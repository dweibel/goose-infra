# MCP HTTP/WebSocket Transport Deployment

## Overview

The Wiki.js MCP server supports three transport layers:
- **Stdio** (default, always enabled) — for direct process communication
- **HTTP** (optional) — POST /mcp endpoint + GET /health
- **WebSocket** (optional) — persistent bidirectional connections on /ws

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `HTTP_TRANSPORT_ENABLED` | `false` | Enable HTTP transport |
| `HTTP_PORT` | `3000` | HTTP listen port |
| `WEBSOCKET_TRANSPORT_ENABLED` | `false` | Enable WebSocket transport |
| `WEBSOCKET_PORT` | `3001` | WebSocket listen port |
| `API_KEY` | (none) | Bearer token for auth (min 32 chars) |
| `RATE_LIMIT_WINDOW_MS` | `60000` | Rate limit window (ms) |
| `RATE_LIMIT_MAX_REQUESTS` | `100` | Max requests per window |
| `WS_MAX_CONNECTIONS` | `50` | Max concurrent WS connections |
| `WS_PING_INTERVAL_MS` | `30000` | WS keepalive ping interval (ms) |

## Enabling Transports

Set environment variables before starting the server:

```bash
export HTTP_TRANSPORT_ENABLED=true
export WEBSOCKET_TRANSPORT_ENABLED=true
export API_KEY=$(openssl rand -hex 32)
node src/server.js
```

## Health Check

```bash
curl http://localhost:3000/health
```

Returns 200 when healthy, 503 when database is disconnected. No authentication required.

## Cloudflare Tunnel

Use `container/cloudflare-tunnel-mcp.yml` as a template. Replace `<tunnel-id>` and hostname, then:

```bash
cloudflared tunnel create wiki-mcp
cloudflared tunnel route dns wiki-mcp mcp.yourdomain.com
cloudflared tunnel --config cloudflare-tunnel-mcp.yml run wiki-mcp
```

## Container Deployment (ARM64)

```bash
podman build -f container/Dockerfile.mcp-server -t wiki-mcp-server .
podman run -d --name wiki-mcp-server \
  -p 3000:3000 -p 3001:3001 \
  -e HTTP_TRANSPORT_ENABLED=true \
  -e WEBSOCKET_TRANSPORT_ENABLED=true \
  -e PG_HOST=postgres.internal \
  -e PG_DATABASE=wikijs \
  -e PG_USER=wikijs \
  -e PG_PASSWORD=secret \
  -e API_KEY=$(openssl rand -hex 32) \
  wiki-mcp-server:latest
```
