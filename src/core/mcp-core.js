const { GatewayError } = require('./gateway-client');

// JSON-RPC 2.0 error codes
const ERROR_CODES = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
};

const PROTOCOL_VERSION = '2024-11-05';
const SERVER_INFO = { name: 'wiki-mcp-server', version: '2.0.0' };

class MCPCore {
  /**
   * @param {import('./gateway-client').GatewayClient} gatewayClient
   * @param {boolean} [enableWriteOps=false]
   */
  constructor(gatewayClient, enableWriteOps = false) {
    this.gatewayClient = gatewayClient;
    this.enableWriteOps = enableWriteOps;
    this.tools = new Map();
    this.startTime = Date.now();
  }

  async initialize() {
    // Read tools (always registered)
    this._registerTool('search_wiki', {
      description: 'Search wiki pages using semantic similarity. Returns ranked results with relevance scores.',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query text' },
          top_k: { type: 'number', description: 'Number of results (1-20, default: 5)' },
        },
        required: ['query'],
      },
      handler: (params) => this._searchWiki(params),
    });

    this._registerTool('get_wiki_page', {
      description: 'Get the full content of a wiki page by its numeric ID or path.',
      inputSchema: {
        type: 'object',
        properties: {
          page_id: { type: 'number', description: 'The wiki page ID' },
          path: { type: 'string', description: 'The wiki page path (e.g. "home" or "devops/kubernetes")' },
        },
      },
      handler: (params) => this._getWikiPage(params),
    });

    this._registerTool('list_wiki_pages', {
      description: 'List all wiki pages, ordered by most recently updated.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
      handler: () => this._listWikiPages(),
    });

    // Write tools (gated)
    if (this.enableWriteOps) {
      this._registerTool('create_wiki_page', {
        description: 'Create a new wiki page with the given title, path, and content.',
        inputSchema: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Page title' },
            path: { type: 'string', description: 'Page path (e.g. "devops/new-page")' },
            content: { type: 'string', description: 'Page content in markdown' },
            description: { type: 'string', description: 'Short page description' },
            tags: { type: 'array', items: { type: 'string' }, description: 'Page tags' },
          },
          required: ['title', 'path', 'content'],
        },
        handler: (params) => this._createWikiPage(params),
      });

      this._registerTool('update_wiki_page', {
        description: 'Update an existing wiki page. Only provided fields are changed.',
        inputSchema: {
          type: 'object',
          properties: {
            page_id: { type: 'number', description: 'The wiki page ID to update' },
            title: { type: 'string', description: 'New page title' },
            content: { type: 'string', description: 'New page content in markdown' },
            description: { type: 'string', description: 'New page description' },
            tags: { type: 'array', items: { type: 'string' }, description: 'New page tags' },
          },
          required: ['page_id'],
        },
        handler: (params) => this._updateWikiPage(params),
      });

      this._registerTool('delete_wiki_page', {
        description: 'Delete a wiki page by its ID.',
        inputSchema: {
          type: 'object',
          properties: {
            page_id: { type: 'number', description: 'The wiki page ID to delete' },
          },
          required: ['page_id'],
        },
        handler: (params) => this._deleteWikiPage(params),
      });

      this._registerTool('move_wiki_page', {
        description: 'Move a wiki page to a new path.',
        inputSchema: {
          type: 'object',
          properties: {
            page_id: { type: 'number', description: 'The wiki page ID to move' },
            destination_path: { type: 'string', description: 'New path for the page' },
            destination_locale: { type: 'string', description: 'Destination locale (default: "en")' },
          },
          required: ['page_id', 'destination_path'],
        },
        handler: (params) => this._moveWikiPage(params),
      });
    }
  }

  _registerTool(name, definition) {
    this.tools.set(name, definition);
  }

  // ── MCP protocol handling ─────────────────────────────────────────────

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

  _handleInitialize() {
    return {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: { tools: {} },
      serverInfo: SERVER_INFO,
    };
  }

  _handleToolsList() {
    const tools = [];
    for (const [name, def] of this.tools) {
      tools.push({ name, description: def.description, inputSchema: def.inputSchema });
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
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    } catch (err) {
      if (err instanceof GatewayError) {
        throw {
          code: this._mapGatewayErrorCode(err.statusCode),
          message: err.message,
          data: { tool: toolName, statusCode: err.statusCode },
        };
      }
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
      await this.gatewayClient.checkHealth();
      return { gateway: 'connected' };
    } catch (err) {
      return { gateway: 'disconnected', error: err.message };
    }
  }

  getUptime() {
    return Date.now() - this.startTime;
  }

  // ── Gateway error → MCP error code mapping ───────────────────────────

  _mapGatewayErrorCode(statusCode) {
    if (statusCode >= 400 && statusCode < 500) {
      // 400, 404, 409 → invalid params
      if (statusCode === 401) return ERROR_CODES.INTERNAL_ERROR; // misconfigured key
      return ERROR_CODES.INVALID_PARAMS;
    }
    return ERROR_CODES.INTERNAL_ERROR; // 5xx, network errors
  }

  // ── Tool handlers ─────────────────────────────────────────────────────

  async _searchWiki({ query, top_k }) {
    if (!query || (typeof query === 'string' && query.trim() === '')) {
      throw { code: ERROR_CODES.INVALID_PARAMS, message: 'query parameter is required' };
    }
    return this.gatewayClient.search(query, top_k);
  }

  async _getWikiPage({ page_id, path }) {
    if (page_id == null && path == null) {
      throw { code: ERROR_CODES.INVALID_PARAMS, message: 'Either page_id or path must be provided' };
    }
    if (page_id != null) {
      return this.gatewayClient.getPage(page_id);
    }
    return this.gatewayClient.getPageByPath(path);
  }

  async _listWikiPages() {
    return this.gatewayClient.listPages();
  }

  async _createWikiPage({ title, path, content, description, tags }) {
    if (!title || !path || !content) {
      throw { code: ERROR_CODES.INVALID_PARAMS, message: 'title, path, and content are required' };
    }
    return this.gatewayClient.createPage({ title, path, content, description, tags });
  }

  async _updateWikiPage({ page_id, ...updates }) {
    if (page_id == null) {
      throw { code: ERROR_CODES.INVALID_PARAMS, message: 'page_id is required' };
    }
    return this.gatewayClient.updatePage(page_id, updates);
  }

  async _deleteWikiPage({ page_id }) {
    if (page_id == null) {
      throw { code: ERROR_CODES.INVALID_PARAMS, message: 'page_id is required' };
    }
    return this.gatewayClient.deletePage(page_id);
  }

  async _moveWikiPage({ page_id, destination_path, destination_locale }) {
    if (page_id == null || !destination_path) {
      throw { code: ERROR_CODES.INVALID_PARAMS, message: 'page_id and destination_path are required' };
    }
    return this.gatewayClient.movePage(page_id, destination_path, destination_locale);
  }
}

module.exports = { MCPCore, ERROR_CODES, PROTOCOL_VERSION, SERVER_INFO };
