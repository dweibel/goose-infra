#!/bin/bash

# Start script for Cloudflare Goose Terminal
# Validates configuration and starts the Podman Compose stack

set -e

echo "Starting Cloudflare Goose Terminal..."

# Check for .env file
if [ ! -f .env ]; then
    echo "ERROR: .env file not found!"
    echo "Please copy .env.example to .env and configure your settings."
    exit 1
fi

# Validate required environment variables
source .env

REQUIRED_VARS=("TUNNEL_TOKEN" "GOOSE_PROVIDER" "GOOSE_API_KEY")
MISSING_VARS=()

for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ] || [ "${!var}" = "your_tunnel_token_here" ] || [ "${!var}" = "your_api_key_here" ]; then
        MISSING_VARS+=("$var")
    fi
done

if [ ${#MISSING_VARS[@]} -gt 0 ]; then
    echo "ERROR: The following required environment variables are missing or not configured:"
    for var in "${MISSING_VARS[@]}"; do
        echo "  - $var"
    done
    echo ""
    echo "Please update your .env file with valid values."
    exit 1
fi

# Start Podman Compose stack
echo "Configuration validated. Starting containers..."
podman-compose up -d

# Wait for containers to start
echo "Waiting for containers to become healthy..."
sleep 5

# Display status
echo ""
echo "Container Status:"
podman-compose ps

echo ""
echo "Health Check Results:"
podman inspect --format='{{.Name}}: {{.State.Health.Status}}' goose-web cloudflared 2>/dev/null || echo "Health checks initializing..."

echo ""
echo "Cloudflare Goose Terminal started successfully!"
echo "Access your terminal at: https://${TUNNEL_SUBDOMAIN:-your-subdomain.example.com}"
echo ""
echo "To view logs, run: ./scripts/logs.sh"
echo "To stop the stack, run: ./scripts/stop.sh"
