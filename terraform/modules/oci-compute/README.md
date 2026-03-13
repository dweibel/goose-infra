# OCI Compute Module

This Terraform module provisions ARM64 compute instances on Oracle Cloud Infrastructure (OCI) with enforced architecture validation for Always Free tier compatibility.

## Features

- **ARM64 Architecture Enforcement**: Only allows VM.Standard.A1.Flex shape
- **Automatic Image Selection**: Selects latest ARM64-compatible Oracle Linux 8 image
- **Workspace Volume**: Provisions and attaches persistent block storage
- **Cloud-Init Configuration**: Automated instance setup with ARM64-specific repositories
- **Validation**: Pre-deployment checks for shape and image compatibility

## Architecture Validation

The module enforces ARM64 architecture through multiple mechanisms:

1. **Variable Validation**: The `instance_shape` variable has a validation rule that only accepts `VM.Standard.A1.Flex`
2. **Runtime Validation**: Null resources validate the shape and image before instance creation
3. **Cloud-Init Verification**: The cloud-init script verifies `aarch64` architecture at boot time

If a non-ARM64 shape is specified, Terraform will fail with:
```
ERROR: Invalid shape: <shape>. Only VM.Standard.A1.Flex (ARM64) is supported for cost optimization.
```

## Usage

```hcl
module "oci_compute" {
  source = "./modules/oci-compute"
  
  compartment_id = var.compartment_id
  subnet_id      = module.oci_network.subnet_id
  ssh_public_key = file("~/.ssh/id_rsa.pub")
  
  name_prefix              = "goose"
  instance_ocpus           = 2
  instance_memory_gb       = 12
  boot_volume_size_gb      = 50
  workspace_volume_size_gb = 50
  workspace_mount_path     = "/mnt/workspace"
  
  tags = {
    Environment = "production"
    Project     = "goose-infra"
  }
}
```

## Inputs

| Name | Description | Type | Default | Required |
|------|-------------|------|---------|----------|
| compartment_id | OCID of the compartment where resources will be created | string | - | yes |
| subnet_id | OCID of the subnet where the instance will be created | string | - | yes |
| ssh_public_key | SSH public key for instance access | string | - | yes |
| name_prefix | Prefix for resource names | string | "goose" | no |
| availability_domain | Availability domain for the instance (leave empty to use first available) | string | "" | no |
| instance_shape | Shape of the instance (must be VM.Standard.A1.Flex) | string | "VM.Standard.A1.Flex" | no |
| instance_ocpus | Number of OCPUs for the instance (1-4) | number | 2 | no |
| instance_memory_gb | Memory in GB for the instance (1-24) | number | 12 | no |
| boot_volume_size_gb | Size of the boot volume in GB (50-200) | number | 50 | no |
| workspace_volume_size_gb | Size of the workspace volume in GB (50-200) | number | 50 | no |
| workspace_mount_path | Mount path for the workspace volume | string | "/mnt/workspace" | no |
| tags | Freeform tags to apply to resources | map(string) | {} | no |

## Outputs

| Name | Description |
|------|-------------|
| instance_id | OCID of the compute instance |
| instance_public_ip | Public IP address of the instance |
| instance_private_ip | Private IP address within the VCN |
| availability_domain | Availability domain where the instance was created |
| workspace_volume_id | OCID of the workspace volume |
| workspace_volume_attachment_id | OCID of the workspace volume attachment |
| shape | Shape of the compute instance (ARM64) |
| image_id | OCID of the image used for the instance |

## Cloud-Init Configuration

The module includes a cloud-init template that:

- Installs essential packages (podman, git, jq, curl, unzip)
- Configures ARM64-specific package repositories
- Installs AWS CLI v2 for ARM64
- Formats and mounts the workspace volume automatically
- Configures swap space (4 GB)
- Sets up Podman with journald logging
- Verifies ARM64 architecture at boot time

## Always Free Tier Limits

The module enforces OCI Always Free tier limits through variable validations:

- **OCPUs**: 1-4 total across all instances
- **Memory**: 1-24 GB total across all instances
- **Boot Volume**: 50-200 GB per volume
- **Block Storage**: Up to 200 GB total across all volumes

## Requirements

- Terraform >= 1.0
- OCI Provider >= 4.0
- Valid OCI credentials configured

## Migration from agent-infra

This module was migrated from `agent-infra/infrastructure/terraform/modules/oci-compute` with the following changes:

1. **Removed application-specific variables**: AWS region, ECR registry, S3 bucket, Bedrock model ID, and application configuration variables
2. **Simplified cloud-init**: Removed application-specific setup, focused on core infrastructure
3. **Enhanced ARM64 validation**: Added explicit shape validation and architecture verification
4. **Updated default name prefix**: Changed from "agent-coder" to "goose"
5. **Added ARM64 repository configuration**: Explicit ARM64 package repository setup
6. **Improved documentation**: Added comprehensive README and inline comments

## License

This module is part of the goose-infra project.
