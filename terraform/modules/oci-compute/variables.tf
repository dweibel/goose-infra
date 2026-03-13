# OCI Compute Module Variables

variable "compartment_id" {
  description = "OCID of the compartment where resources will be created"
  type        = string
}

variable "name_prefix" {
  description = "Prefix for resource names"
  type        = string
  default     = "goose"
}

variable "subnet_id" {
  description = "OCID of the subnet where the instance will be created"
  type        = string
}

variable "availability_domain" {
  description = "Availability domain for the instance (leave empty to use first available)"
  type        = string
  default     = ""
}

variable "instance_shape" {
  description = "Shape of the instance (must be VM.Standard.A1.Flex for ARM64 Always Free tier)"
  type        = string
  default     = "VM.Standard.A1.Flex"

  validation {
    condition     = var.instance_shape == "VM.Standard.A1.Flex"
    error_message = "Invalid shape: ${var.instance_shape}. Only VM.Standard.A1.Flex (ARM64) is supported for cost optimization."
  }
}

variable "instance_ocpus" {
  description = "Number of OCPUs for the instance (Always Free tier allows up to 4 OCPUs total across all instances)"
  type        = number
  default     = 2

  validation {
    condition     = var.instance_ocpus >= 1 && var.instance_ocpus <= 4
    error_message = "instance_ocpus must be between 1 and 4."
  }
}

variable "instance_memory_gb" {
  description = "Memory in GB for the instance (Always Free tier allows up to 24 GB total across all instances)"
  type        = number
  default     = 12

  validation {
    condition     = var.instance_memory_gb >= 1 && var.instance_memory_gb <= 24
    error_message = "instance_memory_gb must be between 1 and 24."
  }
}

variable "ssh_public_key" {
  description = "SSH public key for instance access"
  type        = string
}

variable "boot_volume_size_gb" {
  description = "Size of the boot volume in GB (Always Free tier allows up to 200 GB total)"
  type        = number
  default     = 50

  validation {
    condition     = var.boot_volume_size_gb >= 50 && var.boot_volume_size_gb <= 200
    error_message = "boot_volume_size_gb must be between 50 and 200."
  }
}

variable "workspace_volume_size_gb" {
  description = "Size of the workspace volume in GB (Always Free tier allows up to 200 GB total across all volumes)"
  type        = number
  default     = 50

  validation {
    condition     = var.workspace_volume_size_gb >= 50 && var.workspace_volume_size_gb <= 200
    error_message = "workspace_volume_size_gb must be between 50 and 200."
  }
}

variable "workspace_mount_path" {
  description = "Mount path for the workspace volume"
  type        = string
  default     = "/mnt/workspace"
}

variable "tags" {
  description = "Freeform tags to apply to resources"
  type        = map(string)
  default     = {}
}
