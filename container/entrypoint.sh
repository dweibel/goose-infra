#!/bin/bash

# Entrypoint script for goose-web container
# Handles both interactive and headless modes

set -e

# Default values
TTYD_PORT=${TTYD_PORT:-7681}
GOOSE_MODE=${GOOSE_MODE:-interactive}

# ---------------------------------------------------------------------------
# Load secrets from /run/secrets (podman secrets)
# ---------------------------------------------------------------------------
# Podman mounts secrets as files. Write them to a profile snippet so every
# bash session (including ttyd) picks them up.
# ---------------------------------------------------------------------------
SECRETS_PROFILE="/etc/profile.d/goose-secrets.sh"
: > "${SECRETS_PROFILE}"

for secret in goose-openrouter-key goose-wiki-gateway-key goose-tunnel-token; do
    if [ -f "/run/secrets/${secret}" ]; then
        value="$(cat /run/secrets/${secret} | tr -d '\r\n')"
        case "${secret}" in
            goose-openrouter-key)    echo "export OPENROUTER_API_KEY='${value}'" >> "${SECRETS_PROFILE}" ;;
            goose-wiki-gateway-key)  echo "export WIKI_GATEWAY_API_KEY='${value}'" >> "${SECRETS_PROFILE}" ;;
            goose-tunnel-token)      echo "export TUNNEL_TOKEN='${value}'" >> "${SECRETS_PROFILE}" ;;
        esac
    fi
done

# Also export for the current process (used by config.yaml generation below)
source "${SECRETS_PROFILE}" 2>/dev/null || true

# ---------------------------------------------------------------------------
# Generate Goose config.yaml
# ---------------------------------------------------------------------------
# We deliberately omit the old wiki stdio extension (which caused segfaults).
# Wiki access is now provided by the wiki-cli binary on PATH.
# ---------------------------------------------------------------------------
GOOSE_CONFIG_DIR="/root/.config/goose"
mkdir -p "${GOOSE_CONFIG_DIR}"

cat > "${GOOSE_CONFIG_DIR}/config.yaml" <<EOF
GOOSE_PROVIDER: "${GOOSE_PROVIDER:-openrouter}"
GOOSE_MODEL: "${GOOSE_MODEL:-}"

extensions:
  developer:
    bundled: true
    enabled: true
    name: developer
    timeout: 300
    type: builtin
EOF

echo "Generated Goose config at ${GOOSE_CONFIG_DIR}/config.yaml (wiki stdio extension removed)"

echo "Starting Goose Terminal in ${GOOSE_MODE} mode..."

# Start ttyd with appropriate Goose command based on mode
if [ "$GOOSE_MODE" = "auto" ]; then
    # Headless mode — load the wiki-assistant recipe so Goose knows about wiki-cli
    echo "Headless mode activated"
    exec ttyd -p ${TTYD_PORT} -W bash -lc "goose session start --mode auto --recipe /app/recipes/wiki-assistant.yaml"
else
    # Interactive mode — standard terminal (login shell sources /etc/profile.d/)
    echo "Interactive mode activated"
    echo "Tip: start a wiki-aware session with: goose session start --recipe /app/recipes/wiki-assistant.yaml"
    exec ttyd -p ${TTYD_PORT} -W bash -l
fi
