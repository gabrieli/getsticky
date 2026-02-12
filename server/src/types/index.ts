/**
 * Core types for GetSticky nodes and context storage
 */

export type NodeType = 'conversation' | 'diagram' | 'terminal' | 'richtext';

export interface Node {
  id: string;
  type: NodeType;
  content: string; // JSON blob of node-specific data
  context: string;  // accumulated context for this node
  parent_id: string | null; // for conversation branching
  created_at: string;
  updated_at: string;
}

export interface Edge {
  id: string;
  source_id: string;
  target_id: string;
  label: string | null;
}

export type ContextSource = 'user' | 'agent' | 'codebase' | 'diagram';

export interface ContextEntry {
  node_id: string;
  context_entry: string;
  source: ContextSource;
  embedding: Buffer | null; // vector embedding for semantic search
  created_at: string;
}

export interface VectorContext {
  nodeId: string;
  text: string;
  vector: number[]; // embedding vector
  source: ContextSource;
  createdAt: Date;
}

/**
 * Node content types (parsed from the content JSON blob)
 */

export interface ConversationContent {
  question: string;
  response: string;
  metadata?: Record<string, unknown>;
}

export interface DiagramContent {
  mermaidSyntax: string;
  metadata?: Record<string, unknown>;
}

export interface RichTextContent {
  tiptapJSON: Record<string, unknown>;
  plainText: string;
}

export interface TerminalContent {
  command: string;
  output: string;
  exitCode: number;
}
