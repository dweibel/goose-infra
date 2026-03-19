const { WebSocketServer } = require('ws');
const { randomUUID } = require('crypto');
const http = require('http');
const { ERROR_CODES, PROTOCOL_VERSION } = require('../core/mcp-core');

class WebSocketTransport {
  constructor(mcpCore, config) {
    this.mcpCore = mcpCore;
    this.config = config;
    this.connections = new Map();
    this.httpServer = null;
    this.wss = null;
    this.pingInterval = null;
  }

  async start() {
    this.httpServer = http.createServer((req, res) => {
      res.writeHead(404);
      res.end();
    });

    this.wss = new WebSocketServer({
      server: this.httpServer,
      path: '/ws',
    });

    this.wss.on('connection', (ws, req) => this._handleConnection(ws, req));

    // Ping/pong keepalive
    this.pingInterval = setInterval(() => {
      for (const [id, conn] of this.connections) {
        if (!conn.alive) {
          console.log(`[WS] ${new Date().toISOString()} TIMEOUT connectionId=${id}`);
          conn.ws.terminate();
          this.connections.delete(id);
          continue;
        }
        conn.alive = false;
        conn.ws.ping();
      }
    }, this.config.websocket.pingInterval);

    return new Promise((resolve) => {
      this.httpServer.listen(this.config.websocket.port, () => {
        console.log(`[WS] Transport listening on port ${this.config.websocket.port}`);
        resolve();
      });
    });
  }

  _handleConnection(ws, req) {
    // Connection limit check
    if (this.connections.size >= this.config.websocket.maxConnections) {
      ws.close(1013, 'Maximum connections reached');
      console.log(`[WS] ${new Date().toISOString()} REJECTED max connections reached`);
      return;
    }

    const connectionId = randomUUID();
    const apiKey = this.config.security.apiKey;
    const authenticated = !apiKey; // If no key configured, auto-authenticated

    // Check query param auth
    let isAuthenticated = authenticated;
    if (apiKey) {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const token = url.searchParams.get('token');
      if (token === apiKey) {
        isAuthenticated = true;
      }
    }

    const connState = {
      ws,
      connectionId,
      connectedAt: new Date(),
      lastActivity: new Date(),
      authenticated: isAuthenticated,
      alive: true,
      clientInfo: {
        ip: req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'] || '',
      },
    };

    this.connections.set(connectionId, connState);
    console.log(`[WS] ${new Date().toISOString()} CONNECT connectionId=${connectionId} ip=${connState.clientInfo.ip}`);

    // Send connection acknowledgment
    ws.send(JSON.stringify({
      type: 'connected',
      protocol: `mcp/${PROTOCOL_VERSION}`,
      connectionId,
    }));

    ws.on('pong', () => {
      const conn = this.connections.get(connectionId);
      if (conn) conn.alive = true;
    });

    ws.on('message', async (data) => {
      const conn = this.connections.get(connectionId);
      if (conn) conn.lastActivity = new Date();

      try {
        const message = JSON.parse(data.toString());

        // Handle auth message if not yet authenticated
        if (!conn.authenticated) {
          if (message.type === 'auth' && message.token === apiKey) {
            conn.authenticated = true;
            ws.send(JSON.stringify({ type: 'auth', status: 'ok' }));
            return;
          }
          // If not an auth message and not authenticated, reject
          if (message.type !== 'auth') {
            ws.send(JSON.stringify({
              jsonrpc: '2.0',
              id: message.id ?? null,
              error: { code: -32000, message: 'Authentication required' },
            }));
            return;
          }
          // Bad auth token
          ws.send(JSON.stringify({ type: 'auth', status: 'failed' }));
          return;
        }

        // Validate JSON-RPC 2.0
        if (message.jsonrpc !== '2.0' || !message.method) {
          ws.send(JSON.stringify({
            jsonrpc: '2.0',
            id: message.id ?? null,
            error: { code: ERROR_CODES.INVALID_REQUEST, message: 'Invalid JSON-RPC 2.0 request' },
          }));
          return;
        }

        const start = Date.now();
        const result = await this.mcpCore.handleRequest(message.method, message.params || {});
        const duration = Date.now() - start;
        console.log(`[WS] ${new Date().toISOString()} ${message.method} ${duration}ms connectionId=${connectionId}`);

        ws.send(JSON.stringify({ jsonrpc: '2.0', id: message.id, result }));
      } catch (err) {
        if (err.code && err.message) {
          ws.send(JSON.stringify({
            jsonrpc: '2.0',
            id: null,
            error: { code: err.code, message: err.message, data: err.data },
          }));
        } else if (err instanceof SyntaxError) {
          ws.send(JSON.stringify({
            jsonrpc: '2.0',
            id: null,
            error: { code: ERROR_CODES.PARSE_ERROR, message: 'Invalid JSON' },
          }));
        } else {
          console.error(`[WS] ${new Date().toISOString()} UNHANDLED ERROR`, err);
          ws.send(JSON.stringify({
            jsonrpc: '2.0',
            id: null,
            error: { code: ERROR_CODES.INTERNAL_ERROR, message: 'Internal server error' },
          }));
        }
      }
    });

    ws.on('close', () => {
      this.connections.delete(connectionId);
      console.log(`[WS] ${new Date().toISOString()} DISCONNECT connectionId=${connectionId}`);
    });

    ws.on('error', (err) => {
      console.error(`[WS] ${new Date().toISOString()} ERROR connectionId=${connectionId}`, err.message);
      this.connections.delete(connectionId);
    });
  }

  async stop() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    // Close all connections
    for (const [id, conn] of this.connections) {
      conn.ws.close(1001, 'Server shutting down');
    }
    this.connections.clear();

    if (this.wss) {
      this.wss.close();
    }
    if (this.httpServer) {
      return new Promise((resolve) => {
        this.httpServer.close(() => resolve());
      });
    }
  }

  getConnectionCount() {
    return this.connections.size;
  }
}

module.exports = { WebSocketTransport };
