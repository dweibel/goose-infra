# OCI Monitoring Module
# Creates notification topics, subscriptions, and alarms for compute instance monitoring

# Notification Topics
resource "oci_ons_notification_topic" "critical" {
  compartment_id = var.compartment_id
  name           = "${var.name_prefix}-critical"
  description    = "Critical alerts for ${var.name_prefix}"
  freeform_tags  = var.tags
}

resource "oci_ons_notification_topic" "warnings" {
  compartment_id = var.compartment_id
  name           = "${var.name_prefix}-warnings"
  description    = "Warning alerts for ${var.name_prefix}"
  freeform_tags  = var.tags
}

resource "oci_ons_notification_topic" "info" {
  compartment_id = var.compartment_id
  name           = "${var.name_prefix}-info"
  description    = "Informational notifications for ${var.name_prefix}"
  freeform_tags  = var.tags
}

# Email Subscriptions
resource "oci_ons_subscription" "critical_email" {
  compartment_id = var.compartment_id
  topic_id       = oci_ons_notification_topic.critical.id
  protocol       = "EMAIL"
  endpoint       = var.alert_email
  freeform_tags  = var.tags
}

resource "oci_ons_subscription" "warnings_email" {
  compartment_id = var.compartment_id
  topic_id       = oci_ons_notification_topic.warnings.id
  protocol       = "EMAIL"
  endpoint       = var.alert_email
  freeform_tags  = var.tags
}

resource "oci_ons_subscription" "info_email" {
  compartment_id = var.compartment_id
  topic_id       = oci_ons_notification_topic.info.id
  protocol       = "EMAIL"
  endpoint       = var.alert_email
  freeform_tags  = var.tags
}

# CPU High Utilization Alarm
resource "oci_monitoring_alarm" "cpu_high" {
  compartment_id        = var.compartment_id
  display_name          = "${var.name_prefix}-cpu-high"
  is_enabled            = true
  metric_compartment_id = var.compartment_id
  namespace             = "oci_computeagent"
  query                 = "CpuUtilization[1m]{resourceId = \"${var.instance_id}\"}.mean() > ${var.cpu_threshold}"
  severity              = "CRITICAL"

  destinations = [oci_ons_notification_topic.critical.id]

  body = "CPU utilization has exceeded ${var.cpu_threshold}% for 15 minutes on ${var.name_prefix} instance."

  repeat_notification_duration = "PT15M"

  freeform_tags = var.tags
}

# Memory High Utilization Alarm
resource "oci_monitoring_alarm" "memory_high" {
  compartment_id        = var.compartment_id
  display_name          = "${var.name_prefix}-memory-high"
  is_enabled            = true
  metric_compartment_id = var.compartment_id
  namespace             = "oci_computeagent"
  query                 = "MemoryUtilization[1m]{resourceId = \"${var.instance_id}\"}.mean() > ${var.memory_threshold}"
  severity              = "CRITICAL"

  destinations = [oci_ons_notification_topic.critical.id]

  body = "Memory utilization has exceeded ${var.memory_threshold}% for 10 minutes on ${var.name_prefix} instance."

  repeat_notification_duration = "PT10M"

  freeform_tags = var.tags
}

# Disk High Utilization Alarm
resource "oci_monitoring_alarm" "disk_high" {
  compartment_id        = var.compartment_id
  display_name          = "${var.name_prefix}-disk-high"
  is_enabled            = true
  metric_compartment_id = var.compartment_id
  namespace             = "oci_computeagent"
  query                 = "DiskUtilization[1m]{resourceId = \"${var.instance_id}\"}.mean() > ${var.disk_threshold}"
  severity              = "CRITICAL"

  destinations = [oci_ons_notification_topic.critical.id]

  body = "Disk utilization has exceeded ${var.disk_threshold}% for 10 minutes on ${var.name_prefix} instance."

  repeat_notification_duration = "PT10M"

  freeform_tags = var.tags
}

# CPU Idle Risk Alarm (for Always Free tier reclaim prevention)
resource "oci_monitoring_alarm" "cpu_idle" {
  compartment_id        = var.compartment_id
  display_name          = "${var.name_prefix}-cpu-idle-risk"
  is_enabled            = true
  metric_compartment_id = var.compartment_id
  namespace             = "oci_computeagent"
  query                 = "CpuUtilization[1m]{resourceId = \"${var.instance_id}\"}.mean() < ${var.cpu_idle_threshold}"
  severity              = "WARNING"

  destinations = [oci_ons_notification_topic.warnings.id]

  body = "CPU utilization has been below ${var.cpu_idle_threshold}% for 6 hours on ${var.name_prefix} instance. Instance may be reclaimed if idle."

  repeat_notification_duration = "PT6H"

  freeform_tags = var.tags
}

# Instance Down Alarm
resource "oci_monitoring_alarm" "instance_down" {
  compartment_id        = var.compartment_id
  display_name          = "${var.name_prefix}-instance-down"
  is_enabled            = true
  metric_compartment_id = var.compartment_id
  namespace             = "oci_computeagent"
  query                 = "CpuUtilization[1m]{resourceId = \"${var.instance_id}\"}.count() < 1"
  severity              = "CRITICAL"

  destinations = [oci_ons_notification_topic.critical.id]

  body = "Instance ${var.name_prefix} appears to be down. No CPU metrics received for 5 minutes."

  repeat_notification_duration = "PT5M"

  freeform_tags = var.tags
}
