# Cloudflare Goose Terminal

A secure, Podman-based web terminal for the Goose AI agent with Cloudflare Tunnel connectivity and Zero Trust authentication.

> **Note**: This project uses Podman instead of Docker for enhanced security with rootless containers. See [docs/reference/PODMAN.md](docs/reference/PODMAN.md) for details.

## 🚀 Quick Start

**Ready to deploy?** → **[docs/deployment/README.md](docs/deployment/README.md)** - Start here for deployment help!

Or choose your path:

1. **[docs/deployment/QUICKSTART.md](docs/deployment/QUICKSTART.md)** - 30-minute deployment checklist
2. **[docs/deployment/DEPLOYMENT_GUIDE.md](docs/deployment/DEPLOYMENT_GUIDE.md)** - Detailed step-by-step guide
3. **[docs/reference/PODMAN.md](docs/reference/PODMAN.md)** - Podman installation and troubleshooting
4. **[docs/reference/TROUBLESHOOTING.md](docs/reference/TROUBLESHOOTING.md)** - Common issues and solutions
5. **[docs/reference/ARCHITECTURE.md](docs/reference/ARCHITECTURE.md)** - System design and architecture

---

## Overview

This system provides:
- Web-based terminal access to Goose AI agent via ttyd
- Secure connectivity through Cloudflare Tunnel (no exposed ports)
- Zero Trust authentication via Cloudflare Access
- Support for both interactive web access and headless automation
- Persistent storage for workspace and configuration
- Docker Compose orchestration for easy deployment

## Architecture

The system consists of two Podman containers:
- **goose-web**: Hosts ttyd web terminal and Goose AI agent
- **cloudflared**: Establishes secure tunnel to Cloudflare network

All traffic is routed through Cloudflare's encrypted tunnel. No ports are exposed directly to the internet.

Podman provides rootless container execution for enhanced security compared to Docker.

## Prerequisites

- Podman and podman-compose installed
- Cloudflare account with Zero Trust enabled
- AI provider API key (OpenAI, Anthropic, etc.)

### Installing Podman

**Linux:**
```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install -y podman podman-compose

# Fedora/RHEL
sudo dnf install -y podman podman-compose
```

**macOS:**
```bash
brew install podman podman-compose
podman machine init
podman machine start
```

**Windows (WSL2):**
```bash
# In WSL2 Ubuntu
sudo apt-get update
sudo apt-get install -y podman podman-compose
```

## Setup Instructions

### 1. Clone and Configure

```bash
cd goose-infra
cp .env.example .env
```

Edit `.env` and configure the following required variables:

```bash
# Cloudflare Tunnel Token (obtain from Cloudflare dashboard)
TUNNEL_TOKEN=your_tunnel_token_here

# Your custom subdomain
TUNNEL_SUBDOMAIN=goose.example.com

# Goose configuration
GOOSE_MODE=interactive  # or "auto" for headless
GOOSE_PROVIDER=openai   # or "anthropic", etc.
GOOSE_API_KEY=your_api_key_here
```

### 2. Create Cloudflare Tunnel

1. Log in to [Cloudflare Zero Trust Dashboard](https://one.dash.cloudflare.com/)
2. Navigate to **Access** > **Tunnels**
3. Click **Create a tunnel**
4. Name your tunnel (e.g., "goose-terminal")
5. Copy the tunnel token and add it to your `.env` file as `TUNNEL_TOKEN`

### 3. Configure Tunnel Routing

In the Cloudflare dashboard, configure the tunnel's public hostname:

- **Subdomain**: Choose your subdomain (e.g., "goose")
- **Domain**: Select your domain
- **Service**: `http://goose-web:7681`

Example: `goose.example.com` → `http://goose-web:7681`

### 4. Configure Zero Trust Access Policy

1. Navigate to **Access** > **Applications**
2. Click **Add an application** > **Self-hosted**
3. Configure:
   - **Application name**: Goose Terminal
   - **Subdomain**: Your chosen subdomain
   - **Domain**: Your domain
4. Add an access policy:
   - **Policy name**: Authorized Users
   - **Action**: Allow
   - **Include**: Add your email or group
5. Save the application

### 5. Start the Stack

```bash
./scripts/start.sh
```

The script will:
- Validate your configuration
- Start both containers
- Display health check status
- Show your access URL

### 6. Access Your Terminal

Navigate to your configured subdomain (e.g., `https://goose.example.com`). You'll be prompted to authenticate via Cloudflare Access, then you'll see the web terminal.

## Usage

### Interactive Mode

Set `GOOSE_MODE=interactive` in `.env` for standard web terminal access. You can interact with Goose through the browser-based terminal.

### Headless Mode (API/Automation)

Set `GOOSE_MODE=auto` in `.env` for headless operation. In this mode:
- Goose runs without interactive prompts
- Outputs results in JSON format
- Suitable for API integration, cron jobs, CI/CD pipelines

Example API request format:
```json
{
  "task": "Analyze the codebase and suggest improvements",
  "max_turns": 10
}
```

Example API response:
```json
{
  "status": "success",
  "result": "Analysis complete. Found 3 optimization opportunities...",
  "turns_used": 5
}
```

Error response:
```json
{
  "status": "error",
  "result": "",
  "turns_used": 3,
  "error": "AI provider API rate limit exceeded"
}
```

## Management Commands

### Start the stack
```bash
./scripts/start.sh
```

### Stop the stack
```bash
./scripts/stop.sh
```

### View logs (all services)
```bash
./scripts/logs.sh
```

### View logs (specific service)
```bash
./scripts/logs.sh goose-web
./scripts/logs.sh cloudflared
```

### Follow logs in real-time
```bash
./scripts/logs.sh -f
./scripts/logs.sh goose-web -f
```

### Check container status
```bash
podman-compose ps
```

### Check health status
```bash
podman inspect --format='{{.State.Health.Status}}' goose-web
podman inspect --format='{{.State.Health.Status}}' cloudflared
```

## Data Persistence

Three Podman volumes persist data across container restarts:

- **workspace**: Goose working directory (`/workspace`)
- **goose-config**: Goose configuration and session data (`/root/.config/goose`)
- **cloudflared-config**: Tunnel configuration (`/etc/cloudflared`)

### Backup Volumes

```bash
# Backup workspace
podman run --rm -v goose-infra_workspace:/data -v $(pwd):/backup:Z ubuntu tar czf /backup/workspace-backup.tar.gz -C /data .

# Backup goose-config
podman run --rm -v goose-infra_goose-config:/data -v $(pwd):/backup:Z ubuntu tar czf /backup/config-backup.tar.gz -C /data .

# Backup cloudflared-config
podman run --rm -v goose-infra_cloudflared-config:/data -v $(pwd):/backup:Z ubuntu tar czf /backup/tunnel-backup.tar.gz -C /data .
```

### Restore Volumes

```bash
# Restore workspace
podman run --rm -v goose-infra_workspace:/data -v $(pwd):/backup:Z ubuntu tar xzf /backup/workspace-backup.tar.gz -C /data

# Restore goose-config
podman run --rm -v goose-infra_goose-config:/data -v $(pwd):/backup:Z ubuntu tar xzf /backup/config-backup.tar.gz -C /data

# Restore cloudflared-config
podman run --rm -v goose-infra_cloudflared-config:/data -v $(pwd):/backup:Z ubuntu tar xzf /backup/tunnel-backup.tar.gz -C /data
```

Note: The `:Z` flag is used for SELinux compatibility on systems that have it enabled.

## Troubleshooting

### Container fails to start

Check logs for specific errors:
```bash
./scripts/logs.sh goose-web
./scripts/logs.sh cloudflared
```

Common issues:
- Missing or invalid environment variables in `.env`
- Invalid `TUNNEL_TOKEN`
- AI provider API key issues

### Tunnel connection fails

1. Verify `TUNNEL_TOKEN` is correct and not expired
2. Check tunnel status in Cloudflare dashboard
3. Ensure tunnel routing is configured correctly
4. Check cloudflared logs: `./scripts/logs.sh cloudflared`

### Health checks failing

Health checks may take 30-60 seconds to initialize. If they remain unhealthy:

```bash
# Check container status
podman-compose ps

# Restart unhealthy container
podman-compose restart goose-web
# or
podman-compose restart cloudflared
```

### Cannot access terminal via browser

1. Verify Zero Trust access policy includes your email/group
2. Check that tunnel is active in Cloudflare dashboard
3. Ensure DNS is properly configured for your subdomain
4. Try accessing in incognito mode to rule out browser cache issues

### Podman-specific issues

If you encounter "permission denied" errors with rootless Podman:
```bash
# Enable user namespaces (Linux)
echo "user.max_user_namespaces=15000" | sudo tee -a /etc/sysctl.conf
sudo sysctl -p

# Check Podman configuration
podman info
```

### Volume permission errors

If you see permission denied errors:
```bash
# Fix volume permissions
sudo chmod -R 755 volumes/
```

## Security Notes

- No ports are exposed directly to the internet
- All traffic is encrypted via Cloudflare Tunnel (TLS 1.3)
- Authentication is enforced at the edge via Cloudflare Access
- Containers run on an isolated internal Podman network
- Podman runs rootless by default for enhanced security
- Sensitive credentials are stored in `.env` (gitignored)

## Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `TUNNEL_TOKEN` | Yes | - | Cloudflare tunnel authentication token |
| `TUNNEL_SUBDOMAIN` | No | - | Custom subdomain (informational) |
| `GOOSE_MODE` | No | `interactive` | Operation mode: `interactive` or `auto` |
| `GOOSE_CONTEXT_STRATEGY` | No | `default` | Context strategy: `default`, `minimal`, or `comprehensive` |
| `GOOSE_MAX_TURNS` | No | `10` | Maximum turns for headless mode |
| `GOOSE_PROVIDER` | Yes | - | AI provider: `openai`, `anthropic`, etc. |
| `GOOSE_API_KEY` | Yes | - | AI provider API key |
| `TTYD_PORT` | No | `7681` | Internal port for ttyd |
| `LOG_LEVEL` | No | `INFO` | Logging level: `ERROR`, `WARN`, `INFO`, `DEBUG` |

## License

[Your License Here]

## Support

For issues and questions, please open an issue on the project repository.
