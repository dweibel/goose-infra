/**
 * HTTP client for the Wiki REST API Gateway.
 * Pure HTTP — no MCP protocol awareness.
 */

class GatewayError extends Error {
  constructor(message, statusCode, responseBody) {
    super(message);
    this.name = 'GatewayError';
    this.statusCode = statusCode;
    this.responseBody = responseBody;
  }
}

class GatewayClient {
  /**
   * @param {Object} opts
   * @param {string} opts.baseUrl - Gateway base URL (e.g. http://localhost:3001)
   * @param {string} opts.apiKey - Bearer token for gateway auth
   * @param {number} [opts.timeoutMs=30000] - Request timeout in ms
   */
  constructor({ baseUrl, apiKey, timeoutMs = 30000 }) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.apiKey = apiKey;
    this.timeoutMs = timeoutMs;
  }

  /**
   * Internal HTTP request with retry logic.
   * Retries on network errors and 5xx (up to 2 retries, 100ms/200ms backoff).
   * No retry on 4xx.
   */
  async _request(method, path, body = null) {
    const delays = [100, 200];
    let lastError;

    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) {
        await new Promise((r) => setTimeout(r, delays[attempt - 1]));
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const opts = {
          method,
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
        };
        if (body !== null) {
          opts.body = JSON.stringify(body);
        }

        const res = await fetch(`${this.baseUrl}${path}`, opts);
        clearTimeout(timer);

        if (res.ok) {
          return res.json();
        }

        // Parse error body
        let errBody;
        try {
          errBody = await res.json();
        } catch {
          errBody = { error: res.statusText };
        }

        // No retry on 4xx
        if (res.status >= 400 && res.status < 500) {
          throw new GatewayError(
            errBody.error || `Gateway returned ${res.status}`,
            res.status,
            errBody,
          );
        }

        // 5xx — retry
        lastError = new GatewayError(
          errBody.error || `Gateway returned ${res.status}`,
          res.status,
          errBody,
        );
      } catch (err) {
        clearTimeout(timer);
        if (err instanceof GatewayError && err.statusCode >= 400 && err.statusCode < 500) {
          throw err; // Don't retry 4xx
        }
        lastError = err instanceof GatewayError
          ? err
          : new GatewayError(`Gateway request failed: ${err.message}`, 0, null);
      }
    }

    throw lastError;
  }

  // ── Read methods ──────────────────────────────────────────────────────

  async search(query, topK = 5) {
    return this._request('POST', '/api/search', { query, top_k: topK });
  }

  async getPage(pageId) {
    return this._request('GET', `/api/pages/${pageId}`);
  }

  async getPageByPath(path) {
    return this._request('GET', `/api/pages/by-path?path=${encodeURIComponent(path)}`);
  }

  async listPages() {
    return this._request('GET', '/api/pages');
  }

  async checkHealth() {
    return this._request('GET', '/health');
  }

  // ── Write methods ─────────────────────────────────────────────────────

  async createPage(data) {
    return this._request('POST', '/api/pages', data);
  }

  async updatePage(pageId, updates) {
    return this._request('PUT', `/api/pages/${pageId}`, updates);
  }

  async deletePage(pageId) {
    return this._request('DELETE', `/api/pages/${pageId}`);
  }

  async movePage(pageId, destinationPath, destinationLocale = 'en') {
    return this._request('POST', `/api/pages/${pageId}/move`, {
      destination_path: destinationPath,
      destination_locale: destinationLocale,
    });
  }
}

module.exports = { GatewayClient, GatewayError };
