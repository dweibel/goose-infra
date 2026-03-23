# Recover Leaked OpenRouter API Key

The OpenRouter API key `sk-or-v1-67867f...` was accidentally committed in `scripts/restart-goose-fixed.sh` (commit `4f369f5`) and pushed to GitHub. The key has been invalidated by OpenRouter. This document covers removing it from git history, generating a replacement, updating the deployment, and finishing the wiki MCP server verification.

## Prerequisites

- `git filter-repo` installed (`pip install git-filter-repo`)
- Access to [OpenRouter dashboard](https://openrouter.ai/settings/keys)
- SSH access to OCI instance `193.122.215.174`

## Part 1: Remove the Secret from Git History

### 1.1 Delete the leaked file and rewrite history

From the `goose-infra` repo root:

```bash
# Delete the file from the working tree
rm -f scripts/restart-goose-fixed.sh

# Rewrite history to remove the file from ALL commits
git filter-repo --invert-paths --path scripts/restart-goose-fixed.sh --force
```

This rewrites every commit that ever touched that file. All commit hashes from `4f369f5` onward will change.

### 1.2 Re-add the remote and force push

`git filter-repo` removes the remote origin as a safety measure. Re-add it and force push:

```bash
git remote add origin git@github.com:<your-org>/goose-infra.git
git push origin main --force
```

### 1.3 Verify the secret is gone

```bash
# Search all history for the key prefix — should return nothing
git log --all -p | grep "sk-or-v1-67867f" || echo "Clean — no matches"
```

## Part 2: Generate a New OpenRouter API Key

1. Go to [https://openrouter.ai/settings/keys](https://openrouter.ai/settings/keys)
2. Revoke the old key if it hasn't been already (starts with `sk-or-v1-67867f`)
3. Create a new key — copy it immediately, you won't see it again
4. Store it somewhere safe (password manager, not a git repo)

## Part 3: Update the Deployment on OCI

Replace `NEW_KEY_HERE` with your actual new key in all commands below.

### 3.1 Update ~/deploy/.env on the OCI instance

```bash
ssh -i ~/.ssh/oci_agent_coder opc@193.122.215.174 \
  "sed -i 's|^OPENROUTER_API_KEY=.*|OPENROUTER_API_KEY=NEW_KEY_HERE|' ~/deploy/.env"
```

### 3.2 Verify the update

```bash
ssh -i ~/.ssh/oci_agent_coder opc@193.122.215.174 \
  'grep OPENROUTER_API_KEY ~/deploy/.env'
```

### 3.3 Restart goose-web with the new key

```bash
ssh -i ~/.ssh/oci_agent_coder opc@193.122.215.174 'bash -c "
  podman stop goose-web && podman rm goose-web
  source ~/deploy/.env
  ~/deploy/start-goose.sh
"'
```

### 3.4 Also update the wikijs-gateway if it uses the same key

Check if the gateway container has the old key:

```bash
ssh -i ~/.ssh/oci_agent_coder opc@193.122.215.174 \
  'podman exec wikijs-gateway env | grep OPENROUTER'
```

If it shows the old key, update the wikijs pod's env and restart the gateway.

## Part 4: Verify the Wiki MCP Server End-to-End

### 4.1 Test MCP server standalone (inside goose-web)

```bash
ssh -i ~/.ssh/oci_agent_coder opc@193.122.215.174 '
  echo "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"tools/list\",\"params\":{}}" \
  | podman exec -i goose-web node /app/src/server.js 2>/dev/null
'
```

Expected: JSON response listing 7 tools.

### 4.2 Test list_wiki_pages

```bash
ssh -i ~/.ssh/oci_agent_coder opc@193.122.215.174 '
  printf "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"initialize\",\"params\":{}}\n{\"jsonrpc\":\"2.0\",\"id\":2,\"method\":\"tools/call\",\"params\":{\"name\":\"list_wiki_pages\",\"arguments\":{}}}\n" \
  | podman exec -i goose-web node /app/src/server.js 2>/dev/null
'
```

### 4.3 Test search_wiki (requires working OpenRouter key in gateway)

```bash
ssh -i ~/.ssh/oci_agent_coder opc@193.122.215.174 '
  printf "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"initialize\",\"params\":{}}\n{\"jsonrpc\":\"2.0\",\"id\":2,\"method\":\"tools/call\",\"params\":{\"name\":\"search_wiki\",\"arguments\":{\"query\":\"welcome\"}}}\n" \
  | podman exec -i goose-web node /app/src/server.js 2>/dev/null
'
```

If this returns a 401 error, the gateway's `OPENROUTER_API_KEY` also needs updating (it uses the key for embedding generation).

### 4.4 Test via Goose session

```bash
ssh -i ~/.ssh/oci_agent_coder opc@193.122.215.174 '
  echo "List all wiki pages using the list_wiki_pages tool" \
  | podman exec -i goose-web timeout 60 goose run -i -
'
```

This confirms Goose loads the wiki stdio extension and can invoke tools through it.

## Part 5: Commit the wikijs-infra Fix

The auth token fix for `tools.js` and `routes/pages.js` is staged but not yet committed:

```bash
# From the wikijs-infra repo
git add -A
git commit -m "fix: pass admin token to getWikiPage and moveWikiPage for authenticated page retrieval"
git push origin main
```

## Summary of What Happened

| Item | Status |
|------|--------|
| Leaked key in `scripts/restart-goose-fixed.sh` | Remove from history, force push |
| Old OpenRouter key `sk-or-v1-67867f...` | Invalidated, needs replacement |
| `~/deploy/.env` on OCI | Update with new key |
| goose-web container | Restart after key update |
| wikijs-gateway | Check if it also needs the new key (for embeddings) |
| Wiki MCP server (7 tools) | Deployed and working, needs e2e verification after key fix |
| wikijs-infra auth fix | Commit and push |
