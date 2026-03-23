# Goose Infrastructure Scripts

## Scripts

### start.sh
Starts the goose-web container with all required environment variables. Sources `.env` from the repo root, creates the podman network if needed, and runs the container with wiki gateway, OpenRouter, and leader/worker model config.

```bash
./scripts/start.sh
```

### build.sh
Transfers files to the OCI ARM64 instance and builds the goose-web image natively using podman. Monitors build progress and polls for completion.

```bash
./scripts/build.sh
```

### validate.sh
Comprehensive remote deployment validation. Checks SSH connectivity, container status, port bindings, architecture, volumes, environment variables, Goose/ttyd binaries, cloudflared tunnel, and network connectivity.

```bash
./scripts/validate.sh
```

### scan-secrets.sh
Scans tracked files for common secret patterns (AWS keys, OCI OCIDs, private keys, GitHub tokens, etc.). Use `--fail-on-detect` for CI/CD pipelines.

```bash
./scripts/scan-secrets.sh
./scripts/scan-secrets.sh --fail-on-detect
```

### oci-instance-retry.sh
Automated OCI instance provisioning retry across availability domains. Handles capacity-constrained environments by cycling through all ADs with configurable retry intervals and updates terraform state on success.

```bash
./scripts/oci-instance-retry.sh
./scripts/oci-instance-retry.sh --max-retries 10 --wait-interval 120
```

## Notes

- All production builds must target ARM64 (`--platform linux/arm64`)
- Environment variables are sourced from `.env` (gitignored) — never hardcode secrets in scripts
- The deployment uses standalone `podman run`, not podman-compose
