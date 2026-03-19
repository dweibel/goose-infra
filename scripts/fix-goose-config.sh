#!/bin/bash
# Fix goose config to use openrouter provider properly
set -e

OCI_IP="193.122.215.174"
SSH_KEY="$HOME/.ssh/oci_agent_coder"

# Write a fix script to the remote host
scp -i "$SSH_KEY" /dev/stdin opc@$OCI_IP:/tmp/fix-config.sh << 'REMOTE_SCRIPT'
#!/bin/bash
set -e

CONFIG="/root/.config/goose/config.yaml"
SECRETS="/root/.config/goose/secrets.yaml"

# Remove the nested provider block and add flat keys
podman exec goose-web bash -c '
CONFIG=/root/.config/goose/config.yaml
SECRETS=/root/.config/goose/secrets.yaml

# Remove provider: block (first 5 lines)
sed -i "/^provider:/,/^[^ ]/{ /^provider:/d; /^  /d; }" $CONFIG

# Remove any existing GOOSE_PROVIDER/GOOSE_MODEL lines
sed -i "/^GOOSE_PROVIDER:/d" $CONFIG
sed -i "/^GOOSE_MODEL:/d" $CONFIG
sed -i "/^OPENROUTER_HOST:/d" $CONFIG

# Add correct provider config at the top
sed -i "1i GOOSE_PROVIDER: openrouter\nGOOSE_MODEL: qwen/qwen3.5-flash-02-23" $CONFIG

# Write secrets file
echo "OPENROUTER_API_KEY: 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" > $SECRETS

echo "=== CONFIG (first 10 lines) ==="
head -10 $CONFIG
echo "=== SECRETS ==="
cat $SECRETS
'
REMOTE_SCRIPT

ssh -i "$SSH_KEY" opc@$OCI_IP 'chmod +x /tmp/fix-config.sh && bash /tmp/fix-config.sh' > /tmp/fix-result.txt 2>&1
cat /tmp/fix-result.txt
