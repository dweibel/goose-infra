function parseBool(value, defaultVal = false) {
  if (value === undefined || value === null || value === '') return defaultVal;
  return value === 'true' || value === '1';
}

function parsePort(value, defaultVal) {
  if (value === undefined || value === null || value === '') return defaultVal;
  const port = parseInt(value, 10);
  if (isNaN(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid port number: ${value}`);
  }
  return port;
}

function parseInt_(value, defaultVal) {
  if (value === undefined || value === null || value === '') return defaultVal;
  const num = parseInt(value, 10);
  if (isNaN(num) || num < 0) {
    throw new Error(`Invalid number: ${value}`);
  }
  return num;
}

function loadConfig(env = process.env) {
  const config = {
    // Database
    db: {
      host: env.PG_HOST || 'localhost',
      port: parsePort(env.PG_PORT, 5432),
      database: env.PG_DATABASE || 'wikijs',
      user: env.PG_USER || 'wikijs',
      password: env.PG_PASSWORD || '',
    },
    // Wiki.js
    wiki: {
      baseUrl: env.WIKI_BASE_URL || 'http://localhost:3000',
      adminToken: env.WIKI_ADMIN_TOKEN || '',
      enableWriteOps: parseBool(env.ENABLE_WRITE_OPS, false),
    },
    // HTTP Transport
    http: {
      enabled: parseBool(env.HTTP_TRANSPORT_ENABLED, false),
      port: parsePort(env.HTTP_PORT, 3000),
      cors: {
        enabled: parseBool(env.HTTP_CORS_ENABLED, true),
        origins: (env.HTTP_CORS_ORIGINS || '*').split(',').map(s => s.trim()),
      },
      rateLimit: {
        windowMs: parseInt_(env.RATE_LIMIT_WINDOW_MS, 60000),
        maxRequests: parseInt_(env.RATE_LIMIT_MAX_REQUESTS, 100),
      },
    },
    // WebSocket Transport
    websocket: {
      enabled: parseBool(env.WEBSOCKET_TRANSPORT_ENABLED, false),
      port: parsePort(env.WEBSOCKET_PORT, 3001),
      maxConnections: parseInt_(env.WS_MAX_CONNECTIONS, 50),
      pingInterval: parseInt_(env.WS_PING_INTERVAL_MS, 30000),
    },
    // Stdio Transport
    stdio: {
      enabled: true, // Always enabled by default
    },
    // Security
    security: {
      apiKey: env.API_KEY || null,
    },
    // Logging
    logging: {
      level: env.LOG_LEVEL || 'info',
      format: env.LOG_FORMAT || 'json',
    },
  };

  // Validation
  if (config.security.apiKey && config.security.apiKey.length < 32) {
    throw new Error('API_KEY must be at least 32 characters');
  }

  if (config.http.enabled && config.websocket.enabled && config.http.port === config.websocket.port) {
    throw new Error('HTTP_PORT and WEBSOCKET_PORT must be different');
  }

  return config;
}

module.exports = { loadConfig, parseBool, parsePort };
