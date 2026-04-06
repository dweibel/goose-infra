#!/bin/bash

# Build Goose container on OCI ARM64 instance
# Mirrors the repo structure on the remote and builds natively on ARM64

set -e

# Configuration
OCI_IP="${OCI_IP:-193.122.215.174}"
OCI_USER="opc"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/oci_agent_coder}"
REMOTE_DIR="/home/opc/goose-infra"
BUILD_LOG="${REMOTE_DIR}/build.log"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

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

echo "Step 1: Creating remote directories..."
ssh -i "${SSH_KEY}" "${OCI_USER}@${OCI_IP}" \
    "mkdir -p ${REMOTE_DIR}/{container/recipes,scripts}"
echo "✓ Done"
echo ""

echo "Step 2: Transferring files..."

# Root-level files
scp -i "${SSH_KEY}" \
    "${PROJECT_ROOT}/.env" \
    "${PROJECT_ROOT}/docker-compose.yml" \
    "${OCI_USER}@${OCI_IP}:${REMOTE_DIR}/" > /tmp/scp-out.txt 2>&1

# container/ directory (Dockerfile, entrypoint, recipes)
scp -i "${SSH_KEY}" \
    "${PROJECT_ROOT}/container/Dockerfile" \
    "${PROJECT_ROOT}/container/entrypoint.sh" \
    "${OCI_USER}@${OCI_IP}:${REMOTE_DIR}/container/" >> /tmp/scp-out.txt 2>&1

scp -i "${SSH_KEY}" -r \
    "${PROJECT_ROOT}/container/recipes/" \
    "${OCI_USER}@${OCI_IP}:${REMOTE_DIR}/container/" >> /tmp/scp-out.txt 2>&1

# scripts/ directory
scp -i "${SSH_KEY}" \
    "${PROJECT_ROOT}/scripts/start.sh" \
    "${OCI_USER}@${OCI_IP}:${REMOTE_DIR}/scripts/" >> /tmp/scp-out.txt 2>&1

cat /tmp/scp-out.txt
echo "✓ Done"
echo ""

echo "Step 3: Building image (this will take several minutes)..."
echo ""

# Build with project root as context, Dockerfile at container/Dockerfile
ssh -i "${SSH_KEY}" "${OCI_USER}@${OCI_IP}" \
    "nohup bash -c 'cd ${REMOTE_DIR} && podman build --platform linux/arm64 -t goose-web:latest -f container/Dockerfile . > ${BUILD_LOG} 2>&1; echo DONE >> ${BUILD_LOG}' &>/dev/null &"

echo "✓ Build started in background"
echo ""

# Poll for completion
echo "Monitoring build progress (checking every 15 seconds)..."
echo "Press Ctrl+C to stop monitoring (build will continue on server)"
echo ""

ELAPSED=0
MAX_WAIT=1800

while [ ${ELAPSED} -lt ${MAX_WAIT} ]; do
    sleep 15
    ELAPSED=$((ELAPSED + 15))

    echo "[${ELAPSED}s] Checking build status..."

    ssh -i "${SSH_KEY}" "${OCI_USER}@${OCI_IP}" "tail -5 ${BUILD_LOG}" > /tmp/build-log.txt 2>&1
    cat /tmp/build-log.txt

    if grep -q "DONE" /tmp/build-log.txt 2>/dev/null; then
        echo ""
        echo "✓ Build completed!"
        break
    fi

    echo ""
done

if [ ${ELAPSED} -ge ${MAX_WAIT} ]; then
    echo ""
    echo "! Build monitoring timed out after ${MAX_WAIT} seconds"
    echo "Check manually: ssh -i ${SSH_KEY} ${OCI_USER}@${OCI_IP} 'tail -20 ${BUILD_LOG}'"
    exit 1
fi

echo ""
echo "Step 4: Verifying built image..."
ssh -i "${SSH_KEY}" "${OCI_USER}@${OCI_IP}" "podman images goose-web"

echo ""
echo "=== Build Complete ==="
echo ""
echo "Next: run ./scripts/restart.sh to deploy the new image."
