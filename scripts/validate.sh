#!/bin/bash

# Validation script for Goose container deployment on OCI
# Performs comprehensive checks to verify the deployment is working correctly

set -e

# Configuration
OCI_IP="${OCI_IP:-193.122.215.174}"
OCI_USER="opc"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/oci_agent_coder}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
PASSED=0
FAILED=0
WARNINGS=0

echo "=========================================="
echo "  Goose Container Deployment Validation"
echo "=========================================="
echo ""
echo "Target: ${OCI_USER}@${OCI_IP}"
echo "Date: $(date)"
echo ""

# Helper functions
pass() {
    echo -e "${GREEN}✓${NC} $1"
    ((PASSED++))
}

fail() {
    echo -e "${RED}✗${NC} $1"
    ((FAILED++))
}

warn() {
    echo -e "${YELLOW}!${NC} $1"
    ((WARNINGS++))
}

info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

section() {
    echo ""
    echo "=== $1 ==="
}

# Check SSH connectivity
section "SSH Connectivity"
if ssh -i "${SSH_KEY}" -o ConnectTimeout=5 "${OCI_USER}@${OCI_IP}" 'echo "SSH OK"' > /tmp/ssh-test.txt 2>&1; then
    pass "SSH connection successful"
else
    fail "SSH connection failed"
    cat /tmp/ssh-test.txt
    exit 1
fi

# Check Podman
section "Podman Status"
ssh -i "${SSH_KEY}" "${OCI_USER}@${OCI_IP}" 'podman --version' > /tmp/podman-version.txt 2>&1
if grep -q "podman version" /tmp/podman-version.txt; then
    VERSION=$(cat /tmp/podman-version.txt)
    pass "Podman installed: ${VERSION}"
else
    fail "Podman not found or not working"
fi

# Check goose-web container
section "Goose-Web Container"

# Container exists
ssh -i "${SSH_KEY}" "${OCI_USER}@${OCI_IP}" 'podman ps -a --filter name=goose-web --format "{{.Names}}"' > /tmp/container-check.txt 2>&1
if grep -q "goose-web" /tmp/container-check.txt; then
    pass "goose-web container exists"
else
    fail "goose-web container not found"
fi

# Container running
ssh -i "${SSH_KEY}" "${OCI_USER}@${OCI_IP}" 'podman ps --filter name=goose-web --format "{{.Status}}"' > /tmp/container-status.txt 2>&1
if grep -q "Up" /tmp/container-status.txt; then
    STATUS=$(cat /tmp/container-status.txt)
    pass "goose-web container is running: ${STATUS}"
else
    fail "goose-web container is not running"
    cat /tmp/container-status.txt
fi

# Check image
ssh -i "${SSH_KEY}" "${OCI_USER}@${OCI_IP}" 'podman images goose-web --format "{{.Repository}}:{{.Tag}} {{.Size}}"' > /tmp/image-info.txt 2>&1
if grep -q "goose-web" /tmp/image-info.txt; then
    IMAGE_INFO=$(cat /tmp/image-info.txt)
    pass "goose-web image found: ${IMAGE_INFO}"
else
    fail "goose-web image not found"
fi

# Check architecture
ssh -i "${SSH_KEY}" "${OCI_USER}@${OCI_IP}" 'podman inspect goose-web:latest --format "{{.Architecture}}"' > /tmp/arch.txt 2>&1
ARCH=$(cat /tmp/arch.txt | tr -d '\n\r')
if [ "$ARCH" = "arm64" ]; then
    pass "Image architecture is ARM64"
else
    fail "Image architecture is ${ARCH}, expected arm64"
fi

# Check port binding
ssh -i "${SSH_KEY}" "${OCI_USER}@${OCI_IP}" 'podman port goose-web' > /tmp/ports.txt 2>&1
if grep -q "7681" /tmp/ports.txt; then
    PORT_INFO=$(cat /tmp/ports.txt)
    pass "Port 7681 is exposed: ${PORT_INFO}"
else
    fail "Port 7681 is not exposed"
fi

# Check container logs for errors
section "Container Health"
ssh -i "${SSH_KEY}" "${OCI_USER}@${OCI_IP}" 'podman logs goose-web --tail 50' > /tmp/goose-logs.txt 2>&1

if grep -q "Listening on port: 7681" /tmp/goose-logs.txt; then
    pass "ttyd is listening on port 7681"
else
    fail "ttyd not listening on expected port"
fi

if grep -q "Interactive mode activated" /tmp/goose-logs.txt; then
    pass "Goose started in interactive mode"
else
    warn "Interactive mode message not found in logs"
fi

if grep -qi "error" /tmp/goose-logs.txt; then
    warn "Errors found in container logs (check details below)"
    echo "--- Recent Errors ---"
    grep -i "error" /tmp/goose-logs.txt | tail -5
else
    pass "No errors in container logs"
fi

# Check volumes
section "Volume Configuration"
ssh -i "${SSH_KEY}" "${OCI_USER}@${OCI_IP}" 'podman inspect goose-web --format "{{range .Mounts}}{{.Destination}} -> {{.Source}}\n{{end}}"' > /tmp/volumes.txt 2>&1

if grep -q "/workspace" /tmp/volumes.txt; then
    pass "Workspace volume mounted"
else
    warn "Workspace volume not found"
fi

if grep -q "/root/.config/goose" /tmp/volumes.txt; then
    pass "Goose config volume mounted"
else
    warn "Goose config volume not found"
fi

# Check environment variables
section "Environment Variables"
ssh -i "${SSH_KEY}" "${OCI_USER}@${OCI_IP}" 'podman exec goose-web env' > /tmp/env-vars.txt 2>&1

check_env() {
    local var_name=$1
    if grep -q "^${var_name}=" /tmp/env-vars.txt; then
        local var_value=$(grep "^${var_name}=" /tmp/env-vars.txt | cut -d= -f2)
        pass "${var_name} is set"
    else
        warn "${var_name} is not set"
    fi
}

check_env "GOOSE_MODE"
check_env "GOOSE_PROVIDER"
check_env "TTYD_PORT"

# Check goose binary
section "Goose Binary"
ssh -i "${SSH_KEY}" "${OCI_USER}@${OCI_IP}" 'podman exec goose-web goose --version' > /tmp/goose-version.txt 2>&1
if [ $? -eq 0 ]; then
    GOOSE_VERSION=$(cat /tmp/goose-version.txt)
    pass "Goose CLI is installed: ${GOOSE_VERSION}"
else
    fail "Goose CLI not found or not working"
fi

# Check ttyd binary
ssh -i "${SSH_KEY}" "${OCI_USER}@${OCI_IP}" 'podman exec goose-web ttyd --version' > /tmp/ttyd-version.txt 2>&1
if grep -q "ttyd" /tmp/ttyd-version.txt; then
    TTYD_VERSION=$(cat /tmp/ttyd-version.txt)
    pass "ttyd is installed: ${TTYD_VERSION}"
else
    fail "ttyd not found or not working"
fi

# Check cloudflared container
section "Cloudflared Tunnel"

ssh -i "${SSH_KEY}" "${OCI_USER}@${OCI_IP}" 'podman ps --filter name=cloudflared --format "{{.Names}}"' > /tmp/cloudflared-check.txt 2>&1
if grep -q "cloudflared" /tmp/cloudflared-check.txt; then
    pass "cloudflared container exists"
    
    # Check if running
    ssh -i "${SSH_KEY}" "${OCI_USER}@${OCI_IP}" 'podman ps --filter name=cloudflared --format "{{.Status}}"' > /tmp/cloudflared-status.txt 2>&1
    if grep -q "Up" /tmp/cloudflared-status.txt; then
        pass "cloudflared container is running"
        
        # Check tunnel connections
        ssh -i "${SSH_KEY}" "${OCI_USER}@${OCI_IP}" 'podman logs cloudflared --tail 50' > /tmp/cloudflared-logs.txt 2>&1
        CONNECTION_COUNT=$(grep -c "Registered tunnel connection" /tmp/cloudflared-logs.txt || echo "0")
        if [ "$CONNECTION_COUNT" -ge 1 ]; then
            pass "Cloudflare tunnel has ${CONNECTION_COUNT} registered connection(s)"
        else
            fail "No tunnel connections registered"
        fi
        
        # Check for tunnel errors
        if grep -qi "error" /tmp/cloudflared-logs.txt | grep -v "ICMP"; then
            warn "Errors found in cloudflared logs"
        else
            pass "No critical errors in cloudflared logs"
        fi
    else
        fail "cloudflared container is not running"
    fi
else
    warn "cloudflared container not found (tunnel may not be configured)"
fi

# Network connectivity test
section "Network Connectivity"

# Test local port
ssh -i "${SSH_KEY}" "${OCI_USER}@${OCI_IP}" 'curl -s -o /dev/null -w "%{http_code}" http://localhost:7681' > /tmp/local-test.txt 2>&1
HTTP_CODE=$(cat /tmp/local-test.txt)
if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "101" ]; then
    pass "Local port 7681 is responding (HTTP ${HTTP_CODE})"
else
    warn "Local port 7681 returned HTTP ${HTTP_CODE}"
fi

# Test from external (if accessible)
info "Testing external access to https://goose.dirkweibel.dev..."
if curl -s -o /dev/null -w "%{http_code}" https://goose.dirkweibel.dev > /tmp/external-test.txt 2>&1; then
    EXT_CODE=$(cat /tmp/external-test.txt)
    if [ "$EXT_CODE" = "200" ] || [ "$EXT_CODE" = "302" ] || [ "$EXT_CODE" = "401" ]; then
        pass "External URL is accessible (HTTP ${EXT_CODE})"
    else
        warn "External URL returned HTTP ${EXT_CODE}"
    fi
else
    warn "Could not test external URL (may require authentication)"
fi

# Resource usage
section "Resource Usage"
ssh -i "${SSH_KEY}" "${OCI_USER}@${OCI_IP}" 'podman stats --no-stream --format "{{.Name}}: CPU={{.CPUPerc}} MEM={{.MemUsage}}" goose-web cloudflared' > /tmp/stats.txt 2>&1
if [ -s /tmp/stats.txt ]; then
    info "Container resource usage:"
    cat /tmp/stats.txt | while read line; do
        echo "  $line"
    done
else
    warn "Could not retrieve resource usage stats"
fi

# Summary
section "Validation Summary"
echo ""
echo "Results:"
echo -e "  ${GREEN}Passed:${NC}   ${PASSED}"
echo -e "  ${RED}Failed:${NC}   ${FAILED}"
echo -e "  ${YELLOW}Warnings:${NC} ${WARNINGS}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All critical checks passed!${NC}"
    echo ""
    echo "Your Goose container deployment is working correctly."
    echo "Access your terminal at: https://goose.dirkweibel.dev"
    exit 0
else
    echo -e "${RED}✗ Some checks failed!${NC}"
    echo ""
    echo "Please review the failed checks above and take corrective action."
    exit 1
fi
