# OCI Compute Module
# Creates ARM64 VM instance, block volume, and volume attachment
# Enforces VM.Standard.A1.Flex shape for Always Free tier compatibility

data "oci_identity_availability_domains" "ads" {
  compartment_id = var.compartment_id
}

data "oci_core_images" "oracle_linux_arm" {
  compartment_id           = var.compartment_id
  operating_system         = "Oracle Linux"
  operating_system_version = "8"
  shape                    = var.instance_shape
  sort_by                  = "TIMECREATED"
  sort_order               = "DESC"
}

# Validate ARM64 architecture
locals {
  # List of allowed ARM64 shapes
  allowed_arm64_shapes = [
    "VM.Standard.A1.Flex"
  ]

  # Check if the provided shape is ARM64-compatible
  is_arm64_shape = contains(local.allowed_arm64_shapes, var.instance_shape)

  # Validate image architecture
  image_architecture = length(data.oci_core_images.oracle_linux_arm.images) > 0 ? data.oci_core_images.oracle_linux_arm.images[0].id : ""
}

# Validation: Reject non-ARM64 shapes
resource "null_resource" "validate_arm64_shape" {
  count = local.is_arm64_shape ? 0 : 1

  provisioner "local-exec" {
    command = "echo 'ERROR: Invalid shape: ${var.instance_shape}. Only VM.Standard.A1.Flex (ARM64) is supported for cost optimization.' && exit 1"
  }
}

# Validation: Ensure ARM64-compatible image is available
resource "null_resource" "validate_arm64_image" {
  count = length(data.oci_core_images.oracle_linux_arm.images) > 0 ? 0 : 1

  provisioner "local-exec" {
    command = "echo 'ERROR: No ARM64-compatible images found for shape ${var.instance_shape}.' && exit 1"
  }
}

resource "oci_core_instance" "main" {
  depends_on = [
    null_resource.validate_arm64_shape,
    null_resource.validate_arm64_image
  ]

  compartment_id      = var.compartment_id
  availability_domain = var.availability_domain != "" ? var.availability_domain : data.oci_identity_availability_domains.ads.availability_domains[0].name
  display_name        = "${var.name_prefix}-vm"
  shape               = var.instance_shape

  shape_config {
    ocpus         = var.instance_ocpus
    memory_in_gbs = var.instance_memory_gb
  }

  source_details {
    source_type             = "image"
    source_id               = data.oci_core_images.oracle_linux_arm.images[0].id
    boot_volume_size_in_gbs = var.boot_volume_size_gb
  }

  create_vnic_details {
    subnet_id        = var.subnet_id
    assign_public_ip = true
    display_name     = "${var.name_prefix}-vnic"
  }

  metadata = {
    ssh_authorized_keys = var.ssh_public_key
    user_data = base64encode(templatefile("${path.module}/cloud-init.yaml", {
      workspace_mount_path = var.workspace_mount_path
    }))
  }

  freeform_tags = var.tags

  # Ignore metadata changes to prevent instance replacement when
  # the instance was created via OCI CLI (retry script) and imported.
  # user_data and ssh_authorized_keys formatting can differ slightly.
  lifecycle {
    ignore_changes = [metadata, defined_tags, create_vnic_details[0].defined_tags]
  }
}

resource "oci_core_volume" "workspace" {
  compartment_id      = var.compartment_id
  availability_domain = var.availability_domain != "" ? var.availability_domain : data.oci_identity_availability_domains.ads.availability_domains[0].name
  display_name        = "${var.name_prefix}-workspace-volume"
  size_in_gbs         = var.workspace_volume_size_gb
  freeform_tags       = var.tags
}

resource "oci_core_volume_attachment" "workspace" {
  attachment_type = "paravirtualized"
  instance_id     = oci_core_instance.main.id
  volume_id       = oci_core_volume.workspace.id
  display_name    = "${var.name_prefix}-workspace-attachment"
}
