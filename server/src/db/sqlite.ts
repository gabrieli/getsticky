/**
 * SQLite database layer for GetSticky
 * Handles structured node data, edges, and context storage
 */

import Database from 'better-sqlite3';
import { Node, Edge, ContextEntry, NodeType, ContextSource } from '../types';
import path from 'path';
import fs from 'fs';

export class SQLiteDB {
  private db: Database.Database;

  constructor(dbPath: string = './getsticky-data/getsticky.db') {
    // Ensure directory exists
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(dbPath);
    this.initSchema();
  }

  private initSchema(): void {
    // Enable foreign keys
    this.db.pragma('foreign_keys = ON');

    // Create nodes table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS nodes (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        content TEXT NOT NULL,
        context TEXT NOT NULL DEFAULT '',
        parent_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (parent_id) REFERENCES nodes(id) ON DELETE SET NULL
      )
    `);

    // Create edges table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS edges (
        id TEXT PRIMARY KEY,
        source_id TEXT NOT NULL,
        target_id TEXT NOT NULL,
        label TEXT,
        FOREIGN KEY (source_id) REFERENCES nodes(id) ON DELETE CASCADE,
        FOREIGN KEY (target_id) REFERENCES nodes(id) ON DELETE CASCADE
      )
    `);

    // Create context_chain table for context inheritance
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS context_chain (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        node_id TEXT NOT NULL,
        context_entry TEXT NOT NULL,
        source TEXT NOT NULL,
        embedding BLOB,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE
      )
    `);

    // Create indexes for performance
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_nodes_parent ON nodes(parent_id);
      CREATE INDEX IF NOT EXISTS idx_edges_source ON edges(source_id);
      CREATE INDEX IF NOT EXISTS idx_edges_target ON edges(target_id);
      CREATE INDEX IF NOT EXISTS idx_context_node ON context_chain(node_id);
    `);
  }

  /**
   * Node CRUD operations
   */

  createNode(node: Omit<Node, 'created_at' | 'updated_at'>): Node {
    const stmt = this.db.prepare(`
      INSERT INTO nodes (id, type, content, context, parent_id)
      VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(
      node.id,
      node.type,
      node.content,
      node.context || '',
      node.parent_id
    );

    return this.getNode(node.id)!;
  }

  getNode(id: string): Node | null {
    const stmt = this.db.prepare('SELECT * FROM nodes WHERE id = ?');
    return stmt.get(id) as Node | null;
  }

  getAllNodes(): Node[] {
    const stmt = this.db.prepare('SELECT * FROM nodes ORDER BY created_at DESC');
    return stmt.all() as Node[];
  }

  updateNode(id: string, updates: Partial<Omit<Node, 'id' | 'created_at'>>): Node | null {
    const fields: string[] = [];
    const values: unknown[] = [];

    if (updates.content !== undefined) {
      fields.push('content = ?');
      values.push(updates.content);
    }
    if (updates.context !== undefined) {
      fields.push('context = ?');
      values.push(updates.context);
    }
    if (updates.type !== undefined) {
      fields.push('type = ?');
      values.push(updates.type);
    }
    if (updates.parent_id !== undefined) {
      fields.push('parent_id = ?');
      values.push(updates.parent_id);
    }

    if (fields.length === 0) return this.getNode(id);

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    const stmt = this.db.prepare(`
      UPDATE nodes SET ${fields.join(', ')} WHERE id = ?
    `);

    stmt.run(...values);
    return this.getNode(id);
  }

  deleteNode(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM nodes WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  /**
   * Edge CRUD operations
   */

  createEdge(edge: Edge): Edge {
    const stmt = this.db.prepare(`
      INSERT INTO edges (id, source_id, target_id, label)
      VALUES (?, ?, ?, ?)
    `);

    stmt.run(edge.id, edge.source_id, edge.target_id, edge.label);
    return edge;
  }

  getEdge(id: string): Edge | null {
    const stmt = this.db.prepare('SELECT * FROM edges WHERE id = ?');
    return stmt.get(id) as Edge | null;
  }

  getEdgesForNode(nodeId: string): { incoming: Edge[]; outgoing: Edge[] } {
    const incoming = this.db.prepare('SELECT * FROM edges WHERE target_id = ?').all(nodeId) as Edge[];
    const outgoing = this.db.prepare('SELECT * FROM edges WHERE source_id = ?').all(nodeId) as Edge[];

    return { incoming, outgoing };
  }

  getAllEdges(): Edge[] {
    const stmt = this.db.prepare('SELECT * FROM edges');
    return stmt.all() as Edge[];
  }

  deleteEdge(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM edges WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  /**
   * Context chain operations
   */

  addContextEntry(entry: Omit<ContextEntry, 'created_at'>): void {
    const stmt = this.db.prepare(`
      INSERT INTO context_chain (node_id, context_entry, source, embedding)
      VALUES (?, ?, ?, ?)
    `);

    stmt.run(
      entry.node_id,
      entry.context_entry,
      entry.source,
      entry.embedding
    );
  }

  getContextForNode(nodeId: string): ContextEntry[] {
    const stmt = this.db.prepare(`
      SELECT * FROM context_chain
      WHERE node_id = ?
      ORDER BY created_at ASC
    `);
    return stmt.all(nodeId) as ContextEntry[];
  }

  /**
   * Context inheritance: when branching, get parent's context
   */
  getInheritedContext(nodeId: string): string {
    const node = this.getNode(nodeId);
    if (!node || !node.parent_id) {
      return node?.context || '';
    }

    // Recursively build context from parent chain
    const contexts: string[] = [];
    let currentNode: Node | null = node;

    while (currentNode) {
      if (currentNode.context) {
        contexts.unshift(currentNode.context);
      }
      currentNode = currentNode.parent_id ? this.getNode(currentNode.parent_id) : null;
    }

    return contexts.join('\n\n');
  }

  /**
   * Branching: create a child node that inherits parent's context
   */
  branchNode(parentId: string, newNodeData: {
    id: string;
    type: NodeType;
    content: string;
  }): Node | null {
    const parent = this.getNode(parentId);
    if (!parent) return null;

    // Inherit parent's context
    const inheritedContext = this.getInheritedContext(parentId);

    return this.createNode({
      id: newNodeData.id,
      type: newNodeData.type,
      content: newNodeData.content,
      context: inheritedContext,
      parent_id: parentId,
    });
  }

  /**
   * Get all child nodes (for visualization)
   */
  getChildNodes(parentId: string): Node[] {
    const stmt = this.db.prepare('SELECT * FROM nodes WHERE parent_id = ?');
    return stmt.all(parentId) as Node[];
  }

  /**
   * Cleanup and close
   */
  close(): void {
    this.db.close();
  }
}
