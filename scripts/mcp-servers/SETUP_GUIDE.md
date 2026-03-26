# MCP Servers Setup Guide

## Quick Start

This guide walks you through setting up AWS and Vercel MCP servers for Claude Desktop integration.

**Time Required:** 30-60 minutes  
**Prerequisites:** Claude Desktop, Node.js 18+, AWS Account, Vercel Account

---

## Part 1: AWS MCP Server Setup (20-30 minutes)

### Step 1: Create IAM User

1. Log into AWS Console → IAM → Users
2. Click "Create user"
3. User name: `trulyimagined-mcp`
4. **DO NOT** enable console access (programmatic only)
5. Click "Next"

### Step 2: Attach IAM Policy

1. Select "Attach policies directly"
2. Click "Create policy"
3. Switch to JSON tab
4. Copy contents of `scripts/mcp-servers/aws-iam-policy.json`
5. Paste into policy editor
6. Click "Next: Tags" (skip tags)
7. Click "Next: Review"
8. Policy name: `TrulyImaginedMCPReadOnly`
9. Click "Create policy"
10. Go back to user creation, refresh policies
11. Search for `TrulyImaginedMCPReadOnly`
12. Check the box next to it
13. Click "Next: Review"
14. Click "Create user"

### Step 3: Generate Access Keys

1. Click on the newly created user
2. Go to "Security credentials" tab
3. Scroll to "Access keys"
4. Click "Create access key"
5. Select "Application running outside AWS"
6. Click "Next"
7. Description: "Claude Desktop MCP Server"
8. Click "Create access key"
9. **IMPORTANT:** Copy both keys:
   - Access key ID (starts with `AKIA`)
   - Secret access key (long random string)
10. Click "Done"

⚠️ **Security Note:** Never commit these keys to Git. Store them securely.

### Step 4: Configure Environment Variables

Add to your `.env.local` file (project root):

```bash
# AWS MCP Server Configuration
AWS_ACCESS_KEY_ID=AKIAXXXXXXXXXXXXXXXX
AWS_SECRET_ACCESS_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
AWS_REGION=us-east-1
```

# Added below instead of reccomended above

AWS_MCP_REGION=eu-west-1
AWS_MCP_ACCESS_KEY_ID=AKIAxxxxxxxxxxxxxxxxxxxxxxxxxx
AWS_MCP_SECRET_ACCESS_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

### Step 5: Install AWS SDK Dependencies

```bash
cd scripts/mcp-servers
pnpm install
```

This will install:

- `@modelcontextprotocol/sdk`
- `@aws-sdk/client-rds`
- `@aws-sdk/client-lambda`
- `@aws-sdk/client-s3`
- `@aws-sdk/client-secrets-manager`
- `@aws-sdk/client-cloudwatch-logs`
- `@aws-sdk/client-cost-explorer`

### Step 6: Test AWS MCP Server Locally

```bash
cd scripts/mcp-servers
node --loader ts-node/esm aws-mcp-server.ts
```

You should see: `AWS MCP Server running on stdio`

Press Ctrl+C to stop.

---

## Part 2: Vercel MCP Server Setup (15-20 minutes)

### Step 1: Generate Vercel API Token

1. Go to https://vercel.com/account/tokens
2. Click "Create Token"
3. Token name: `Claude Desktop MCP`
4. Scope: Select your project (`trulyimagined-web`)
5. Expiration: 90 days (recommended)
6. Click "Create"
7. **IMPORTANT:** Copy the token (starts with `vercel_`)
8. Store securely (you won't see it again)

### Step 2: Get Project and Team IDs

#### Option A: Via Vercel CLI

```bash
cd apps/web
npx vercel link

# Follow prompts to link project
# This creates .vercel/project.json with IDs
```

#### Option B: Via Vercel Dashboard

1. Go to your project dashboard
2. Settings → General
3. Copy "Project ID" (starts with `prj_`)
4. Copy "Team ID" (starts with `team_`)

### Step 3: Configure Environment Variables

Add to your `.env.local` file:

```bash
# Vercel MCP Server Configuration
VERCEL_TOKEN=vercel_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
VERCEL_PROJECT_ID=prj_xxxxxxxxxxxxxxxx
VERCEL_TEAM_ID=team_xxxxxxxxxxxxxxxx
```

### Step 4: Test Vercel MCP Server Locally

```bash
cd scripts/mcp-servers
node --loader ts-node/esm vercel-mcp-server.ts
```

You should see: `Vercel MCP Server running on stdio`

Press Ctrl+C to stop.

---

## Part 3: Claude Desktop Configuration (10 minutes)

### Step 1: Locate Claude Desktop Config

**macOS:**

```bash
~/Library/Application Support/Claude/claude_desktop_config.json
```

**Windows:**

```
%APPDATA%\Claude\claude_desktop_config.json
```

**Linux:**

```bash
~/.config/Claude/claude_desktop_config.json
```

### Step 2: Add MCP Server Configurations

Create or edit the file to include:

```json
{
  "mcpServers": {
    "aws-trulyimagined": {
      "command": "node",
      "args": [
        "--loader",
        "ts-node/esm",
        "/ABSOLUTE/PATH/TO/trulyimagined-web-v3/scripts/mcp-servers/aws-mcp-server.ts"
      ],
      "env": {
        "AWS_ACCESS_KEY_ID": "AKIAXXXXXXXXXXXXXXXX",
        "AWS_SECRET_ACCESS_KEY": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        "AWS_REGION": "us-east-1"
      }
    },
    "vercel-trulyimagined": {
      "command": "node",
      "args": [
        "--loader",
        "ts-node/esm",
        "/ABSOLUTE/PATH/TO/trulyimagined-web-v3/scripts/mcp-servers/vercel-mcp-server.ts"
      ],
      "env": {
        "VERCEL_TOKEN": "vercel_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        "VERCEL_PROJECT_ID": "prj_xxxxxxxxxxxxxxxx",
        "VERCEL_TEAM_ID": "team_xxxxxxxxxxxxxxxx"
      }
    }
  }
}
```

**Replace:**

- `/ABSOLUTE/PATH/TO/` with your actual project path
- All `xxx` placeholders with your actual credentials

### Step 3: Restart Claude Desktop

1. Quit Claude Desktop completely
2. Relaunch Claude Desktop
3. Start a new conversation

---

## Part 4: Testing MCP Servers (10 minutes)

### Test AWS MCP

Open Claude Desktop and try these prompts:

```
1. List all RDS instances in the Truly Imagined project
```

Expected: Details about `truly-imagined-db` instance

```
2. Show recent Lambda errors from the identity-service function
```

Expected: CloudWatch logs from `/aws/lambda/identity-service`

```
3. Check S3 bucket size for truly-imagined-media
```

Expected: Bucket info with object count and total size

```
4. What's my AWS spending this month?
```

Expected: Cost breakdown by service

### Test Vercel MCP

```
1. Show recent deployments for trulyimagined-web
```

Expected: List of recent deployments with status

```
2. Check build status of the latest production deployment
```

Expected: Deployment details, build logs

```
3. View Core Web Vitals for the homepage
```

Expected: Performance metrics (LCP, FCP, CLS, etc.)

```
4. List environment variables for production
```

Expected: Environment variable names (values hidden)

---

## Troubleshooting

### AWS MCP Issues

**"Access Denied" errors:**

1. Verify IAM policy is attached correctly
2. Check AWS region is `us-east-1`
3. Ensure credentials in Claude config are correct
4. Try `aws sts get-caller-identity` in terminal to verify keys work

**"Rate limit exceeded":**

1. AWS API limits reached (especially CloudWatch)
2. Wait 60 seconds and retry
3. Consider reducing query frequency

**"Resource not found":**

1. Verify resource exists in `us-east-1` region
2. Check spelling of resource names (case-sensitive)
3. IAM user may not have permission to see resource

### Vercel MCP Issues

**"Authentication failed":**

1. Verify token is not expired (check Vercel dashboard)
2. Ensure token has project-level scope
3. Check token is correctly copied (no extra spaces)

**"Project not found":**

1. Run `npx vercel link` in `apps/web`
2. Verify `VERCEL_PROJECT_ID` matches dashboard
3. Ensure token has access to the team/project

**"Deployment failed":**

1. Check build logs in Vercel dashboard
2. Verify GitHub integration is active
3. Ensure environment variables are set correctly

### Claude Desktop Issues

**MCP servers not showing:**

1. Check Claude Desktop logs:
   - macOS: `~/Library/Logs/Claude/`
   - Windows: `%APPDATA%\Claude\Logs\`
2. Verify absolute paths are correct (no `~` or relative paths)
3. Ensure `node` is in PATH (run `which node` or `where node`)
4. Check JSON syntax is valid (use JSONLint.com)

**Servers timing out:**

1. Check internet connection
2. Verify AWS/Vercel APIs are accessible
3. Try running MCP servers manually to see errors

---

## Security Best Practices

### AWS Credentials

✅ **DO:**

- Rotate access keys every 90 days
- Use least-privilege IAM policy
- Enable MFA on IAM user
- Monitor AWS CloudTrail for suspicious activity
- Store credentials in secure password manager

❌ **DON'T:**

- Use root account credentials
- Grant write permissions unless necessary
- Share credentials between team members
- Store credentials in version control
- Use credentials in public scripts

### Vercel Tokens

✅ **DO:**

- Use project-scoped tokens (not account-level)
- Set token expiration (90 days recommended)
- Use different tokens for dev/prod
- Revoke tokens when no longer needed
- Monitor token usage in Vercel dashboard

❌ **DON'T:**

- Share tokens between team members
- Use tokens with broader scope than needed
- Store tokens in version control
- Leave tokens active indefinitely

---

## Maintenance Schedule

### Monthly Tasks

- [ ] Review AWS CloudWatch logs for errors
- [ ] Check Vercel deployment success rate
- [ ] Update MCP server dependencies (`pnpm update`)
- [ ] Review AWS costs and spending trends

### Quarterly Tasks (Every 90 Days)

- [ ] Rotate AWS access keys
- [ ] Regenerate Vercel API token
- [ ] Review IAM policy permissions
- [ ] Update Claude Desktop configuration
- [ ] Test all MCP server functionality

### Annual Tasks

- [ ] Audit all AWS resources for cost optimization
- [ ] Review Vercel plan and usage
- [ ] Consider adding more MCP servers (GitHub, Auth0)
- [ ] Update MCP server implementation

---

## Next Steps

After successful setup:

1. **Explore Capabilities:**
   - Try different AWS queries (RDS, Lambda, S3)
   - Test Vercel deployments and environment management
   - Experiment with cost monitoring and analytics

2. **Create Workflows:**
   - Morning routine: Check AWS costs, Vercel deployments
   - Pre-release: Check Web Vitals, Lambda errors
   - Post-deployment: Monitor CloudWatch logs

3. **Expand MCP Servers:**
   - Consider GitHub MCP for PR automation
   - Add Auth0 MCP for user management
   - Explore Stripe MCP for billing analytics

4. **Document Your Usage:**
   - Save useful prompts and queries
   - Track time saved vs manual operations
   - Identify automation opportunities

---

## Resources

- [MCP Protocol Specification](https://modelcontextprotocol.io/)
- [AWS MCP Server Documentation](https://github.com/modelcontextprotocol/servers/tree/main/src/aws)
- [Vercel MCP Server Documentation](https://github.com/modelcontextprotocol/servers/tree/main/src/vercel)
- [Claude Desktop MCP Guide](https://claude.ai/docs/mcp)
- [Truly Imagined MCP Feasibility Assessment](../../MCP_FEASIBILITY_ASSESSMENT.md)

---

## Support

For issues:

- **MCP Protocol:** https://github.com/modelcontextprotocol/servers/issues
- **AWS Services:** AWS Support or Stack Overflow
- **Vercel Platform:** Vercel Support or Discord
- **Truly Imagined Project:** File issue in project repository

For security concerns, contact project maintainer immediately.
