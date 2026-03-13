#!/bin/bash

# Stop script for Cloudflare Goose Terminal
# Gracefully shuts down the Podman Compose stack

set -e

echo "Stopping Cloudflare Goose Terminal..."

# Stop Podman Compose stack
podman-compose down

echo ""
echo "Cloudflare Goose Terminal stopped successfully!"
echo ""
echo "Note: Volumes are preserved. Your data is safe."
echo "To start again, run: ./scripts/start.sh"
