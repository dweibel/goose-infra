# Migration Summary: oci-compute Module

## Source
`agent-infra/infrastructure/terraform/modules/oci-compute`

## Destination
`goose-infra/terraform/modules/oci-compute`

## Changes Made

### 1. ARM64 Architecture Enforcement
- Added variable validation for `instance_shape` to only accept `VM.Standard.A1.Flex`
- Added `null_resource` validators to reject non-ARM64 shapes at plan time
- Added ARM64 architecture verification in cloud-init script

### 2. Simplified Configuration
- Removed application-specific variables (AWS region, ECR registry, S3 bucket, Bedrock model ID)
- Removed application configuration variables (app_port, log_format, max_iterations, iteration_timeout)
- Focused module on core infrastructure provisioning only

### 3. Enhanced Cloud-Init
- Added explicit ARM64 package repository configuration
- Added architecture verification step (checks for aarch64)
- Removed application-specific setup code
- Kept essential infrastructure setup (workspace volume, swap, podman)

### 4. Updated Defaults
- Changed `name_prefix` default from "agent-coder" to "goose"
- Adjusted volume size defaults for Always Free tier optimization
- Added validation rules for Always Free tier limits

### 5. Improved Documentation
- Added comprehensive README.md with usage examples
- Added inline comments explaining ARM64 enforcement
- Documented all inputs, outputs, and validations
- Added migration notes

## Validation Added

The module now validates:
- Shape must be VM.Standard.A1.Flex
- OCPUs: 1-4 (Always Free tier limit)
- Memory: 1-24 GB (Always Free tier limit)
- Boot volume: 50-200 GB
- Workspace volume: 50-200 GB
- ARM64 image availability
- Architecture verification at boot time

## Files Migrated
- main.tf (enhanced with ARM64 validation)
- variables.tf (simplified and validated)
- outputs.tf (preserved with additions)
- cloud-init.yaml (simplified and ARM64-focused)
- README.md (new)
