/**
 * API Layer for GetSticky Frontend
 *
 * Provides type-safe interface to backend operations via WebSocket
 */

import { getWebSocketClient } from './websocket';
import type { Node, Edge } from '@xyflow/react';

// ============================================================================
// Type Definitions
// ============================================================================

export interface NodeData {
  [key: string]: any;
}

export interface CreateNodeParams {
  type: string;
  position: { x: number; y: number };
  data: NodeData;
  parentId?: string;
}

export interface UpdateNodeParams {
  id: string;
  data?: Partial<NodeData>;
  position?: { x: number; y: number };
}

export interface CreateEdgeParams {
  source: string;
  target: string;
  animated?: boolean;
  style?: Record<string, any>;
}

export interface BranchNodeParams {
  parentId: string;
  question?: string;
  position?: { x: number; y: number };
}

export interface SearchContextParams {
  query: string;
  limit?: number;
}

export interface ContextSearchResult {
  nodeId: string;
  text: string;
  relevance: number;
  source: string;
}

export interface SubmitQuestionParams {
  question: string;
  context?: string[];
  parentId?: string;
}

// ============================================================================
// API Class
// ============================================================================

export class GetStickyAPI {
  private ws;

  constructor(wsUrl?: string) {
    this.ws = getWebSocketClient(wsUrl);
  }

  /**
   * Initialize connection to backend
   */
  async connect(): Promise<void> {
    return this.ws.connect();
  }

  /**
   * Disconnect from backend
   */
  disconnect(): void {
    this.ws.disconnect();
  }

  /**
   * Subscribe to backend events
   */
  on(event: string, handler: (data: any) => void): () => void {
    return this.ws.on(event, handler);
  }

  /**
   * Unsubscribe from backend events
   */
  off(event: string, handler?: (data: any) => void): void {
    this.ws.off(event, handler);
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.ws.isConnected();
  }

  // ==========================================================================
  // Node Operations
  // ==========================================================================

  /**
   * Create a new node
   */
  createNode(params: CreateNodeParams): void {
    this.ws.send('create_node', params);
  }

  /**
   * Update an existing node
   */
  updateNode(params: UpdateNodeParams): void {
    this.ws.send('update_node', params);
  }

  /**
   * Delete a node
   */
  deleteNode(nodeId: string): void {
    this.ws.send('delete_node', { id: nodeId });
  }

  // ==========================================================================
  // Edge Operations
  // ==========================================================================

  /**
   * Create a new edge between nodes
   */
  createEdge(params: CreateEdgeParams): void {
    this.ws.send('create_edge', params);
  }

  /**
   * Delete an edge
   */
  deleteEdge(edgeId: string): void {
    this.ws.send('delete_edge', { id: edgeId });
  }

  // ==========================================================================
  // Conversation Operations
  // ==========================================================================

  /**
   * Branch a conversation from a node
   * Creates a child node with inherited context
   */
  branchNode(params: BranchNodeParams): void {
    this.ws.send('branch_conversation', params);
  }

  /**
   * Submit a question to Claude
   * Creates an AgentNode with the response
   */
  submitQuestion(params: SubmitQuestionParams): void {
    this.ws.send('ask_claude', {
      question: params.question,
      context: params.context?.[0], // Backend expects single context string
      nodeId: params.parentId,
    });
  }

  /**
   * Ask Claude a question (direct method)
   * Backend expects: { question, context?, parent_id? }
   */
  askClaude(question: string, context?: string, parentId?: string): void {
    this.ws.send('ask_claude', {
      question,
      context,
      parent_id: parentId,
    });
  }

  /**
   * Regenerate a response
   * Re-queries Claude with the same question
   */
  regenerateResponse(nodeId: string): void {
    this.ws.send('regenerate_response', { nodeId });
  }

  /**
   * Edit a node's content
   */
  editNode(nodeId: string, newContent: any): void {
    this.ws.send('edit_node', { nodeId, content: newContent });
  }

  // ==========================================================================
  // Context Operations
  // ==========================================================================

  /**
   * Search context using semantic search (LanceDB)
   */
  async searchContext(params: SearchContextParams): Promise<ContextSearchResult[]> {
    return new Promise((resolve) => {
      const unsubscribe = this.ws.on('context_search_results', (data) => {
        unsubscribe();
        resolve(data.results || []);
      });

      this.ws.send('search_context', params);
    });
  }

  /**
   * Add context to a node
   */
  addContext(nodeId: string, context: string, source: string = 'user'): void {
    this.ws.send('add_context', { nodeId, context, source });
  }

  /**
   * Get context for a node (including inherited context)
   */
  async getNodeContext(nodeId: string): Promise<string[]> {
    return new Promise((resolve) => {
      const unsubscribe = this.ws.on('node_context', (data) => {
        if (data.nodeId === nodeId) {
          unsubscribe();
          resolve(data.context || []);
        }
      });

      this.ws.send('get_node_context', { nodeId });
    });
  }

  // ==========================================================================
  // State Operations
  // ==========================================================================

  /**
   * Request initial state from backend
   */
  requestInitialState(): void {
    this.ws.send('get_initial_state', {});
  }

  /**
   * Save current canvas state
   */
  saveState(nodes: Node[], edges: Edge[]): void {
    this.ws.send('save_state', { nodes, edges });
  }

  // ==========================================================================
  // Terminal Operations
  // ==========================================================================

  /**
   * Connect a terminal node to WebSocket stream
   */
  connectTerminal(nodeId: string): void {
    this.ws.send('connect_terminal', { nodeId });
  }

  /**
   * Send input to terminal
   */
  sendTerminalInput(nodeId: string, input: string): void {
    this.ws.send('terminal_input', { nodeId, input });
  }

  // ==========================================================================
  // Diagram Operations
  // ==========================================================================

  /**
   * Ask a question about a diagram
   * Creates a new conversation with diagram context
   */
  askAboutDiagram(diagramNodeId: string, question?: string): void {
    this.ws.send('ask_about_diagram', { diagramNodeId, question });
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let apiInstance: GetStickyAPI | null = null;

/**
 * Get or create API instance
 */
export function getAPI(wsUrl?: string): GetStickyAPI {
  if (!apiInstance) {
    apiInstance = new GetStickyAPI(wsUrl);
  }
  return apiInstance;
}

/**
 * Destroy API instance
 */
export function destroyAPI(): void {
  if (apiInstance) {
    apiInstance.disconnect();
    apiInstance = null;
  }
}
