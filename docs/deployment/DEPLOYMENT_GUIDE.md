# Deployment Guide: Cloudflare Goose Terminal

This guide walks you through deploying the Cloudflare Goose Terminal from scratch.

## Prerequisites Checklist

Before starting, ensure you have:

- [ ] A server or local machine (Linux, macOS, or Windows with WSL2)
- [ ] Podman and podman-compose installed
- [ ] A Cloudflare account (free tier works)
- [ ] A domain managed by Cloudflare
- [ ] An AI provider API key (OpenAI, Anthropic, etc.)

## Step 1: Install Podman

### On Ubuntu/Debian (including WSL2)

```bash
# Update package list
sudo apt-get update

# Install Podman and podman-compose
sudo apt-get install -y podman podman-compose

# Verify installation
podman --version
podman-compose --version
```

### On Fedora/RHEL/CentOS

```bash
sudo dnf install -y podman podman-compose
podman --version
podman-compose --version
```

### On macOS

```bash
# Install via Homebrew
brew install podman podman-compose

# Initialize Podman machine
podman machine init
podman machine start

# Verify
podman --version
podman-compose --version
```

### Test Podman

```bash
# Run a test container
podman run --rm hello-world

# If successful, you should see "Hello from Docker!" message
```

## Step 2: Configure User Namespaces (Linux Only)

If you're on Linux and encounter permission issues:

```bash
# Check current setting
cat /proc/sys/user/max_user_namespaces

# If it returns 0, enable user namespaces
echo "user.max_user_namespaces=15000" | sudo tee -a /etc/sysctl.conf
sudo sysctl -p

# Verify
cat /proc/sys/user/max_user_namespaces
# Should show 15000
```

## Step 3: Set Up Cloudflare Tunnel

### 3.1 Access Cloudflare Zero Trust Dashboard

1. Go to https://one.dash.cloudflare.com/
2. Log in with your Cloudflare account
3. If prompted, set up Zero Trust (it's free for up to 50 users)

### 3.2 Create a Tunnel

1. In the Zero Trust dashboard, navigate to **Networks** > **Tunnels**
2. Click **Create a tunnel**
3. Select **Cloudflared** as the connector type
4. Name your tunnel (e.g., "goose-terminal")
5. Click **Save tunnel**

### 3.3 Get Your Tunnel Token

After creating the tunnel, you'll see installation instructions. Look for a command like:

```bash
cloudflared service install <LONG_TOKEN_STRING>
```

Copy the **entire token string** (it's very long, starts with "eyJ..."). You'll need this for your `.env` file.

**Important**: Don't run the cloudflared installation command - we'll use the Docker container instead.

### 3.4 Configure Public Hostname

1. In the tunnel configuration page, go to the **Public Hostname** tab
2. Click **Add a public hostname**
3. Configure:
   - **Subdomain**: Choose a subdomain (e.g., "goose")
   - **Domain**: Select your domain from the dropdown
   - **Path**: Leave empty
   - **Service Type**: HTTP
   - **URL**: `goose-web:7681`
4. Click **Save hostname**

Example: If you chose subdomain "goose" and domain "example.com", your terminal will be accessible at `https://goose.example.com`

### 3.5 Configure Zero Trust Access Policy

1. Navigate to **Access** > **Applications**
2. Click **Add an application**
3. Select **Self-hosted**
4. Configure application:
   - **Application name**: Goose Terminal
   - **Session Duration**: 24 hours (or your preference)
   - **Application domain**: 
     - Subdomain: goose (or whatever you chose)
     - Domain: example.com (your domain)
5. Click **Next**

6. Create an access policy:
   - **Policy name**: Authorized Users
   - **Action**: Allow
   - **Session duration**: Same as application
   - **Configure rules**:
     - **Include**: 
       - Select "Emails" and add your email address
       - OR select "Email domain" and add your domain
       - OR select "Everyone" (not recommended for production)
7. Click **Next**, then **Add application**

## Step 4: Configure the Project

### 4.1 Navigate to Project Directory

```bash
cd goose-infra
```

### 4.2 Create Environment File

```bash
# Copy the example file
cp .env.example .env

# Edit the file
nano .env
# or
vim .env
# or use your preferred editor
```

### 4.3 Configure Required Variables

Edit `.env` and set these required values:

```bash
# Cloudflare Tunnel Configuration
TUNNEL_TOKEN=eyJ...your_very_long_token_here...
TUNNEL_SUBDOMAIN=goose.example.com

# Goose AI Agent Configuration
GOOSE_MODE=interactive
GOOSE_PROVIDER=openai
GOOSE_API_KEY=sk-...your_openai_api_key...

# Optional: Adjust these if needed
GOOSE_CONTEXT_STRATEGY=default
GOOSE_MAX_TURNS=10
TTYD_PORT=7681
LOG_LEVEL=INFO
```

**Getting API Keys:**
- **OpenAI**: https://platform.openai.com/api-keys
- **Anthropic**: https://console.anthropic.com/settings/keys

### 4.4 Verify Configuration

```bash
# Check that .env file exists and has content
cat .env | grep -v "^#" | grep -v "^$"

# Should show your configured variables
```

## Step 5: Deploy the Stack

### 5.1 Make Scripts Executable

```bash
chmod +x scripts/*.sh entrypoint.sh
```

### 5.2 Start the Stack

```bash
./scripts/start.sh
```

You should see output like:
```
Starting Cloudflare Goose Terminal...
Configuration validated. Starting containers...
Creating network goose-infra_goose-network
Creating volume goose-infra_workspace
Creating volume goose-infra_goose-config
Creating volume goose-infra_cloudflared-config
Building goose-web...
Creating goose-web...
Creating cloudflared...
Waiting for containers to become healthy...

Container Status:
NAME         IMAGE                          STATUS
goose-web    localhost/goose-infra_goose-web:latest   Up
cloudflared  cloudflare/cloudflared:latest            Up

Cloudflare Goose Terminal started successfully!
Access your terminal at: https://goose.example.com
```

### 5.3 Check Container Status

```bash
# View running containers
podman-compose ps

# Check health status
podman inspect --format='{{.State.Health.Status}}' goose-web
podman inspect --format='{{.State.Health.Status}}' cloudflared
```

Both should show `healthy` after 30-60 seconds.

### 5.4 View Logs

```bash
# View all logs
./scripts/logs.sh

# View specific service logs
./scripts/logs.sh goose-web
./scripts/logs.sh cloudflared

# Follow logs in real-time
./scripts/logs.sh -f
```

## Step 6: Access Your Terminal

1. Open your browser and navigate to your configured URL (e.g., `https://goose.example.com`)
2. You'll be redirected to Cloudflare Access authentication
3. Enter your email address
4. Check your email for the one-time code
5. Enter the code
6. You should now see the web terminal!

## Step 7: Test the Terminal

Once you're in the terminal, test Goose:

```bash
# Check Goose is installed
goose --version

# Start a Goose session
goose session start

# Try a simple task
# Goose will prompt you for input
```

## Troubleshooting

### Container Won't Start

```bash
# Check logs for errors
./scripts/logs.sh goose-web

# Common issues:
# 1. Missing environment variables - check .env file
# 2. Invalid API key - verify with your provider
# 3. Port conflicts - ensure 7681 isn't in use
```

### Tunnel Connection Failed

```bash
# Check cloudflared logs
./scripts/logs.sh cloudflared

# Common issues:
# 1. Invalid TUNNEL_TOKEN - regenerate in Cloudflare dashboard
# 2. Network connectivity - check internet connection
# 3. Tunnel already connected elsewhere - disconnect other instances
```

### Can't Access via Browser

1. **Check tunnel status** in Cloudflare dashboard (Networks > Tunnels)
   - Should show "Healthy" with green indicator
   
2. **Verify DNS** is resolving:
   ```bash
   nslookup goose.example.com
   # Should return Cloudflare IP addresses
   ```

3. **Check access policy** includes your email

4. **Try incognito mode** to rule out browser cache

### Health Checks Failing

```bash
# Wait 60 seconds for initialization
sleep 60

# Check again
podman inspect --format='{{.State.Health.Status}}' goose-web

# If still unhealthy, restart
podman-compose restart goose-web
```

### Permission Denied Errors (Linux)

```bash
# Enable user namespaces
echo "user.max_user_namespaces=15000" | sudo tee -a /etc/sysctl.conf
sudo sysctl -p

# Restart Podman
podman system reset --force
```

## Managing the Deployment

### Stop the Stack

```bash
./scripts/stop.sh
```

### Restart the Stack

```bash
./scripts/stop.sh
./scripts/start.sh
```

### Update Configuration

There are two deployment paths depending on what changed:

#### Env-only changes (model, API keys, feature flags)

No rebuild needed. The entrypoint regenerates `config.yaml` from environment variables on every container start.

```bash
# 1. Edit .env with your changes
nano .env

# 2. Restart the container (syncs .env to remote and restarts)
./scripts/restart.sh
```

This takes about 5 seconds.

#### Image changes (Dockerfile, entrypoint, recipes, wiki-cli version)

A full rebuild is required when you change anything baked into the container image.

```bash
# 1. Make your changes to container/, recipes, etc.

# 2. Build the new image on the OCI instance
./scripts/build.sh

# 3. Stop the old container and start the new one
./scripts/restart.sh
```

The build takes several minutes since it runs natively on the ARM64 instance.

### Backup Data

```bash
# Backup workspace
podman run --rm -v goose-infra_workspace:/data -v $(pwd):/backup:Z ubuntu tar czf /backup/workspace-backup.tar.gz -C /data .

# Backup config
podman run --rm -v goose-infra_goose-config:/data -v $(pwd):/backup:Z ubuntu tar czf /backup/config-backup.tar.gz -C /data .
```

### View Resource Usage

```bash
# Container stats
podman stats

# Disk usage
podman system df
```

## Headless Mode (API/Automation)

To use Goose in headless mode for automation:

### 1. Update Configuration

Edit `.env`:
```bash
GOOSE_MODE=auto
```

### 2. Restart Stack

```bash
./scripts/stop.sh
./scripts/start.sh
```

### 3. Send API Requests

In headless mode, Goose will:
- Not prompt for interactive input
- Execute tasks automatically
- Return JSON responses

Example usage in scripts:
```bash
# Access the terminal programmatically
curl -X POST https://goose.example.com/api/task \
  -H "Content-Type: application/json" \
  -d '{"task": "Analyze the codebase", "max_turns": 10}'
```

## Security Best Practices

1. **Keep TUNNEL_TOKEN secret** - Never commit to git
2. **Rotate API keys** regularly
3. **Limit access policy** to specific users/groups
4. **Monitor logs** for suspicious activity
5. **Update containers** regularly:
   ```bash
   podman pull cloudflare/cloudflared:latest
   podman-compose build --no-cache goose-web
   ./scripts/stop.sh
   ./scripts/start.sh
   ```

## Next Steps

- Set up automated backups (cron job)
- Configure monitoring/alerting
- Customize Goose configuration
- Explore headless mode for CI/CD integration
- Add additional access policies for team members

## Getting Help

- Check logs: `./scripts/logs.sh -f`
- Review README.md for detailed documentation
- Check PODMAN.md for Podman-specific issues
- Cloudflare Tunnel docs: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/
- Goose documentation: https://github.com/square/goose

## Quick Reference Commands

```bash
# Start
./scripts/start.sh

# Stop
./scripts/stop.sh

# Logs
./scripts/logs.sh -f

# Status
podman-compose ps

# Health
podman inspect --format='{{.State.Health.Status}}' goose-web cloudflared

# Restart
podman-compose restart goose-web
podman-compose restart cloudflared

# Rebuild
podman-compose build --no-cache
```
