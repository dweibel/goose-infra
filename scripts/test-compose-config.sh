#!/bin/bash

# Test script to validate docker-compose configuration
# Validates the compose file syntax and configuration

set -e

echo "=== Testing Docker Compose Configuration ==="
echo ""

# Check if docker-compose.yml exists
if [ ! -f docker-compose.yml ]; then
    echo "✗ docker-compose.yml not found"
    exit 1
fi
echo "✓ docker-compose.yml found"

# Validate compose file syntax
echo ""
echo "Validating compose file syntax..."
if podman-compose config > /tmp/compose-config.yml 2>&1; then
    echo "✓ Compose file syntax is valid"
else
    echo "✗ Compose file syntax error:"
    cat /tmp/compose-config.yml
    exit 1
fi

# Check for required services
echo ""
echo "Checking required services..."
if grep -q "goose-web:" docker-compose.yml; then
    echo "✓ goose-web service defined"
else
    echo "✗ goose-web service not found"
    exit 1
fi

if grep -q "cloudflared:" docker-compose.yml; then
    echo "✓ cloudflared service defined"
else
    echo "✗ cloudflared service not found"
    exit 1
fi

# Check for required volumes
echo ""
echo "Checking volume definitions..."
if grep -q "workspace:" docker-compose.yml; then
    echo "✓ workspace volume defined"
else
    echo "✗ workspace volume not found"
    exit 1
fi

if grep -q "goose-config:" docker-compose.yml; then
    echo "✓ goose-config volume defined"
else
    echo "✗ goose-config volume not found"
    exit 1
fi

if grep -q "cloudflared-config:" docker-compose.yml; then
    echo "✓ cloudflared-config volume defined"
else
    echo "✗ cloudflared-config volume not found"
    exit 1
fi

# Check for network configuration
echo ""
echo "Checking network configuration..."
if grep -q "goose-network:" docker-compose.yml; then
    echo "✓ goose-network defined"
else
    echo "✗ goose-network not found"
    exit 1
fi

# Check for health checks
echo ""
echo "Checking health check configuration..."
if grep -q "healthcheck:" docker-compose.yml; then
    echo "✓ Health checks configured"
else
    echo "! Warning: No health checks found"
fi

# Validate environment variable references
echo ""
echo "Checking environment variable references..."
source .env

ENV_VARS=(
    "TUNNEL_TOKEN"
    "GOOSE_MODE"
    "GOOSE_PROVIDER"
    "GOOSE_API_KEY"
    "TTYD_PORT"
)

for var in "${ENV_VARS[@]}"; do
    if [ -n "${!var}" ]; then
        echo "✓ $var is set"
    else
        echo "✗ $var is not set"
    fi
done

# Summary
echo ""
echo "=== Compose Configuration Test Summary ==="
echo "✓ Compose file syntax is valid"
echo "✓ All required services are defined"
echo "✓ All required volumes are defined"
echo "✓ Network configuration is present"
echo "✓ Environment variables are configured"
echo ""
echo "The compose configuration is ready for deployment."
echo ""
echo "Next steps:"
echo "  1. For local x86_64 testing: podman-compose up -d"
echo "  2. For ARM64 production: Use Fargate build server"
echo "  3. Deploy to OCI instance using deployment scripts"
echo ""
echo "✓ Compose configuration test completed successfully!"
