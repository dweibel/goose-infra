#!/bin/bash
# Restart goose-web container on OCI instance
# Syncs .env and start.sh, then stops/removes/re-runs the container
set -e

OCI_IP="${OCI_IP:-193.122.215.174}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/oci_agent_coder}"
OCI_USER="opc"
REMOTE_DIR="/home/opc/goose-infra"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

echo "Restarting goose-web on ${OCI_IP}..."

# Sync .env and start.sh
echo "Syncing files..."
ssh -i "${SSH_KEY}" "${OCI_USER}@${OCI_IP}" "mkdir -p ${REMOTE_DIR}/scripts"
scp -i "${SSH_KEY}" \
    "${PROJECT_ROOT}/.env" \
    "${OCI_USER}@${OCI_IP}:${REMOTE_DIR}/" > /tmp/scp-out.txt 2>&1
scp -i "${SSH_KEY}" \
    "${SCRIPT_DIR}/start.sh" \
    "${OCI_USER}@${OCI_IP}:${REMOTE_DIR}/scripts/" >> /tmp/scp-out.txt 2>&1
cat /tmp/scp-out.txt

# Stop, remove, and restart
ssh -i "${SSH_KEY}" "${OCI_USER}@${OCI_IP}" "
  podman stop goose-web 2>/dev/null || true
  podman rm goose-web 2>/dev/null || true
  cd ${REMOTE_DIR} && bash scripts/start.sh
" 2>&1
echo "Done."
