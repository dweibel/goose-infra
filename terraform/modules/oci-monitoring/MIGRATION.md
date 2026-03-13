# OCI Monitoring Module Migration

## Migration Summary

This module was migrated from `agent-infra/infrastructure/terraform/modules/oci-monitoring` to `goose-infra/terraform/modules/oci-monitoring` as part of task 2.7.

## Changes Made

### 1. Added Disk Usage Monitoring
- **New alarm**: `disk_high` - monitors disk utilization
- **Configurable threshold**: `disk_threshold` variable (default: 85%)
- **Requirement**: Satisfies Requirement 13.3 (disk usage alarms)

### 2. Made All Thresholds Configurable
Previously, alarm thresholds were hardcoded in the queries. Now all thresholds are configurable via variables:

- `cpu_threshold` - CPU high utilization (default: 90%)
- `memory_threshold` - Memory high utilization (default: 85%)
- `disk_threshold` - Disk high utilization (default: 85%)
- `cpu_idle_threshold` - CPU idle risk warning (default: 15%)

Each variable includes validation to ensure values are within valid ranges (0-100%).

**Requirement**: Satisfies Requirement 13.4 (configurable alarm thresholds)

### 3. Updated Default Name Prefix
Changed default `name_prefix` from "agent-coder" to "oci-infra" to align with the new repository naming convention.

### 4. Enhanced Outputs
Added `notification_topic_id` output that points to the critical topic as the primary notification topic for easier reference.

### 5. Added Comprehensive Documentation
Created `README.md` with:
- Complete usage examples
- Input/output documentation
- Alarm descriptions and thresholds
- Email subscription confirmation instructions
- Requirements validation mapping

## Requirements Satisfied

This module satisfies the following requirements from the design document:

- ✅ **Requirement 2.4**: Includes the oci-monitoring terraform module
- ✅ **Requirement 2.6**: Preserves all terraform variable definitions and outputs
- ✅ **Requirement 13.1**: Provisions OCI monitoring alarms for CPU usage
- ✅ **Requirement 13.2**: Provisions OCI monitoring alarms for memory usage
- ✅ **Requirement 13.3**: Provisions OCI monitoring alarms for disk usage
- ✅ **Requirement 13.4**: Supports configurable alarm thresholds via variables
- ✅ **Requirement 13.5**: Creates notification topics for alarm delivery

## Files Created

```
goose-infra/terraform/modules/oci-monitoring/
├── main.tf           # Resource definitions for topics, subscriptions, and alarms
├── variables.tf      # Input variables with validation
├── outputs.tf        # Module outputs
├── README.md         # Usage documentation
└── MIGRATION.md      # This file
```

## Alarms Configured

### Critical Alarms (sent to critical topic)
1. **CPU High**: Triggers when CPU > threshold for 15 minutes
2. **Memory High**: Triggers when memory > threshold for 10 minutes
3. **Disk High**: Triggers when disk > threshold for 10 minutes (NEW)
4. **Instance Down**: Triggers when no metrics received for 5 minutes

### Warning Alarms (sent to warnings topic)
1. **CPU Idle Risk**: Triggers when CPU < threshold for 6 hours (prevents Always Free tier reclamation)

## Usage Example

```hcl
module "monitoring" {
  source = "./modules/oci-monitoring"

  compartment_id = var.compartment_id
  name_prefix    = "my-instance"
  instance_id    = module.compute.instance_id
  alert_email    = "alerts@example.com"

  # Custom thresholds (optional)
  cpu_threshold      = 85
  memory_threshold   = 80
  disk_threshold     = 90
  cpu_idle_threshold = 10

  tags = {
    Environment = "production"
  }
}
```

## Next Steps

This module is ready to be integrated into the root Terraform configuration (task 2.9). The module will be referenced in `main.tf` to enable monitoring for provisioned compute instances.

## Notes

- All alarm queries use the `oci_computeagent` namespace, which requires the OCI monitoring agent to be installed on instances
- Email subscriptions require confirmation via email before alerts will be delivered
- The CPU idle alarm is specifically designed to prevent Always Free tier instance reclamation
- All thresholds include validation to prevent invalid values
