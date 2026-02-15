#!/usr/bin/env node

'use strict';

const path = require('path');
const fs = require('fs');

// Parse CLI arguments
const args = process.argv.slice(2);

function getArg(name, defaultValue) {
  const index = args.indexOf(`--${name}`);
  if (index === -1) return defaultValue;
  return args[index + 1] || defaultValue;
}

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
  getsticky - AI conversations on an infinite canvas

  Usage:
    getsticky [options]

  Options:
    --port <number>   Port to run on (default: 2528)
    --data <path>     Data directory path (default: ./getsticky-data)
    --help, -h        Show this help message

  MCP Server:
    Configure in .mcp.json:
    {
      "mcpServers": {
        "getsticky": {
          "command": "getsticky-mcp",
          "env": {
            "DB_PATH": "./getsticky-data",
            "WS_SERVER_URL": "http://localhost:2528"
          }
        }
      }
    }
`);
  process.exit(0);
}

const port = getArg('port', '2528');
const dataDir = getArg('data', './getsticky-data');

// Resolve static dir relative to this script
const staticDir = path.resolve(__dirname, '..', 'app');

if (!fs.existsSync(staticDir)) {
  console.error('Error: Built frontend not found at', staticDir);
  console.error('If running from source, run: npm run build');
  process.exit(1);
}

// Set environment variables for the server
process.env.WS_PORT = port;
process.env.DB_PATH = dataDir;
process.env.GETSTICKY_STATIC_DIR = staticDir;

// Start the server
require('../server/dist/index.js');
