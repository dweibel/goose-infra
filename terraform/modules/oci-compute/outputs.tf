# OCI Compute Module Outputs

output "instance_id" {
  description = "OCID of the compute instance"
  value       = oci_core_instance.main.id
}

output "instance_public_ip" {
  description = "Public IP address of the instance"
  value       = oci_core_instance.main.public_ip
}

output "instance_private_ip" {
  description = "Private IP address of the instance"
  value       = oci_core_instance.main.private_ip
}

output "availability_domain" {
  description = "Availability domain where the instance was created"
  value       = oci_core_instance.main.availability_domain
}

output "workspace_volume_id" {
  description = "OCID of the workspace volume"
  value       = oci_core_volume.workspace.id
}

output "workspace_volume_attachment_id" {
  description = "OCID of the workspace volume attachment"
  value       = oci_core_volume_attachment.workspace.id
}

output "shape" {
  description = "Shape of the compute instance (ARM64)"
  value       = oci_core_instance.main.shape
}

output "image_id" {
  description = "OCID of the image used for the instance"
  value       = oci_core_instance.main.source_details[0].source_id
}
