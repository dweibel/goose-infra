# Cloudflare Zero Trust Access Policy Setup

Complete guide to configure Zero Trust authentication for your Goose terminal.

## Prerequisites

- Cloudflare account with Zero Trust enabled
- Active tunnel (already configured: ad22b3dc-1898-45dd-8bed-8f909f381b47)
- Domain: dirkweibel.dev
- Subdomain: goose.dirkweibel.dev

## Step-by-Step Configuration

### Step 1: Access Cloudflare Zero Trust Dashboard

1. Go to https://one.dash.cloudflare.com/
2. Log in with your Cloudflare account
3. Select your account if you have multiple

### Step 2: Configure Tunnel Public Hostname

1. Navigate to **Access** → **Tunnels** (or **Networks** → **Tunnels**)
2. Find your tunnel: `goose-terminal` or the tunnel with ID `ad22b3dc-1898-45dd-8bed-8f909f381b47`
3. Click **Configure** or **Edit**
4. Go to the **Public Hostname** tab
5. Click **Add a public hostname**

Configure the hostname:
- **Subdomain:** `goose`
- **Domain:** `dirkweibel.dev`
- **Type:** HTTP
- **URL:** `goose-web:7681` or `localhost:7681`

**Important:** The service URL should point to where cloudflared can reach the goose-web container. Since they're on the same host, use:
- `localhost:7681` (if cloudflared can access host network)
- `goose-web:7681` (if using container networking)
- `192.168.x.x:7681` (container IP if needed)

6. Click **Save hostname**

### Step 3: Create Zero Trust Application

1. Navigate to **Access** → **Applications**
2. Click **Add an application**
3. Select **Self-hosted**

### Step 4: Configure Application Settings

**Application Configuration:**

- **Application name:** `Goose Terminal`
- **Session Duration:** `24 hours` (or your preference)
- **Application domain:**
  - **Subdomain:** `goose`
  - **Domain:** `dirkweibel.dev`
  - **Path:** Leave empty (or `/` for root)

**Application Appearance (Optional):**
- **App Launcher visibility:** Visible
- **Custom logo:** Upload if desired

Click **Next**

### Step 5: Create Access Policy

**Policy Configuration:**

- **Policy name:** `Authorized Users`
- **Action:** `Allow`
- **Session duration:** `24 hours` (or match application setting)

**Configure Rules - Include:**

Choose one or more options:

**Option A: Email-based Access**
- **Selector:** `Emails`
- **Value:** Enter your email address(es)
  - Example: `your.email@example.com`
  - Add multiple emails if needed

**Option B: Email Domain**
- **Selector:** `Email domains`
- **Value:** `@yourdomain.com`
  - Allows anyone with that domain

**Option C: Everyone (Not Recommended)**
- **Selector:** `Everyone`
- Only use for testing, not production

**Option D: Group-based (Advanced)**
- **Selector:** `User Group Names`
- **Value:** Select or create a group
- Requires setting up groups first

**Configure Rules - Exclude (Optional):**
- Add any users/emails you want to explicitly block

**Configure Rules - Require (Optional):**
- Add additional requirements like:
  - Country
  - IP ranges
  - Device posture checks

Click **Next**

### Step 6: Additional Settings (Optional)

**CORS Settings:**
- Leave default unless you need specific CORS configuration

**Cookie Settings:**
- **HTTP Only:** Enabled (recommended)
- **Same Site:** `Lax` (recommended)

**Automatic cloudflared authentication:**
- Leave disabled (not needed for web terminal)

Click **Add application**

### Step 7: Verify Configuration

1. Navigate to **Access** → **Applications**
2. Verify your `Goose Terminal` application is listed
3. Check the status shows as **Active**

### Step 8: Test Access

1. Open a new browser window (or incognito mode)
2. Navigate to: https://goose.dirkweibel.dev
3. You should see the Cloudflare Access login page
4. Authenticate using your configured method:
   - **Email OTP:** Enter your email, receive code, enter code
   - **SSO:** Use your identity provider
   - **Other methods:** As configured

5. After successful authentication, you should see the ttyd terminal

## Verification Checklist

- [ ] Tunnel is running and connected (4 connections)
- [ ] Public hostname configured (goose.dirkweibel.dev → goose-web:7681)
- [ ] Application created in Zero Trust
- [ ] Access policy configured with your email/domain
- [ ] Can access https://goose.dirkweibel.dev
- [ ] Authentication prompt appears
- [ ] Can successfully authenticate
- [ ] Terminal loads after authentication

## Common Issues and Solutions

### Issue: "Unable to reach the origin"

**Cause:** Tunnel can't reach the goose-web container

**Solutions:**
1. Verify goose-web container is running:
   ```bash
   ssh -i ~/.ssh/oci_agent_coder opc@193.122.215.174 'podman ps | grep goose-web'
   ```

2. Check the service URL in tunnel configuration:
   - Try `localhost:7681`
   - Try `127.0.0.1:7681`
   - Try the container IP directly

3. Verify port 7681 is listening:
   ```bash
   ssh -i ~/.ssh/oci_agent_coder opc@193.122.215.174 'podman exec goose-web netstat -tlnp | grep 7681'
   ```

### Issue: "Access Denied" after authentication

**Cause:** User not in access policy

**Solutions:**
1. Check the access policy includes your email
2. Verify email matches exactly (case-sensitive)
3. Check for typos in email address
4. Try adding your email to a different rule type

### Issue: Authentication loop (keeps asking to login)

**Cause:** Cookie or session issues

**Solutions:**
1. Clear browser cookies for dirkweibel.dev
2. Try incognito/private browsing mode
3. Check cookie settings in application configuration
4. Verify session duration is set

### Issue: DNS not resolving

**Cause:** DNS propagation or configuration

**Solutions:**
1. Wait 5-10 minutes for DNS propagation
2. Check Cloudflare DNS settings for dirkweibel.dev
3. Verify the tunnel hostname is saved
4. Try `nslookup goose.dirkweibel.dev`

## Security Best Practices

1. **Use Email OTP or SSO** - More secure than simple email allow
2. **Set Reasonable Session Duration** - 24 hours is good for development
3. **Enable MFA** - If using SSO, enable MFA on your identity provider
4. **Restrict by Email** - Don't use "Everyone" in production
5. **Monitor Access Logs** - Review who's accessing in Cloudflare dashboard
6. **Use Device Posture** - Add device requirements for additional security
7. **Set IP Restrictions** - Limit access to known IP ranges if possible

## Advanced Configuration

### Add Multiple Authentication Methods

1. Go to **Settings** → **Authentication**
2. Add additional login methods:
   - Google Workspace
   - Azure AD
   - Okta
   - GitHub
   - Generic SAML/OIDC

### Add Device Posture Checks

1. Go to **Settings** → **WARP Client**
2. Configure device posture requirements:
   - OS version
   - Disk encryption
   - Firewall enabled
   - Specific applications installed

3. Add to access policy:
   - **Require:** `Passed Device Posture Checks`

### Add Country Restrictions

In your access policy:
1. Click **Add require**
2. Select **Country**
3. Choose allowed countries

### Enable Audit Logs

1. Go to **Logs** → **Access**
2. View authentication attempts
3. Monitor for suspicious activity
4. Export logs if needed

## Testing Commands

### Check tunnel status
```bash
ssh -i ~/.ssh/oci_agent_coder opc@193.122.215.174 'podman logs cloudflared | tail -20'
```

### Check goose-web status
```bash
ssh -i ~/.ssh/oci_agent_coder opc@193.122.215.174 'podman logs goose-web | tail -20'
```

### Test DNS resolution
```bash
nslookup goose.dirkweibel.dev
```

### Test connectivity (from local machine)
```bash
curl -I https://goose.dirkweibel.dev
```

## Support Resources

- **Cloudflare Zero Trust Docs:** https://developers.cloudflare.com/cloudflare-one/
- **Tunnel Documentation:** https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/
- **Access Policies:** https://developers.cloudflare.com/cloudflare-one/policies/access/

## Quick Reference

**Dashboard URLs:**
- Zero Trust Dashboard: https://one.dash.cloudflare.com/
- Tunnels: https://one.dash.cloudflare.com/ → Access → Tunnels
- Applications: https://one.dash.cloudflare.com/ → Access → Applications
- Logs: https://one.dash.cloudflare.com/ → Logs → Access

**Your Configuration:**
- Tunnel ID: ad22b3dc-1898-45dd-8bed-8f909f381b47
- Public URL: https://goose.dirkweibel.dev
- Service: goose-web:7681 (or localhost:7681)
- Domain: dirkweibel.dev
- Subdomain: goose

---

Once configured, your Goose terminal will be securely accessible with enterprise-grade authentication! 🔒
