#!/bin/bash
# Create network if it doesn't exist
podman network exists goose-network || podman network create goose-network

# Load environment from .env file
SCRIPT_DIR="$(dirname "$(readlink -f "$0")")"
ENV_FILE="${SCRIPT_DIR}/../.env"
if [ -f "$ENV_FILE" ]; then
    set -a
    source "$ENV_FILE"
    set +a
    echo "Loaded environment from $ENV_FILE"
elif [ -f "${SCRIPT_DIR}/.env" ]; then
    set -a
    source "${SCRIPT_DIR}/.env"
    set +a
    echo "Loaded environment from ${SCRIPT_DIR}/.env"
else
    echo "WARNING: .env file not found at $ENV_FILE or ${SCRIPT_DIR}/.env"
fi

# Start the container
podman run -d --name goose-web \
  --network goose-network \
  -v workspace:/workspace \
  -v goose-config:/root/.config/goose \
  -e GOOSE_MODE=${GOOSE_MODE:-interactive} \
  -e GOOSE_KEYRING_BACKEND=plaintext \
  -e GOOSE_DISABLE_KEYRING=1 \
  -e GOOSE_PROVIDER=${GOOSE_PROVIDER} \
  -e OPENROUTER_API_KEY=${OPENROUTER_API_KEY} \
  -e GOOSE_MODEL=${GOOSE_MODEL} \
  -e GOOSE_LEAD_MODEL=${GOOSE_LEAD_MODEL} \
  -e GOOSE_LEAD_PROVIDER=${GOOSE_LEAD_PROVIDER} \
  -e GOOSE_LEAD_TURNS=${GOOSE_LEAD_TURNS} \
  -e GOOSE_LEAD_FAILURE_THRESHOLD=${GOOSE_LEAD_FAILURE_THRESHOLD} \
  -e GOOSE_LEAD_FALLBACK_TURNS=${GOOSE_LEAD_FALLBACK_TURNS} \
  -p 7681:7681 \
  --restart unless-stopped \
  goose-web

sleep 2
podman ps | grep goose-web
