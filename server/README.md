# GetSticky Server

Backend server for GetSticky v3 - provides database layer and MCP integration for Claude Code.

## Features

- **Two-tier storage**:
  - SQLite (better-sqlite3) for structured node/edge data
  - LanceDB for semantic vector search across contexts
- **MCP Server**: Model Context Protocol integration for Claude Code
- **WebSocket Server**: Real-time sync with React Flow frontend
- **Context inheritance**: Child nodes automatically inherit parent context
- **Semantic search**: Find relevant context across all nodes using embeddings

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file:
```bash
cp .env.example .env
```

3. Add your OpenAI API key to `.env`:
```
OPENAI_API_KEY=your_key_here
```

## Usage

### Run WebSocket Server (for frontend)

```bash
npm run dev
```

The server will start on `ws://localhost:8080` by default.

### Run MCP Server (for Claude Code)

```bash
npm run mcp
```

This starts the MCP server using stdio transport for Claude Desktop/Code integration.

### Production Build

```bash
npm run build
npm start
```

## Database Schema

### Nodes Table
- `id`: Unique identifier
- `type`: Node type (conversation, diagram, richtext, terminal)
- `content`: JSON blob of node-specific data
- `context`: Accumulated context for this node
- `parent_id`: Parent node (for branching)
- `created_at`, `updated_at`: Timestamps

### Edges Table
- `id`: Unique identifier
- `source_id`: Source node ID
- `target_id`: Target node ID
- `label`: Optional edge label

### Context Chain Table
- `node_id`: Associated node
- `context_entry`: Individual context chunk
- `source`: Context source (user, agent, codebase, diagram)
- `embedding`: Vector embedding (stored in SQLite, indexed in LanceDB)
- `created_at`: Timestamp

## MCP Tools

The MCP server exposes these tools to Claude Code:

### Node Operations
- `create_node`: Create a new node
- `get_node`: Get node by ID
- `update_node`: Update node content/context
- `delete_node`: Delete a node
- `get_all_nodes`: List all nodes

### Edge Operations
- `create_edge`: Connect two nodes
- `branch_conversation`: Create a child node with inherited context

### Context Operations
- `add_context`: Add context to a node
- `get_context`: Get node context (with inheritance)
- `search_context`: Semantic search across all contexts
- `get_conversation_path`: Get full path from root to node

### Utilities
- `export_graph`: Export nodes and edges
- `get_stats`: Database statistics

## WebSocket API

Connect to `ws://localhost:8080` and send JSON messages:

### Message Format
```json
{
  "type": "create_node|update_node|delete_node|create_edge|delete_edge|add_context|search_context",
  "data": { /* type-specific data */ },
  "id": "optional-request-id"
}
```

### Response Format
```json
{
  "type": "success|error|node_created|node_updated|...",
  "data": { /* response data */ },
  "error": "error message if applicable",
  "requestId": "matches request id"
}
```

### Events (broadcast to all clients)
- `node_created`: New node added
- `node_updated`: Node modified
- `node_deleted`: Node removed
- `edge_created`: New edge added
- `edge_deleted`: Edge removed
- `context_added`: Context added to node

## Architecture

```
┌─────────────────────────────────────────────┐
│          React Flow Frontend                │
│         (WebSocket client)                  │
└──────────────────┬──────────────────────────┘
                   │ WebSocket
         ┌─────────▼──────────┐
         │  WebSocket Server  │
         │    (port 8080)     │
         └─────────┬──────────┘
                   │
    ┌──────────────▼───────────────┐
    │     Database Manager          │
    │                               │
    │  ┌─────────────────────────┐  │
    │  │  SQLite                 │  │
    │  │  (structured data)      │  │
    │  └─────────────────────────┘  │
    │                               │
    │  ┌─────────────────────────┐  │
    │  │  LanceDB                │  │
    │  │  (vector search)        │  │
    │  └─────────────────────────┘  │
    └───────────────────────────────┘
                   ▲
                   │ stdio
         ┌─────────┴──────────┐
         │    MCP Server      │
         └─────────┬──────────┘
                   │
         ┌─────────▼──────────┐
         │   Claude Code      │
         └────────────────────┘
```

## License

MIT
