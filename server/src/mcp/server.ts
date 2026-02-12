#!/usr/bin/env node

/**
 * GetSticky MCP Server
 * Provides Model Context Protocol tools for Claude Code to interact with the node graph
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { initDB } from '../db/index.js';
import type { DatabaseManager } from '../db/index.js';
import { v4 as uuidv4 } from 'uuid';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Database instance
let db: DatabaseManager;

// Define MCP tools
const tools: Tool[] = [
  {
    name: 'create_node',
    description: 'Create a new node on the canvas (conversation, diagram, richtext, or terminal)',
    inputSchema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['conversation', 'diagram', 'richtext', 'terminal'],
          description: 'Type of node to create',
        },
        content: {
          type: 'object',
          description: 'Node content (varies by type)',
        },
        context: {
          type: 'string',
          description: 'Context information for this node',
        },
        parent_id: {
          type: 'string',
          description: 'Parent node ID (for branching conversations)',
        },
      },
      required: ['type', 'content'],
    },
  },
  {
    name: 'get_node',
    description: 'Get a specific node by ID',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Node ID',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'update_node',
    description: 'Update an existing node',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Node ID to update',
        },
        content: {
          type: 'object',
          description: 'Updated content',
        },
        context: {
          type: 'string',
          description: 'Updated context',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'delete_node',
    description: 'Delete a node from the canvas',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Node ID to delete',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'create_edge',
    description: 'Create a connection between two nodes',
    inputSchema: {
      type: 'object',
      properties: {
        source_id: {
          type: 'string',
          description: 'Source node ID',
        },
        target_id: {
          type: 'string',
          description: 'Target node ID',
        },
        label: {
          type: 'string',
          description: 'Optional label for the edge',
        },
      },
      required: ['source_id', 'target_id'],
    },
  },
  {
    name: 'branch_conversation',
    description: 'Create a new conversation branch from an existing node (inherits context)',
    inputSchema: {
      type: 'object',
      properties: {
        parent_id: {
          type: 'string',
          description: 'Parent node ID to branch from',
        },
        type: {
          type: 'string',
          enum: ['conversation', 'diagram', 'richtext', 'terminal'],
          description: 'Type of the new branch node',
        },
        content: {
          type: 'object',
          description: 'Content for the new branch',
        },
      },
      required: ['parent_id', 'type', 'content'],
    },
  },
  {
    name: 'add_context',
    description: 'Add context information to a node',
    inputSchema: {
      type: 'object',
      properties: {
        node_id: {
          type: 'string',
          description: 'Node ID',
        },
        text: {
          type: 'string',
          description: 'Context text to add',
        },
        source: {
          type: 'string',
          enum: ['user', 'agent', 'codebase', 'diagram'],
          description: 'Source of the context',
        },
      },
      required: ['node_id', 'text', 'source'],
    },
  },
  {
    name: 'get_context',
    description: 'Get context for a specific node (including inherited context)',
    inputSchema: {
      type: 'object',
      properties: {
        node_id: {
          type: 'string',
          description: 'Node ID',
        },
        include_inherited: {
          type: 'boolean',
          description: 'Include inherited context from parent nodes',
          default: true,
        },
      },
      required: ['node_id'],
    },
  },
  {
    name: 'search_context',
    description: 'Semantic search across all node contexts',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results',
          default: 5,
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_conversation_path',
    description: 'Get the full conversation path from root to a specific node',
    inputSchema: {
      type: 'object',
      properties: {
        node_id: {
          type: 'string',
          description: 'Node ID',
        },
      },
      required: ['node_id'],
    },
  },
  {
    name: 'get_all_nodes',
    description: 'Get all nodes on the canvas',
    inputSchema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['conversation', 'diagram', 'richtext', 'terminal'],
          description: 'Filter by node type (optional)',
        },
      },
    },
  },
  {
    name: 'export_graph',
    description: 'Export the entire graph (nodes and edges) for visualization',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_stats',
    description: 'Get database statistics (node counts, context stats, etc.)',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];

// Create MCP server
const server = new Server(
  {
    name: 'getsticky-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'create_node': {
        const { type, content, context, parent_id } = args as any;
        const node = await db.createNode({
          id: uuidv4(),
          type,
          content: JSON.stringify(content),
          context: context || '',
          parent_id: parent_id || null,
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(node, null, 2),
            },
          ],
        };
      }

      case 'get_node': {
        const { id } = args as any;
        const node = db.getNode(id);

        if (!node) {
          return {
            content: [
              {
                type: 'text',
                text: `Node not found: ${id}`,
              },
            ],
            isError: true,
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(node, null, 2),
            },
          ],
        };
      }

      case 'update_node': {
        const { id, content, context } = args as any;
        const updates: any = {};

        if (content) updates.content = JSON.stringify(content);
        if (context) updates.context = context;

        const node = await db.updateNode(id, updates);

        if (!node) {
          return {
            content: [
              {
                type: 'text',
                text: `Node not found: ${id}`,
              },
            ],
            isError: true,
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(node, null, 2),
            },
          ],
        };
      }

      case 'delete_node': {
        const { id } = args as any;
        const success = await db.deleteNode(id);

        return {
          content: [
            {
              type: 'text',
              text: success ? `Deleted node: ${id}` : `Node not found: ${id}`,
            },
          ],
        };
      }

      case 'create_edge': {
        const { source_id, target_id, label } = args as any;
        const edge = db.createEdge({
          id: uuidv4(),
          source_id,
          target_id,
          label: label || null,
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(edge, null, 2),
            },
          ],
        };
      }

      case 'branch_conversation': {
        const { parent_id, type, content } = args as any;
        const node = await db.branchNode(parent_id, {
          id: uuidv4(),
          type,
          content: JSON.stringify(content),
        });

        if (!node) {
          return {
            content: [
              {
                type: 'text',
                text: `Parent node not found: ${parent_id}`,
              },
            ],
            isError: true,
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(node, null, 2),
            },
          ],
        };
      }

      case 'add_context': {
        const { node_id, text, source } = args as any;
        await db.addContext(node_id, text, source);

        return {
          content: [
            {
              type: 'text',
              text: `Added context to node: ${node_id}`,
            },
          ],
        };
      }

      case 'get_context': {
        const { node_id, include_inherited = true } = args as any;
        const context = include_inherited
          ? db.getInheritedContext(node_id)
          : db.getContextForNode(node_id);

        return {
          content: [
            {
              type: 'text',
              text: context || 'No context found',
            },
          ],
        };
      }

      case 'search_context': {
        const { query, limit = 5 } = args as any;
        const results = await db.searchContext(query, limit);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(results, null, 2),
            },
          ],
        };
      }

      case 'get_conversation_path': {
        const { node_id } = args as any;
        const path = db.getConversationPath(node_id);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(path, null, 2),
            },
          ],
        };
      }

      case 'get_all_nodes': {
        const { type } = args as any;
        let nodes = db.getAllNodes();

        if (type) {
          nodes = nodes.filter((n) => n.type === type);
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(nodes, null, 2),
            },
          ],
        };
      }

      case 'export_graph': {
        const graph = db.exportGraph();

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(graph, null, 2),
            },
          ],
        };
      }

      case 'get_stats': {
        const stats = await db.getStats();

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(stats, null, 2),
            },
          ],
        };
      }

      default:
        return {
          content: [
            {
              type: 'text',
              text: `Unknown tool: ${name}`,
            },
          ],
          isError: true,
        };
    }
  } catch (error: any) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
});

// Start server
async function main() {
  console.error('Initializing GetSticky MCP Server...');

  // Initialize database
  db = await initDB();
  console.error('Database initialized');

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('GetSticky MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
