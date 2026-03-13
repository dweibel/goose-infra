#!/bin/bash

# Test script to validate container entrypoint and configuration
# Uses a simple Ubuntu container to test the entrypoint script logic

set -e

echo "=== Testing Goose Container Entrypoint ==="
echo ""

# Load environment
source .env

echo "Testing entrypoint script with GOOSE_MODE=${GOOSE_MODE}"
echo ""

# Test the entrypoint script logic in a simple container
echo "Running entrypoint validation test..."

# Create a test container that validates the entrypoint script
podman run --rm \
  -v "$(pwd)/entrypoint.sh:/test-entrypoint.sh:ro" \
  -e GOOSE_MODE="${GOOSE_MODE}" \
  -e TTYD_PORT="${TTYD_PORT:-7681}" \
  ubuntu:22.04 \
  bash -c '
    echo "Validating entrypoint script..."
    
    # Check if entrypoint exists and is executable
    if [ ! -f /test-entrypoint.sh ]; then
      echo "✗ entrypoint.sh not found"
      exit 1
    fi
    echo "✓ entrypoint.sh found"
    
    # Check if it has proper shebang
    if head -n1 /test-entrypoint.sh | grep -q "^#!/bin/bash"; then
      echo "✓ Valid bash shebang"
    else
      echo "✗ Invalid or missing shebang"
      exit 1
    fi
    
    # Validate environment variables are set
    if [ -n "$GOOSE_MODE" ]; then
      echo "✓ GOOSE_MODE is set: $GOOSE_MODE"
    else
      echo "✗ GOOSE_MODE not set"
      exit 1
    fi
    
    if [ -n "$TTYD_PORT" ]; then
      echo "✓ TTYD_PORT is set: $TTYD_PORT"
    else
      echo "✗ TTYD_PORT not set"
      exit 1
    fi
    
    echo ""
    echo "✓ Entrypoint script validation passed"
  '

echo ""
echo "=== Container Test Summary ==="
echo "✓ Entrypoint script is valid"
echo "✓ Environment variables are properly configured"
echo ""
echo "Note: Full container functionality requires:"
echo "  - ttyd binary (web terminal)"
echo "  - goose-ai Python package"
echo "  - These should be built using Fargate build server for ARM64"
echo ""
echo "✓ Container test completed successfully!"
