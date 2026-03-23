# Wiki MCP Extension — Current Status

## What Works

- Goose container (`goose-web`) is running on OCI at `193.122.215.174`
- OpenRouter API key is valid — Goose sessions start and the LLM responds
- Wiki MCP server runs correctly inside the container as a standalone process:
  - `node /app/src/server.js` starts, connects to the gateway, registers 7 tools
  - JSON-RPC over stdin/stdout works (tested with piped `initialize`, `tools/list`, `tools/call`)
  - Gateway health check passes (`gateway: connected`)
  - `list_wiki_pages`, `get_wiki_page` (by ID and path) all return correct data
- Gateway env vars are set in the container: `WIKI_GATEWAY_URL`, `WIKI_GATEWAY_API_KEY`, `ENABLE_WRITE_OPS`
- Wiki extension is registered in Goose config at `/root/.config/goose/config.yaml`

## What Doesn't Work

Goose does not load the wiki extension when starting a session. When asked to use `list_wiki_pages`, Goose says the tool is not available and only shows platform extensions (Developer, Analyze, Apps, etc.).

The wiki extension is defined in config.yaml as:

```yaml
wiki:
  enabled: true
  type: stdio
  name: wiki
  cmd: node
  args:
    - /app/src/server.js
  env_keys:
    - WIKI_GATEWAY_URL
    - WIKI_GATEWAY_API_KEY
    - ENABLE_WRITE_OPS
```

## Likely Root Cause

Goose's stdio extension loading may require the MCP server to implement the full MCP handshake that Goose expects. Our server implements a raw JSON-RPC protocol, but Goose may expect:

1. A specific initialization sequence (e.g., sending `initialize` and waiting for a response before listing tools)
2. The `notifications/initialized` notification after the `initialize` response
3. Specific capability negotiation fields

Alternatively, the `env_keys` config tells Goose which env vars to forward to the child process, but Goose may be failing silently when spawning the process — possibly a missing `description` or `display_name` field, or a protocol mismatch causing Goose to disable the extension without logging an error.

## Diagnostic Steps To Try

1. Check Goose CLI logs for extension loading errors:
   ```bash
   podman exec goose-web find /root/.local/state/goose/logs -name "*.log" -exec cat {} \;
   ```

2. Check if Goose expects `notifications/initialized` after `initialize`:
   ```bash
   printf '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"goose","version":"1.28.0"}}}\n{"jsonrpc":"2.0","method":"notifications/initialized"}\n{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}\n' \
   | podman exec -i goose-web node /app/src/server.js 2>/dev/null
   ```

3. Test with Goose's built-in extension test command (if available):
   ```bash
   podman exec goose-web goose configure --help
   ```

4. Try adding the extension via Goose CLI instead of editing config.yaml directly:
   ```bash
   podman exec -it goose-web goose configure
   ```

## Search Wiki (Separate Issue)

The `search_wiki` tool depends on the gateway's embedding generation, which uses OpenRouter. The gateway container (`wikijs-gateway`) has its own `OPENROUTER_API_KEY` env var. If that key is also the old invalidated one, search will fail with a 401. Check and update:

```bash
podman exec wikijs-gateway env | grep OPENROUTER
```

## Files

| File | Location | Purpose |
|------|----------|---------|
| MCP server | `/app/src/server.js` (in container) | stdio JSON-RPC server |
| Goose config | `/root/.config/goose/config.yaml` (persistent volume) | Extension registration |
| Gateway env | `~/deploy/.env` on host | API keys and URLs |
| Start script | `~/deploy/start.sh` on host | Container launcher |
