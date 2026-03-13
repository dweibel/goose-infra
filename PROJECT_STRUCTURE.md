# Project Structure

This document describes the organization of the goose-infra project.

## Directory Layout

```
goose-infra/
├── README.md                    # Main project documentation
├── docker-compose.yml           # Container orchestration configuration
├── package.json                 # Test dependencies (npm/node)
├── vitest.config.ts             # Test runner configuration
├── .env.example                 # Environment variable template
├── .env                         # Your local configuration (gitignored)
├── .gitignore                   # Git ignore rules
├── PROJECT_STRUCTURE.md         # This file - project organization guide
├── ORGANIZATION_SUMMARY.md      # Documentation reorganization summary
│
├── container/                   # Container-specific files
│   ├── Dockerfile               # Goose web container image definition
│   ├── entrypoint.sh            # Container startup script
│   └── cloudflared-config.yml   # Cloudflare tunnel configuration
│
├── docs/                        # All documentation
│   ├── README.md                # Documentation index
│   ├── deployment/              # Deployment guides
│   │   ├── README.md            # Deployment help hub (start here!)
│   │   ├── QUICKSTART.md        # 30-minute fast deployment
│   │   ├── DEPLOYMENT_GUIDE.md  # Detailed step-by-step guide
│   │   ├── DEPLOYMENT_FLOW.md   # Visual deployment guide
│   │   └── CLOUDFLARE_ZERO_TRUST_SETUP.md
│   └── reference/               # Technical reference
│       ├── ARCHITECTURE.md      # System design and architecture
│       ├── PODMAN.md            # Podman installation and help
│       └── TROUBLESHOOTING.md   # Common issues and solutions
│
├── scripts/                     # Management and deployment scripts
│   ├── README.md                # Scripts documentation
│   ├── start.sh                 # Start the container stack (recommended)
│   ├── start-goose.sh           # Alternative simple start script
│   ├── stop.sh                  # Stop the container stack
│   ├── logs.sh                  # View container logs
│   ├── preflight-check.sh       # Pre-deployment validation
│   ├── verify-secrets.sh        # Security scan for secrets
│   ├── build-on-oci.sh          # Build on OCI instance
│   ├── deploy-to-oci.sh         # Deploy to OCI instance
│   ├── restart-cloudflared.sh   # Restart tunnel
│   ├── update-cloudflared-config.sh
│   ├── validate-deployment.sh   # Post-deployment checks
│   ├── test-local.sh            # Local environment tests
│   ├── test-container-run.sh    # Container entrypoint tests
│   ├── test-compose-config.sh   # Compose configuration tests
│   └── test-terminal.sh         # Terminal functionality tests
│
├── tests/                       # Test suites
│   ├── unit/                    # Unit tests
│   │   ├── test_env_config.test.ts
│   │   └── test_docker_compose.test.ts
│   ├── property/                # Property-based tests
│   │   └── test_docker_compose_property.test.ts
│   └── fixtures/                # Test fixtures and data
│
└── volumes/                     # Persistent data (gitignored)
    ├── workspace/               # Goose working directory
    ├── goose-config/            # Goose configuration
    └── cloudflared-config/      # Tunnel configuration
```

## File Categories

### Root Level Files

Files that should remain in the project root:

- **README.md** - Main entry point, links to all documentation
- **docker-compose.yml** - Container orchestration (references container/Dockerfile)
- **package.json** - Test dependencies (standard npm location)
- **vitest.config.ts** - Test runner configuration (standard location)
- **.env.example** - Configuration template
- **.env** - Local configuration (gitignored)
- **.gitignore** - Git ignore rules
- **PROJECT_STRUCTURE.md** - Project organization guide
- **ORGANIZATION_SUMMARY.md** - Reorganization summary

Note: `package.json` and `vitest.config.ts` remain in root as this is the standard location for Node.js/test configurations.

### Container Files (`container/`)

Files used by the container runtime:

- **Dockerfile** - Container image definition (ARM64-optimized)
- **entrypoint.sh** - Container startup script
- **cloudflared-config.yml** - Cloudflare tunnel configuration

These files are referenced by docker-compose.yml and should not be moved.

### Documentation (`docs/`)

All user-facing documentation organized by purpose:

**Deployment guides** (`docs/deployment/`):
- Step-by-step instructions for getting the system running
- Quick start guides and checklists
- Cloudflare-specific setup instructions

**Reference documentation** (`docs/reference/`):
- Technical architecture and design
- Platform-specific installation guides
- Troubleshooting and problem-solving

### Scripts (`scripts/`)

Operational scripts for managing the system:

**Management scripts**:
- start.sh - Full-featured container startup with validation (recommended)
- start-goose.sh - Simple alternative start script
- stop.sh, logs.sh - Basic container operations
- preflight-check.sh - Pre-deployment validation
- verify-secrets.sh - Security scan for accidentally committed secrets

**Deployment scripts**:
- build-on-oci.sh, deploy-to-oci.sh - OCI deployment automation
- validate-deployment.sh - Post-deployment verification

**Test scripts**:
- test-local.sh, test-container-run.sh, test-compose-config.sh
- Local validation without full container builds

### Tests (`tests/`)

Automated test suites:

- **unit/** - Unit tests for configuration and compose files
- **property/** - Property-based tests for system behavior
- **fixtures/** - Test data and fixture files

## Documentation Organization

### Entry Points

1. **For deployment**: Start at [docs/deployment/README.md](docs/deployment/README.md)
2. **For reference**: Browse [docs/README.md](docs/README.md)
3. **For overview**: Read [README.md](README.md)

### Documentation Flow

```
README.md (root)
    ↓
docs/deployment/README.md (deployment hub)
    ↓
    ├─→ QUICKSTART.md (fast path)
    ├─→ DEPLOYMENT_GUIDE.md (detailed path)
    └─→ DEPLOYMENT_FLOW.md (visual path)
    
docs/reference/
    ├─→ ARCHITECTURE.md (understanding)
    ├─→ PODMAN.md (installation)
    └─→ TROUBLESHOOTING.md (problem-solving)
```

## Removed Files

The following transitory status files were removed during reorganization:

- **BUILD_STATUS.md** - Temporary build tracking
- **DEPLOYMENT_SUCCESS.md** - One-time deployment record
- **TEST_RESULTS.md** - Transitory test output
- **IMPLEMENTATION_STATUS.md** - Development tracking
- **INDEX.md** - Redundant with docs/README.md

These files served their purpose during development but are not needed for ongoing operations.

## Configuration Files

### Environment Configuration

- **.env.example** - Template with all required variables
- **.env** - Your local configuration (never commit!)

### Container Configuration

- **docker-compose.yml** - Service definitions, volumes, networks
- **container/Dockerfile** - Image build instructions
- **container/entrypoint.sh** - Container initialization
- **container/cloudflared-config.yml** - Tunnel settings

## Best Practices

### Adding New Documentation

- **Deployment guides** → `docs/deployment/`
- **Technical reference** → `docs/reference/`
- **Update** `docs/README.md` to include new documents

### Adding New Scripts

- Place in `scripts/` directory
- Update `scripts/README.md` with description
- Make executable: `chmod +x scripts/your-script.sh`

### Adding New Tests

- **Unit tests** → `tests/unit/`
- **Property tests** → `tests/property/`
- Update `package.json` if new dependencies needed

## Quick Reference

### I need to...

- **Deploy the system** → `docs/deployment/README.md`
- **Understand the architecture** → `docs/reference/ARCHITECTURE.md`
- **Fix a problem** → `docs/reference/TROUBLESHOOTING.md`
- **Install Podman** → `docs/reference/PODMAN.md`
- **Start containers** → `./scripts/start.sh`
- **View logs** → `./scripts/logs.sh`
- **Run tests** → `npm test`
- **Modify the container** → `container/Dockerfile` or `container/entrypoint.sh`
- **Change configuration** → `.env`

## Maintenance

### Keeping Documentation Current

When making changes:

1. Update relevant documentation in `docs/`
2. Update `docs/README.md` if adding/removing docs
3. Update this file if changing project structure
4. Update `README.md` if changing entry points

### Version Control

Files tracked in git:
- All documentation
- All scripts
- Configuration templates (.env.example)
- Container definitions
- Test suites

Files ignored by git:
- .env (contains secrets)
- volumes/ (runtime data)
- node_modules/ (dependencies)
- Test output files

## Architecture Compliance

This project follows strict ARM64-only architecture requirements:

- Container images built for `linux/arm64` platform
- OCI deployments use `VM.Standard.A1.Flex` shape only
- No x86/AMD64 instances or images

See `docs/reference/ARCHITECTURE.md` for details.
