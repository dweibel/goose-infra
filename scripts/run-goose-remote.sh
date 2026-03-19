#!/bin/bash
set -e
podman rm -f goose-web 2>/dev/null || true
podman run -d \
  --name goose-web \
  --network goose-network \
  -v goose-config:/root/.config/goose \
  -v workspace:/workspace \
  --restart unless-stopped \
  -e GOOSE_PROVIDER=openrouter \
  -e GOOSE_MODEL=qwen/qwen3.5-flash-02-23 \
  -e GOOSE_LEAD_PROVIDER=openrouter \
  -e GOOSE_LEAD_MODEL=anthropic/claude-sonnet-4.6 \
  -e GOOSE_LEAD_TURNS=3 \
  -e GOOSE_LEAD_FALLBACK_TURNS=2 \
  -e GOOSE_LEAD_FAILURE_THRESHOLD=2 \
  -e GOOSE_MODE=interactive \
  -e GOOSE_CONTEXT_STRATEGY=default \
  -e GOOSE_MAX_TURNS=10 \
  -e GOOSE_TELEMETRY_ENABLED=false \
  -e GOOSE_DISABLE_KEYRING=1 \
  -e TTYD_PORT=7681 \
  -e LOG_LEVEL=INFO \
  -e SHELL=/bin/bash \
  goose-web:latest
echo "Container started:"
podman ps --filter name=goose-web
