#!/bin/bash
# OCI Instance Provisioning Retry Script
#
# Automated retry script for OCI instance provisioning across availability domains.
# Handles capacity-constrained environments by cycling through all ADs with configurable
# retry intervals. Updates terraform state on successful provisioning.
#
# Usage:
#   ./scripts/oci-instance-retry.sh [OPTIONS]
#
# Options:
#   --compartment-id ID    OCI compartment OCID (default: from .env)
#   --shape SHAPE          Compute shape (default: VM.Standard.A1.Flex)
#   --max-retries N        Maximum retry attempts (default: unlimited)
#   --wait-interval SEC    Wait time between retry rounds in seconds (default: 60)
#   --help                 Display this help message
#
# Requirements:
#   - OCI CLI installed and configured
#   - jq installed for JSON parsing
#   - .env file with OCI credentials
#   - Terraform initialized in terraform/ directory
#
# Validates: Requirements 3.1, 3.2, 3.5, 3.6, 5.1, 5.2, 5.4, 5.5, 5.6

set -euo pipefail

# Script directory and paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
TERRAFORM_DIR="${REPO_ROOT}/terraform"
LOG_FILE="${SCRIPT_DIR}/oci-instance-retry.log"

# Load environment variables from .env
if [[ -f "${REPO_ROOT}/.env" ]]; then
    set -a
    source "${REPO_ROOT}/.env"
    set +a
else
    echo "ERROR: .env file not found at ${REPO_ROOT}/.env"
    echo "Please create .env from .env.example and populate with your credentials"
    exit 1
fi

# Default configuration (can be overridden by command-line flags)
COMPARTMENT_ID="${OCI_COMPARTMENT_OCID:-}"
SHAPE="${OCI_INSTANCE_SHAPE:-VM.Standard.A1.Flex}"
MAX_RETRIES=0  # 0 means unlimited
WAIT_INTERVAL=60  # seconds between retry rounds

# Availability domains for the configured region
# These will be dynamically discovered from OCI
declare -a ADS

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging function with timestamps
log() {
    local level=$1
    shift
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${timestamp} [${level}] $@" | tee -a "${LOG_FILE}"
}

# Display usage information
usage() {
    cat << EOF
OCI Instance Provisioning Retry Script

Usage:
  $0 [OPTIONS]

Options:
  --compartment-id ID    OCI compartment OCID (default: from .env)
  --shape SHAPE          Compute shape (default: VM.Standard.A1.Flex)
  --max-retries N        Maximum retry attempts (default: unlimited)
  --wait-interval SEC    Wait time between retry rounds in seconds (default: 60)
  --help                 Display this help message

Examples:
  # Use defaults from .env
  $0

  # Specify custom compartment and retry limit
  $0 --compartment-id ocid1.compartment.oc1... --max-retries 10

  # Use custom wait interval
  $0 --wait-interval 120

Environment Variables (from .env):
  OCI_COMPARTMENT_OCID   Target compartment for provisioning
  OCI_INSTANCE_SHAPE     Compute shape (default: VM.Standard.A1.Flex)
  OCI_REGION             OCI region for provisioning

EOF
    exit 0
}

# Parse command-line arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --compartment-id)
                COMPARTMENT_ID="$2"
                shift 2
                ;;
            --shape)
                SHAPE="$2"
                shift 2
                ;;
            --max-retries)
                MAX_RETRIES="$2"
                shift 2
                ;;
            --wait-interval)
                WAIT_INTERVAL="$2"
                shift 2
                ;;
            --help)
                usage
                ;;
            *)
                echo "ERROR: Unknown option: $1"
                echo "Use --help for usage information"
                exit 1
                ;;
        esac
    done
}

# Validate required configuration
validate_config() {
    if [[ -z "${COMPARTMENT_ID}" ]]; then
        log "ERROR" "${RED}Compartment ID not specified. Set OCI_COMPARTMENT_OCID in .env or use --compartment-id${NC}"
        exit 1
    fi

    if [[ -z "${OCI_REGION:-}" ]]; then
        log "ERROR" "${RED}OCI_REGION not set in .env${NC}"
        exit 1
    fi

    # Validate shape is ARM64
    if [[ "${SHAPE}" != "VM.Standard.A1.Flex" ]]; then
        log "WARN" "${YELLOW}Shape ${SHAPE} is not VM.Standard.A1.Flex (ARM64). Ensure it's ARM64-compatible.${NC}"
    fi
}

# Discover availability domains for the region
discover_availability_domains() {
    log "INFO" "Discovering availability domains in ${OCI_REGION}..."
    
    local ad_list
    ad_list=$(oci iam availability-domain list \
        --compartment-id "${COMPARTMENT_ID}" \
        --query 'data[].name' \
        --raw-output 2>/dev/null) || {
        log "ERROR" "${RED}Failed to discover availability domains${NC}"
        exit 1
    }

    # Convert to array
    mapfile -t ADS <<< "${ad_list}"
    
    if [[ ${#ADS[@]} -eq 0 ]]; then
        log "ERROR" "${RED}No availability domains found${NC}"
        exit 1
    fi

    log "INFO" "Found ${#ADS[@]} availability domains: ${ADS[*]}"
}

# Get the latest ARM64-compatible image
get_image_id() {
    local image_id
    image_id=$(oci compute image list \
        --compartment-id "${COMPARTMENT_ID}" \
        --operating-system "Oracle Linux" \
        --operating-system-version "8" \
        --shape "${SHAPE}" \
        --sort-by TIMECREATED \
        --sort-order DESC \
        --query 'data[0].id' \
        --raw-output 2>/dev/null) || {
        log "ERROR" "${RED}Failed to query images${NC}"
        return 1
    }

    if [[ -z "${image_id}" ]] || [[ "${image_id}" == "null" ]]; then
        log "ERROR" "${RED}No ARM64-compatible Oracle Linux 8 image found${NC}"
        return 1
    fi

    echo "${image_id}"
}

# Get subnet ID from terraform state or create network
get_subnet_id() {
    # Try to get from terraform state first
    cd "${TERRAFORM_DIR}"
    
    if [[ -f "terraform.tfstate" ]]; then
        local subnet_id
        subnet_id=$(terraform output -raw subnet_id 2>/dev/null || echo "")
        
        if [[ -n "${subnet_id}" ]] && [[ "${subnet_id}" != "null" ]]; then
            echo "${subnet_id}"
            return 0
        fi
    fi

    # Network doesn't exist, create it via terraform
    log "INFO" "${BLUE}Network not found in terraform state, creating...${NC}"
    
    if [[ ! -d ".terraform" ]]; then
        log "INFO" "Initializing terraform..."
        terraform init >> "${LOG_FILE}" 2>&1 || {
            log "ERROR" "${RED}Terraform init failed${NC}"
            return 1
        }
    fi

    log "INFO" "Creating network infrastructure..."
    if terraform apply -auto-approve -target=module.network >> "${LOG_FILE}" 2>&1; then
        log "INFO" "${GREEN}Network created successfully${NC}"
    else
        log "ERROR" "${RED}Failed to create network. Check ${LOG_FILE}${NC}"
        return 1
    fi

    # Get subnet ID from outputs
    local subnet_id
    subnet_id=$(terraform output -raw subnet_id 2>/dev/null || echo "")
    
    if [[ -z "${subnet_id}" ]] || [[ "${subnet_id}" == "null" ]]; then
        log "ERROR" "${RED}Subnet ID not available after network creation${NC}"
        return 1
    fi

    echo "${subnet_id}"
}

# Check if instance already exists
find_existing_instance() {
    local name_prefix="${OCI_NAME_PREFIX:-goose}-${OCI_ENVIRONMENT:-dev}"
    
    local instance_id
    instance_id=$(oci compute instance list \
        --compartment-id "${COMPARTMENT_ID}" \
        --lifecycle-state RUNNING \
        --query "data[?\"display-name\"=='${name_prefix}-vm'].id | [0]" \
        --raw-output 2>/dev/null || echo "")

    if [[ -n "${instance_id}" ]] && [[ "${instance_id}" != "null" ]]; then
        echo "${instance_id}"
        return 0
    fi

    return 1
}

# Check for pending instance (provisioning, starting, etc.)
find_pending_instance() {
    local name_prefix="${OCI_NAME_PREFIX:-goose}-${OCI_ENVIRONMENT:-dev}"
    
    local result
    result=$(oci compute instance list \
        --compartment-id "${COMPARTMENT_ID}" \
        --query "data[?\"display-name\"=='${name_prefix}-vm' && \"lifecycle-state\"!='TERMINATED'] | [0].{id:id,state:\"lifecycle-state\"}" \
        2>/dev/null || echo "")

    if [[ -n "${result}" ]] && [[ "${result}" != "null" ]] && [[ "${result}" != "{}" ]]; then
        echo "${result}"
        return 0
    fi

    return 1
}

# Wait for instance to reach RUNNING state
wait_for_running() {
    local instance_id=$1
    local max_wait=300  # 5 minutes
    local elapsed=0

    log "INFO" "Waiting for instance to reach RUNNING state..."

    while [[ ${elapsed} -lt ${max_wait} ]]; do
        local state
        state=$(oci compute instance get \
            --instance-id "${instance_id}" \
            --query 'data."lifecycle-state"' \
            --raw-output 2>/dev/null || echo "UNKNOWN")

        case "${state}" in
            RUNNING)
                log "INFO" "${GREEN}Instance is RUNNING${NC}"
                return 0
                ;;
            TERMINATED|TERMINATING)
                log "ERROR" "${RED}Instance entered ${state} state${NC}"
                return 1
                ;;
            *)
                log "INFO" "  State: ${state} (${elapsed}s elapsed)"
                sleep 15
                elapsed=$((elapsed + 15))
                ;;
        esac
    done

    log "WARN" "${YELLOW}Timed out waiting for RUNNING state${NC}"
    return 1
}

# Attempt to provision instance in specific availability domain
try_provision_in_ad() {
    local ad=$1
    local image_id=$2
    local subnet_id=$3

    log "INFO" "  Attempting provisioning in ${ad}..."

    cd "${TERRAFORM_DIR}"

    # Update terraform.tfvars with the target AD
    if [[ -f "terraform.tfvars" ]]; then
        # Update existing file
        if grep -q "^availability_domain" terraform.tfvars; then
            sed -i.bak "s|^availability_domain[[:space:]]*=.*|availability_domain = \"${ad}\"|" terraform.tfvars
        else
            echo "availability_domain = \"${ad}\"" >> terraform.tfvars
        fi
    else
        # Create new tfvars file
        log "WARN" "${YELLOW}terraform.tfvars not found, creating from example${NC}"
        if [[ -f "terraform.tfvars.example" ]]; then
            cp terraform.tfvars.example terraform.tfvars
            sed -i "s|^availability_domain[[:space:]]*=.*|availability_domain = \"${ad}\"|" terraform.tfvars
        else
            log "ERROR" "${RED}terraform.tfvars.example not found${NC}"
            return 1
        fi
    fi

    # Attempt terraform apply for compute module
    log "INFO" "  Running terraform apply for compute module..."
    if terraform apply -auto-approve -target=module.compute >> "${LOG_FILE}" 2>&1; then
        # Get instance ID from state
        local instance_id
        instance_id=$(terraform output -raw instance_id 2>/dev/null || echo "")
        
        if [[ -n "${instance_id}" ]] && [[ "${instance_id}" != "null" ]]; then
            log "INFO" "${GREEN}Instance provisioned in ${ad}: ${instance_id}${NC}"
            echo "${instance_id}"
            return 0
        else
            log "WARN" "${YELLOW}Terraform apply succeeded but instance ID not found${NC}"
            return 1
        fi
    else
        # Check if it's a capacity error
        if grep -qi "out of host capacity\|out of capacity\|InternalError\|LimitExceeded" "${LOG_FILE}"; then
            log "INFO" "  ${YELLOW}No capacity in ${ad}${NC}"
        else
            log "WARN" "  ${YELLOW}Provisioning failed in ${ad} (see log for details)${NC}"
        fi
        return 1
    fi
}

# Update terraform state after successful provisioning
update_terraform_state() {
    local instance_id=$1
    local ad=$2

    log "INFO" "${BLUE}Updating terraform state...${NC}"

    cd "${TERRAFORM_DIR}"

    # Run full terraform apply to sync all resources (logging, monitoring, etc.)
    log "INFO" "Running full terraform apply to sync infrastructure..."
    if terraform apply -auto-approve >> "${LOG_FILE}" 2>&1; then
        log "INFO" "${GREEN}Terraform state updated successfully${NC}"
        return 0
    else
        log "WARN" "${YELLOW}Terraform apply had issues. Review ${LOG_FILE} and run manually if needed.${NC}"
        return 1
    fi
}

# Main provisioning loop
main() {
    # Clear log file
    > "${LOG_FILE}"

    log "INFO" "=== OCI Instance Provisioning Retry Script ==="
    log "INFO" "Region: ${OCI_REGION}"
    log "INFO" "Shape: ${SHAPE}"
    log "INFO" "Compartment: ${COMPARTMENT_ID}"
    log "INFO" "Max retries: $([ ${MAX_RETRIES} -eq 0 ] && echo 'unlimited' || echo ${MAX_RETRIES})"
    log "INFO" "Wait interval: ${WAIT_INTERVAL}s"

    # Prerequisites check
    if ! command -v oci &> /dev/null; then
        log "ERROR" "${RED}OCI CLI not installed${NC}"
        exit 1
    fi

    if ! command -v jq &> /dev/null; then
        log "ERROR" "${RED}jq not installed${NC}"
        exit 1
    fi

    if ! command -v terraform &> /dev/null; then
        log "ERROR" "${RED}terraform not installed${NC}"
        exit 1
    fi

    # Check for existing running instance
    log "INFO" "Checking for existing instance..."
    local existing_id
    if existing_id=$(find_existing_instance); then
        local ip
        ip=$(oci compute instance list-vnics \
            --instance-id "${existing_id}" \
            --query 'data[0]."public-ip"' \
            --raw-output 2>/dev/null || echo "N/A")
        
        log "INFO" "${GREEN}Instance already running: ${existing_id}${NC}"
        log "INFO" "${GREEN}Public IP: ${ip}${NC}"
        log "INFO" "${GREEN}SSH: ssh -i ${SSH_PRIVATE_KEY_PATH:-~/.ssh/id_rsa} opc@${ip}${NC}"
        exit 0
    fi

    # Check for pending instance
    log "INFO" "Checking for pending instance..."
    local pending
    if pending=$(find_pending_instance); then
        local pending_id pending_state
        pending_id=$(echo "${pending}" | jq -r '.id')
        pending_state=$(echo "${pending}" | jq -r '.state')
        
        log "INFO" "Found instance in ${pending_state} state: ${pending_id}"
        log "INFO" "Waiting for it to reach RUNNING state..."
        
        if wait_for_running "${pending_id}"; then
            log "INFO" "${GREEN}Instance is now running${NC}"
            exit 0
        fi
        
        log "WARN" "${YELLOW}Pending instance didn't reach RUNNING, continuing with retry...${NC}"
    fi

    # Discover availability domains
    discover_availability_domains

    # Get image ID
    log "INFO" "Resolving ARM64 image..."
    local image_id
    if ! image_id=$(get_image_id); then
        exit 1
    fi
    log "INFO" "Image: ${image_id}"

    # Get or create subnet
    log "INFO" "Resolving subnet..."
    local subnet_id
    if ! subnet_id=$(get_subnet_id); then
        exit 1
    fi
    log "INFO" "Subnet: ${subnet_id}"

    # Initialize terraform if needed
    cd "${TERRAFORM_DIR}"
    if [[ ! -d ".terraform" ]]; then
        log "INFO" "Initializing terraform..."
        terraform init >> "${LOG_FILE}" 2>&1 || {
            log "ERROR" "${RED}Terraform init failed${NC}"
            exit 1
        }
    fi

    # Retry loop
    local round=0
    local total_attempts=0

    while true; do
        round=$((round + 1))
        log "INFO" "${BLUE}=== Retry Round #${round} ===${NC}"

        # Try each availability domain
        for ad in "${ADS[@]}"; do
            total_attempts=$((total_attempts + 1))

            # Check max retries limit
            if [[ ${MAX_RETRIES} -gt 0 ]] && [[ ${total_attempts} -gt ${MAX_RETRIES} ]]; then
                log "INFO" "${YELLOW}Maximum retry attempts (${MAX_RETRIES}) reached${NC}"
                exit 1
            fi

            # Re-check for existing instance before each attempt
            if existing_id=$(find_existing_instance); then
                local ip
                ip=$(oci compute instance list-vnics \
                    --instance-id "${existing_id}" \
                    --query 'data[0]."public-ip"' \
                    --raw-output 2>/dev/null || echo "N/A")
                
                log "INFO" "${GREEN}Instance now running (from earlier attempt): ${existing_id}${NC}"
                log "INFO" "${GREEN}Public IP: ${ip}${NC}"
                exit 0
            fi

            # Attempt provisioning in this AD
            local instance_id
            if instance_id=$(try_provision_in_ad "${ad}" "${image_id}" "${subnet_id}"); then
                # Wait for instance to reach RUNNING state
                if wait_for_running "${instance_id}"; then
                    local ip
                    ip=$(oci compute instance list-vnics \
                        --instance-id "${instance_id}" \
                        --query 'data[0]."public-ip"' \
                        --raw-output 2>/dev/null || echo "N/A")

                    log "INFO" "${GREEN}=== SUCCESS ===${NC}"
                    log "INFO" "${GREEN}Instance ID: ${instance_id}${NC}"
                    log "INFO" "${GREEN}Public IP:   ${ip}${NC}"
                    log "INFO" "${GREEN}AD:          ${ad}${NC}"
                    log "INFO" "${GREEN}SSH:         ssh -i ${SSH_PRIVATE_KEY_PATH:-~/.ssh/id_rsa} opc@${ip}${NC}"

                    # Update terraform state with all resources
                    update_terraform_state "${instance_id}" "${ad}"

                    exit 0
                else
                    log "WARN" "${YELLOW}Instance provisioned but didn't reach RUNNING state${NC}"
                fi
            fi
        done

        # All ADs exhausted, wait before next round
        log "INFO" "No capacity in any availability domain. Sleeping ${WAIT_INTERVAL}s... (Ctrl+C to stop)"
        sleep "${WAIT_INTERVAL}"
    done
}

# Graceful termination handler
cleanup() {
    log "INFO" "${YELLOW}Script interrupted by user${NC}"
    exit 130
}

trap cleanup INT TERM

# Parse arguments and run
parse_args "$@"
validate_config
main
