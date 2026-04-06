#!/bin/bash

# Entrypoint script for goose-web container
# Handles both interactive and headless modes

set -e

# Default values
TTYD_PORT=${TTYD_PORT:-7681}
GOOSE_MODE=${GOOSE_MODE:-interactive}

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
    exec ttyd -p ${TTYD_PORT} -W bash -c "goose session start --mode auto --recipe /app/recipes/wiki-assistant.yaml"
else
    # Interactive mode — standard terminal
    echo "Interactive mode activated"
    echo "Tip: start a wiki-aware session with: goose session start --recipe /app/recipes/wiki-assistant.yaml"
    exec ttyd -p ${TTYD_PORT} -W bash
fi
