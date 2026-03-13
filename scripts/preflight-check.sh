#!/bin/bash

# Pre-flight check script for Cloudflare Goose Terminal
# Verifies all prerequisites are met before deployment

set -e

echo "=========================================="
echo "Cloudflare Goose Terminal - Pre-flight Check"
echo "=========================================="
echo ""

ERRORS=0
WARNINGS=0

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check functions
check_pass() {
    echo -e "${GREEN}✓${NC} $1"
}

check_fail() {
    echo -e "${RED}✗${NC} $1"
    ((ERRORS++))
}

check_warn() {
    echo -e "${YELLOW}⚠${NC} $1"
    ((WARNINGS++))
}

echo "Checking prerequisites..."
echo ""

# 1. Check Podman
echo "1. Checking Podman installation..."
if command -v podman &> /dev/null; then
    PODMAN_VERSION=$(podman --version)
    check_pass "Podman is installed: $PODMAN_VERSION"
else
    check_fail "Podman is not installed"
    echo "   Install: sudo apt-get install -y podman (Linux)"
    echo "   Install: brew install podman (macOS)"
fi
echo ""

# 2. Check podman-compose
echo "2. Checking podman-compose installation..."
if command -v podman-compose &> /dev/null; then
    COMPOSE_VERSION=$(podman-compose --version 2>&1 || echo "unknown")
    check_pass "podman-compose is installed: $COMPOSE_VERSION"
else
    check_fail "podman-compose is not installed"
    echo "   Install: sudo apt-get install -y podman-compose (Linux)"
    echo "   Install: brew install podman-compose (macOS)"
fi
echo ""

# 3. Check Podman is working
echo "3. Testing Podman functionality..."
if podman ps &> /dev/null; then
    check_pass "Podman is working correctly"
else
    check_fail "Podman is not working properly"
    echo "   Try: podman machine start (macOS/Windows)"
    echo "   Try: sudo sysctl -w user.max_user_namespaces=15000 (Linux)"
fi
echo ""

# 4. Check user namespaces (Linux only)
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    echo "4. Checking user namespaces (Linux)..."
    MAX_NAMESPACES=$(cat /proc/sys/user/max_user_namespaces 2>/dev/null || echo "0")
    if [ "$MAX_NAMESPACES" -gt 0 ]; then
        check_pass "User namespaces enabled: $MAX_NAMESPACES"
    else
        check_warn "User namespaces not enabled (may cause issues)"
        echo "   Fix: echo 'user.max_user_namespaces=15000' | sudo tee -a /etc/sysctl.conf"
        echo "   Then: sudo sysctl -p"
    fi
    echo ""
fi

# 5. Check .env file
echo "5. Checking configuration files..."
if [ -f .env ]; then
    check_pass ".env file exists"
    
    # Check required variables
    source .env
    
    if [ -n "$TUNNEL_TOKEN" ] && [ "$TUNNEL_TOKEN" != "your_tunnel_token_here" ]; then
        check_pass "TUNNEL_TOKEN is configured"
    else
        check_fail "TUNNEL_TOKEN is not configured in .env"
    fi
    
    if [ -n "$GOOSE_API_KEY" ] && [ "$GOOSE_API_KEY" != "your_api_key_here" ]; then
        check_pass "GOOSE_API_KEY is configured"
    else
        check_fail "GOOSE_API_KEY is not configured in .env"
    fi
    
    if [ -n "$GOOSE_PROVIDER" ]; then
        check_pass "GOOSE_PROVIDER is set to: $GOOSE_PROVIDER"
    else
        check_fail "GOOSE_PROVIDER is not configured in .env"
    fi
    
else
    check_fail ".env file not found"
    echo "   Create: cp .env.example .env"
    echo "   Then edit .env with your configuration"
fi
echo ""

# 6. Check scripts are executable
echo "6. Checking script permissions..."
if [ -x scripts/start.sh ]; then
    check_pass "start.sh is executable"
else
    check_warn "start.sh is not executable"
    echo "   Fix: chmod +x scripts/*.sh"
fi

if [ -x scripts/stop.sh ]; then
    check_pass "stop.sh is executable"
else
    check_warn "stop.sh is not executable"
    echo "   Fix: chmod +x scripts/*.sh"
fi

if [ -x entrypoint.sh ]; then
    check_pass "entrypoint.sh is executable"
else
    check_warn "entrypoint.sh is not executable"
    echo "   Fix: chmod +x entrypoint.sh"
fi
echo ""

# 7. Check docker-compose.yml
echo "7. Checking compose file..."
if [ -f docker-compose.yml ]; then
    check_pass "docker-compose.yml exists"
    
    # Validate compose file
    if podman-compose config &> /dev/null; then
        check_pass "docker-compose.yml is valid"
    else
        check_warn "docker-compose.yml validation failed (may need .env file)"
    fi
else
    check_fail "docker-compose.yml not found"
fi
echo ""

# 8. Check Dockerfile
echo "8. Checking Dockerfile..."
if [ -f Dockerfile.goose-web ]; then
    check_pass "Dockerfile.goose-web exists"
else
    check_fail "Dockerfile.goose-web not found"
fi
echo ""

# 9. Check network connectivity
echo "9. Checking network connectivity..."
if ping -c 1 1.1.1.1 &> /dev/null; then
    check_pass "Internet connectivity available"
else
    check_warn "Cannot reach internet (required for Cloudflare Tunnel)"
fi
echo ""

# 10. Check disk space
echo "10. Checking disk space..."
AVAILABLE_SPACE=$(df -h . | awk 'NR==2 {print $4}')
check_pass "Available disk space: $AVAILABLE_SPACE"
echo ""

# Summary
echo "=========================================="
echo "Pre-flight Check Summary"
echo "=========================================="
echo ""

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✓ All checks passed!${NC}"
    echo ""
    echo "You're ready to deploy. Run:"
    echo "  ./scripts/start.sh"
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}⚠ $WARNINGS warning(s) found${NC}"
    echo ""
    echo "You can proceed, but review the warnings above."
    echo "To deploy, run:"
    echo "  ./scripts/start.sh"
    exit 0
else
    echo -e "${RED}✗ $ERRORS error(s) found${NC}"
    if [ $WARNINGS -gt 0 ]; then
        echo -e "${YELLOW}⚠ $WARNINGS warning(s) found${NC}"
    fi
    echo ""
    echo "Please fix the errors above before deploying."
    echo ""
    echo "Need help? Check:"
    echo "  - QUICKSTART.md for quick setup"
    echo "  - DEPLOYMENT_GUIDE.md for detailed instructions"
    echo "  - PODMAN.md for Podman-specific issues"
    exit 1
fi
