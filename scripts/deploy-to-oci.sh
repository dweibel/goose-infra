#!/bin/bash

# Deploy Goose container to OCI instance
# Starts the container stack using podman-compose

set -e

# Configuration
OCI_IP="${OCI_IP:-193.122.215.174}"
OCI_USER="opc"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/oci_agent_coder}"
REMOTE_DIR="/home/opc/goose-infra"

echo "=== Deploying Goose Container to OCI ==="
echo ""
echo "OCI Instance: ${OCI_USER}@${OCI_IP}"
echo "Remote Directory: ${REMOTE_DIR}"
echo ""

# Check SSH key exists
if [ ! -f "${SSH_KEY}" ]; then
    echo "ERROR: SSH key not found at ${SSH_KEY}"
    exit 1
fi

echo "Step 1: Verifying image exists..."
ssh -i "${SSH_KEY}" "${OCI_USER}@${OCI_IP}" "podman images goose-web" > /tmp/verify-image.txt 2>&1
cat /tmp/verify-image.txt

if ! grep -q "goose-web" /tmp/verify-image.txt; then
    echo ""
    echo "ERROR: goose-web image not found!"
    echo "Please build the image first using scripts/build-on-oci.sh"
    exit 1
fi

echo "✓ Image verified"
echo ""

echo "Step 2: Stopping any existing containers..."
ssh -i "${SSH_KEY}" "${OCI_USER}@${OCI_IP}" \
    "cd ${REMOTE_DIR} && podman-compose down" > /tmp/stop-containers.txt 2>&1 || true
cat /tmp/stop-containers.txt

echo "✓ Existing containers stopped"
echo ""

echo "Step 3: Starting container stack..."
ssh -i "${SSH_KEY}" "${OCI_USER}@${OCI_IP}" \
    "cd ${REMOTE_DIR} && podman-compose up -d" > /tmp/start-containers.txt 2>&1
cat /tmp/start-containers.txt

echo "✓ Containers started"
echo ""

echo "Step 4: Checking container status..."
ssh -i "${SSH_KEY}" "${OCI_USER}@${OCI_IP}" \
    "podman ps -a --filter name=goose" > /tmp/container-status.txt 2>&1
cat /tmp/container-status.txt

echo ""
echo "Step 5: Checking container logs..."
echo "Waiting 5 seconds for containers to initialize..."
sleep 5

ssh -i "${SSH_KEY}" "${OCI_USER}@${OCI_IP}" \
    "podman logs goose-web --tail 50" > /tmp/goose-logs.txt 2>&1 || true
cat /tmp/goose-logs.txt

echo ""
echo "=== Deployment Complete ==="
echo ""
echo "Access your Goose terminal at:"
echo "  https://goose.dirkweibel.dev (via Cloudflare Tunnel)"
echo ""
echo "To view logs:"
echo "  ssh -i ${SSH_KEY} ${OCI_USER}@${OCI_IP} 'podman logs -f goose-web'"
echo ""
echo "To check status:"
echo "  ssh -i ${SSH_KEY} ${OCI_USER}@${OCI_IP} 'podman ps'"
echo ""
echo "To stop:"
echo "  ssh -i ${SSH_KEY} ${OCI_USER}@${OCI_IP} 'cd ${REMOTE_DIR} && podman-compose down'"
