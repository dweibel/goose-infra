#!/bin/bash

# Build Goose container on OCI ARM64 instance
# This script transfers files to OCI and builds the image natively on ARM64

set -e

# Configuration
OCI_IP="${OCI_IP:-193.122.215.174}"
OCI_USER="opc"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/oci_agent_coder}"
REMOTE_DIR="/home/opc/goose-infra"
BUILD_LOG="/home/opc/goose-build.log"

echo "=== Building Goose Container on OCI ARM64 Instance ==="
echo ""
echo "OCI Instance: ${OCI_USER}@${OCI_IP}"
echo "Remote Directory: ${REMOTE_DIR}"
echo ""

# Check SSH key exists
if [ ! -f "${SSH_KEY}" ]; then
    echo "ERROR: SSH key not found at ${SSH_KEY}"
    exit 1
fi

echo "Step 1: Creating remote directory..."
ssh -i "${SSH_KEY}" "${OCI_USER}@${OCI_IP}" "mkdir -p ${REMOTE_DIR}" > /tmp/ssh-out.txt 2>&1
cat /tmp/ssh-out.txt

echo "✓ Remote directory created"
echo ""

echo "Step 2: Transferring files to OCI instance..."

# Resolve script location so paths work regardless of cwd
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Transfer Dockerfile (renamed to match build command)
scp -i "${SSH_KEY}" \
    "${PROJECT_ROOT}/container/Dockerfile" \
    "${OCI_USER}@${OCI_IP}:${REMOTE_DIR}/Dockerfile.goose-web" > /tmp/scp-out.txt 2>&1

# Transfer entrypoint, compose, and env
scp -i "${SSH_KEY}" \
    "${PROJECT_ROOT}/container/entrypoint.sh" \
    "${PROJECT_ROOT}/docker-compose.yml" \
    "${PROJECT_ROOT}/.env" \
    "${OCI_USER}@${OCI_IP}:${REMOTE_DIR}/" >> /tmp/scp-out.txt 2>&1

# Transfer recipes directory
ssh -i "${SSH_KEY}" "${OCI_USER}@${OCI_IP}" "mkdir -p ${REMOTE_DIR}/recipes" > /dev/null 2>&1
scp -i "${SSH_KEY}" -r \
    "${PROJECT_ROOT}/container/recipes/" \
    "${OCI_USER}@${OCI_IP}:${REMOTE_DIR}/recipes/" >> /tmp/scp-out.txt 2>&1

cat /tmp/scp-out.txt

echo "✓ Files transferred"
echo ""

echo "Step 3: Starting build on OCI instance (this will take several minutes)..."
echo "Build log will be saved to: ${BUILD_LOG}"
echo ""

# Start build in background on remote host
ssh -i "${SSH_KEY}" "${OCI_USER}@${OCI_IP}" \
    "nohup bash -c 'cd ${REMOTE_DIR} && podman build --platform linux/arm64 -t goose-web:latest -f Dockerfile.goose-web . > ${BUILD_LOG} 2>&1; echo DONE >> ${BUILD_LOG}' &>/dev/null &" \
    > /tmp/ssh-build-start.txt 2>&1
cat /tmp/ssh-build-start.txt

echo "✓ Build started in background"
echo ""

# Function to check build progress
check_build_progress() {
    ssh -i "${SSH_KEY}" "${OCI_USER}@${OCI_IP}" "cat ${BUILD_LOG}" > /tmp/build-log.txt 2>&1
    cat /tmp/build-log.txt
}

# Poll for completion
echo "Monitoring build progress (checking every 15 seconds)..."
echo "Press Ctrl+C to stop monitoring (build will continue on server)"
echo ""

ELAPSED=0
MAX_WAIT=1800  # 30 minutes max

while [ ${ELAPSED} -lt ${MAX_WAIT} ]; do
    sleep 15
    ELAPSED=$((ELAPSED + 15))
    
    echo "[${ELAPSED}s] Checking build status..."
    
    # Get current log
    check_build_progress
    
    # Check if build is complete
    if grep -q "DONE" /tmp/build-log.txt 2>/dev/null; then
        echo ""
        echo "✓ Build completed!"
        break
    fi
    
    # Check for errors
    if grep -qi "error" /tmp/build-log.txt 2>/dev/null; then
        echo ""
        echo "! Build may have errors. Check log above."
    fi
    
    echo ""
done

if [ ${ELAPSED} -ge ${MAX_WAIT} ]; then
    echo ""
    echo "! Build monitoring timed out after ${MAX_WAIT} seconds"
    echo "Build may still be running on the server."
    echo "Check manually with: ssh -i ${SSH_KEY} ${OCI_USER}@${OCI_IP} 'cat ${BUILD_LOG}'"
    exit 1
fi

echo ""
echo "Step 4: Verifying built image..."
ssh -i "${SSH_KEY}" "${OCI_USER}@${OCI_IP}" "podman images goose-web" > /tmp/images-out.txt 2>&1
cat /tmp/images-out.txt

echo ""
echo "=== Build Complete ==="
echo ""
echo "Image built successfully on OCI ARM64 instance!"
echo ""
echo "Next steps:"
echo "  1. Test the container: ssh -i ${SSH_KEY} ${OCI_USER}@${OCI_IP}"
echo "  2. Run: cd ${REMOTE_DIR} && podman-compose up -d"
echo "  3. Check logs: podman-compose logs -f"
echo ""
echo "To view full build log:"
echo "  ssh -i ${SSH_KEY} ${OCI_USER}@${OCI_IP} 'cat ${BUILD_LOG}'"
