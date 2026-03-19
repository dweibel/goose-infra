/**
 * Wiki MCP Server — stdio-only entry point.
 *
 * Goose invokes this as a child process. Communication is via
 * stdin/stdout JSON-RPC 2.0 (MCP protocol).
 *
 * No network ports are opened.
 */

const { loadConfig } = require('./config');
const { GatewayClient } = require('./core/gateway-client');
const { MCPCore } = require('./core/mcp-core');
const readline = require('readline');

async function main() {
  // Load config
  let config;
  try {
    config = loadConfig();
  } catch (err) {
    console.error(`[MCP] Configuration error: ${err.message}`);
    process.exit(1);
  }

  // Create gateway client
  const gatewayClient = new GatewayClient({
    baseUrl: config.gateway.url,
    apiKey: config.gateway.apiKey,
  });

  // Initialize MCPCore
  const mcpCore = new MCPCore(gatewayClient, config.wiki.enableWriteOps);
  await mcpCore.initialize();

  const toolCount = mcpCore.getToolList().tools.length;
  console.error(`[MCP] Wiki MCP server started (stdio). ${toolCount} tools registered.`);
  console.error(`[MCP] Gateway: ${config.gateway.url}`);
  console.error(`[MCP] Write ops: ${config.wiki.enableWriteOps ? 'enabled' : 'disabled'}`);

  // Check gateway health at startup (warn only, don't exit)
  try {
    const health = await mcpCore.checkHealth();
    if (health.gateway === 'connected') {
      console.error('[MCP] Gateway health: connected');
    } else {
      console.error(`[MCP] Gateway health: disconnected — ${health.error}`);
    }
  } catch (err) {
    console.error(`[MCP] Gateway health check failed: ${err.message}`);
  }

  // Stdio JSON-RPC transport
  const rl = readline.createInterface({ input: process.stdin, terminal: false });
  let pendingRequests = 0;
  let stdinClosed = false;

  function maybeExit() {
    if (stdinClosed && pendingRequests === 0) {
      console.error('[MCP] All requests drained, shutting down.');
      process.exit(0);
    }
  }

  rl.on('line', async (line) => {
    pendingRequests++;
    let request;
    try {
      request = JSON.parse(line);
    } catch {
      const errResponse = {
        jsonrpc: '2.0',
        id: null,
        error: { code: -32700, message: 'Parse error' },
      };
      process.stdout.write(JSON.stringify(errResponse) + '\n');
      pendingRequests--;
      maybeExit();
      return;
    }

    const { id, method, params } = request;

    try {
      const result = await mcpCore.handleRequest(method, params);
      const response = { jsonrpc: '2.0', id, result };
      process.stdout.write(JSON.stringify(response) + '\n');
    } catch (err) {
      const response = {
        jsonrpc: '2.0',
        id,
        error: {
          code: err.code || -32603,
          message: err.message || 'Internal error',
          ...(err.data ? { data: err.data } : {}),
        },
      };
      process.stdout.write(JSON.stringify(response) + '\n');
    }
    pendingRequests--;
    maybeExit();
  });

  rl.on('close', () => {
    console.error('[MCP] stdin closed, waiting for pending requests...');
    stdinClosed = true;
    maybeExit();
  });
}

main().catch((err) => {
  console.error(`[MCP] Fatal error: ${err.message}`);
  process.exit(1);
});
