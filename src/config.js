function parseBool(value, defaultVal = false) {
  if (value === undefined || value === null || value === '') return defaultVal;
  return value === 'true' || value === '1';
}

function loadConfig(env = process.env) {
  const config = {
    // Wiki API Gateway
    gateway: {
      url: env.WIKI_GATEWAY_URL || 'http://localhost:3001',
      apiKey: env.WIKI_GATEWAY_API_KEY || '',
    },
    // Write operations
    wiki: {
      enableWriteOps: parseBool(env.ENABLE_WRITE_OPS, false),
    },
    // Logging
    logging: {
      level: env.LOG_LEVEL || 'info',
    },
  };

  // Validation
  if (!config.gateway.apiKey) {
    throw new Error('WIKI_GATEWAY_API_KEY is required');
  }

  try {
    new URL(config.gateway.url);
  } catch {
    throw new Error(`Invalid WIKI_GATEWAY_URL: ${config.gateway.url}`);
  }

  return config;
}

module.exports = { loadConfig, parseBool };
