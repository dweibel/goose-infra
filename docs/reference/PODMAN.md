# Using Podman with Cloudflare Goose Terminal

This project uses Podman instead of Docker for enhanced security and rootless container execution.

## Why Podman?

- **Rootless by default**: Containers run without root privileges
- **Daemonless**: No background daemon required
- **Docker-compatible**: Drop-in replacement for Docker CLI
- **OCI compliant**: Works with standard container images
- **Better security**: Reduced attack surface

## Installation

### Linux (Ubuntu/Debian)
```bash
sudo apt-get update
sudo apt-get install -y podman podman-compose
```

### Linux (Fedora/RHEL/CentOS)
```bash
sudo dnf install -y podman podman-compose
```

### macOS
```bash
brew install podman podman-compose

# Initialize and start Podman machine
podman machine init
podman machine start
```

### Windows (WSL2)
```bash
# In WSL2 Ubuntu distribution
sudo apt-get update
sudo apt-get install -y podman podman-compose
```

## Verification

Check that Podman is installed correctly:
```bash
podman --version
podman-compose --version
```

Test Podman:
```bash
podman run --rm hello-world
```

## Podman vs Docker Commands

Podman commands are identical to Docker:

| Docker | Podman |
|--------|--------|
| `docker run` | `podman run` |
| `docker ps` | `podman ps` |
| `docker images` | `podman images` |
| `docker-compose up` | `podman-compose up` |
| `docker-compose down` | `podman-compose down` |

## Rootless Mode

Podman runs in rootless mode by default. This means:
- Containers run as your user, not as root
- Enhanced security isolation
- No need for sudo (in most cases)

### User Namespace Configuration (Linux)

If you encounter permission issues, enable user namespaces:

```bash
# Check current limit
cat /proc/sys/user/max_user_namespaces

# If it's 0, enable it
echo "user.max_user_namespaces=15000" | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

## SELinux Considerations

On systems with SELinux (Fedora, RHEL, CentOS), volume mounts may need the `:Z` flag:

```bash
# Example with :Z flag for SELinux
podman run -v ./data:/data:Z myimage
```

The compose file in this project works with both SELinux-enabled and disabled systems.

## Troubleshooting

### "permission denied" errors

Enable user namespaces (see above) or check:
```bash
podman info
```

Look for warnings about user namespaces or cgroups.

### Port binding issues

Rootless Podman cannot bind to ports below 1024 without additional configuration. This project doesn't expose any ports directly, so this shouldn't be an issue.

### Volume permissions

If you see permission errors with volumes:
```bash
# Check volume ownership
podman volume inspect goose-infra_workspace

# If needed, adjust permissions
podman unshare chown -R 0:0 ~/.local/share/containers/storage/volumes/goose-infra_workspace/_data
```

### Podman machine issues (macOS/Windows)

If the Podman machine isn't running:
```bash
# Check status
podman machine list

# Start machine
podman machine start

# If issues persist, recreate
podman machine stop
podman machine rm
podman machine init
podman machine start
```

## Migrating from Docker

If you have existing Docker containers/images:

1. Export Docker images:
```bash
docker save myimage:tag | podman load
```

2. Or pull images directly with Podman:
```bash
podman pull docker.io/myimage:tag
```

3. Use the same compose files - podman-compose is compatible

## Additional Resources

- [Podman Documentation](https://docs.podman.io/)
- [Podman vs Docker](https://docs.podman.io/en/latest/Introduction.html)
- [Rootless Containers](https://rootlesscontaine.rs/)
- [Podman Compose](https://github.com/containers/podman-compose)
