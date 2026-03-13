#!/bin/bash

# Script to update cloudflared configuration on OCI instance
# This script should be run from the goose-infra directory

set -e

IP_ADDRESS=${1:-193.122.215.174}
SSH_KEY=${2:-~/.ssh/oci_agent_coder}
SSH_USER=${3:-opc}

echo "Updating cloudflared configuration on OCI instance $IP_ADDRESS..."

# Create credentials file from TUNNEL_TOKEN
echo "Creating credentials file..."
cat > /tmp/credentials.json << EOF
{
  "AccountTag": "8a353545704e40ed72d53b536b954fe4",
  "TunnelSecret": "${TUNNEL_TOKEN}",
  "TunnelID": "ad22b3dc-1898-45dd-8bed-8f909f381b47"
}
EOF

# Copy files to OCI instance
echo "Copying configuration files..."
scp -i $SSH_KEY cloudflared-config.yml $SSH_USER@$IP_ADDRESS:/tmp/cloudflared-config.yml
scp -i $SSH_KEY /tmp/credentials.json $SSH_USER@$IP_ADDRESS:/tmp/credentials.json

# Update containers on OCI instance
echo "Updating containers..."
ssh -i $SSH_KEY $SSH_USER@$IP_ADDRESS << 'EOF'
set -e

# Stop and remove cloudflared container
echo "Stopping cloudflared container..."
podman stop cloudflared || true
podman rm cloudflared || true

# Copy config files to volume location
echo "Copying config files to volume..."
sudo mkdir -p /var/lib/containers/storage/volumes/cloudflared-config/_data
sudo cp /tmp/cloudflared-config.yml /var/lib/containers/storage/volumes/cloudflared-config/_data/config.yml
sudo cp /tmp/credentials.json /var/lib/containers/storage/volumes/cloudflared-config/_data/credentials.json

# Restart containers with podman-compose
echo "Restarting containers..."
cd /home/opc/deploy/goose-infra
podman-compose up -d cloudflared

echo "Waiting for cloudflared to start..."
sleep 10

echo "Checking cloudflared logs..."
podman logs cloudflared --tail 20

echo "Checking container status..."
podman ps
EOF

echo "Cloudflared configuration updated successfully!"
echo "Test the terminal at: https://goose.dirkweibel.dev"