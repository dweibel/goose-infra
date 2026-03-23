#!/bin/bash
# Restart goose-web container on OCI instance
# Stops, removes, and re-runs using start.sh
set -e

OCI_IP="${OCI_IP:-193.122.215.174}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/oci_agent_coder}"
OCI_USER="opc"
REMOTE_DEPLOY_DIR="/home/opc/deploy"

echo "Restarting goose-web on ${OCI_IP}..."

# Sync start.sh to remote
SCRIPT_DIR="$(dirname "$(readlink -f "$0")")"
echo "Syncing start.sh to remote..."
scp -i "${SSH_KEY}" "${SCRIPT_DIR}/start.sh" "${OCI_USER}@${OCI_IP}:${REMOTE_DEPLOY_DIR}/start.sh" > /tmp/scp-out.txt 2>&1
cat /tmp/scp-out.txt

# Stop, remove, and restart
ssh -i "${SSH_KEY}" "${OCI_USER}@${OCI_IP}" "
  podman stop goose-web 2>/dev/null || true
  podman rm goose-web 2>/dev/null || true
  bash ${REMOTE_DEPLOY_DIR}/start.sh
" > /tmp/restart-out.txt 2>&1
cat /tmp/restart-out.txt

echo "Done."
