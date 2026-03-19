const { randomUUID } = require('crypto');

// JSON-RPC 2.0 error codes
const ERROR_CODES = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
};

const PROTOCOL_VERSION = '2024-11-05';
const SERVER_INFO = { name: 'wiki-mcp-server', version: '1.0.0' };

class MCPCore {
  constructor(dbClient, wikiBaseUrl, wikiAdminToken, enableWriteOps = false) {
    this.dbClient = dbClient;
    this.wikiBaseUrl = wikiBaseUrl;
    this.wikiAdminToken = wikiAdminToken;
    this.enableWriteOps = enableWriteOps;
    this.tools = new Map();
    this.startTime = Date.now();
  }

  async initialize() {
    this._registerTool('search_wiki', {
      description: 'Search wiki pages using semantic similarity via pgvector embeddings',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query text' },
          top_k: { type: 'number', description: 'Number of results to return (default: 5)', default: 5 },
        },
        required: ['query'],
      },
      handler: async (params) => this._searchWiki(params),
    });

    this._registerTool('get_wiki_page', {
      description: 'Get the full content of a wiki page by its ID',
      inputSchema: {
        type: 'object',
        properties: {
          page_id: { type: 'number', description: 'The wiki page ID' },
        },
        required: ['page_id'],
      },
      handler: async (params) => this._getWikiPage(params),
    });
  }

  _registerTool(name, definition) {
    this.tools.set(name, definition);
  }

  async handleRequest(method, params) {
    switch (method) {
      case 'initialize':
        return this._handleInitialize(params);
      case 'tools/list':
        return this._handleToolsList();
      case 'tools/call':
        return this._handleToolsCall(params);
      default:
        throw { code: ERROR_CODES.METHOD_NOT_FOUND, message: `Method not found: ${method}` };
    }
  }

  _handleInitialize(params) {
    return {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: { tools: {} },
      serverInfo: SERVER_INFO,
    };
  }

  _handleToolsList() {
    const tools = [];
    for (const [name, def] of this.tools) {
      tools.push({
        name,
        description: def.description,
        inputSchema: def.inputSchema,
      });
    }
    return { tools };
  }

  async _handleToolsCall(params) {
    if (!params || !params.name) {
      throw { code: ERROR_CODES.INVALID_PARAMS, message: 'Missing tool name' };
    }
    const tool = this.tools.get(params.name);
    if (!tool) {
      throw { code: ERROR_CODES.INVALID_PARAMS, message: `Unknown tool: ${params.name}` };
    }
    return this.executeTool(params.name, params.arguments || {});
  }

  async executeTool(toolName, args) {
    const tool = this.tools.get(toolName);
    if (!tool) {
      throw { code: ERROR_CODES.INVALID_PARAMS, message: `Unknown tool: ${toolName}` };
    }
    try {
      const result = await tool.handler(args);
      return {
        content: [{ type: 'text', text: JSON.stringify(result) }],
      };
    } catch (err) {
      throw {
        code: ERROR_CODES.INTERNAL_ERROR,
        message: `Tool execution failed: ${err.message}`,
        data: { tool: toolName },
      };
    }
  }

  getToolList() {
    return this._handleToolsList();
  }

  getCapabilities() {
    return {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: { tools: {} },
      serverInfo: SERVER_INFO,
    };
  }

  async checkHealth() {
    try {
      await this.dbClient.query('SELECT 1');
      return { database: 'connected' };
    } catch (err) {
      return { database: 'disconnected', error: err.message };
    }
  }

  getUptime() {
    return Date.now() - this.startTime;
  }

  async _searchWiki(params) {
    const { query, top_k = 5 } = params;
    if (!query) {
      throw new Error('query parameter is required');
    }
    const result = await this.dbClient.query(
      `SELECT p.id AS page_id, p.title AS page_title, p.path AS page_path,
              pe.content AS chunk_text,
              1 - (pe.embedding <=> (
                SELECT embedding FROM page_embeddings
                WHERE content = $1 LIMIT 1
              )) AS relevance_score
       FROM page_embeddings pe
       JOIN pages p ON pe."pageId" = p.id
       ORDER BY pe.embedding <=> (
         SELECT embedding FROM page_embeddings
         WHERE content = $1 LIMIT 1
       )
       LIMIT $2`,
      [query, top_k]
    );
    return result.rows;
  }

  async _getWikiPage(params) {
    const { page_id } = params;
    if (page_id === undefined || page_id === null) {
      throw new Error('page_id parameter is required');
    }
    const result = await this.dbClient.query(
      'SELECT id, title, path, content, "updatedAt" FROM pages WHERE id = $1',
      [page_id]
    );
    if (result.rows.length === 0) {
      throw new Error(`Page not found: ${page_id}`);
    }
    return result.rows[0];
  }
}

module.exports = { MCPCore, ERROR_CODES, PROTOCOL_VERSION, SERVER_INFO };
