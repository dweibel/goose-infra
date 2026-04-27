#!/bin/bash
# Start goose-web and cloudflared containers on the OCI instance.
# This is the single source of truth for what runs on this host.

set -e

# Create network if it doesn't exist
podman network exists goose-network || podman network create goose-network

# ---------------------------------------------------------------------------
# Load environment
# ---------------------------------------------------------------------------
SCRIPT_DIR="$(dirname "$(readlink -f "$0")")"
ENV_FILE="${SCRIPT_DIR}/../.env"
SECRETS_FILE="${SCRIPT_DIR}/../.env.secrets"

if [ -f "$ENV_FILE" ]; then
    set -a; source "$ENV_FILE"; set +a
    echo "Loaded environment from $ENV_FILE"
elif [ -f "${SCRIPT_DIR}/.env" ]; then
    set -a; source "${SCRIPT_DIR}/.env"; set +a
    echo "Loaded environment from ${SCRIPT_DIR}/.env"
else
    echo "WARNING: .env file not found at $ENV_FILE or ${SCRIPT_DIR}/.env"
fi

if [ -f "$SECRETS_FILE" ]; then
    set -a; source "$SECRETS_FILE"; set +a
    echo "Loaded secrets from $SECRETS_FILE"
elif [ -f "${SCRIPT_DIR}/.env.secrets" ]; then
    set -a; source "${SCRIPT_DIR}/.env.secrets"; set +a
    echo "Loaded secrets from ${SCRIPT_DIR}/.env.secrets"
fi

# ---------------------------------------------------------------------------
# Create/update podman secrets from env vars
# ---------------------------------------------------------------------------
_create_secret() {
    local name="$1" value="$2"
    if [ -n "${value}" ]; then
        podman secret rm "${name}" 2>/dev/null || true
        printf '%s' "${value}" | podman secret create "${name}" -
        echo "  ✓ ${name}"
    fi
}

echo "Provisioning secrets..."
_create_secret goose-openrouter-key   "${OPENROUTER_API_KEY}"
_create_secret goose-wiki-gateway-key "${WIKI_GATEWAY_API_KEY}"
_create_secret goose-tunnel-token     "${TUNNEL_TOKEN}"

# ---------------------------------------------------------------------------
# Start goose-web
# ---------------------------------------------------------------------------
echo ""
echo "Starting goose-web..."
podman run -d --name goose-web \
  --network goose-network \
  -v workspace:/workspace \
  -v goose-config:/root/.config/goose \
  --secret goose-openrouter-key \
  --secret goose-wiki-gateway-key \
  -e GOOSE_MODE=${GOOSE_MODE:-interactive} \
  -e GOOSE_KEYRING_BACKEND=plaintext \
  -e GOOSE_DISABLE_KEYRING=1 \
  -e GOOSE_PROVIDER=${GOOSE_PROVIDER} \
  -e GOOSE_MODEL=${GOOSE_MODEL} \
  -e GOOSE_LEAD_MODEL=${GOOSE_LEAD_MODEL} \
  -e GOOSE_LEAD_PROVIDER=${GOOSE_LEAD_PROVIDER} \
  -e GOOSE_LEAD_TURNS=${GOOSE_LEAD_TURNS} \
  -e GOOSE_LEAD_FAILURE_THRESHOLD=${GOOSE_LEAD_FAILURE_THRESHOLD} \
  -e GOOSE_LEAD_FALLBACK_TURNS=${GOOSE_LEAD_FALLBACK_TURNS} \
  -e WIKI_GATEWAY_URL=${WIKI_GATEWAY_URL:-http://host.containers.internal:3001} \
  -e ENABLE_WRITE_OPS=${ENABLE_WRITE_OPS:-true} \
  -p 7681:7681 \
  -p 1313:1313 \
  --restart unless-stopped \
  goose-web

sleep 2
echo "goose-web status:"
podman ps --filter name=goose-web --format "  {{.Names}}  {{.Status}}  {{.Ports}}"

# ---------------------------------------------------------------------------
# Start cloudflared tunnel
# ---------------------------------------------------------------------------
echo ""
echo "Starting cloudflared tunnel..."

# Pull image if not present
if ! podman image exists docker.io/cloudflare/cloudflared:latest; then
    echo "  Pulling cloudflared image..."
    podman pull docker.io/cloudflare/cloudflared:latest
fi

# Read tunnel token from podman secret
CF_TOKEN=$(podman secret inspect goose-tunnel-token --showsecret \
    | python3 -c "import sys,json; print(json.load(sys.stdin)[0]['SecretData'])" 2>/dev/null)

if [ -z "${CF_TOKEN}" ]; then
    echo "ERROR: Could not read goose-tunnel-token secret. Tunnel not started."
    echo "Ensure TUNNEL_TOKEN is set in .env.secrets and re-run."
    exit 1
fi

podman run -d --name cloudflared \
  --network goose-network \
  --restart unless-stopped \
  docker.io/cloudflare/cloudflared:latest \
  tunnel run --token "${CF_TOKEN}"

sleep 3
echo "cloudflared status:"
podman ps --filter name=cloudflared --format "  {{.Names}}  {{.Status}}"

# Quick health check — look for at least one registered connection
CF_CONNS=$(podman logs cloudflared 2>&1 | grep -c "Registered tunnel connection" || true)
if [ "${CF_CONNS}" -ge 1 ]; then
    echo "  ✓ Tunnel connected (${CF_CONNS} connection(s) registered)"
else
    echo "  ⚠ No tunnel connections yet — check: podman logs cloudflared"
fi

echo ""
echo "Done. All services started."
