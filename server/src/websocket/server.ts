/**
 * WebSocket server for real-time communication with the frontend
 * Allows the React Flow canvas to sync with the database in real-time
 */

import { WebSocketServer, WebSocket } from 'ws';
import { DatabaseManager } from '../db/index';
import { v4 as uuidv4 } from 'uuid';
import Anthropic from '@anthropic-ai/sdk';

export interface WSMessage {
  type: 'create_node' | 'update_node' | 'delete_node' | 'create_edge' | 'delete_edge' | 'add_context' | 'search_context' | 'ask_claude' | 'subscribe' | 'unsubscribe';
  data: any;
  id?: string;
}

export interface WSResponse {
  type: 'success' | 'error' | 'node_created' | 'node_updated' | 'node_deleted' | 'edge_created' | 'edge_deleted' | 'context_added' | 'search_results' | 'claude_response' | 'claude_streaming';
  data?: any;
  error?: string;
  requestId?: string;
}

export class GetStickyWSServer {
  private wss: WebSocketServer;
  private db: DatabaseManager;
  private clients: Set<WebSocket> = new Set();
  private anthropic: Anthropic | null = null;

  constructor(port: number, db: DatabaseManager, anthropicApiKey?: string) {
    this.db = db;
    this.wss = new WebSocketServer({ port });

    // Initialize Anthropic client if API key is provided
    if (anthropicApiKey) {
      this.anthropic = new Anthropic({ apiKey: anthropicApiKey });
    }

    this.setupServer();
  }

  private setupServer(): void {
    this.wss.on('connection', (ws: WebSocket) => {
      console.log('Client connected');
      this.clients.add(ws);

      ws.on('message', async (data: string) => {
        try {
          const message: WSMessage = JSON.parse(data.toString());
          await this.handleMessage(ws, message);
        } catch (error: any) {
          this.sendError(ws, error.message);
        }
      });

      ws.on('close', () => {
        console.log('Client disconnected');
        this.clients.delete(ws);
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        this.clients.delete(ws);
      });

      // Send initial state
      this.sendInitialState(ws);
    });

    console.log(`WebSocket server running on port ${this.wss.options.port}`);
  }

  private async sendInitialState(ws: WebSocket): Promise<void> {
    const graph = this.db.exportGraph();
    this.send(ws, {
      type: 'success',
      data: {
        type: 'initial_state',
        nodes: graph.nodes,
        edges: graph.edges,
      },
    });
  }

  private async handleMessage(ws: WebSocket, message: WSMessage): Promise<void> {
    const requestId = message.id;

    try {
      switch (message.type) {
        case 'create_node': {
          const { type, content, context, parent_id } = message.data;
          const node = await this.db.createNode({
            id: uuidv4(),
            type,
            content: JSON.stringify(content),
            context: context || '',
            parent_id: parent_id || null,
          });

          // Broadcast to all clients
          this.broadcast({
            type: 'node_created',
            data: node,
            requestId,
          });
          break;
        }

        case 'update_node': {
          const { id, content, context } = message.data;
          const updates: any = {};

          if (content) updates.content = JSON.stringify(content);
          if (context) updates.context = context;

          const node = await this.db.updateNode(id, updates);

          if (!node) {
            this.sendError(ws, `Node not found: ${id}`, requestId);
            return;
          }

          this.broadcast({
            type: 'node_updated',
            data: node,
            requestId,
          });
          break;
        }

        case 'delete_node': {
          const { id } = message.data;
          const success = await this.db.deleteNode(id);

          if (!success) {
            this.sendError(ws, `Node not found: ${id}`, requestId);
            return;
          }

          this.broadcast({
            type: 'node_deleted',
            data: { id },
            requestId,
          });
          break;
        }

        case 'create_edge': {
          const { source_id, target_id, label } = message.data;
          const edge = this.db.createEdge({
            id: uuidv4(),
            source_id,
            target_id,
            label: label || null,
          });

          this.broadcast({
            type: 'edge_created',
            data: edge,
            requestId,
          });
          break;
        }

        case 'delete_edge': {
          const { id } = message.data;
          const success = this.db.deleteEdge(id);

          if (!success) {
            this.sendError(ws, `Edge not found: ${id}`, requestId);
            return;
          }

          this.broadcast({
            type: 'edge_deleted',
            data: { id },
            requestId,
          });
          break;
        }

        case 'add_context': {
          const { node_id, text, source } = message.data;
          await this.db.addContext(node_id, text, source);

          this.broadcast({
            type: 'context_added',
            data: { node_id, text, source },
            requestId,
          });
          break;
        }

        case 'search_context': {
          const { query, limit = 5 } = message.data;
          const results = await this.db.searchContext(query, limit);

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

  private broadcast(response: WSResponse): void {
    const message = JSON.stringify(response);
    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  private sendError(ws: WebSocket, error: string, requestId?: string): void {
    this.send(ws, {
      type: 'error',
      error,
      requestId,
    });
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

    const { question, parent_id, context, node_position, stream = false } = data;

    try {
      // Get inherited context if parent_id is provided
      let fullContext = context || '';
      if (parent_id) {
        const inheritedContext = this.db.getInheritedContext(parent_id);
        fullContext = inheritedContext ? `${inheritedContext}\n\n${context || ''}` : context || '';
      }

      // Build system message with context
      const systemMessage = fullContext
        ? `You are a helpful AI assistant. Here is the conversation context:\n\n${fullContext}`
        : 'You are a helpful AI assistant.';

      if (stream) {
        // Streaming response
        const stream = await this.anthropic.messages.stream({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4096,
          system: systemMessage,
          messages: [{ role: 'user', content: question }],
        });

        let fullResponse = '';

        stream.on('text', (text) => {
          fullResponse += text;
          // Send streaming chunks to client
          this.send(ws, {
            type: 'claude_streaming',
            data: { chunk: text, complete: false },
            requestId,
          });
        });

        await stream.finalMessage();

        // Create AgentNode with full response
        const agentNode = await this.db.createNode({
          id: uuidv4(),
          type: 'conversation',
          content: JSON.stringify({
            question,
            response: fullResponse,
            position: node_position,
          }),
          context: fullResponse,
          parent_id: parent_id || null,
        });

        // Create edge from parent to agent node if parent exists
        if (parent_id) {
          const edge = this.db.createEdge({
            id: uuidv4(),
            source_id: parent_id,
            target_id: agentNode.id,
            label: 'response',
          });

          this.broadcast({
            type: 'edge_created',
            data: edge,
            requestId,
          });
        }

        // Broadcast the completed node
        this.broadcast({
          type: 'claude_response',
          data: {
            node: agentNode,
            complete: true,
          },
          requestId,
        });
      } else {
        // Non-streaming response
        const message = await this.anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4096,
          system: systemMessage,
          messages: [{ role: 'user', content: question }],
        });

        const response = message.content[0].type === 'text' ? message.content[0].text : '';

        // Create AgentNode with response
        const agentNode = await this.db.createNode({
          id: uuidv4(),
          type: 'conversation',
          content: JSON.stringify({
            question,
            response,
            position: node_position,
          }),
          context: response,
          parent_id: parent_id || null,
        });

        // Create edge from parent to agent node if parent exists
        if (parent_id) {
          const edge = this.db.createEdge({
            id: uuidv4(),
            source_id: parent_id,
            target_id: agentNode.id,
            label: 'response',
          });

          this.broadcast({
            type: 'edge_created',
            data: edge,
            requestId,
          });
        }

        // Broadcast the node creation
        this.broadcast({
          type: 'claude_response',
          data: {
            node: agentNode,
            complete: true,
          },
          requestId,
        });
      }
    } catch (error: any) {
      console.error('Claude API error:', error);
      this.sendError(ws, `Claude API error: ${error.message}`, requestId);
    }
  }

  close(): void {
    this.clients.forEach((client) => client.close());
    this.wss.close();
  }
}
