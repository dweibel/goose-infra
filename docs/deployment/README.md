# Deployment Help - Start Here! 🚀

Welcome! This guide will help you deploy the Cloudflare Goose Terminal.

## 📚 Documentation Overview

We've created comprehensive guides to help you at every step:

### 🎯 Start Here (Choose Your Path)

**New to this project?**
→ **[QUICKSTART.md](QUICKSTART.md)** - 30-minute checklist to get running

**Want detailed instructions?**
→ **[DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)** - Step-by-step walkthrough

**Need Podman help?**
→ **[../reference/PODMAN.md](../reference/PODMAN.md)** - Installation and troubleshooting

**Something not working?**
→ **[../reference/TROUBLESHOOTING.md](../reference/TROUBLESHOOTING.md)** - Common issues and fixes

**Want to understand the system?**
→ **[../reference/ARCHITECTURE.md](../reference/ARCHITECTURE.md)** - System design and diagrams

## 🎬 Quick Start (TL;DR)

```bash
# 1. Install Podman
sudo apt-get install -y podman podman-compose  # Linux
# or
brew install podman podman-compose             # macOS

# 2. Run pre-flight check
./scripts/preflight-check.sh

# 3. Configure
cp .env.example .env
nano .env  # Add your TUNNEL_TOKEN and GOOSE_API_KEY

# 4. Deploy
./scripts/start.sh

# 5. Access
# Open https://goose.yourdomain.com in browser
```

## 📋 Pre-Deployment Checklist

Before you start, make sure you have:

- [ ] **Podman installed** (see [../reference/PODMAN.md](../reference/PODMAN.md))
- [ ] **Cloudflare account** (free tier works)
- [ ] **Domain in Cloudflare** (for tunnel)
- [ ] **AI provider API key** (OpenAI, Anthropic, etc.)
- [ ] **30 minutes** of time

## 🛠️ Available Scripts

We've created helper scripts to make deployment easy:

```bash
# Check if you're ready to deploy
./scripts/preflight-check.sh

# Start the stack
./scripts/start.sh

# Stop the stack
./scripts/stop.sh

# View logs
./scripts/logs.sh
./scripts/logs.sh -f              # Follow mode
./scripts/logs.sh goose-web       # Specific service
./scripts/logs.sh cloudflared -f  # Specific service, follow mode
```

## 🎯 Deployment Steps (High Level)

### Step 1: Install Podman (5 min)
See [../reference/PODMAN.md](../reference/PODMAN.md) for your platform

### Step 2: Set Up Cloudflare (10 min)
1. Create tunnel in Cloudflare dashboard
2. Get tunnel token
3. Configure public hostname
4. Set up access policy

See [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md#step-3-set-up-cloudflare-tunnel) for details

### Step 3: Configure Project (5 min)
```bash
cp .env.example .env
nano .env
# Fill in:
# - TUNNEL_TOKEN
# - GOOSE_API_KEY
# - GOOSE_PROVIDER
```

### Step 4: Deploy (5 min)
```bash
./scripts/preflight-check.sh  # Verify setup
./scripts/start.sh             # Deploy
```

### Step 5: Access (2 min)
Open your browser to `https://goose.yourdomain.com`

## 🔍 Verification

After deployment, verify everything is working:

```bash
# Check container status
podman-compose ps
# Both should show "Up"

# Check health
podman inspect --format='{{.State.Health.Status}}' goose-web cloudflared
# Both should show "healthy" after 60 seconds

# View logs
./scripts/logs.sh
# Should see "ttyd started" and "Connection established"
```

## 🆘 Common Issues

### "Podman not found"
→ Install Podman: [../reference/PODMAN.md](../reference/PODMAN.md)

### "Container won't start"
→ Check logs: `./scripts/logs.sh goose-web`
→ See [../reference/TROUBLESHOOTING.md](../reference/TROUBLESHOOTING.md#1-container-wont-start)

### "Can't access in browser"
→ Check tunnel status in Cloudflare dashboard
→ See [../reference/TROUBLESHOOTING.md](../reference/TROUBLESHOOTING.md#3-cant-access-terminal-in-browser)

### "Permission denied"
→ Enable user namespaces (Linux)
→ See [../reference/TROUBLESHOOTING.md](../reference/TROUBLESHOOTING.md#5-permission-denied-errors)

## 📖 Documentation Index

| Document | Purpose | When to Use |
|----------|---------|-------------|
| [QUICKSTART.md](QUICKSTART.md) | Fast deployment checklist | First time setup |
| [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) | Detailed instructions | Need step-by-step help |
| [../reference/PODMAN.md](../reference/PODMAN.md) | Podman installation & help | Podman issues |
| [../reference/TROUBLESHOOTING.md](../reference/TROUBLESHOOTING.md) | Problem solving | Something's broken |
| [../reference/ARCHITECTURE.md](../reference/ARCHITECTURE.md) | System design | Want to understand how it works |
| [../../README.md](../../README.md) | Main documentation | General reference |

## 🎓 Learning Path

**Beginner** (Just want it working):
1. [QUICKSTART.md](QUICKSTART.md)
2. [../reference/TROUBLESHOOTING.md](../reference/TROUBLESHOOTING.md) (if issues)

**Intermediate** (Want to understand):
1. [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)
2. [../reference/ARCHITECTURE.md](../reference/ARCHITECTURE.md)
3. [../../README.md](../../README.md)

**Advanced** (Want to customize):
1. [../reference/ARCHITECTURE.md](../reference/ARCHITECTURE.md)
2. Review source files (docker-compose.yml, container/Dockerfile, etc.)

## 🔐 Security Notes

This deployment is secure by default:

✅ No exposed ports
✅ Cloudflare Tunnel encryption (TLS 1.3)
✅ Zero Trust authentication
✅ Rootless Podman containers
✅ Internal network isolation

See [../reference/ARCHITECTURE.md](../reference/ARCHITECTURE.md#security-layers) for details.

## 🚀 Next Steps After Deployment

Once deployed successfully:

1. **Test the terminal**
   - Access via browser
   - Run `goose --version`
   - Try a simple task

2. **Set up backups**
   - See [../../README.md](../../README.md#backup-volumes)
   - Schedule regular backups

3. **Explore headless mode**
   - Set `GOOSE_MODE=auto` in .env
   - Use for API/automation
   - See [../../README.md](../../README.md#headless-mode-apiautomation)

4. **Add team members**
   - Update Cloudflare Access policy
   - Add their emails to allow list

5. **Monitor the system**
   - Check logs regularly: `./scripts/logs.sh`
   - Monitor health: `podman-compose ps`
   - Watch resources: `podman stats`

## 💡 Tips for Success

1. **Run preflight check first**
   ```bash
   ./scripts/preflight-check.sh
   ```
   This catches most issues before deployment.

2. **Keep logs open during first deployment**
   ```bash
   ./scripts/logs.sh -f
   ```
   Watch for errors in real-time.

3. **Wait for health checks**
   Health checks take 30-60 seconds to initialize. Be patient!

4. **Use incognito mode for testing**
   Avoids browser cache issues when testing access.

5. **Save your .env file securely**
   It contains sensitive credentials. Never commit to git!

## 🤝 Getting Help

If you're stuck:

1. **Check the docs** (you're reading them!)
2. **Run diagnostics**:
   ```bash
   ./scripts/preflight-check.sh
   ./scripts/logs.sh > logs.txt
   ```
3. **Review [../reference/TROUBLESHOOTING.md](../reference/TROUBLESHOOTING.md)**
4. **Check external resources**:
   - Cloudflare Docs: https://developers.cloudflare.com/
   - Podman Docs: https://docs.podman.io/
   - Goose Docs: https://github.com/square/goose

## ✅ Success Criteria

You'll know deployment succeeded when:

- ✅ `./scripts/start.sh` completes without errors
- ✅ `podman-compose ps` shows both containers "Up"
- ✅ Health checks show "healthy"
- ✅ You can access the terminal in your browser
- ✅ Goose responds to commands

## 🎉 You're Ready!

Pick your starting point:

- **Fast track**: [QUICKSTART.md](QUICKSTART.md)
- **Detailed guide**: [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)
- **Podman help**: [../reference/PODMAN.md](../reference/PODMAN.md)

Good luck with your deployment! 🚀
