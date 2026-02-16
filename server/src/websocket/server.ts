/**
 * WebSocket server for real-time communication with the frontend
 * Allows the React Flow canvas to sync with the database in real-time
 *
 * Also exposes an HTTP endpoint (POST /notify) so that external
 * processes (e.g. the MCP server) can push mutation events that
 * get broadcast to connected frontends.
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { DatabaseManager } from '../db/index';
import { v4 as uuidv4 } from 'uuid';
import Anthropic from '@anthropic-ai/sdk';
import { maskApiKey } from '../utils';
import type { NotificationPayload } from '../notifications/types';

const VALID_WS_TYPES = new Set([
  'create_node', 'update_node', 'delete_node',
  'create_edge', 'update_edge', 'delete_edge',
  'add_context', 'search_context',
  'ask_claude', 'comment_ask_claude',
  'get_settings', 'update_settings',
  'create_board', 'delete_board', 'list_boards',
  'list_projects', 'create_project', 'delete_project', 'get_project_boards',
  'update_viewport',
]);

export interface WSMessage {
  type: 'create_node' | 'update_node' | 'delete_node' | 'create_edge' | 'update_edge' | 'delete_edge' | 'add_context' | 'search_context' | 'ask_claude' | 'comment_ask_claude' | 'get_settings' | 'update_settings' | 'create_board' | 'delete_board' | 'list_boards' | 'list_projects' | 'create_project' | 'delete_project' | 'get_project_boards' | 'update_viewport';
  data: any;
  id?: string;
}

export interface WSResponse {
  type: 'success' | 'error' | 'node_created' | 'node_updated' | 'node_deleted' | 'edge_created' | 'edge_updated' | 'edge_deleted' | 'context_added' | 'search_results' | 'claude_response' | 'claude_streaming' | 'comment_claude_response' | 'settings' | 'board_created' | 'board_deleted' | 'boards_list' | 'projects_list' | 'project_created' | 'project_deleted' | 'project_boards';
  data?: any;
  error?: string;
  requestId?: string;
}

/** Strip HTML tags and limit length for safe display */
function sanitizeDisplayName(input: string): string {
  return input.replace(/<[^>]*>/g, '').trim().slice(0, 50);
}

/** Get all settings with the API key masked */
function getMaskedSettings(db: DatabaseManager): Record<string, string> {
  const settings = db.getAllSettings();
  if (settings.anthropic_api_key) {
    settings.anthropic_api_key = maskApiKey(settings.anthropic_api_key);
  }
  return settings;
}

export class GetStickyWSServer {
  private httpServer: http.Server;
  private wss: WebSocketServer;
  private db: DatabaseManager;
  private boardClients: Map<string, Set<WebSocket>> = new Map();
  private clientBoard: Map<WebSocket, string> = new Map();
  private anthropic: Anthropic | null = null;
  private staticDir: string | null;

  private static MIME_TYPES: Record<string, string> = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.eot': 'application/vnd.ms-fontobject',
    '.map': 'application/json',
  };

  constructor(port: number, db: DatabaseManager, anthropicApiKey?: string, staticDir?: string) {
    this.db = db;
    this.staticDir = staticDir || null;

    // Create HTTP server that handles REST endpoints and upgrades to WS
    this.httpServer = http.createServer((req, res) => {
      this.handleHttpRequest(req, res);
    });

    this.wss = new WebSocketServer({ server: this.httpServer });

    // Try to load API key: DB first, then env fallback
    const dbApiKey = this.db.getSetting('anthropic_api_key');
    const apiKey = dbApiKey || anthropicApiKey;
    if (apiKey) {
      this.anthropic = new Anthropic({ apiKey });
    }

    this.setupServer();
    this.httpServer.listen(port, () => {
      console.log(`WebSocket + HTTP server running on port ${port}`);
    });
  }

  /**
   * Handle incoming HTTP requests (POST /notify, GET /health).
   * Everything else returns 404.
   */
  private handleHttpRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
      return;
    }

    if (req.method === 'POST' && req.url === '/notify') {
      let body = '';
      req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
      req.on('end', () => {
        try {
          const payload: NotificationPayload = JSON.parse(body);
          if (!payload.event || !payload.boardId) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Missing event or boardId' }));
            return;
          }
          this.broadcastToBoard(
            { type: payload.event as WSResponse['type'], data: payload.data },
            payload.boardId,
          );
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true }));
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid JSON' }));
        }
      });
      return;
    }

    // CORS headers for dev mode (frontend on different port)
    const origin = req.headers.origin;
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    }
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // API: GET /api/projects — list all projects with their boards
    if (req.method === 'GET' && req.url?.startsWith('/api/projects')) {
      const projects = this.db.getAllProjects();
      const result = projects.map((p) => ({
        ...p,
        boards: this.db.getBoardsForProject(p.id),
      }));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
      return;
    }

    // API: GET /api/resolve?project=X&board=Y — resolve URL slugs to board ID
    if (req.method === 'GET' && req.url?.startsWith('/api/resolve')) {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const projectSlug = url.searchParams.get('project') || 'default';
      const boardSlug = url.searchParams.get('board') || 'main';

      // Auto-create project and board if they don't exist
      this.db.getOrCreateProject(projectSlug, projectSlug);
      const board = this.db.getOrCreateBoard(projectSlug, boardSlug, boardSlug);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ boardId: board.id, projectId: projectSlug, boardSlug: board.slug }));
      return;
    }

    // API: DELETE /api/boards/:id — delete a board
    if (req.method === 'DELETE' && req.url?.startsWith('/api/boards/')) {
      const boardId = decodeURIComponent(req.url.replace('/api/boards/', ''));
      if (!boardId) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Board ID required' }));
        return;
      }
      this.db.deleteBoard(boardId).then((success) => {
        if (success) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ deleted: true, id: boardId }));
        } else {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: `Board not found: ${boardId}` }));
        }
      }).catch((err) => {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      });
      return;
    }

    // Serve static files if configured
    if (this.staticDir && req.method === 'GET') {
      const urlPath = req.url?.split('?')[0] || '/';
      // Prevent directory traversal
      const safePath = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, '');
      let filePath = path.join(this.staticDir, safePath);

      // Check if file exists; if not and it looks like a SPA route, serve index.html
      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        const ext = path.extname(safePath);
        if (!ext) {
          // SPA fallback: serve index.html for routes without file extensions
          filePath = path.join(this.staticDir, 'index.html');
        } else {
          res.writeHead(404);
          res.end();
          return;
        }
      }

      try {
        const data = fs.readFileSync(filePath);
        const ext = path.extname(filePath);
        const contentType = GetStickyWSServer.MIME_TYPES[ext] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
      } catch {
        res.writeHead(500);
        res.end();
      }
      return;
    }

    res.writeHead(404);
    res.end();
  }

  private getBoardId(ws: WebSocket): string {
    return this.clientBoard.get(ws) || 'default';
  }

  private addClientToBoard(ws: WebSocket, boardId: string): void {
    this.clientBoard.set(ws, boardId);
    if (!this.boardClients.has(boardId)) {
      this.boardClients.set(boardId, new Set());
    }
    this.boardClients.get(boardId)!.add(ws);
  }

  private removeClient(ws: WebSocket): void {
    const boardId = this.clientBoard.get(ws);
    if (boardId) {
      const clients = this.boardClients.get(boardId);
      if (clients) {
        clients.delete(ws);
        if (clients.size === 0) {
          this.boardClients.delete(boardId);
        }
      }
    }
    this.clientBoard.delete(ws);
  }

  private setupServer(): void {
    this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      const url = new URL(req.url || '', `http://${req.headers.host}`);
      const boardId = url.searchParams.get('board') || 'default';

      console.log(`Client connected to board: ${boardId}`);
      this.addClientToBoard(ws, boardId);

      ws.on('message', async (data: string) => {
        try {
          const parsed = JSON.parse(data.toString());

          // Validate message shape
          if (!parsed || typeof parsed.type !== 'string') {
            this.sendError(ws, 'Invalid message: missing "type" field');
            return;
          }
          if (!VALID_WS_TYPES.has(parsed.type)) {
            this.sendError(ws, `Unknown message type: ${parsed.type}`, parsed.id);
            return;
          }
          if (parsed.data !== undefined && typeof parsed.data !== 'object') {
            this.sendError(ws, 'Invalid message: "data" must be an object', parsed.id);
            return;
          }

          const message: WSMessage = parsed;
          await this.handleMessage(ws, message);
        } catch (error: any) {
          this.sendError(ws, error.message);
        }
      });

      ws.on('close', () => {
        console.log(`Client disconnected from board: ${boardId}`);
        this.removeClient(ws);
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        this.removeClient(ws);
      });

      // Send initial state for this board
      this.sendInitialState(ws);
    });
  }

  private async sendInitialState(ws: WebSocket): Promise<void> {
    const boardId = this.getBoardId(ws);
    const graph = this.db.exportGraph(boardId);
    const viewport = this.db.getBoardViewport(boardId);
    this.send(ws, {
      type: 'success',
      data: {
        type: 'initial_state',
        nodes: graph.nodes,
        edges: graph.edges,
        viewport,
      },
    });
  }

  private async handleMessage(ws: WebSocket, message: WSMessage): Promise<void> {
    const requestId = message.id;

    const boardId = this.getBoardId(ws);

    try {
      switch (message.type) {
        case 'create_board': {
          const { name, id } = message.data;
          if (!name) {
            this.sendError(ws, 'Board name is required', requestId);
            return;
          }
          const slugFromName = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
          const board = this.db.createBoard(id || slugFromName || uuidv4(), name, 'default', slugFromName || undefined);
          this.send(ws, {
            type: 'board_created',
            data: board,
            requestId,
          });
          break;
        }

        case 'delete_board': {
          const { id } = message.data;
          if (!id) {
            this.sendError(ws, 'Board ID is required', requestId);
            return;
          }
          const success = await this.db.deleteBoard(id);
          if (!success) {
            this.sendError(ws, `Board not found: ${id}`, requestId);
            return;
          }
          this.send(ws, {
            type: 'board_deleted',
            data: { id },
            requestId,
          });
          break;
        }

        case 'list_boards': {
          const boards = this.db.getAllBoards();
          this.send(ws, {
            type: 'boards_list',
            data: boards,
            requestId,
          });
          break;
        }

        case 'list_projects': {
          const projects = this.db.getAllProjects();
          this.send(ws, {
            type: 'projects_list',
            data: projects,
            requestId,
          });
          break;
        }

        case 'create_project': {
          const { id: projId, name: projName } = message.data;
          if (!projName && !projId) {
            this.sendError(ws, 'Project name or id is required', requestId);
            return;
          }
          const projectId = projId || projName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
          const project = this.db.getOrCreateProject(projectId, projName || projectId);
          // Also create a default "main" board for the project
          this.db.getOrCreateBoard(projectId, 'main', 'Main');
          this.send(ws, {
            type: 'project_created',
            data: project,
            requestId,
          });
          break;
        }

        case 'delete_project': {
          const { id: delProjId } = message.data;
          if (!delProjId) {
            this.sendError(ws, 'Project ID is required', requestId);
            return;
          }
          const projSuccess = await this.db.deleteProject(delProjId);
          if (!projSuccess) {
            this.sendError(ws, `Project not found: ${delProjId}`, requestId);
            return;
          }
          this.send(ws, {
            type: 'project_deleted',
            data: { id: delProjId },
            requestId,
          });
          break;
        }

        case 'get_project_boards': {
          const { project_id: getBoardsProjId } = message.data;
          if (!getBoardsProjId) {
            this.sendError(ws, 'project_id is required', requestId);
            return;
          }
          const projectBoards = this.db.getBoardsForProject(getBoardsProjId);
          this.send(ws, {
            type: 'project_boards',
            data: projectBoards,
            requestId,
          });
          break;
        }

        case 'create_node': {
          const { type, content, data: nodeData, context, parent_id, parentId, position } = message.data;
          // Support both MCP format (content) and frontend format (data + position)
          let nodeContent = content || nodeData || {};
          if (position && typeof nodeContent === 'object') {
            nodeContent = { ...nodeContent, position };
          }
          const node = await this.db.createNode({
            id: uuidv4(),
            type,
            content: JSON.stringify(nodeContent),
            context: context || '',
            parent_id: parent_id || parentId || null,
            board_id: boardId,
          });

          // Broadcast to clients on the same board
          this.broadcastToBoard({
            type: 'node_created',
            data: node,
            requestId,
          }, boardId);
          break;
        }

        case 'update_node': {
          const { id, content, data: partialData, context, position, parent_id, parentId } = message.data;
          const updates: any = {};

          if (content) {
            // Full content replacement
            updates.content = JSON.stringify(content);
          } else if (partialData || position) {
            // Partial update: merge into existing content
            const existing = this.db.getNode(id);
            if (existing) {
              const existingContent = JSON.parse(existing.content);
              const merged = { ...existingContent, ...partialData };
              if (position) merged.position = position;
              updates.content = JSON.stringify(merged);
            }
          }
          if (context) updates.context = context;

          // Handle parent_id changes (for list node drag in/out)
          const newParentId = parent_id !== undefined ? parent_id : parentId;
          if (newParentId !== undefined) updates.parent_id = newParentId;

          const node = await this.db.updateNode(id, updates);

          if (!node) {
            this.sendError(ws, `Node not found: ${id}`, requestId);
            return;
          }

          this.broadcastToBoard({
            type: 'node_updated',
            data: node,
            requestId,
          }, boardId);
          break;
        }

        case 'delete_node': {
          const { id } = message.data;
          const success = await this.db.deleteNode(id);

          if (!success) {
            this.sendError(ws, `Node not found: ${id}`, requestId);
            return;
          }

          this.broadcastToBoard({
            type: 'node_deleted',
            data: { id },
            requestId,
          }, boardId);
          break;
        }

        case 'create_edge': {
          const { source_id, target_id, source, target, label } = message.data;
          const edge = this.db.createEdge({
            id: uuidv4(),
            source_id: source_id || source,
            target_id: target_id || target,
            label: label || null,
          });

          this.broadcastToBoard({
            type: 'edge_created',
            data: edge,
            requestId,
          }, boardId);
          break;
        }

        case 'update_edge': {
          const { id, label } = message.data;
          const updatedEdge = this.db.updateEdge(id, label ?? '');

          if (!updatedEdge) {
            this.sendError(ws, `Edge not found: ${id}`, requestId);
            return;
          }

          this.broadcastToBoard({
            type: 'edge_updated',
            data: updatedEdge,
            requestId,
          }, boardId);
          break;
        }

        case 'delete_edge': {
          const { id } = message.data;
          const success = this.db.deleteEdge(id);

          if (!success) {
            this.sendError(ws, `Edge not found: ${id}`, requestId);
            return;
          }

          this.broadcastToBoard({
            type: 'edge_deleted',
            data: { id },
            requestId,
          }, boardId);
          break;
        }

        case 'add_context': {
          const { node_id, text, source } = message.data;
          await this.db.addContext(node_id, text, source);

          this.broadcastToBoard({
            type: 'context_added',
            data: { node_id, text, source },
            requestId,
          }, boardId);
          break;
        }

        case 'search_context': {
          const { query, limit = 5 } = message.data;
          const results = await this.db.searchContext(query, limit, boardId);

          this.send(ws, {
            type: 'search_results',
            data: results,
            requestId,
          });
          break;
        }

        case 'ask_claude': {
          await this.handleClaudeQuery(ws, message.data, requestId);
          break;
        }

        case 'comment_ask_claude': {
          await this.handleCommentClaudeQuery(ws, message.data, requestId);
          break;
        }

        case 'update_viewport': {
          const { x, y, zoom } = message.data;
          if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(zoom)) {
            this.sendError(ws, 'Viewport requires numeric x, y, and zoom values', requestId);
            return;
          }
          this.db.updateBoardViewport(boardId, x, y, zoom);
          this.send(ws, { type: 'success', requestId });
          break;
        }

        case 'get_settings': {
          this.send(ws, {
            type: 'settings',
            data: getMaskedSettings(this.db),
            requestId,
          });
          break;
        }

        case 'update_settings': {
          const { agentName, apiKey } = message.data;

          if (agentName !== undefined) {
            const sanitized = sanitizeDisplayName(agentName);
            if (sanitized.length === 0) {
              this.sendError(ws, 'Agent name cannot be empty', requestId);
              return;
            }
            this.db.setSetting('agent_name', sanitized);
          }

          if (apiKey !== undefined && apiKey !== '') {
            // Basic format validation
            if (!apiKey.startsWith('sk-') || apiKey.length < 20) {
              this.sendError(ws, 'Invalid API key format. Key should start with "sk-" and be at least 20 characters.', requestId);
              return;
            }
            this.db.setSetting('anthropic_api_key', apiKey);
            this.anthropic = new Anthropic({ apiKey });
            console.log('Anthropic client reinitialized with new API key');
          }

          this.broadcastToAll({
            type: 'settings',
            data: getMaskedSettings(this.db),
            requestId,
          });
          break;
        }

        default:
          this.sendError(ws, `Unknown message type: ${message.type}`, requestId);
      }
    } catch (error: any) {
      this.sendError(ws, error.message, requestId);
    }
  }

  private send(ws: WebSocket, response: WSResponse): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(response));
    }
  }

  private broadcastToBoard(response: WSResponse, boardId: string): void {
    const message = JSON.stringify(response);
    const clients = this.boardClients.get(boardId);
    if (clients) {
      clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
      });
    }
  }

  private broadcastToAll(response: WSResponse): void {
    const message = JSON.stringify(response);
    for (const clients of this.boardClients.values()) {
      clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(message);
        }
      });
    }
  }

  private sendError(ws: WebSocket, error: string, requestId?: string): void {
    this.send(ws, {
      type: 'error',
      error,
      requestId,
    });
  }

  /**
   * Create an AgentNode from a Claude response, optionally link to parent, and broadcast.
   */
  private async createAndBroadcastAgentNode(
    question: string,
    response: string,
    parent_id: string | undefined,
    node_position: { x: number; y: number } | undefined,
    boardId: string,
    requestId?: string,
  ): Promise<void> {
    const agentNode = await this.db.createNode({
      id: uuidv4(),
      type: 'conversation',
      content: JSON.stringify({ question, response, position: node_position }),
      context: response,
      parent_id: parent_id || null,
      board_id: boardId,
    });

    if (parent_id) {
      const edge = this.db.createEdge({
        id: uuidv4(),
        source_id: parent_id,
        target_id: agentNode.id,
        label: 'response',
      });
      this.broadcastToBoard({ type: 'edge_created', data: edge, requestId }, boardId);
    }

    const agentName = this.db.getSetting('agent_name') || 'Claude';
    this.broadcastToBoard({
      type: 'claude_response',
      data: { node: agentNode, complete: true, agentName },
      requestId,
    }, boardId);
  }

  /**
   * Handle Claude query: send question to Claude API, create AgentNode with response
   */
  private async handleClaudeQuery(
    ws: WebSocket,
    data: {
      question: string;
      parent_id?: string;
      context?: string;
      node_position?: { x: number; y: number };
      stream?: boolean;
    },
    requestId?: string
  ): Promise<void> {
    if (!this.anthropic) {
      this.sendError(ws, 'Claude API not configured. Set ANTHROPIC_API_KEY in environment.', requestId);
      return;
    }

    const { question, parent_id, context, node_position, stream: useStream = false } = data;

    try {
      // Get inherited context if parent_id is provided
      let fullContext = context || '';
      if (parent_id) {
        const inheritedContext = this.db.getInheritedContext(parent_id);
        fullContext = inheritedContext ? `${inheritedContext}\n\n${context || ''}` : context || '';
      }

      const systemMessage = fullContext
        ? `You are a helpful AI assistant. Here is the conversation context:\n\n${fullContext}`
        : 'You are a helpful AI assistant.';

      if (useStream) {
        const stream = await this.anthropic.messages.stream({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4096,
          system: systemMessage,
          messages: [{ role: 'user', content: question }],
        });

        let fullResponse = '';
        stream.on('text', (text) => {
          fullResponse += text;
          this.send(ws, {
            type: 'claude_streaming',
            data: { chunk: text, complete: false },
            requestId,
          });
        });

        await stream.finalMessage();
        const streamBoardId = this.getBoardId(ws);
        await this.createAndBroadcastAgentNode(question, fullResponse, parent_id, node_position, streamBoardId, requestId);
      } else {
        const message = await this.anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4096,
          system: systemMessage,
          messages: [{ role: 'user', content: question }],
        });

        const response = message.content[0].type === 'text' ? message.content[0].text : '';
        const nonStreamBoardId = this.getBoardId(ws);
        await this.createAndBroadcastAgentNode(question, response, parent_id, node_position, nonStreamBoardId, requestId);
      }
    } catch (error: any) {
      console.error('Claude API error:', error);
      this.sendError(ws, `Claude API error: ${error.message}`, requestId);
    }
  }

  /**
   * Handle Claude query scoped to a comment thread in a review node
   */
  private async handleCommentClaudeQuery(
    ws: WebSocket,
    data: {
      node_id: string;
      thread_id: string;
      selected_text: string;
      messages: { author: string; text: string }[];
    },
    requestId?: string
  ): Promise<void> {
    if (!this.anthropic) {
      this.sendError(ws, 'Claude API not configured. Set ANTHROPIC_API_KEY in environment.', requestId);
      return;
    }

    const { node_id, thread_id, selected_text, messages } = data;

    try {
      // Load the review node's context
      const node = this.db.getNode(node_id);
      const reviewContext = node?.context || '';

      // Build conversation messages for Claude
      const systemMessage = `You are reviewing code/text with a user. Here is the full review context:\n\n${reviewContext}\n\nThe user has highlighted the following text and is discussing it with you:\n\n"${selected_text}"`;

      const conversationMessages = messages.map((msg) => ({
        role: msg.author === 'user' ? 'user' as const : 'assistant' as const,
        content: msg.text,
      }));

      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        system: systemMessage,
        messages: conversationMessages,
      });

      const responseText = response.content[0].type === 'text' ? response.content[0].text : '';

      const commentAgentName = this.db.getSetting('agent_name') || 'Claude';
      this.send(ws, {
        type: 'comment_claude_response',
        data: {
          node_id,
          thread_id,
          agentName: commentAgentName,
          message: {
            id: `msg-${Date.now()}`,
            author: 'claude',
            text: responseText,
            createdAt: new Date().toISOString(),
          },
        },
        requestId,
      });
    } catch (error: any) {
      console.error('Comment Claude API error:', error);
      this.sendError(ws, `Claude API error: ${error.message}`, requestId);
    }
  }

  close(): void {
    for (const clients of this.boardClients.values()) {
      clients.forEach((client) => client.close());
    }
    this.boardClients.clear();
    this.clientBoard.clear();
    this.wss.close();
    this.httpServer.close();
  }
}
