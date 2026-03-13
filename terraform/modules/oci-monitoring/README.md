# OCI Monitoring Module

This Terraform module provisions OCI monitoring infrastructure including notification topics, email subscriptions, and alarms for compute instance monitoring.

## Features

- **Notification Topics**: Creates three notification topics (critical, warnings, info) for different severity levels
- **Email Subscriptions**: Automatically subscribes an email address to all notification topics
- **CPU Monitoring**: Configurable alarms for high CPU utilization and idle risk
- **Memory Monitoring**: Configurable alarm for high memory utilization
- **Disk Monitoring**: Configurable alarm for high disk utilization
- **Instance Health**: Alarm for instance down detection
- **Configurable Thresholds**: All alarm thresholds are configurable via variables

## Requirements

- OCI Terraform Provider
- Valid OCI credentials with permissions to create ONS topics and monitoring alarms
- An existing compute instance to monitor

## Usage

```hcl
module "monitoring" {
  source = "./modules/oci-monitoring"

  compartment_id = var.compartment_id
  name_prefix    = "my-instance"
  instance_id    = module.compute.instance_id
  alert_email    = "alerts@example.com"

  # Optional: Configure alarm thresholds
  cpu_threshold        = 90
  memory_threshold     = 85
  disk_threshold       = 85
  cpu_idle_threshold   = 15

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
| name_prefix | Prefix for resource names | string | "oci-infra" | no |
| instance_id | OCID of the compute instance to monitor | string | - | yes |
| alert_email | Email address for alert notifications | string | - | yes |
| cpu_threshold | CPU usage threshold percentage for critical alarm | number | 90 | no |
| memory_threshold | Memory usage threshold percentage for critical alarm | number | 85 | no |
| disk_threshold | Disk usage threshold percentage for critical alarm | number | 85 | no |
| cpu_idle_threshold | CPU idle threshold percentage for warning alarm | number | 15 | no |
| tags | Freeform tags to apply to resources | map(string) | {} | no |

## Outputs

| Name | Description |
|------|-------------|
| critical_topic_id | OCID of the critical notifications topic |
| warnings_topic_id | OCID of the warnings notifications topic |
| info_topic_id | OCID of the info notifications topic |
| cpu_alarm_id | OCID of the CPU high utilization alarm |
| memory_alarm_id | OCID of the memory high utilization alarm |
| disk_alarm_id | OCID of the disk high utilization alarm |
| cpu_idle_alarm_id | OCID of the CPU idle risk alarm |
| instance_down_alarm_id | OCID of the instance down alarm |
| notification_topic_id | OCID of the critical notification topic (primary) |

## Alarms

### Critical Alarms

1. **CPU High Utilization**: Triggers when CPU usage exceeds the configured threshold (default: 90%) for 15 minutes
2. **Memory High Utilization**: Triggers when memory usage exceeds the configured threshold (default: 85%) for 10 minutes
3. **Disk High Utilization**: Triggers when disk usage exceeds the configured threshold (default: 85%) for 10 minutes
4. **Instance Down**: Triggers when no CPU metrics are received for 5 minutes

### Warning Alarms

1. **CPU Idle Risk**: Triggers when CPU usage is below the configured threshold (default: 15%) for 6 hours. This helps prevent Always Free tier instance reclamation due to inactivity.

## Email Subscription Confirmation

After applying this module, you will receive confirmation emails for each notification topic subscription. You must confirm these subscriptions by clicking the confirmation link in each email to start receiving alerts.

## Requirements Validation

This module satisfies the following requirements:
- **Requirement 2.4**: Includes the oci-monitoring terraform module
- **Requirement 2.6**: Preserves all terraform variable definitions and outputs
- **Requirement 13.1**: Provisions OCI monitoring alarms for CPU usage
- **Requirement 13.2**: Provisions OCI monitoring alarms for memory usage
- **Requirement 13.3**: Provisions OCI monitoring alarms for disk usage
- **Requirement 13.4**: Supports configurable alarm thresholds via variables
- **Requirement 13.5**: Creates notification topics for alarm delivery

## Notes

- All thresholds are validated to be within valid ranges (0-100%)
- Alarm queries use the `oci_computeagent` namespace which requires the OCI monitoring agent to be installed on the instance
- The CPU idle alarm helps prevent Always Free tier instances from being reclaimed due to inactivity
- Notification topics are created with three severity levels to allow for flexible alerting strategies
