# Goose Infrastructure Scripts

This directory contains scripts for managing and testing the Goose container infrastructure.

## Management Scripts

### start.sh
Starts the Goose container stack using podman-compose.

```bash
./scripts/start.sh
```

**What it does:**
- Validates .env configuration
- Checks required environment variables
- Starts both goose-web and cloudflared containers
- Displays health check status

### stop.sh
Stops the running Goose container stack.

```bash
./scripts/stop.sh
```

### logs.sh
Views logs from running containers.

```bash
# View all logs
./scripts/logs.sh

# View specific service logs
./scripts/logs.sh goose-web
./scripts/logs.sh cloudflared

# Follow logs in real-time
./scripts/logs.sh -f
./scripts/logs.sh goose-web -f
```

### preflight-check.sh
Runs pre-deployment validation checks.

```bash
./scripts/preflight-check.sh
```

## Test Scripts

### test-local.sh
Validates local environment and configuration without building containers.

```bash
bash scripts/test-local.sh
```

**Checks:**
- .env file exists and is configured
- Required environment variables are set
- Podman and podman-compose are installed
- Required files exist (Dockerfile, entrypoint.sh, docker-compose.yml)
- Podman can run containers

**Use when:**
- Setting up a new environment
- Troubleshooting configuration issues
- Verifying prerequisites before deployment

### test-container-run.sh
Tests the entrypoint script logic in a minimal container.

```bash
bash scripts/test-container-run.sh
```

**Checks:**
- Entrypoint script is valid
- Environment variables are passed correctly
- Script logic is sound

**Use when:**
- Validating entrypoint script changes
- Testing environment variable handling
- Debugging container startup issues

### test-compose-config.sh
Validates docker-compose.yml configuration.

```bash
bash scripts/test-compose-config.sh
```

**Checks:**
- Compose file syntax is valid
- All required services are defined
- Volume definitions are present
- Network configuration is correct
- Environment variables are referenced properly

**Use when:**
- Modifying docker-compose.yml
- Adding new services or volumes
- Troubleshooting compose configuration

## Running All Tests

To run all validation tests in sequence:

```bash
bash scripts/test-local.sh && \
bash scripts/test-container-run.sh && \
bash scripts/test-compose-config.sh
```

## Test Results

Test results are tracked during development but transitory status files are not committed to the repository.

## Notes

### WSL Limitations
Full container builds may fail in WSL due to systemd/cgroups limitations. The test scripts validate configuration without requiring full builds.

### ARM64 Production Builds
For production ARM64 builds, use the Fargate build server as documented in the steering rules:

```bash
cd agent-infra
./infrastructure/scripts/build-docker-image.sh development \
  ../goose-infra/container/Dockerfile \
  goose-web \
  your-ecr-repo-name
```

### Architecture Requirements
Production deployments must use ARM64 architecture:
- OCI: VM.Standard.A1.Flex shape only
- Docker images: Build for linux/arm64 platform only
