# OCI Logging Module

This Terraform module provisions centralized logging infrastructure for OCI compute instances using OCI Logging service and the Unified Monitoring Agent.

## Features

- **Log Group**: Creates a dedicated log group for application logs
- **Custom Log**: Provisions a custom log for collecting instance logs
- **Dynamic Group**: Creates a dynamic group for instance identity-based access
- **IAM Policy**: Grants instances permissions to write logs
- **Unified Monitoring Agent**: Configures automatic log collection from instances

## Resources Created

- `oci_logging_log_group.main` - Log group for organizing logs
- `oci_logging_log.app` - Custom log for application logs
- `oci_identity_dynamic_group.instance` - Dynamic group for instance access
- `oci_identity_policy.logging` - IAM policy for log write permissions
- `oci_logging_unified_agent_configuration.main` - Agent configuration for log collection

## Usage

```hcl
module "logging" {
  source = "./modules/oci-logging"

  compartment_id      = var.compartment_id
  tenancy_ocid        = var.tenancy_ocid
  name_prefix         = "my-app"
  instance_id         = module.compute.instance_id
  log_retention_days  = 30

  tags = {
    Environment = "production"
    ManagedBy   = "terraform"
  }
}
```

## Inputs

| Name | Description | Type | Default | Required |
|------|-------------|------|---------|----------|
| compartment_id | OCID of the compartment where resources will be created | string | - | yes |
| tenancy_ocid | OCID of the tenancy (required for dynamic group creation) | string | - | yes |
| name_prefix | Prefix for resource names | string | "agent-coder" | no |
| instance_id | OCID of the compute instance to associate with logging | string | - | yes |
| log_retention_days | Number of days to retain logs | number | 30 | no |
| tags | Freeform tags to apply to resources | map(string) | {} | no |

## Outputs

| Name | Description |
|------|-------------|
| log_group_id | OCID of the log group |
| app_log_id | OCID of the application log |
| dynamic_group_id | OCID of the dynamic group |
| logging_policy_id | OCID of the logging policy |
| uma_config_id | OCID of the Unified Monitoring Agent configuration |

## Resource Dependencies

The module includes proper dependency management to ensure clean teardown:

- The unified agent configuration has `depends_on` for the log and dynamic group
- The agent configuration is destroyed before the log group to prevent dependency conflicts
- The log resource has `ignore_changes` for the configuration block to prevent unnecessary recreations

## Log Collection

The Unified Monitoring Agent is configured to collect logs from:

- **Source**: `/var/log/journal` (systemd journal logs)
- **Parser**: JSON format with timestamp parsing
- **Destination**: Custom log in the log group

## IAM Permissions

The module grants the following permissions to instances in the dynamic group:

- `use log-content` - Write log entries
- `manage logging-family` - Manage logging resources

## Requirements

- Terraform >= 1.0
- OCI Provider >= 4.0
- Instance must be running in the same compartment
- Tenancy OCID required for dynamic group creation

## Notes

- Log retention is configurable (default: 30 days)
- The unified agent configuration must be destroyed before the log group
- Dynamic groups use instance OCID for matching rules
- All resources support freeform tagging
