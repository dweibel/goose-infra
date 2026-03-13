# OCI Infrastructure Terraform Configuration

This directory contains the root Terraform configuration for provisioning OCI infrastructure with ARM64 compute instances, networking, logging, and monitoring.

## Architecture

The configuration is organized into four modules:

- **oci-compute**: ARM64 compute instances with workspace volumes
- **oci-network**: VCN, subnets, internet gateway, and security lists
- **oci-logging**: Log groups and unified agent configuration
- **oci-monitoring**: Monitoring alarms and notification topics

## Prerequisites

1. **OCI Account**: An Oracle Cloud Infrastructure account with Always Free tier
2. **OCI CLI**: Install and configure the OCI CLI
3. **Terraform**: Version 1.6.0 or higher
4. **API Key**: Generate an API key pair for OCI authentication

## Quick Start

### 1. Configure Authentication

Create your OCI API key if you haven't already:

```bash
mkdir -p ~/.oci
oci setup config
```

### 2. Create Configuration File

Copy the example configuration and fill in your values:

```bash
cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars` with your OCI credentials and preferences.

### 3. Initialize Terraform

```bash
terraform init
```

### 4. Plan Deployment

```bash
terraform plan
```

### 5. Apply Configuration

```bash
terraform apply
```

## Configuration Variables

### Required Variables

- `tenancy_ocid`: OCID of your OCI tenancy
- `user_ocid`: OCID of your OCI user
- `fingerprint`: Fingerprint of your API key
- `private_key_path`: Path to your private key file
- `compartment_id`: OCID of the target compartment
- `ssh_public_key`: SSH public key for instance access
- `allowed_ssh_cidrs`: CIDR blocks allowed for SSH access
- `allowed_http_cidrs`: CIDR blocks allowed for HTTP access
- `alert_email`: Email address for monitoring alerts

### Optional Variables

- `region`: OCI region (default: us-ashburn-1)
- `project_name`: Project name (default: oci-infra)
- `name_prefix`: Resource name prefix (default: oci)
- `environment`: Environment name (default: dev)
- `vcn_cidr`: VCN CIDR block (default: 10.0.0.0/16)
- `subnet_cidr`: Subnet CIDR block (default: 10.0.1.0/24)
- `instance_shape`: Compute shape (default: VM.Standard.A1.Flex)
- `instance_ocpus`: Number of OCPUs (default: 4)
- `instance_memory_gb`: Memory in GB (default: 24)
- `boot_volume_size_gb`: Boot volume size (default: 200)
- `workspace_volume_size_gb`: Workspace volume size (default: 40)
- `workspace_mount_path`: Workspace mount path (default: /mnt/workspace)
- `app_port`: Application port (default: 8080)
- `log_retention_days`: Log retention period (default: 30)

## Outputs

After successful deployment, Terraform will output:

- `instance_public_ip`: Public IP address of the instance
- `instance_id`: OCID of the compute instance
- `workspace_volume_id`: OCID of the workspace volume
- `vcn_id`: OCID of the VCN
- `log_group_id`: OCID of the log group
- `ssh_command`: SSH command to connect to the instance

## ARM64 Architecture

This configuration enforces ARM64 architecture for cost optimization:

- Only `VM.Standard.A1.Flex` shape is supported
- Validation prevents non-ARM64 shapes
- Compatible with OCI Always Free tier

## Workspace Volume

The configuration provisions a persistent workspace volume:

- Configurable size via `workspace_volume_size_gb`
- Survives instance termination
- Automatically mounted at boot via cloud-init
- Can be reattached to new instances

## Logging

Centralized logging is configured automatically:

- Log group for application logs
- Unified agent for log collection
- Dynamic groups and IAM policies
- Configurable retention period

## Monitoring

Monitoring alarms are configured for:

- CPU utilization
- Memory utilization
- Disk utilization
- Instance availability

Alerts are sent to the configured email address.

## Cleanup

To destroy all resources:

```bash
terraform destroy
```

**Warning**: This will permanently delete all resources including the workspace volume. Back up any important data first.

## Module Documentation

For detailed module documentation, see:

- [oci-compute](./modules/oci-compute/README.md)
- [oci-network](./modules/oci-network/README.md)
- [oci-logging](./modules/oci-logging/README.md)
- [oci-monitoring](./modules/oci-monitoring/README.md)

## Troubleshooting

### Capacity Issues

If you encounter "Out of capacity" errors:

1. Try a different availability domain
2. Use the retry script: `../../scripts/oci-instance-retry.sh`
3. Wait and retry later

### Authentication Errors

If you get authentication errors:

1. Verify your API key is correctly configured
2. Check the fingerprint matches your key
3. Ensure the private key path is correct
4. Verify your user has necessary permissions

### State Lock Issues

If Terraform state is locked:

1. Check if another Terraform process is running
2. Remove stale locks if the process is no longer active
3. Use `terraform force-unlock <lock-id>` if necessary

## Security Best Practices

1. **Restrict SSH Access**: Limit `allowed_ssh_cidrs` to your IP address
2. **Restrict HTTP Access**: Limit `allowed_http_cidrs` to trusted sources
3. **Protect Private Keys**: Never commit private keys to version control
4. **Use Strong SSH Keys**: Generate keys with at least 2048 bits
5. **Enable MFA**: Enable multi-factor authentication on your OCI account
6. **Regular Updates**: Keep Terraform and providers up to date

## Support

For issues or questions:

1. Check the module README files
2. Review OCI documentation
3. Check Terraform OCI provider documentation
4. Review the spec documentation in `.kiro/specs/oci-infra-repository/`
