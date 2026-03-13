#!/bin/bash

# Local test script for Goose container
# Tests configuration and validates environment without full deployment

set -e

echo "=== Goose Container Local Test ==="
echo ""

# Check for .env file
if [ ! -f .env ]; then
    echo "ERROR: .env file not found!"
    exit 1
fi

echo "✓ .env file found"

# Load environment variables
source .env

# Validate required variables
echo ""
echo "Checking required environment variables..."

REQUIRED_VARS=("TUNNEL_TOKEN" "GOOSE_PROVIDER" "GOOSE_API_KEY")
MISSING_VARS=()
PLACEHOLDER_VARS=()

for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        MISSING_VARS+=("$var")
    elif [ "${!var}" = "your_tunnel_token_here" ] || [ "${!var}" = "your_api_key_here" ]; then
        PLACEHOLDER_VARS+=("$var")
    else
        echo "✓ $var is set"
    fi
done

if [ ${#MISSING_VARS[@]} -gt 0 ]; then
    echo ""
    echo "ERROR: Missing variables:"
    for var in "${MISSING_VARS[@]}"; do
        echo "  ✗ $var"
    done
    exit 1
fi

if [ ${#PLACEHOLDER_VARS[@]} -gt 0 ]; then
    echo ""
    echo "WARNING: Placeholder values detected:"
    for var in "${PLACEHOLDER_VARS[@]}"; do
        echo "  ! $var (still has placeholder value)"
    done
fi

# Check Podman
echo ""
echo "Checking Podman installation..."
if command -v podman &> /dev/null; then
    PODMAN_VERSION=$(podman --version)
    echo "✓ Podman installed: $PODMAN_VERSION"
else
    echo "✗ Podman not found"
    exit 1
fi

# Check podman-compose
if command -v podman-compose &> /dev/null; then
    COMPOSE_VERSION=$(podman-compose --version | head -n1)
    echo "✓ podman-compose installed: $COMPOSE_VERSION"
else
    echo "✗ podman-compose not found"
    exit 1
fi

# Validate Dockerfile exists
echo ""
echo "Checking Dockerfile..."
if [ -f Dockerfile.goose-web ]; then
    echo "✓ Dockerfile.goose-web found"
else
    echo "✗ Dockerfile.goose-web not found"
    exit 1
fi

# Validate entrypoint script
if [ -f entrypoint.sh ]; then
    echo "✓ entrypoint.sh found"
else
    echo "✗ entrypoint.sh not found"
    exit 1
fi

# Validate docker-compose.yml
if [ -f docker-compose.yml ]; then
    echo "✓ docker-compose.yml found"
else
    echo "✗ docker-compose.yml not found"
    exit 1
fi

# Test Podman functionality
echo ""
echo "Testing Podman functionality..."
if podman run --rm hello-world > /tmp/podman-test.log 2>&1; then
    echo "✓ Podman can run containers"
else
    echo "✗ Podman test failed"
    cat /tmp/podman-test.log
    exit 1
fi

# Check for existing containers
echo ""
echo "Checking for existing containers..."
EXISTING=$(podman ps -a --filter name=goose-web --format "{{.Names}}" 2>/dev/null || true)
if [ -n "$EXISTING" ]; then
    echo "! Found existing goose-web container"
    podman ps -a --filter name=goose-web
else
    echo "✓ No existing goose-web container"
fi

# Summary
echo ""
echo "=== Test Summary ==="
echo "✓ Configuration validated"
echo "✓ Podman is functional"
echo "✓ All required files present"
echo ""
echo "Environment Configuration:"
echo "  - GOOSE_MODE: ${GOOSE_MODE:-interactive}"
echo "  - GOOSE_PROVIDER: ${GOOSE_PROVIDER}"
echo "  - TTYD_PORT: ${TTYD_PORT:-7681}"
echo "  - LOG_LEVEL: ${LOG_LEVEL:-INFO}"
echo ""
echo "Note: Due to WSL/systemd limitations, full container builds"
echo "should be done using the Fargate build server for ARM64 targets."
echo ""
echo "To deploy to production, use the deployment scripts in agent-infra."
echo ""
echo "✓ Local test completed successfully!"
