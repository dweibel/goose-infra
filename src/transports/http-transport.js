const express = require('express');
const rateLimit = require('express-rate-limit');
const { ERROR_CODES } = require('../core/mcp-core');

class HttpTransport {
  constructor(mcpCore, config) {
    this.mcpCore = mcpCore;
    this.config = config;
    this.app = express();
    this.server = null;
    this._setupMiddleware();
    this._setupRoutes();
  }

  _setupMiddleware() {
    // JSON body parser
    this.app.use(express.json());

    // CORS
    if (this.config.http.cors.enabled) {
      this.app.use((req, res, next) => {
        const origin = this.config.http.cors.origins.includes('*')
          ? '*'
          : this.config.http.cors.origins.join(',');
        res.header('Access-Control-Allow-Origin', origin);
        res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        if (req.method === 'OPTIONS') return res.sendStatus(204);
        next();
      });
    }

    // Trust proxy headers (Cloudflare — 1 hop)
    this.app.set('trust proxy', 1);

    // Rate limiting on /mcp
    const limiter = rateLimit({
      windowMs: this.config.http.rateLimit.windowMs,
      max: this.config.http.rateLimit.maxRequests,
      standardHeaders: true,
      legacyHeaders: false,
      validate: { trustProxy: false },
      message: { jsonrpc: '2.0', error: { code: -32000, message: 'Rate limit exceeded' } },
    });
    this.app.use('/mcp', limiter);
  }

  _setupRoutes() {
    // Health check — no auth required
    this.app.get('/health', async (req, res) => {
      try {
        const healthStatus = await this.mcpCore.checkHealth();
        const status = healthStatus.database === 'connected' ? 'ok' : 'degraded';
        const httpStatus = healthStatus.database === 'connected' ? 200 : 503;
        res.status(httpStatus).json({
          status,
          version: '1.0.0',
          uptime: this.mcpCore.getUptime(),
          transports: {
            stdio: 'enabled',
            http: this.config.http.enabled ? 'enabled' : 'disabled',
            websocket: this.config.websocket.enabled ? 'enabled' : 'disabled',
          },
          database: healthStatus.database,
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        res.status(503).json({
          status: 'error',
          database: 'disconnected',
          error: err.message,
          timestamp: new Date().toISOString(),
        });
      }
    });

    // MCP endpoint — auth required if API_KEY set
    this.app.post('/mcp', this._authMiddleware(), async (req, res) => {
      const start = Date.now();
      try {
        const body = req.body;

        // Validate JSON-RPC 2.0 structure
        if (!body || body.jsonrpc !== '2.0' || !body.method) {
          return res.status(400).json({
            jsonrpc: '2.0',
            id: body?.id ?? null,
            error: { code: ERROR_CODES.INVALID_REQUEST, message: 'Invalid JSON-RPC 2.0 request' },
          });
        }

        const result = await this.mcpCore.handleRequest(body.method, body.params || {});
        const duration = Date.now() - start;
        console.log(`[HTTP] ${new Date().toISOString()} ${body.method} ${duration}ms`);

        res.json({ jsonrpc: '2.0', id: body.id, result });
      } catch (err) {
        const duration = Date.now() - start;
        const id = req.body?.id ?? null;

        if (err.code && err.message) {
          // Known MCP/JSON-RPC error
          const httpStatus = this._errorToHttpStatus(err.code);
          console.log(`[HTTP] ${new Date().toISOString()} ERROR ${err.message} ${duration}ms`);
          return res.status(httpStatus).json({
            jsonrpc: '2.0',
            id,
            error: { code: err.code, message: err.message, data: err.data },
          });
        }

        // Unhandled error
        console.error(`[HTTP] ${new Date().toISOString()} UNHANDLED ERROR`, err);
        res.status(500).json({
          jsonrpc: '2.0',
          id,
          error: { code: ERROR_CODES.INTERNAL_ERROR, message: 'Internal server error' },
        });
      }
    });

    // Handle JSON parse errors
    this.app.use((err, req, res, next) => {
      if (err.type === 'entity.parse.failed') {
        return res.status(400).json({
          jsonrpc: '2.0',
          id: null,
          error: { code: ERROR_CODES.PARSE_ERROR, message: 'Invalid JSON' },
        });
      }
      next(err);
    });
  }

  _authMiddleware() {
    return (req, res, next) => {
      const apiKey = this.config.security.apiKey;
      if (!apiKey) return next();

      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.log(`[HTTP] ${new Date().toISOString()} AUTH_FAILURE missing token from ${req.ip}`);
        return res.status(401).json({
          jsonrpc: '2.0',
          id: null,
          error: { code: -32000, message: 'Authentication required' },
        });
      }

      const token = authHeader.slice(7);
      if (token !== apiKey) {
        console.log(`[HTTP] ${new Date().toISOString()} AUTH_FAILURE invalid token from ${req.ip}`);
        return res.status(401).json({
          jsonrpc: '2.0',
          id: null,
          error: { code: -32000, message: 'Invalid authentication token' },
        });
      }

      next();
    };
  }

  _errorToHttpStatus(code) {
    switch (code) {
      case ERROR_CODES.PARSE_ERROR:
      case ERROR_CODES.INVALID_REQUEST:
      case ERROR_CODES.INVALID_PARAMS:
        return 400;
      case ERROR_CODES.METHOD_NOT_FOUND:
        return 400;
      case ERROR_CODES.INTERNAL_ERROR:
        return 500;
      default:
        return code >= -32000 ? 400 : 500;
    }
  }

  async start() {
    return new Promise((resolve) => {
      this.server = this.app.listen(this.config.http.port, () => {
        console.log(`[HTTP] Transport listening on port ${this.config.http.port}`);
        resolve();
      });
    });
  }

  async stop() {
    if (this.server) {
      return new Promise((resolve) => {
        this.server.close(() => resolve());
      });
    }
  }

  getApp() {
    return this.app;
  }

  getServer() {
    return this.server;
  }
}

module.exports = { HttpTransport };
