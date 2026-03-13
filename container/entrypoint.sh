#!/bin/bash

# Entrypoint script for goose-web container
# Handles both interactive and headless modes

set -e

# Default values
TTYD_PORT=${TTYD_PORT:-7681}
GOOSE_MODE=${GOOSE_MODE:-interactive}

echo "Starting Goose Terminal in ${GOOSE_MODE} mode..."

# Start ttyd with appropriate Goose command based on mode
if [ "$GOOSE_MODE" = "auto" ]; then
    # Headless mode - no interactive prompts
    echo "Headless mode activated"
    exec ttyd -p ${TTYD_PORT} -W bash -c "goose session start --mode auto"
else
    # Interactive mode - standard terminal
    echo "Interactive mode activated"
    exec ttyd -p ${TTYD_PORT} -W bash
fi
