#!/bin/bash

# Test script for goose terminal functionality
# This script helps verify that the terminal is accessible and functional

echo "Testing goose terminal functionality..."
echo "========================================"

# Test 1: Check if terminal is accessible locally
LOCAL_STATUS=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:7681)
if [ "$LOCAL_STATUS" = "200" ]; then
    echo "✓ Local terminal accessible (HTTP $LOCAL_STATUS)"
else
    echo "✗ Local terminal not accessible (HTTP $LOCAL_STATUS)"
    exit 1
fi

# Test 2: Check if terminal is accessible via Cloudflare tunnel
# Note: This requires external network access
TUNNEL_STATUS=$(curl -s -o /dev/null -w '%{http_code}' https://goose.dirkweibel.dev 2>/dev/null || echo "000")
if [ "$TUNNEL_STATUS" = "200" ]; then
    echo "✓ Cloudflare tunnel terminal accessible (HTTP $TUNNEL_STATUS)"
else
    echo "⚠ Cloudflare tunnel may not be accessible (HTTP $TUNNEL_STATUS)"
    echo "   This could be normal if testing from within the OCI instance"
fi

# Test 3: Check if ttyd process is running with correct parameters
TTYD_PROCESS=$(docker exec goose-infra-goose-web-1 ps aux | grep ttyd | grep -v grep)
if echo "$TTYD_PROCESS" | grep -q "--readonly"; then
    echo "✗ Terminal is running in READONLY mode"
    echo "   Process: $TTYD_PROCESS"
    exit 1
else
    echo "✓ Terminal is running in WRITABLE mode"
    if echo "$TTYD_PROCESS" | grep -q "--port 7681"; then
        echo "✓ Terminal configured on correct port (7681)"
    fi
fi

# Test 4: Check cloudflared connection to terminal
CLOUDFLARED_LOGS=$(docker logs goose-infra-cloudflared-1 2>&1 | tail -5)
if echo "$CLOUDFLARED_LOGS" | grep -q "Connected"; then
    echo "✓ Cloudflared tunnel is connected"
else
    echo "⚠ Cloudflared connection status unknown"
fi

echo ""
echo "========================================"
echo "Terminal test completed successfully!"
echo ""
echo "Access the terminal at: https://goose.dirkweibel.dev"
echo "The terminal should now be writable and functional."