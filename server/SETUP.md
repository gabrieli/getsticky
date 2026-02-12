# GetSticky Server Setup Guide

## Quick Start

### 1. Install Dependencies

```bash
cd server
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and add your OpenAI API key:
```
OPENAI_API_KEY=sk-...
```

### 3. Run the WebSocket Server (for Frontend)

```bash
npm run dev
```

The server will start on `ws://localhost:8080`.

### 4. Configure Claude Desktop (Optional - for MCP)

**Option A: Development Mode (with tsx)**

1. Copy the config to Claude Desktop:
```bash
cat claude-desktop-config-dev.json
```

2. Add this to your Claude Desktop config file:
   - **Mac**: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
   - **Linux**: `~/.config/Claude/claude_desktop_config.json`

3. Update the path and API key in the config

4. Restart Claude Desktop

**Option B: Production Mode (compiled)**

1. Build the MCP server:
```bash
npm run build:mcp
```

2. Use `claude-desktop-config.json` instead (points to compiled JS)

## Testing the Setup

### Test WebSocket Server

Create a simple WebSocket client:

```javascript
const ws = new WebSocket('ws://localhost:8080');

ws.onopen = () => {
  console.log('Connected');

  // Create a node
  ws.send(JSON.stringify({
    type: 'create_node',
    data: {
      type: 'conversation',
      content: {
        question: 'Hello',
        response: 'Hi there!'
      }
    }
  }));
};

ws.onmessage = (event) => {
  console.log('Message:', JSON.parse(event.data));
};
```

### Test MCP Server

After configuring Claude Desktop, you should see "getsticky" in the MCP servers list. Try asking Claude:

> "Use the getsticky MCP server to create a new conversation node"

## Database Location

By default, the database is stored in `./getsticky-data/`:
- SQLite: `getsticky-data/getsticky.db`
- LanceDB: `getsticky-data/lancedb/`

You can change this by setting `DB_PATH` in `.env`.

## Troubleshooting

### "Module not found" errors

Make sure you've installed dependencies:
```bash
npm install
```

### WebSocket connection refused

Check that the server is running:
```bash
npm run dev
```

### MCP server not appearing in Claude Desktop

1. Check the config file path is correct
2. Ensure the paths in the config are absolute (not relative)
3. Restart Claude Desktop after changing config
4. Check Claude Desktop logs for errors

### Database permission errors

Ensure the directory is writable:
```bash
chmod -R 755 ./getsticky-data
```

## Development

### Run with auto-reload

```bash
npm run dev
```

### Run MCP server in development mode

```bash
npm run mcp:dev
```

### Build for production

```bash
npm run build        # Main server
npm run build:mcp    # MCP server
```

### Run production build

```bash
npm start
```

## Architecture Overview

```
GetSticky Server
├── WebSocket Server (port 8080)
│   ├── Handles real-time communication with frontend
│   └── Broadcasts changes to all connected clients
│
├── Database Layer
│   ├── SQLite (structured data)
│   │   ├── nodes table
│   │   ├── edges table
│   │   └── context_chain table
│   │
│   └── LanceDB (vector search)
│       └── Semantic search across all contexts
│
└── MCP Server (stdio)
    ├── Tools for Claude Code
    └── Direct database access
```

## Next Steps

- [Read the API documentation](./README.md)
- [Explore the database schema](./README.md#database-schema)
- [Check out example usage](./src/db/example.ts)
