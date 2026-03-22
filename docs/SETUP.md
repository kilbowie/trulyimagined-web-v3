# Truly Imagined v3 — Environment Setup Guide

## Prerequisites

Before starting, ensure you have the following installed:

- **Node.js 18+** — [Download](https://nodejs.org/)
- **pnpm 8+** — Install with: `npm install -g pnpm`
- **Git** — [Download](https://git-scm.com/)
- **AWS CLI** — [Installation Guide](https://aws.amazon.com/cli/)
- **AWS SAM CLI** — [Installation Guide](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html)
- **PostgreSQL** — Local install or Docker

---

## Step-by-Step Setup

### 1. Clone and Install Dependencies

```bash
# Navigate to project directory
cd trulyimagined-web-v3

# Install all dependencies (this will install for all workspaces)
pnpm install
```

### 2. Setup Environment Variables

```bash
# Copy environment template
cp .env.example .env.local

# Also copy for the web app
cp apps/web/.env.example apps/web/.env.local
```

Edit `.env.local` with your actual values:

**Required for local development:**

- `DATABASE_URL` — Your PostgreSQL connection string
- `AUTH0_DOMAIN` — From Auth0 dashboard
- `AUTH0_CLIENT_ID` — From Auth0 dashboard
- `AUTH0_CLIENT_SECRET` — From Auth0 dashboard
- `AUTH0_SECRET` — Generate with: `openssl rand -base64 32`

### 3. Setup PostgreSQL Database

**Option A: Using Docker (Recommended for local dev)**

```bash
docker run --name trulyimagined-db \
  -e POSTGRES_DB=trulyimagined_v3 \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=password \
  -p 5432:5432 \
  -d postgres:15
```

Your `DATABASE_URL` will be:

```
postgresql://postgres:password@localhost:5432/trulyimagined_v3
```

**Option B: Local PostgreSQL Installation**

1. Install PostgreSQL 15+
2. Create database: `createdb trulyimagined_v3`
3. Update `DATABASE_URL` in `.env.local`

### 4. Setup Auth0 (Required for Step 4 of Roadmap)

1. Go to [Auth0 Dashboard](https://manage.auth0.com/)
2. Create a new Application (Regular Web Application)
3. Configure settings:
   - **Allowed Callback URLs**: `http://localhost:3000/api/auth/callback`
   - **Allowed Logout URLs**: `http://localhost:3000`
   - **Allowed Web Origins**: `http://localhost:3000`
4. Copy credentials to `.env.local`
5. Create an API in Auth0:
   - Name: `Truly Imagined API`
   - Identifier: `https://api.trulyimagined.com`

### 5. Verify Setup

```bash
# Type check all packages
pnpm type-check

# Lint all code
pnpm lint

# Format all code
pnpm format
```

If any errors occur, check your environment variables and dependencies.

### 6. Start Development Server

```bash
# Start Next.js frontend
pnpm dev

# In another terminal, start local API (when ready in Step 3)
# cd infra/api-gateway
# sam local start-api --port 3001
```

Visit:

- **Frontend**: http://localhost:3000
- **API** (when running): http://localhost:3001

---

## Troubleshooting

### `pnpm` command not found

Install pnpm globally: `npm install -g pnpm`

### Port 3000 already in use

Stop other processes on port 3000 or change the port:

```bash
PORT=3001 pnpm dev
```

### TypeScript errors in IDE

1. Ensure VS Code is using the workspace TypeScript version
2. Press `Ctrl+Shift+P` → "TypeScript: Select TypeScript Version" → "Use Workspace Version"

### Database connection errors

- Verify PostgreSQL is running: `docker ps` or check local service
- Test connection: `psql $DATABASE_URL`
- Check `DATABASE_URL` format in `.env.local`

---

## Workspace Scripts

```bash
# Install dependencies
pnpm install

# Start web dev server
pnpm dev

# Build all packages
pnpm build

# Type check
pnpm type-check

# Lint
pnpm lint

# Format code
pnpm format

# Clean build artifacts
pnpm clean
```

---

## Next Steps

Once setup is complete, proceed with the Roadmap:

- ✅ **Step 1**: Repositioning (COMPLETE)
- ✅ **Step 2**: Repository + Environment Setup (COMPLETE)
- 🔄 **Step 3**: Core Backend Infrastructure (Next)

See [ROADMAP.md](../ROADMAP.md) for the full execution plan.

---

**Questions?** Review the main [README.md](../README.md) or check existing documentation.
