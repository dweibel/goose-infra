#!/bin/bash
# Create network if it doesn't exist
podman network exists goose-network || podman network create goose-network

# Start the container
podman run -d --name goose-web \
  --network goose-network \
  -v workspace:/workspace \
  -v goose-config:/root/.config/goose \
  -e GOOSE_MODE=interactive \
  -p 7681:7681 \
  --restart unless-stopped \
  goose-web

sleep 2
podman ps | grep goose-web
