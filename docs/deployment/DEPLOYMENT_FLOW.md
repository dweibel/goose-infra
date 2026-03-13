# Deployment Flow Visualization

This document shows the complete deployment process visually.

## Overview: What You're Building

```
┌─────────────────────────────────────────────────────────────┐
│                    Your Goal                                 │
│                                                              │
│  Access Goose AI Terminal from anywhere via web browser     │
│  with enterprise-grade security (Zero Trust)                │
└─────────────────────────────────────────────────────────────┘
```

## The Journey: 5 Steps to Success

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  Step 1  │───▶│  Step 2  │───▶│  Step 3  │───▶│  Step 4  │───▶│  Step 5  │
│  Podman  │    │Cloudflare│    │ Configure│    │  Deploy  │    │  Access  │
│  Install │    │  Setup   │    │  Project │    │   Stack  │    │ Terminal │
└──────────┘    └──────────┘    └──────────┘    └──────────┘    └──────────┘
   5 min           10 min           5 min           5 min           2 min
```

## Step 1: Install Podman

```
Your Computer
     │
     │ Install Podman
     ▼
┌─────────────────────────────┐
│  Podman Installed           │
│  - Container runtime        │
│  - Rootless security        │
│  - Docker-compatible        │
└─────────────────────────────┘
     │
     │ Verify
     ▼
$ podman --version
Podman version 4.x.x

✅ Ready for Step 2
```

**Commands:**
```bash
# Linux/WSL2
sudo apt-get install -y podman podman-compose

# macOS
brew install podman podman-compose
podman machine init
podman machine start

# Verify
podman --version
```

## Step 2: Cloudflare Setup

```
Cloudflare Dashboard
     │
     ├─▶ Create Tunnel
     │   └─▶ Get Token (eyJ...)
     │
     ├─▶ Configure Hostname
     │   └─▶ goose.yourdomain.com → goose-web:7681
     │
     └─▶ Set Access Policy
         └─▶ Allow: your@email.com

✅ Ready for Step 3
```

**What You Get:**
- Tunnel Token (long string starting with `eyJ...`)
- Public URL (e.g., `goose.yourdomain.com`)
- Access control configured

## Step 3: Configure Project

```
goose-infra/
     │
     ├─▶ Copy .env.example to .env
     │
     └─▶ Edit .env
         ├─▶ TUNNEL_TOKEN=eyJ...
         ├─▶ GOOSE_API_KEY=sk-...
         └─▶ GOOSE_PROVIDER=openai

✅ Ready for Step 4
```

**Commands:**
```bash
cd goose-infra
cp .env.example .env
nano .env  # Edit with your values
```

**Required Values:**
- `TUNNEL_TOKEN` - From Cloudflare (Step 2)
- `GOOSE_API_KEY` - From OpenAI/Anthropic
- `GOOSE_PROVIDER` - `openai` or `anthropic`

## Step 4: Deploy Stack

```
$ ./scripts/start.sh
     │
     ├─▶ Validate Configuration
     │   ✓ .env file exists
     │   ✓ Required variables set
     │
     ├─▶ Build goose-web Container
     │   ├─▶ Install Ubuntu base
     │   ├─▶ Install Python 3.11
     │   ├─▶ Install ttyd
     │   └─▶ Install Goose AI
     │
     ├─▶ Pull cloudflared Container
     │   └─▶ Official Cloudflare image
     │
     ├─▶ Create Network
     │   └─▶ goose-network (internal)
     │
     ├─▶ Create Volumes
     │   ├─▶ workspace
     │   ├─▶ goose-config
     │   └─▶ cloudflared-config
     │
     ├─▶ Start Containers
     │   ├─▶ goose-web (ttyd + Goose)
     │   └─▶ cloudflared (tunnel)
     │
     └─▶ Wait for Health Checks
         ✓ goose-web: healthy
         ✓ cloudflared: healthy

✅ Deployment Complete!
```

**What Happens:**
1. Configuration validated
2. Containers built/pulled
3. Network and volumes created
4. Services started
5. Health checks pass

**Timeline:**
- First time: 5-10 minutes (building images)
- Subsequent: 30-60 seconds (using cache)

## Step 5: Access Terminal

```
Browser
     │
     │ Navigate to goose.yourdomain.com
     ▼
┌─────────────────────────────┐
│  Cloudflare Access          │
│  Authentication Required    │
└─────────────────────────────┘
     │
     │ Enter email
     ▼
┌─────────────────────────────┐
│  Email Verification         │
│  Check your inbox           │
└─────────────────────────────┘
     │
     │ Enter code
     ▼
┌─────────────────────────────┐
│  Web Terminal               │
│  Goose AI Ready!            │
└─────────────────────────────┘

✅ Success! You're in!
```

## Complete System Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         Your Browser                             │
│                    https://goose.yourdomain.com                  │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ HTTPS Request
                             ▼
                    ┌────────────────┐
                    │  Cloudflare    │
                    │  Edge Network  │
                    └────────┬───────┘
                             │
                             │ Check Auth
                             ▼
                    ┌────────────────┐
                    │  Cloudflare    │
                    │  Access        │
                    └────────┬───────┘
                             │
                             │ Authenticated
                             ▼
                    ┌────────────────┐
                    │  Cloudflare    │
                    │  Tunnel        │
                    └────────┬───────┘
                             │
                             │ Encrypted
                             ▼
┌────────────────────────────────────────────────────────────────┐
│                    Your Server                                  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │              Podman Network (Internal)                    │ │
│  │                                                            │ │
│  │  ┌─────────────────┐         ┌─────────────────┐        │ │
│  │  │  cloudflared    │────────▶│  goose-web      │        │ │
│  │  │  Container      │  :7681  │  Container      │        │ │
│  │  │                 │         │                 │        │ │
│  │  │  Tunnel Client  │         │  ttyd + Goose   │        │ │
│  │  └─────────────────┘         └────────┬────────┘        │ │
│  │                                       │                  │ │
│  └───────────────────────────────────────┼─────────────────┘ │
│                                          │                    │
│  ┌───────────────────────────────────────▼─────────────────┐ │
│  │              Persistent Volumes                          │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐             │ │
│  │  │workspace │  │  config  │  │  tunnel  │             │ │
│  │  └──────────┘  └──────────┘  └──────────┘             │ │
│  └──────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────┘
```

## Verification Checklist

After deployment, verify each component:

```
┌─────────────────────────────────────────────────────────────┐
│  Verification Steps                                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ☐ 1. Containers Running                                    │
│     $ podman-compose ps                                     │
│     ✓ goose-web: Up                                         │
│     ✓ cloudflared: Up                                       │
│                                                              │
│  ☐ 2. Health Checks Passing                                 │
│     $ podman inspect --format='{{.State.Health.Status}}'    │
│     ✓ goose-web: healthy                                    │
│     ✓ cloudflared: healthy                                  │
│                                                              │
│  ☐ 3. Tunnel Connected                                      │
│     Check Cloudflare Dashboard                              │
│     ✓ Tunnel status: Healthy (green)                        │
│                                                              │
│  ☐ 4. DNS Resolving                                         │
│     $ nslookup goose.yourdomain.com                         │
│     ✓ Returns Cloudflare IPs                                │
│                                                              │
│  ☐ 5. Browser Access                                        │
│     Navigate to https://goose.yourdomain.com                │
│     ✓ Cloudflare Access page loads                          │
│     ✓ Can authenticate                                      │
│     ✓ Terminal appears                                      │
│                                                              │
│  ☐ 6. Goose Working                                         │
│     In terminal: $ goose --version                          │
│     ✓ Version displayed                                     │
│     $ goose session start                                   │
│     ✓ Goose responds                                        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Troubleshooting Decision Tree

```
                    Deployment Failed?
                           │
                           ▼
                    Check Logs
                    ./scripts/logs.sh
                           │
              ┌────────────┴────────────┐
              │                         │
         Container                  Tunnel
         Won't Start               Failed
              │                         │
              ▼                         ▼
       Check .env file          Check TUNNEL_TOKEN
       Missing variables?       Valid token?
              │                         │
              ▼                         ▼
       Fix .env                 Get new token
       Restart                  Update .env
                                Restart
              │                         │
              └────────────┬────────────┘
                           │
                           ▼
                    Still failing?
                           │
                           ▼
              See TROUBLESHOOTING.md
```

## Success Indicators

You'll know everything is working when:

```
✅ Containers
   $ podman-compose ps
   NAME         STATUS
   goose-web    Up (healthy)
   cloudflared  Up (healthy)

✅ Logs
   $ ./scripts/logs.sh
   goose-web    | ttyd started on port 7681
   cloudflared  | Connection established

✅ Cloudflare Dashboard
   Networks > Tunnels > Your Tunnel
   Status: Healthy (green indicator)

✅ Browser
   https://goose.yourdomain.com
   - Loads Cloudflare Access page
   - Authentication works
   - Terminal appears
   - Goose responds to commands

✅ Terminal Test
   $ goose --version
   Goose version X.Y.Z
   
   $ goose session start
   Goose> Ready for your task!
```

## Maintenance Flow

```
┌─────────────────────────────────────────────────────────────┐
│  Regular Maintenance                                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Daily:                                                      │
│  └─▶ Check health: podman-compose ps                        │
│                                                              │
│  Weekly:                                                     │
│  ├─▶ Review logs: ./scripts/logs.sh                         │
│  └─▶ Backup volumes: See README.md                          │
│                                                              │
│  Monthly:                                                    │
│  ├─▶ Update containers:                                     │
│  │   podman pull cloudflare/cloudflared:latest              │
│  │   podman-compose build --no-cache                        │
│  └─▶ Restart: ./scripts/stop.sh && ./scripts/start.sh       │
│                                                              │
│  As Needed:                                                  │
│  ├─▶ Update .env: nano .env                                 │
│  ├─▶ Restart: ./scripts/stop.sh && ./scripts/start.sh       │
│  └─▶ Check logs: ./scripts/logs.sh -f                       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Quick Reference Commands

```bash
# Pre-deployment
./scripts/preflight-check.sh    # Check prerequisites

# Deployment
./scripts/start.sh               # Start everything

# Monitoring
podman-compose ps                # Container status
./scripts/logs.sh                # View logs
./scripts/logs.sh -f             # Follow logs
podman stats                     # Resource usage

# Maintenance
./scripts/stop.sh                # Stop everything
./scripts/start.sh               # Start again
podman-compose restart goose-web # Restart one service

# Troubleshooting
./scripts/logs.sh goose-web      # Specific service logs
podman inspect goose-web         # Detailed info
```

## Next Steps After Successful Deployment

```
1. Test thoroughly
   └─▶ Try various Goose commands
   └─▶ Test from different browsers
   └─▶ Verify access control works

2. Set up backups
   └─▶ See README.md for backup commands
   └─▶ Schedule regular backups

3. Add team members
   └─▶ Update Cloudflare Access policy
   └─▶ Add their emails

4. Explore headless mode
   └─▶ Set GOOSE_MODE=auto
   └─▶ Use for automation/API

5. Monitor and maintain
   └─▶ Check logs regularly
   └─▶ Update containers monthly
   └─▶ Review access logs
```

## Resources

- **Quick Start**: [QUICKSTART.md](QUICKSTART.md)
- **Detailed Guide**: [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)
- **Troubleshooting**: [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
- **Architecture**: [ARCHITECTURE.md](ARCHITECTURE.md)
- **Main Docs**: [README.md](README.md)

---

**Ready to deploy?** Start with [README_DEPLOYMENT.md](README_DEPLOYMENT.md)!
