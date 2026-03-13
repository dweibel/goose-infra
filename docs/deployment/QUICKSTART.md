# Quick Start Checklist

Use this checklist to deploy Cloudflare Goose Terminal in under 30 minutes.

## Pre-Deployment (10 minutes)

### ☐ 1. Install Podman

**Linux/WSL2:**
```bash
sudo apt-get update && sudo apt-get install -y podman podman-compose
```

**macOS:**
```bash
brew install podman podman-compose
podman machine init && podman machine start
```

**Verify:**
```bash
podman --version && podman-compose --version
```

### ☐ 2. Get Your API Key

Choose one:
- **OpenAI**: https://platform.openai.com/api-keys
- **Anthropic**: https://console.anthropic.com/settings/keys

Save it somewhere safe!

### ☐ 3. Set Up Cloudflare (First Time Only)

1. Go to https://one.dash.cloudflare.com/
2. Sign up/login
3. Add your domain to Cloudflare (if not already)
4. Enable Zero Trust (free tier is fine)

## Cloudflare Configuration (10 minutes)

### ☐ 4. Create Tunnel

1. **Networks** > **Tunnels** > **Create a tunnel**
2. Name it: `goose-terminal`
3. **Copy the token** (starts with `eyJ...`) - you'll need this!
4. Don't run the installation command - we'll use containers

### ☐ 5. Configure Public Hostname

1. In tunnel settings, **Public Hostname** tab
2. **Add a public hostname**:
   - Subdomain: `goose` (or your choice)
   - Domain: `yourdomain.com`
   - Service: `HTTP`
   - URL: `goose-web:7681`
3. Save

### ☐ 6. Set Up Access Policy

1. **Access** > **Applications** > **Add an application**
2. Choose **Self-hosted**
3. Configure:
   - Name: `Goose Terminal`
   - Domain: `goose.yourdomain.com`
4. Add policy:
   - Name: `Authorized Users`
   - Action: `Allow`
   - Include: Your email address
5. Save

## Project Configuration (5 minutes)

### ☐ 7. Create .env File

```bash
cd goose-infra
cp .env.example .env
```

### ☐ 8. Edit .env File

```bash
nano .env  # or vim, or your editor
```

**Required changes:**
```bash
TUNNEL_TOKEN=eyJ...paste_your_long_token_here...
TUNNEL_SUBDOMAIN=goose.yourdomain.com
GOOSE_PROVIDER=openai
GOOSE_API_KEY=sk-...your_api_key...
```

Save and exit.

### ☐ 9. Verify Configuration

```bash
# Check file exists and has your values
grep -E "TUNNEL_TOKEN|GOOSE_API_KEY" .env
```

## Deployment (5 minutes)

### ☐ 10. Make Scripts Executable

```bash
chmod +x scripts/*.sh entrypoint.sh
```

### ☐ 11. Start the Stack

```bash
./scripts/start.sh
```

Wait for "started successfully" message.

### ☐ 12. Check Status

```bash
# Should show both containers running
podman-compose ps

# Wait 60 seconds, then check health
sleep 60
podman inspect --format='{{.State.Health.Status}}' goose-web cloudflared
```

Both should show `healthy`.

### ☐ 13. View Logs (Optional)

```bash
./scripts/logs.sh
```

Look for:
- `goose-web`: "ttyd started"
- `cloudflared`: "Connection established"

## Access & Test (2 minutes)

### ☐ 14. Open in Browser

Navigate to: `https://goose.yourdomain.com`

### ☐ 15. Authenticate

1. Enter your email
2. Check email for code
3. Enter code
4. You should see the terminal!

### ☐ 16. Test Goose

In the terminal:
```bash
goose --version
goose session start
```

## ✅ Done!

You now have a secure, web-accessible Goose AI terminal!

---

## Troubleshooting Quick Fixes

### Container won't start?
```bash
./scripts/logs.sh goose-web
# Check for missing env vars or invalid API key
```

### Can't access in browser?
1. Check tunnel status in Cloudflare dashboard (should be green/healthy)
2. Verify DNS: `nslookup goose.yourdomain.com`
3. Check access policy includes your email
4. Try incognito mode

### Health checks failing?
```bash
# Wait a bit longer
sleep 60
podman inspect --format='{{.State.Health.Status}}' goose-web

# Still failing? Restart
podman-compose restart goose-web
```

### Permission denied (Linux)?
```bash
echo "user.max_user_namespaces=15000" | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

---

## Common Commands

```bash
# View logs
./scripts/logs.sh -f

# Stop
./scripts/stop.sh

# Start
./scripts/start.sh

# Restart a service
podman-compose restart goose-web
```

---

## Need More Help?

- Full guide: [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)
- Podman help: [PODMAN.md](PODMAN.md)
- Main docs: [README.md](README.md)
