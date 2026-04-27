#!/bin/bash
# Manage the cloudflared tunnel independently of goose-web.
#
# Usage (from laptop):
#   ./scripts/tunnel.sh restart   — restart tunnel on OCI instance
#   ./scripts/tunnel.sh stop      — stop tunnel
#   ./scripts/tunnel.sh status    — show tunnel container status and recent logs
#   ./scripts/tunnel.sh logs      — tail tunnel logs
#
# Usage (on OCI instance directly):
#   OCI_LOCAL=1 bash scripts/tunnel.sh restart

set -e

ACTION="${1:-status}"

OCI_IP="${OCI_IP:-193.122.215.174}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/oci_agent_coder}"
OCI_USER="opc"
REMOTE_DIR="/home/opc/goose-infra"

# ---------------------------------------------------------------------------
# Helper: run a command on the instance (or locally if OCI_LOCAL=1)
# ---------------------------------------------------------------------------
_run() {
    if [ "${OCI_LOCAL}" = "1" ]; then
        bash -c "$1"
    else
        ssh -i "${SSH_KEY}" "${OCI_USER}@${OCI_IP}" "$1"
    fi
}

# ---------------------------------------------------------------------------
# Actions
# ---------------------------------------------------------------------------
case "${ACTION}" in
  restart)
    echo "Restarting cloudflared tunnel..."

    # Sync secrets if running remotely
    if [ "${OCI_LOCAL}" != "1" ]; then
        SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
        PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
        [ -f "${PROJECT_ROOT}/.env.secrets" ] && \
            scp -i "${SSH_KEY}" "${PROJECT_ROOT}/.env.secrets" \
                "${OCI_USER}@${OCI_IP}:${REMOTE_DIR}/" > /dev/null 2>&1
    fi

    _run "
      podman stop cloudflared 2>/dev/null || true
      podman rm   cloudflared 2>/dev/null || true

      # Reload secrets
      cd ${REMOTE_DIR}
      if [ -f .env.secrets ]; then set -a; source .env.secrets; set +a; fi
      if [ -n \"\${TUNNEL_TOKEN}\" ]; then
          podman secret rm goose-tunnel-token 2>/dev/null || true
          printf '%s' \"\${TUNNEL_TOKEN}\" | podman secret create goose-tunnel-token -
      fi

      # Pull if needed
      podman image exists docker.io/cloudflare/cloudflared:latest 2>/dev/null || \
          podman pull docker.io/cloudflare/cloudflared:latest

      # Read token
      CF_TOKEN=\$(podman secret inspect goose-tunnel-token --showsecret \
          | python3 -c \"import sys,json; print(json.load(sys.stdin)[0]['SecretData'])\" 2>/dev/null)

      if [ -z \"\${CF_TOKEN}\" ]; then
          echo 'ERROR: Could not read tunnel token from podman secrets.'
          exit 1
      fi

      podman run -d --name cloudflared \
        --network goose-network \
        --restart unless-stopped \
        docker.io/cloudflare/cloudflared:latest \
        tunnel run --token \"\${CF_TOKEN}\"

      sleep 3
      podman ps --filter name=cloudflared --format '{{.Names}}  {{.Status}}'
      CONNS=\$(podman logs cloudflared 2>&1 | grep -c 'Registered tunnel connection' || true)
      echo \"Tunnel connections: \${CONNS}\"
    "
    ;;

  stop)
    echo "Stopping cloudflared tunnel..."
    _run "podman stop cloudflared 2>/dev/null || true; podman rm cloudflared 2>/dev/null || true"
    echo "Done."
    ;;

  status)
    _run "
      echo '=== Container ==='
      podman ps -a --filter name=cloudflared --format '{{.Names}}  {{.Status}}  {{.Image}}'
      echo ''
      echo '=== Recent Logs ==='
      podman logs cloudflared --tail 15 2>&1 || echo '(no container)'
    "
    ;;

  logs)
    _run "podman logs cloudflared --tail 50 2>&1"
    ;;

  *)
    echo "Usage: $0 {restart|stop|status|logs}"
    exit 1
    ;;
esac
