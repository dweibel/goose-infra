FROM --platform=linux/arm64 ubuntu:22.04

# Prevent interactive prompts during package installation
ENV DEBIAN_FRONTEND=noninteractive

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    wget \
    git \
    bash \
    python3.11 \
    python3-pip \
    build-essential \
    jq \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js 20 for MCP server
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists/*

# Install ttyd web terminal emulator (ARM64)
RUN wget https://github.com/tsl0922/ttyd/releases/download/1.7.4/ttyd.aarch64 -O /usr/local/bin/ttyd \
    && chmod +x /usr/local/bin/ttyd

# Install Goose AI agent CLI - manual download to avoid interactive config
RUN mkdir -p /root/.local/bin && \
    curl -fsSL "https://github.com/block/goose/releases/download/stable/goose-aarch64-unknown-linux-gnu.tar.bz2" -o /tmp/goose.tar.bz2 && \
    tar -xjf /tmp/goose.tar.bz2 -C /usr/local/bin && \
    chmod +x /usr/local/bin/goose && \
    rm /tmp/goose.tar.bz2

# Set working directory
WORKDIR /workspace

# Copy Wiki MCP server source
COPY src/ /app/src/
COPY container/goose-mcp-config.json /app/goose-mcp-config.json

# Expose internal port for ttyd
EXPOSE 7681

# Configure shell environment
ENV SHELL=/bin/bash

# Bypass keyring/DBUS in headless container to prevent segfaults
ENV GOOSE_KEYRING_BACKEND=plaintext

# Create entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Set entrypoint
ENTRYPOINT ["/entrypoint.sh"]
