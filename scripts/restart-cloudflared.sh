#!/bin/bash

# Script to restart cloudflared with updated configuration
# This script should be run from the goose-infra directory

set -e

IP_ADDRESS=${1:-193.122.215.174}
SSH_KEY=${2:-~/.ssh/oci_agent_coder}
SSH_USER=${3:-opc}

echo "Restarting cloudflared on OCI instance $IP_ADDRESS..."

# Copy updated docker-compose.yml to OCI instance
echo "Copying updated docker-compose.yml..."
scp -i $SSH_KEY docker-compose.yml $SSH_USER@$IP_ADDRESS:/tmp/docker-compose.yml

# Restart cloudflared container on OCI instance
echo "Restarting cloudflared container..."
ssh -i $SSH_KEY $SSH_USER@$IP_ADDRESS << 'EOF'
set -e

# Stop and remove cloudflared container
echo "Stopping cloudflared container..."
podman stop cloudflared || true
podman rm cloudflared || true

# Update docker-compose.yml
echo "Updating docker-compose.yml..."
cp /tmp/docker-compose.yml /home/opc/goose-infra/docker-compose.yml

# Restart cloudflared with podman-compose
echo "Restarting cloudflared..."
cd /home/opc/goose-infra
podman-compose up -d cloudflared

echo "Waiting for cloudflared to start..."
sleep 10

echo "Checking cloudflared logs..."
podman logs cloudflared --tail 20

echo "Checking container status..."
podman ps
EOF

echo "Cloudflared restarted successfully!"
echo "Test the terminal at: https://goose.dirkweibel.dev"