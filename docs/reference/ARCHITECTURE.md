# Architecture Overview

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Internet                                 │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ HTTPS
                             │
                    ┌────────▼────────┐
                    │  Cloudflare     │
                    │  Edge Network   │
                    │  (DDoS, CDN)    │
                    └────────┬────────┘
                             │
                             │ Authentication
                             │
                    ┌────────▼────────┐
                    │  Cloudflare     │
                    │  Zero Trust     │
                    │  (Access)       │
                    └────────┬────────┘
                             │
                             │ Authenticated Traffic
                             │
                    ┌────────▼────────┐
                    │  Cloudflare     │
                    │  Tunnel         │
                    │  (Encrypted)    │
                    └────────┬────────┘
                             │
                             │ TLS 1.3
                             │
┌────────────────────────────▼────────────────────────────────────┐
│                    Your Server / Local Machine                   │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Podman Internal Network                      │  │
│  │              (No Exposed Ports)                           │  │
│  │                                                            │  │
│  │  ┌─────────────────────┐      ┌─────────────────────┐   │  │
│  │  │  cloudflared        │      │  goose-web          │   │  │
│  │  │  Container          │─────▶│  Container          │   │  │
│  │  │                     │:7681 │                     │   │  │
│  │  │  - Tunnel client    │      │  - ttyd server      │   │  │
│  │  │  - Auto-reconnect   │      │  - Goose AI agent   │   │  │
│  │  │  - Health checks    │      │  - Python 3.11      │   │  │
│  │  └─────────────────────┘      └──────────┬──────────┘   │  │
│  │                                           │               │  │
│  └───────────────────────────────────────────┼──────────────┘  │
│                                              │                  │
│  ┌───────────────────────────────────────────▼──────────────┐  │
│  │              Podman Volumes (Persistent)                  │  │
│  │                                                            │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │  │
│  │  │  workspace   │  │ goose-config │  │cloudflared-  │   │  │
│  │  │              │  │              │  │   config     │   │  │
│  │  │ - User files │  │ - Settings   │  │ - Tunnel     │   │  │
│  │  │ - Projects   │  │ - History    │  │   creds      │   │  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘   │  │
│  └───────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

## Traffic Flow

### Interactive Mode (Web Browser)

```
User Browser
    │
    │ 1. HTTPS Request (goose.example.com)
    ▼
Cloudflare Edge
    │
    │ 2. Check Authentication
    ▼
Cloudflare Access
    │
    │ 3. Verify Email/Policy
    ▼
Cloudflare Tunnel
    │
    │ 4. Encrypted Connection
    ▼
cloudflared Container
    │
    │ 5. HTTP Proxy (internal)
    ▼
goose-web Container (ttyd:7681)
    │
    │ 6. WebSocket Connection
    ▼
Goose AI Agent
    │
    │ 7. Interactive Terminal
    ▼
User sees terminal in browser
```

### Headless Mode (API/Automation)

```
API Client / CI/CD
    │
    │ 1. HTTPS POST Request
    ▼
Cloudflare Edge
    │
    │ 2. Authentication (API Token)
    ▼
Cloudflare Access
    │
    │ 3. Verify Token
    ▼
Cloudflare Tunnel
    │
    │ 4. Encrypted Connection
    ▼
cloudflared Container
    │
    │ 5. HTTP Proxy
    ▼
goose-web Container
    │
    │ 6. Execute Task
    ▼
Goose AI Agent (auto mode)
    │
    │ 7. JSON Response
    ▼
API Client receives result
```

## Security Layers

```
┌─────────────────────────────────────────────────────────────┐
│ Layer 1: Cloudflare Edge                                    │
│ - DDoS protection                                            │
│ - Rate limiting                                              │
│ - WAF (Web Application Firewall)                            │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ Layer 2: Zero Trust Authentication                          │
│ - Email verification                                         │
│ - Access policies                                            │
│ - Session management                                         │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ Layer 3: Encrypted Tunnel                                   │
│ - TLS 1.3 encryption                                         │
│ - Certificate pinning                                        │
│ - No exposed ports                                           │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ Layer 4: Container Isolation                                │
│ - Rootless Podman                                            │
│ - Internal network only                                      │
│ - No host port binding                                       │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ Layer 5: Application Security                               │
│ - Environment variable isolation                             │
│ - Volume permissions                                         │
│ - API key protection                                         │
└─────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

### cloudflared Container

**Purpose**: Secure tunnel client

**Responsibilities**:
- Establish encrypted connection to Cloudflare
- Maintain persistent tunnel connection
- Auto-reconnect on connection loss
- Proxy authenticated traffic to goose-web
- Report health status

**Configuration**:
- Token-based authentication
- No configuration files needed
- Automatic routing setup
- Health check via tunnel status

### goose-web Container

**Purpose**: Web terminal and AI agent host

**Responsibilities**:
- Run ttyd web terminal server
- Host Goose AI agent
- Handle both interactive and headless modes
- Manage workspace and configuration
- Execute AI tasks

**Configuration**:
- Mode detection (interactive/auto)
- AI provider configuration
- Context strategy settings
- Volume mounts for persistence

### Podman Volumes

**workspace**:
- User project files
- Generated code
- Task outputs
- Working directory

**goose-config**:
- Goose settings
- Session history
- Cache data
- User preferences

**cloudflared-config**:
- Tunnel credentials
- Connection state
- Routing configuration

## Deployment Modes

### Interactive Mode

```yaml
GOOSE_MODE: interactive

User → Browser → Terminal → Goose (prompts for input)
```

**Use Cases**:
- Manual AI agent interaction
- Exploratory tasks
- Learning and experimentation
- Real-time collaboration

### Headless Mode

```yaml
GOOSE_MODE: auto

API → Request → Goose (auto-executes) → JSON Response
```

**Use Cases**:
- CI/CD integration
- Scheduled tasks (cron)
- Automated code reviews
- Batch processing
- API integrations

## Network Topology

```
External Network (Internet)
         │
         │ Cloudflare Tunnel
         │ (Encrypted)
         │
         ▼
┌────────────────────────────────────┐
│  Host Network Interface            │
│  (No listening ports)              │
└────────────────────────────────────┘
         │
         │ Podman Bridge
         │
         ▼
┌────────────────────────────────────┐
│  goose-network (internal)          │
│  Bridge Network                    │
│                                    │
│  ┌──────────────┐  ┌────────────┐ │
│  │ cloudflared  │  │ goose-web  │ │
│  │ (no ports)   │  │ (no ports) │ │
│  └──────────────┘  └────────────┘ │
│         │                 │        │
│         └────────┬────────┘        │
│                  │                 │
│         Internal DNS Resolution    │
│         goose-web:7681             │
└────────────────────────────────────┘
```

**Key Points**:
- No ports exposed to host
- No ports exposed to internet
- All traffic via Cloudflare Tunnel
- Internal DNS for container communication
- Rootless execution (non-root user)

## Data Flow

### Configuration Loading

```
.env file
    │
    ├─▶ TUNNEL_TOKEN ──▶ cloudflared container
    │
    └─▶ GOOSE_* vars ──▶ goose-web container
            │
            └─▶ entrypoint.sh
                    │
                    ├─▶ Mode: interactive ──▶ ttyd + bash
                    │
                    └─▶ Mode: auto ──▶ ttyd + goose headless
```

### Request Processing

```
1. Request arrives at Cloudflare Edge
2. Cloudflare Access checks authentication
3. Authenticated request enters tunnel
4. cloudflared receives encrypted traffic
5. cloudflared proxies to goose-web:7681
6. ttyd handles WebSocket connection
7. Goose processes command
8. Response flows back through tunnel
9. User receives result
```

## Scaling Considerations

### Single Instance (Current)

```
1 Server
├── 1 cloudflared container
└── 1 goose-web container
```

**Suitable for**:
- Personal use
- Small teams (< 10 users)
- Development/testing
- Low-moderate workload

### Multi-Instance (Future)

```
Load Balancer (Cloudflare)
    │
    ├─▶ Server 1 (goose-web-1)
    ├─▶ Server 2 (goose-web-2)
    └─▶ Server 3 (goose-web-3)
```

**Suitable for**:
- Large teams
- High availability requirements
- Heavy workload
- Production environments

## Monitoring Points

```
┌─────────────────────────────────────┐
│ Cloudflare Dashboard                │
│ - Tunnel status                     │
│ - Traffic analytics                 │
│ - Access logs                       │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ Container Logs                      │
│ - podman logs cloudflared           │
│ - podman logs goose-web             │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ Health Checks                       │
│ - Container health status           │
│ - Tunnel connectivity               │
│ - ttyd availability                 │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ Resource Usage                      │
│ - CPU usage (podman stats)          │
│ - Memory usage                      │
│ - Disk usage                        │
└─────────────────────────────────────┘
```

## Backup Strategy

```
┌─────────────────────────────────────┐
│ Critical Data                       │
│ - workspace volume                  │
│ - goose-config volume               │
│ - cloudflared-config volume         │
└─────────────────────────────────────┘
         │
         │ Backup Script
         ▼
┌─────────────────────────────────────┐
│ Backup Storage                      │
│ - Local filesystem                  │
│ - Remote storage (S3, etc.)         │
│ - Version control (git)             │
└─────────────────────────────────────┘
```

## Disaster Recovery

```
1. Stop containers
   └─▶ ./scripts/stop.sh

2. Backup volumes
   └─▶ podman run --rm -v volume:/data ...

3. Store backups securely
   └─▶ Copy to remote storage

4. Document configuration
   └─▶ Save .env file (encrypted)

5. Test restore procedure
   └─▶ Verify backups work
```

## Performance Characteristics

**Latency**:
- Cloudflare Edge: ~10-50ms
- Tunnel overhead: ~5-20ms
- Container processing: ~1-10ms
- Total: ~20-100ms (typical)

**Throughput**:
- Limited by Cloudflare Tunnel bandwidth
- Typical: 100-1000 Mbps
- Sufficient for terminal traffic

**Concurrency**:
- Single instance: 1-10 concurrent users
- Multiple instances: Scales linearly

**Resource Usage**:
- cloudflared: ~50MB RAM, minimal CPU
- goose-web: ~500MB-2GB RAM, variable CPU
- Disk: ~2-10GB (depends on workspace)
