#!/bin/bash

# Logs script for Cloudflare Goose Terminal
# Displays logs from one or both containers

set -e

SERVICE=${1:-}
FOLLOW_FLAG=""

# Check for -f flag
if [ "$1" = "-f" ] || [ "$2" = "-f" ]; then
    FOLLOW_FLAG="-f"
    if [ "$1" = "-f" ]; then
        SERVICE=${2:-}
    fi
fi

# Display usage if invalid service specified
if [ -n "$SERVICE" ] && [ "$SERVICE" != "goose-web" ] && [ "$SERVICE" != "cloudflared" ]; then
    echo "Usage: $0 [SERVICE] [-f]"
    echo ""
    echo "SERVICE: goose-web, cloudflared, or omit for both"
    echo "-f: Follow log output (like tail -f)"
    echo ""
    echo "Examples:"
    echo "  $0              # Show logs from both services"
    echo "  $0 goose-web    # Show logs from goose-web only"
    echo "  $0 -f           # Follow logs from both services"
    echo "  $0 goose-web -f # Follow logs from goose-web only"
    exit 1
fi

# Display logs
if [ -z "$SERVICE" ]; then
    echo "Displaying logs from all services..."
    podman-compose logs $FOLLOW_FLAG
else
    echo "Displaying logs from $SERVICE..."
    podman-compose logs $FOLLOW_FLAG $SERVICE
fi
