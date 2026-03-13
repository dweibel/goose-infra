# Troubleshooting Guide

Common issues and their solutions for Cloudflare Goose Terminal.

## Quick Diagnostics

Run the pre-flight check first:
```bash
./scripts/preflight-check.sh
```

View logs for errors:
```bash
./scripts/logs.sh -f
```

## Common Issues

### 1. Container Won't Start

#### Symptom
```bash
./scripts/start.sh
# Error: container failed to start
```

#### Diagnosis
```bash
# Check logs
./scripts/logs.sh goose-web

# Check container status
podman-compose ps
```

#### Common Causes & Solutions

**Missing environment variables**
```bash
# Check .env file exists
ls -la .env

# Verify required variables
grep -E "TUNNEL_TOKEN|GOOSE_API_KEY|GOOSE_PROVIDER" .env

# If missing, copy example and configure
cp .env.example .env
nano .env
```

**Invalid API key**
```bash
# Test OpenAI key
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $GOOSE_API_KEY"

# Should return list of models, not error
```

**Podman not running (macOS/Windows)**
```bash
# Check Podman machine status
podman machine list

# Start if stopped
podman machine start

# Verify
podman ps
```

**User namespace issues (Linux)**
```bash
# Check setting
cat /proc/sys/user/max_user_namespaces

# If 0, enable
echo "user.max_user_namespaces=15000" | sudo tee -a /etc/sysctl.conf
sudo sysctl -p

# Restart Podman
podman system reset --force
```

---

### 2. Tunnel Connection Failed

#### Symptom
```bash
# In logs:
cloudflared | ERR Failed to connect to Cloudflare
cloudflared | ERR Authentication failed
```

#### Diagnosis
```bash
# Check cloudflared logs
./scripts/logs.sh cloudflared

# Check tunnel status in Cloudflare dashboard
# Networks > Tunnels > Your Tunnel
```

#### Solutions

**Invalid tunnel token**
```bash
# Get new token from Cloudflare dashboard
# Networks > Tunnels > Your Tunnel > Configure

# Update .env
nano .env
# Replace TUNNEL_TOKEN with new value

# Restart
./scripts/stop.sh
./scripts/start.sh
```

**Tunnel already connected elsewhere**
```bash
# Check Cloudflare dashboard for active connections
# Disconnect other instances or create new tunnel

# If needed, create new tunnel:
# 1. Cloudflare dashboard > Networks > Tunnels
# 2. Create new tunnel
# 3. Get new token
# 4. Update .env
```

**Network connectivity issues**
```bash
# Test internet connection
ping -c 3 1.1.1.1

# Test Cloudflare connectivity
curl -I https://cloudflare.com

# Check firewall rules
sudo iptables -L | grep -i cloudflare
```

**DNS resolution issues**
```bash
# Test DNS
nslookup api.cloudflare.com

# If fails, try different DNS
# Edit /etc/resolv.conf
nameserver 1.1.1.1
nameserver 8.8.8.8
```

---

### 3. Can't Access Terminal in Browser

#### Symptom
- Browser shows "Unable to connect"
- Cloudflare error page
- Infinite loading

#### Diagnosis
```bash
# Check tunnel status
./scripts/logs.sh cloudflared | grep -i "connection"

# Check goose-web status
podman inspect --format='{{.State.Health.Status}}' goose-web

# Test DNS resolution
nslookup goose.yourdomain.com
```

#### Solutions

**Tunnel not healthy**
```bash
# Check Cloudflare dashboard
# Networks > Tunnels > Should show green "Healthy"

# If unhealthy, check logs
./scripts/logs.sh cloudflared

# Restart tunnel
podman-compose restart cloudflared
```

**DNS not propagated**
```bash
# Check DNS
dig goose.yourdomain.com

# Should return Cloudflare IPs (104.x.x.x or 172.x.x.x)
# If not, wait 5-10 minutes for propagation

# Clear browser DNS cache
# Chrome: chrome://net-internals/#dns
# Firefox: about:networking#dns
```

**Access policy blocking you**
```bash
# Check Cloudflare dashboard
# Access > Applications > Your App > Policies

# Verify your email is in "Include" rules
# Try adding "Everyone" temporarily for testing

# Clear browser cookies for your domain
```

**Wrong subdomain/domain**
```bash
# Verify in Cloudflare dashboard
# Networks > Tunnels > Your Tunnel > Public Hostname

# Should match your .env TUNNEL_SUBDOMAIN
grep TUNNEL_SUBDOMAIN .env

# Update if mismatch
```

**Browser cache issues**
```bash
# Try incognito/private mode
# Or clear browser cache

# Chrome: Ctrl+Shift+Delete
# Firefox: Ctrl+Shift+Delete
```

---

### 4. Health Checks Failing

#### Symptom
```bash
podman inspect --format='{{.State.Health.Status}}' goose-web
# Returns: unhealthy
```

#### Diagnosis
```bash
# Check health check logs
podman inspect goose-web | grep -A 20 Health

# Check container logs
./scripts/logs.sh goose-web
```

#### Solutions

**Container still starting**
```bash
# Health checks need 30-60 seconds to initialize
sleep 60

# Check again
podman inspect --format='{{.State.Health.Status}}' goose-web
```

**ttyd not responding**
```bash
# Check if ttyd is running
podman exec goose-web ps aux | grep ttyd

# If not running, check entrypoint logs
./scripts/logs.sh goose-web | grep -i ttyd

# Restart container
podman-compose restart goose-web
```

**Port conflict (internal)**
```bash
# Check if port 7681 is in use
podman exec goose-web netstat -tlnp | grep 7681

# If conflict, update .env
nano .env
# Change TTYD_PORT=7682

# Restart
./scripts/stop.sh
./scripts/start.sh
```

**Resource exhaustion**
```bash
# Check resource usage
podman stats

# If high CPU/memory, increase limits in docker-compose.yml
# Or reduce GOOSE_MAX_TURNS in .env
```

---

### 5. Permission Denied Errors

#### Symptom
```bash
# In logs:
Error: permission denied
Error: cannot write to /workspace
```

#### Diagnosis
```bash
# Check volume permissions
podman volume inspect goose-infra_workspace

# Check SELinux status (Linux)
getenforce
```

#### Solutions

**Rootless Podman permissions**
```bash
# Enable user namespaces
echo "user.max_user_namespaces=15000" | sudo tee -a /etc/sysctl.conf
sudo sysctl -p

# Reset Podman
podman system reset --force

# Restart
./scripts/start.sh
```

**SELinux blocking (Fedora/RHEL)**
```bash
# Check SELinux denials
sudo ausearch -m avc -ts recent

# Add :Z flag to volumes in docker-compose.yml
# Already included in our compose file

# Or temporarily disable SELinux (not recommended)
sudo setenforce 0
```

**Volume ownership issues**
```bash
# Fix volume permissions
podman unshare chown -R 0:0 ~/.local/share/containers/storage/volumes/goose-infra_workspace/_data

# Restart
./scripts/stop.sh
./scripts/start.sh
```

---

### 6. Goose Agent Not Working

#### Symptom
```bash
# In terminal:
goose: command not found
# Or Goose crashes/hangs
```

#### Diagnosis
```bash
# Check if Goose is installed
podman exec goose-web which goose

# Check Goose version
podman exec goose-web goose --version

# Check Python environment
podman exec goose-web python3 --version
```

#### Solutions

**Goose not installed**
```bash
# Rebuild container
podman-compose build --no-cache goose-web

# Restart
./scripts/stop.sh
./scripts/start.sh
```

**Invalid AI provider configuration**
```bash
# Check .env settings
grep GOOSE_ .env

# Verify API key is valid
# Test with curl (OpenAI example):
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $GOOSE_API_KEY"

# Update .env if needed
nano .env

# Restart
./scripts/stop.sh
./scripts/start.sh
```

**Goose configuration issues**
```bash
# Check Goose config
podman exec goose-web cat /root/.config/goose/config.yaml

# Reset Goose config
podman volume rm goose-infra_goose-config
./scripts/stop.sh
./scripts/start.sh
```

---

### 7. Headless Mode Not Working

#### Symptom
- Goose prompts for input in auto mode
- JSON output not formatted correctly
- API requests fail

#### Diagnosis
```bash
# Check mode setting
grep GOOSE_MODE .env

# Check entrypoint logs
./scripts/logs.sh goose-web | grep -i mode
```

#### Solutions

**Mode not set correctly**
```bash
# Update .env
nano .env
# Set: GOOSE_MODE=auto

# Restart
./scripts/stop.sh
./scripts/start.sh
```

**Entrypoint not detecting mode**
```bash
# Check entrypoint script
cat entrypoint.sh | grep GOOSE_MODE

# Verify environment variable is passed
podman exec goose-web env | grep GOOSE_MODE

# If missing, check docker-compose.yml environment section
```

---

### 8. Slow Performance

#### Symptom
- Terminal is laggy
- Goose responses are slow
- High resource usage

#### Diagnosis
```bash
# Check resource usage
podman stats

# Check AI provider status
# OpenAI: https://status.openai.com/
# Anthropic: https://status.anthropic.com/

# Check network latency
ping -c 10 1.1.1.1
```

#### Solutions

**High CPU/Memory usage**
```bash
# Reduce max turns
nano .env
# Set: GOOSE_MAX_TURNS=5

# Use minimal context strategy
# Set: GOOSE_CONTEXT_STRATEGY=minimal

# Restart
./scripts/stop.sh
./scripts/start.sh
```

**Network latency**
```bash
# Check Cloudflare tunnel latency
./scripts/logs.sh cloudflared | grep -i latency

# Consider deploying closer to users
# Or use Cloudflare Argo for faster routing
```

**AI provider rate limiting**
```bash
# Check logs for rate limit errors
./scripts/logs.sh goose-web | grep -i "rate limit"

# Reduce request frequency
# Or upgrade AI provider plan
```

---

## Advanced Diagnostics

### Full System Check

```bash
#!/bin/bash
echo "=== System Information ==="
uname -a
echo ""

echo "=== Podman Version ==="
podman --version
podman-compose --version
echo ""

echo "=== Container Status ==="
podman-compose ps
echo ""

echo "=== Health Status ==="
podman inspect --format='{{.Name}}: {{.State.Health.Status}}' goose-web cloudflared
echo ""

echo "=== Resource Usage ==="
podman stats --no-stream
echo ""

echo "=== Volume Status ==="
podman volume ls | grep goose-infra
echo ""

echo "=== Network Status ==="
podman network ls | grep goose
echo ""

echo "=== Recent Logs (last 20 lines) ==="
echo "--- goose-web ---"
podman logs --tail 20 goose-web
echo ""
echo "--- cloudflared ---"
podman logs --tail 20 cloudflared
echo ""

echo "=== Environment Check ==="
if [ -f .env ]; then
    echo ".env file exists"
    grep -v "^#" .env | grep -v "^$" | sed 's/=.*/=***/'
else
    echo ".env file missing!"
fi
```

Save as `scripts/diagnose.sh` and run:
```bash
chmod +x scripts/diagnose.sh
./scripts/diagnose.sh > diagnosis.txt
```

### Enable Debug Logging

```bash
# Update .env
nano .env
# Set: LOG_LEVEL=DEBUG

# Restart
./scripts/stop.sh
./scripts/start.sh

# View detailed logs
./scripts/logs.sh -f
```

### Test Connectivity

```bash
# Test from inside container
podman exec goose-web curl -I http://localhost:7681

# Should return HTTP 200 OK

# Test tunnel connectivity
podman exec cloudflared cloudflared tunnel info
```

## Getting Help

If you're still stuck:

1. **Gather information**:
   ```bash
   ./scripts/diagnose.sh > diagnosis.txt
   ```

2. **Check documentation**:
   - [README.md](README.md) - Main documentation
   - [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) - Setup guide
   - [PODMAN.md](PODMAN.md) - Podman-specific help
   - [ARCHITECTURE.md](ARCHITECTURE.md) - System design

3. **Check external resources**:
   - Cloudflare Tunnel docs: https://developers.cloudflare.com/cloudflare-one/
   - Podman docs: https://docs.podman.io/
   - Goose docs: https://github.com/square/goose

4. **Common support channels**:
   - Cloudflare Community: https://community.cloudflare.com/
   - Podman GitHub: https://github.com/containers/podman/issues
   - Goose GitHub: https://github.com/square/goose/issues

## Prevention Tips

1. **Regular backups**:
   ```bash
   # Weekly backup script
   ./scripts/backup.sh
   ```

2. **Monitor health**:
   ```bash
   # Add to cron
   */5 * * * * cd /path/to/goose-infra && podman inspect --format='{{.State.Health.Status}}' goose-web cloudflared
   ```

3. **Keep updated**:
   ```bash
   # Update containers monthly
   podman pull cloudflare/cloudflared:latest
   podman-compose build --no-cache goose-web
   ```

4. **Test after changes**:
   ```bash
   # Always test after configuration changes
   ./scripts/preflight-check.sh
   ./scripts/start.sh
   ```
