const { loadConfig } = require('./config');
const { MCPCore } = require('./core/mcp-core');
const { HttpTransport } = require('./transports/http-transport');
const { WebSocketTransport } = require('./transports/websocket-transport');

async function createDbClient(config) {
  // Use pg module if available, otherwise create a mock for testing
  try {
    const { Pool } = require('pg');
    const pool = new Pool({
      host: config.db.host,
      port: config.db.port,
      database: config.db.database,
      user: config.db.user,
      password: config.db.password,
    });
    return pool;
  } catch (err) {
    console.error('[SERVER] Failed to create database client:', err.message);
    throw err;
  }
}

async function startServer(configOverride) {
  const config = configOverride || loadConfig();
  const transports = [];

  console.log('[SERVER] Starting MCP server...');
  console.log(`[SERVER] Stdio transport: enabled (default)`);
  console.log(`[SERVER] HTTP transport: ${config.http.enabled ? 'enabled' : 'disabled'}`);
  console.log(`[SERVER] WebSocket transport: ${config.websocket.enabled ? 'enabled' : 'disabled'}`);

  // Initialize shared database client
  const dbClient = await createDbClient(config);

  // Initialize MCPCore
  const mcpCore = new MCPCore(
    dbClient,
    config.wiki.baseUrl,
    config.wiki.adminToken,
    config.wiki.enableWriteOps
  );
  await mcpCore.initialize();

  // Start HTTP transport if enabled
  let httpTransport = null;
  if (config.http.enabled) {
    httpTransport = new HttpTransport(mcpCore, config);
    await httpTransport.start();
    transports.push(httpTransport);
  }

  // Start WebSocket transport if enabled
  let wsTransport = null;
  if (config.websocket.enabled) {
    wsTransport = new WebSocketTransport(mcpCore, config);
    await wsTransport.start();
    transports.push(wsTransport);
  }

  console.log('[SERVER] MCP server started successfully');

  // Graceful shutdown
  const shutdown = async () => {
    console.log('[SERVER] Shutting down...');
    for (const transport of transports) {
      await transport.stop();
    }
    if (dbClient.end) await dbClient.end();
    console.log('[SERVER] Shutdown complete');
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  return { mcpCore, httpTransport, wsTransport, dbClient, config, shutdown };
}

// Run if executed directly
if (require.main === module) {
  startServer().catch((err) => {
    console.error('[SERVER] Fatal error:', err.message);
    process.exit(1);
  });
}

module.exports = { startServer, createDbClient };
