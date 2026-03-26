# MCP Server Configurations

This directory contains Model Context Protocol (MCP) server configurations for Truly Imagined v3.

## Overview

MCP servers enable AI agents (like Claude Desktop) to interact with external services programmatically. These configurations provide infrastructure management and deployment automation capabilities.

## Available Servers

### 1. AWS MCP Server (`aws-mcp-config.json`)

**Purpose:** Manage AWS infrastructure (RDS, Lambda, S3, Secrets Manager, CloudWatch)

**Capabilities:**
- Query RDS database status and execute read-only queries
- View Lambda function logs and metrics
- List S3 bucket contents and check storage usage
- Read AWS Secrets Manager values
- Monitor CloudWatch alarms and logs
- Check cost and billing information

**Setup Required:**
1. Create IAM user: `trulyimagined-mcp` (see `aws-iam-policy.json`)
2. Generate access keys in AWS Console
3. Add credentials to `.env.local` or Claude Desktop config
4. Install: `npm install -g @modelcontextprotocol/server-aws`

### 2. Vercel MCP Server (`vercel-mcp-config.json`)

**Purpose:** Automate Vercel deployments and manage environments

**Capabilities:**
- Trigger deployments from AI context
- Check deployment status and build logs
- Manage environment variables across environments
- View production/preview URLs
- Monitor Web Vitals and performance metrics
- Roll back deployments if needed

**Setup Required:**
1. Generate Vercel API token: https://vercel.com/account/tokens
2. Link project: `npx vercel link` in `apps/web`
3. Add token to `.env.local` or Claude Desktop config
4. Install: `npm install -g @modelcontextprotocol/server-vercel`

## Installation Guide

### 1. Install MCP Servers Globally

```bash
# AWS MCP Server
npm install -g @modelcontextprotocol/server-aws

# Vercel MCP Server
npm install -g @modelcontextprotocol/server-vercel
```

### 2. Configure Credentials

#### Option A: Environment Variables (`.env.local`)

```bash
# AWS MCP
AWS_ACCESS_KEY_ID=AKIAXXXXXXXXXXXXXXXX
AWS_SECRET_ACCESS_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
AWS_REGION=us-east-1
AWS_MCP_ALLOWED_ACTIONS=rds:Describe*,lambda:Get*,s3:List*,s3:Get*,secretsmanager:GetSecretValue,cloudwatch:Describe*,cloudwatch:Get*,ce:GetCostAndUsage

# Vercel MCP
VERCEL_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
VERCEL_ORG_ID=team_xxxxxxxxxxxxxxxx
VERCEL_PROJECT_ID=prj_xxxxxxxxxxxxxxxx
```

#### Option B: Claude Desktop Configuration

**Location:** `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS)  
**Location:** `%APPDATA%\Claude\claude_desktop_config.json` (Windows)

```json
{
  "mcpServers": {
    "aws": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-aws"],
      "env": {
        "AWS_ACCESS_KEY_ID": "AKIAXXXXXXXXXXXXXXXX",
        "AWS_SECRET_ACCESS_KEY": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        "AWS_REGION": "us-east-1"
      }
    },
    "vercel": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-vercel"],
      "env": {
        "VERCEL_TOKEN": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
      }
    }
  }
}
```

### 3. Test MCP Servers

#### Test AWS MCP

Open Claude Desktop and try:
```
List all RDS instances in the Truly Imagined project
Show recent Lambda errors from the identity-service function
Check S3 bucket size for truly-imagined-media
```

#### Test Vercel MCP

Open Claude Desktop and try:
```
Show recent deployments for trulyimagined-web
Check build status of the latest production deployment
View Core Web Vitals for the homepage
```

## Security Best Practices

### AWS Credentials

- ✅ **DO** use IAM user with least-privilege policy (see `aws-iam-policy.json`)
- ✅ **DO** rotate access keys every 90 days
- ✅ **DO** enable MFA on the IAM user
- ❌ **DON'T** use root account credentials
- ❌ **DON'T** grant write permissions unless absolutely necessary
- ❌ **DON'T** commit credentials to version control

### Vercel Tokens

- ✅ **DO** use scoped tokens (project-level)
- ✅ **DO** set token expiration (90 days recommended)
- ✅ **DO** use different tokens for dev/prod environments
- ❌ **DON'T** use account-level tokens
- ❌ **DON'T** share tokens across team members

## Troubleshooting

### AWS MCP Issues

**Problem:** "Access Denied" errors
- **Solution:** Check IAM policy includes necessary permissions (see `aws-iam-policy.json`)
- **Solution:** Verify AWS credentials are correct in `.env.local`
- **Solution:** Ensure region is set correctly (us-east-1)

**Problem:** "Rate limit exceeded"
- **Solution:** AWS CloudWatch has API limits. Wait 1 minute and retry
- **Solution:** Consider using CloudWatch Insights for complex queries

### Vercel MCP Issues

**Problem:** "Project not found"
- **Solution:** Run `npx vercel link` in `apps/web` directory
- **Solution:** Verify `VERCEL_PROJECT_ID` matches your project
- **Solution:** Check token has correct scope (Team > Project)

**Problem:** "Deployment failed"
- **Solution:** Check build logs in Vercel dashboard
- **Solution:** Verify environment variables are set correctly
- **Solution:** Ensure GitHub integration is active

## Usage Examples

### AWS MCP

```
# Database Operations
Check the status of the RDS instance truly-imagined-db
Show recent database connections
List all tables in the actors schema

# Lambda Operations
Show errors from the consent-service Lambda in the last hour
Get the latest deployment version of identity-service
Check Lambda memory usage for all functions

# S3 Operations
List objects in truly-imagined-media bucket with prefix /headshots
Check total storage used in S3
Show recent uploads to the media bucket

# Cost Monitoring
What's my AWS spending this month?
Show cost breakdown by service
Alert me if daily cost exceeds $20
```

### Vercel MCP

```
# Deployment Operations
Deploy the latest commit to production
Show deployment status for PR #123
List all preview deployments

# Environment Management
Show all environment variables for production
Add NEXT_PUBLIC_FEATURE_FLAG=true to preview environment
Compare env vars between staging and production

# Performance Monitoring
Show Core Web Vitals for the dashboard page
Which pages have the slowest load times?
Check performance over the last 7 days
```

## Maintenance

### Monthly Tasks

- [ ] Rotate AWS access keys (90-day policy)
- [ ] Review IAM policy permissions (ensure least-privilege)
- [ ] Check Vercel token expiration
- [ ] Review MCP server logs for errors
- [ ] Update MCP server packages (`npm update -g`)

### When to Expand

Consider adding more MCP servers when:

- **GitHub MCP:** Need automated PR creation/review (high value)
- **Auth0 MCP:** Frequent user management operations (medium value)
- **Stripe MCP:** Building billing dashboards or analytics (medium value)
- **Resend MCP:** Debugging email deliverability (low value, use Resend dashboard)

## Resources

- [MCP Specification](https://modelcontextprotocol.io/)
- [AWS MCP Server Docs](https://github.com/modelcontextprotocol/servers/tree/main/src/aws)
- [Vercel MCP Server Docs](https://github.com/modelcontextprotocol/servers/tree/main/src/vercel)
- [Claude Desktop MCP Guide](https://claude.ai/docs/mcp)

## Support

For issues specific to:
- **MCP Protocol:** https://github.com/modelcontextprotocol/servers/issues
- **AWS Services:** AWS Support or Stack Overflow
- **Vercel Platform:** Vercel Support or Discord
- **Truly Imagined Project:** File issue in project repository
