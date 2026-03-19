#!/bin/bash
# Restart goose-web with corrected environment variables
set -e

OCI_IP="193.122.215.174"
SSH_KEY="$HOME/.ssh/oci_agent_coder"

# Create the run script on remote
ssh -i "$SSH_KEY" opc@$OCI_IP 'cat > /tmp/run-goose.sh << SCRIPT
#!/bin/bash
set -e

# Remove if exists
podman rm -f goose-web 2>/dev/null || true

# Start with corrected env vars
podman run -d \
  --name goose-web \
  --network goose-network \
  -v goose-config:/root/.config/goose \
  -v workspace:/workspace \
  --restart unless-stopped \
  -e GOOSE_PROVIDER=openai \
  -e GOOSE_PROVIDER__TYPE=openai \
  -e GOOSE_PROVIDER__HOST=https://openrouter.ai/api/v1 \
  -e GOOSE_PROVIDER__API_KEY=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 \
  -e OPENAI_API_KEY=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 \
  -e GOOSE_MODEL=qwen/qwen3.5-flash-02-23 \
  -e GOOSE_LEAD_PROVIDER=openai \
  -e GOOSE_LEAD_MODEL=anthropic/claude-sonnet-4.6 \
  -e GOOSE_LEAD_TURNS=3 \
  -e GOOSE_LEAD_FALLBACK_TURNS=2 \
  -e GOOSE_LEAD_FAILURE_THRESHOLD=2 \
  -e GOOSE_MODE=interactive \
  -e GOOSE_CONTEXT_STRATEGY=default \
  -e GOOSE_MAX_TURNS=10 \
  -e GOOSE_TELEMETRY_ENABLED=false \
  -e TTYD_PORT=7681 \
  -e LOG_LEVEL=INFO \
  -e SHELL=/bin/bash \
  goose-web:latest

echo "Container started:"
podman ps --filter name=goose-web
SCRIPT
chmod +x /tmp/run-goose.sh'

# Execute it
ssh -i "$SSH_KEY" opc@$OCI_IP 'bash /tmp/run-goose.sh' > /tmp/goose-restart.txt 2>&1
cat /tmp/goose-restart.txt
