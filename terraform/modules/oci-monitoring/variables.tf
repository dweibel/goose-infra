# OCI Monitoring Module Variables

variable "compartment_id" {
  description = "OCID of the compartment where resources will be created"
  type        = string
}

variable "name_prefix" {
  description = "Prefix for resource names"
  type        = string
  default     = "oci-infra"
}

variable "instance_id" {
  description = "OCID of the compute instance to monitor"
  type        = string
}

variable "alert_email" {
  description = "Email address for alert notifications"
  type        = string
}

variable "cpu_threshold" {
  description = "CPU usage threshold percentage for critical alarm"
  type        = number
  default     = 90

  validation {
    condition     = var.cpu_threshold > 0 && var.cpu_threshold <= 100
    error_message = "CPU threshold must be between 1 and 100."
  }
}

variable "memory_threshold" {
  description = "Memory usage threshold percentage for critical alarm"
  type        = number
  default     = 85

  validation {
    condition     = var.memory_threshold > 0 && var.memory_threshold <= 100
    error_message = "Memory threshold must be between 1 and 100."
  }
}

variable "disk_threshold" {
  description = "Disk usage threshold percentage for critical alarm"
  type        = number
  default     = 85

  validation {
    condition     = var.disk_threshold > 0 && var.disk_threshold <= 100
    error_message = "Disk threshold must be between 1 and 100."
  }
}

variable "cpu_idle_threshold" {
  description = "CPU idle threshold percentage for warning alarm (instance reclaim risk)"
  type        = number
  default     = 15

  validation {
    condition     = var.cpu_idle_threshold >= 0 && var.cpu_idle_threshold < 100
    error_message = "CPU idle threshold must be between 0 and 99."
  }
}

variable "tags" {
  description = "Freeform tags to apply to resources"
  type        = map(string)
  default     = {}
}
