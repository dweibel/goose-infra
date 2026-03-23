#!/bin/bash

# Secret verification script for OCI Infrastructure Repository
# Scans repository for accidentally committed secrets and sensitive data

set -e

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default options
FAIL_ON_DETECT=false
PATTERNS_FILE=""

# Usage information
usage() {
    cat << EOF
Usage: $(basename "$0") [OPTIONS]

Scans the repository for common secret patterns to prevent accidental commits
of sensitive data.

OPTIONS:
    --fail-on-detect    Exit with error code 1 when secrets are found
    --patterns-file     Custom patterns file (default: built-in patterns)
    -h, --help          Show this help message

EXAMPLES:
    # Scan repository and report findings
    $(basename "$0")

    # Scan and fail if secrets detected (useful for CI/CD)
    $(basename "$0") --fail-on-detect

    # Use custom patterns file
    $(basename "$0") --patterns-file custom-patterns.txt

EOF
    exit 0
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --fail-on-detect)
            FAIL_ON_DETECT=true
            shift
            ;;
        --patterns-file)
            PATTERNS_FILE="$2"
            shift 2
            ;;
        -h|--help)
            usage
            ;;
        *)
            echo -e "${RED}Error: Unknown option: $1${NC}"
            usage
            ;;
    esac
done

echo "=========================================="
echo "Secret Verification Scan"
echo "=========================================="
echo ""

# Define secret patterns to detect
# Format: "PATTERN|DESCRIPTION"
declare -a SECRET_PATTERNS=(
    "AKIA[0-9A-Z]{16}|AWS Access Key ID"
    "aws_access_key_id\s*=\s*[A-Z0-9]{20}|AWS Access Key"
    "aws_secret_access_key\s*=\s*[A-Za-z0-9/+=]{40}|AWS Secret Key"
    "ocid1\.tenancy\.oc1\.\.[a-z0-9]{60}|OCI Tenancy OCID"
    "ocid1\.user\.oc1\.\.[a-z0-9]{60}|OCI User OCID"
    "BEGIN RSA PRIVATE KEY|RSA Private Key"
    "BEGIN PRIVATE KEY|Private Key"
    "BEGIN OPENSSH PRIVATE KEY|OpenSSH Private Key"
    "ghp_[a-zA-Z0-9]{36}|GitHub Personal Access Token"
    "gho_[a-zA-Z0-9]{36}|GitHub OAuth Token"
    "ghs_[a-zA-Z0-9]{36}|GitHub Server Token"
    "xox[baprs]-[0-9]{10,12}-[0-9]{10,12}-[a-zA-Z0-9]{24,}|Slack Token"
)

# Load custom patterns if provided
if [ -n "$PATTERNS_FILE" ]; then
    if [ -f "$PATTERNS_FILE" ]; then
        echo "Loading custom patterns from: $PATTERNS_FILE"
        while IFS= read -r line; do
            [[ -z "$line" || "$line" =~ ^# ]] && continue
            SECRET_PATTERNS+=("$line")
        done < "$PATTERNS_FILE"
        echo ""
    else
        echo -e "${RED}Error: Patterns file not found: $PATTERNS_FILE${NC}"
        exit 1
    fi
fi

echo "Scanning tracked files for secret patterns..."
echo ""

# Track findings
SECRETS_FOUND=0
declare -A FINDINGS

# Get list of tracked files
if git rev-parse --git-dir > /dev/null 2>&1; then
    TRACKED_FILES=$(git ls-files)
else
    TRACKED_FILES=$(find . -type f -not -path '*/\.git/*' -not -path '*/node_modules/*' -not -path '*/\.kiro/*')
fi

# Scan each file
while IFS= read -r file; do
    # Skip excluded files
    [[ "$file" == *.md ]] && continue
    [[ "$file" == .env.example ]] && continue
    [[ "$file" == *.log ]] && continue
    [[ "$file" == *.min.js ]] && continue
    [[ "$file" == *.bundle.js ]] && continue
    [[ ! -f "$file" ]] && continue
    
    # Check each pattern
    for pattern_entry in "${SECRET_PATTERNS[@]}"; do
        IFS='|' read -r pattern description <<< "$pattern_entry"
        
        if grep -qE "$pattern" "$file" 2>/dev/null; then
            line_numbers=$(grep -nE "$pattern" "$file" 2>/dev/null | cut -d: -f1 | paste -sd, -)
            key="$file|$description"
            FINDINGS["$key"]="$line_numbers"
            ((SECRETS_FOUND++))
        fi
    done
done <<< "$TRACKED_FILES"

# Display results
if [ $SECRETS_FOUND -eq 0 ]; then
    echo -e "${GREEN}✓ No secrets detected${NC}"
    echo ""
    echo "All tracked files are clean."
    exit 0
else
    echo -e "${RED}✗ Found $SECRETS_FOUND potential secret(s)${NC}"
    echo ""
    echo "The following files contain potential secrets:"
    echo ""
    
    # Display findings
    for key in "${!FINDINGS[@]}"; do
        IFS='|' read -r file description <<< "$key"
        line_numbers="${FINDINGS[$key]}"
        echo -e "${YELLOW}File:${NC} $file"
        echo -e "${YELLOW}Type:${NC} $description"
        echo -e "${YELLOW}Lines:${NC} $line_numbers"
        echo ""
    done
    
    echo "=========================================="
    echo "Action Required"
    echo "=========================================="
    echo ""
    echo "1. Remove secrets from the files listed above"
    echo "2. Add secrets to .env file (excluded from git)"
    echo "3. Update .gitignore if needed"
    echo "4. If secrets were already committed:"
    echo "   - Use 'git filter-branch' or 'BFG Repo-Cleaner' to remove from history"
    echo "   - Rotate the exposed credentials immediately"
    echo ""
    
    if [ "$FAIL_ON_DETECT" = true ]; then
        exit 1
    else
        exit 0
    fi
fi
