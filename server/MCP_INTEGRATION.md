# GetSticky MCP Server Integration Guide

Complete guide for integrating GetSticky with Claude Desktop via the Model Context Protocol.

## What is the MCP Server?

The GetSticky MCP server exposes 13 tools that Claude Desktop can use to interact with your node graph. This enables:
- Creating and managing nodes from Claude conversations
- Searching context across your entire canvas
- Building conversation trees with context inheritance
- Querying your saved work semantically

## Quick Setup

### 1. Build the Server

```bash
cd server
npm install
npm run build:mcp
```

This compiles the MCP server to `dist-mcp/mcp/server.js`.

### 2. Configure Claude Desktop

#### macOS
Edit `~/Library/Application Support/Claude/claude_desktop_config.json`

#### Windows
Edit `%APPDATA%\Claude\claude_desktop_config.json`

#### Linux
Edit `~/.config/Claude/claude_desktop_config.json`

### 3. Add GetSticky MCP Server

```json
{
  "mcpServers": {
    "getsticky": {
      "command": "node",
      "args": [
        "/absolute/path/to/getsticky/server/dist-mcp/mcp/server.js"
      ],
      "env": {
        "OPENAI_API_KEY": "sk-...",
        "ANTHROPIC_API_KEY": "sk-ant-...",
        "DB_PATH": "/absolute/path/to/getsticky/getsticky-data"
      }
    }
  }
}
```

**Important:** Use absolute paths, not relative paths!

### 4. Restart Claude Desktop

After saving the config, completely quit and restart Claude Desktop.

## Development Setup

For development with auto-reload, use tsx instead:

```json
{
  "mcpServers": {
    "getsticky": {
      "command": "npx",
      "args": [
        "tsx",
        "/absolute/path/to/getsticky/server/src/mcp/server.ts"
      ],
      "env": {
        "OPENAI_API_KEY": "sk-...",
        "ANTHROPIC_API_KEY": "sk-ant-...",
        "DB_PATH": "/absolute/path/to/getsticky/getsticky-data"
      }
    }
  }
}
```

## Available Tools

### Node Management

**1. create_node**
```
Create a new node on the canvas
- type: conversation | diagram | richtext | terminal
- content: Node-specific data (object)
- context: Context information (string)
- parent_id: Parent node ID for branching (optional)
```

**2. get_node**
```
Get a specific node by ID
- id: Node ID
```

**3. update_node**
```
Update an existing node
- id: Node ID
- content: Updated content (optional)
- context: Updated context (optional)
```

**4. delete_node**
```
Delete a node from the canvas
- id: Node ID
```

**5. get_all_nodes**
```
Get all nodes on the canvas
- type: Filter by type (optional)
```

### Edge Management

**6. create_edge**
```
Create a connection between two nodes
- source_id: Source node ID
- target_id: Target node ID
- label: Edge label (optional)
```

### Conversation Branching

**7. branch_conversation**
```
Create a new branch from an existing node (inherits context)
- parent_id: Parent node ID
- type: Type of the new branch node
- content: Content for the new branch
```

### Context Operations

**8. add_context**
```
Add context information to a node
- node_id: Node ID
- text: Context text
- source: user | agent | codebase | diagram
```

**9. get_context**
```
Get context for a node (including inherited context)
- node_id: Node ID
- include_inherited: Include parent context (default: true)
```

**10. search_context**
```
Semantic search across all node contexts
- query: Search query
- limit: Max results (default: 5)
```

**11. get_conversation_path**
```
Get the full conversation path from root to node
- node_id: Node ID
```

### Utilities

**12. export_graph**
```
Export the entire graph (nodes and edges)
No parameters required
```

**13. get_stats**
```
Get database statistics
No parameters required
```

## Example Usage in Claude Desktop

Once configured, you can interact with GetSticky directly in Claude conversations:

### Create a Node
> "Use the getsticky server to create a conversation node about implementing JWT authentication in Node.js"

### Search Context
> "Search my getsticky canvas for information about database design"

### Branch a Conversation
> "Create a branch from node abc-123 to explore error handling approaches"

### Get Stats
> "Show me statistics about my getsticky canvas"

## Verification

### Check if MCP Server is Loaded

In Claude Desktop:
1. Open a new conversation
2. Look for "MCP" indicator or available tools
3. Type: "What MCP servers are available?"
4. You should see "getsticky" listed

### Test a Tool

> "Use the getsticky get_stats tool to show me my canvas statistics"

If successful, you'll see node counts, context stats, etc.

## Troubleshooting

### MCP Server Not Appearing

**1. Check config file location**
```bash
# macOS
ls ~/Library/Application\ Support/Claude/claude_desktop_config.json

# Linux
ls ~/.config/Claude/claude_desktop_config.json
```

**2. Validate JSON syntax**
Use a JSON validator to ensure no syntax errors in config.

**3. Check absolute paths**
Paths must be absolute, not relative:
- ❌ `./server/dist-mcp/mcp/server.js`
- ✅ `/Users/yourname/projects/getsticky/server/dist-mcp/mcp/server.js`

**4. Check environment variables**
Ensure API keys are valid and properly quoted.

**5. Restart Claude Desktop completely**
- Quit Claude Desktop (not just close window)
- Reopen Claude Desktop
- Wait for initialization

### Check Claude Desktop Logs

**macOS:**
```bash
tail -f ~/Library/Logs/Claude/mcp*.log
```

**Linux:**
```bash
tail -f ~/.config/Claude/logs/mcp*.log
```

Look for errors related to "getsticky" server startup.

### Test MCP Server Directly

You can test the MCP server in stdio mode:

```bash
cd server
npm run mcp:dev
```

Type JSON-RPC requests to test:
```json
{"jsonrpc":"2.0","id":1,"method":"tools/list"}
```

You should see the list of 13 tools.

### Common Errors

**"Module not found"**
- Run `npm install` in server directory
- Rebuild with `npm run build:mcp`

**"Permission denied"**
- Ensure server files are readable
- Check execute permissions on node/npx

**"API key not found"**
- Verify OPENAI_API_KEY is set in env
- Check for typos in environment variable names

**"Database error"**
- Ensure DB_PATH directory exists and is writable
- Try with absolute path instead of relative

## Architecture

```
┌─────────────────────────┐
│   Claude Desktop        │
│   (User Interface)      │
└───────────┬─────────────┘
            │ stdio
┌───────────▼─────────────┐
│   GetSticky MCP Server  │
│   (13 tools)            │
└───────────┬─────────────┘
            │
┌───────────▼─────────────┐
│   Database Manager      │
│   - SQLite              │
│   - LanceDB             │
└─────────────────────────┘
```

## Security Notes

- API keys are stored in Claude Desktop config (local file)
- MCP server runs locally, no network access
- Database files are stored locally
- No data sent to external services (except OpenAI for embeddings)

## Next Steps

1. Configure Claude Desktop with MCP server
2. Test basic operations (create node, get stats)
3. Try semantic search across your canvas
4. Build complex conversation trees with branching
5. Use alongside React Flow frontend for full power

## Questions?

- Check `server/README.md` for database details
- See `server/FRONTEND_API.md` for WebSocket integration
- Review `server/SETUP.md` for general setup
