# Truly Imagined (TI) - Repository Setup & Deployment Guide

**Repository**: `trulyimagined-web` (separate from HDICR)  
**Deployment**: Vercel  
**Domain**: `trulyimagined.com`  
**Status**: Ready to implement

---

## Overview

This guide covers setting up the **TI (Truly Imagined) web application** as a standalone Next.js application deployed to Vercel.

**Key points:**
- Separate repository (independent from HDICR)
- Calls HDICR API at `https://hdicr.trulyimagined.com` via HTTP + M2M Auth
- Deployed to Vercel (automatic on git push)
- No shared code or dependencies with HDICR

---

## Repository Structure

```
trulyimagined-web/
├── src/
│   ├── app/                    # Next.js pages
│   ├── components/
│   ├── lib/
│   │   ├── hdicr/             # HDICR HTTP client
│   │   │   ├── hdicr-http-client.ts
│   │   │   ├── hdicr-auth.ts
│   │   │   └── actor-identity.ts
│   │   ├── db.ts              # Database connections (TI_DATABASE_URL)
│   │   └── utils/
│   └── pages/                  # API routes
├── public/
├── .env.example               # Environment template
├── .env.local                 # Local dev (never committed)
├── .env.production            # Production (set in Vercel)
├── next.config.js
├── tsconfig.json
├── package.json
├── vercel.json               # Vercel deployment config
└── README.md
```

---

## Step 1: Create Repository

### Option A: From Scratch
```bash
# Create new Next.js project
npx create-next-app@latest trulyimagined-web --typescript --tailwind

cd trulyimagined-web
git init
git remote add origin https://github.com/YOUR_USERNAME/trulyimagined-web.git
git add .
git commit -m "initial: create next.js project"
git push -u origin main
```

### Option B: From Existing Code
If you have existing TI code:
```bash
# Reorganize into this structure
# Keep only TI-specific code
# Remove any HDICR service references
# Remove any shared packages (will use direct imports for now)
```

---

## Step 2: Install Dependencies

```bash
npm install
# or
pnpm install
# or
yarn install
```

**Key dependencies** (already in create-next-app):
```json
{
  "dependencies": {
    "next": "^15.x",
    "react": "^19.x",
    "react-dom": "^19.x"
  },
  "devDependencies": {
    "typescript": "^5.x",
    "@types/react": "^19.x",
    "@types/node": "^20.x"
  }
}
```

**Additional dependencies you may need:**
```bash
npm install \
  jsonwebtoken \
  jwks-rsa \
  pg \
  uuid \
  @auth0/nextjs-auth0
```

---

## Step 3: Configure Environment Variables

### `.env.example`
```bash
# ===== Database (TI) =====
TI_DATABASE_URL=postgresql://user:password@host:5432/ti?sslmode=require

# ===== HDICR API (M2M Authentication) =====
HDICR_API_URL=https://hdicr.trulyimagined.com
AUTH0_M2M_CLIENT_ID=your_m2m_client_id
AUTH0_M2M_CLIENT_SECRET=your_m2m_secret
AUTH0_M2M_AUDIENCE=https://hdicr.trulyimagined.com

# ===== Auth0 (User Login) =====
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_CLIENT_ID=your_ti_user_auth_client_id
AUTH0_CLIENT_SECRET=your_ti_user_auth_secret
AUTH0_BASE_URL=http://localhost:3000
AUTH0_SECRET=your_random_secret_here

# ===== Environment =====
NODE_ENV=development
```

### `.env.local` (Local Development)
Copy `.env.example` to `.env.local` and fill in with local values:
```bash
TI_DATABASE_URL=postgresql://localhost:5432/ti
HDICR_API_URL=http://localhost:4001
AUTH0_M2M_CLIENT_ID=...
AUTH0_M2M_CLIENT_SECRET=...
# etc.
```

---

## Step 4: Create HDICR HTTP Client

### `src/lib/hdicr/hdicr-auth.ts`

M2M token fetching with caching:

```typescript
let cachedToken: { token: string; expiresAt: number } | null = null;

/**
 * Get M2M token from Auth0 for calling HDICR API
 * Tokens are cached until 5 minutes before expiry
 */
async function getM2mToken(): Promise<string> {
  const now = Date.now();
  const REFRESH_BUFFER_MS = 5 * 60 * 1000; // 5 minutes

  // Return cached token if still valid
  if (cachedToken && cachedToken.expiresAt > now + REFRESH_BUFFER_MS) {
    return cachedToken.token;
  }

  const auth0Domain = process.env.AUTH0_DOMAIN;
  const clientId = process.env.AUTH0_M2M_CLIENT_ID;
  const clientSecret = process.env.AUTH0_M2M_CLIENT_SECRET;
  const audience = process.env.AUTH0_M2M_AUDIENCE;

  if (!auth0Domain || !clientId || !clientSecret || !audience) {
    throw new Error('Missing Auth0 M2M configuration');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

  try {
    const response = await fetch(`https://${auth0Domain}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        audience: audience,
        grant_type: 'client_credentials',
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Auth0 token fetch failed: ${response.statusText}`);
    }

    const data = await response.json();

    // Cache the token
    cachedToken = {
      token: data.access_token,
      expiresAt: now + data.expires_in * 1000,
    };

    return data.access_token;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

export { getM2mToken };
```

### `src/lib/hdicr/hdicr-http-client.ts`

Main HDICR API client:

```typescript
import { getM2mToken } from './hdicr-auth';
import { v4 as uuidv4 } from 'uuid';

interface HdicrRequestOptions {
  method?: string;
  body?: any;
}

interface HdicrResponse<T> {
  statusCode: number;
  body: T;
}

/**
 * Call HDICR API with M2M authentication
 */
async function callHdicr<T>(
  path: string,
  options: HdicrRequestOptions = {},
  correlationId?: string
): Promise<HdicrResponse<T>> {
  const baseUrl = process.env.HDICR_API_URL || 'http://localhost:4001';
  const url = `${baseUrl}${path}`;
  const method = options.method || 'GET';
  const id = correlationId || uuidv4();

  // Get M2M token
  let token: string;
  try {
    token = await getM2mToken();
  } catch (error) {
    console.error('[HDICR] Failed to fetch M2M token', {
      correlationId: id,
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      statusCode: 503,
      body: {
        error: 'Authentication service unavailable',
        correlationId: id,
      } as any,
    };
  }

  // Make request with timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout

  try {
    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-Correlation-ID': id,
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const data = await response.json();

    console.log('[HDICR Request]', {
      method,
      path,
      statusCode: response.status,
      duration: `${Date.now()}ms`,
      correlationId: id,
    });

    return {
      statusCode: response.status,
      body: data,
    };
  } catch (error) {
    clearTimeout(timeoutId);

    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[HDICR Error]', {
      method,
      path,
      error: errorMessage,
      correlationId: id,
    });

    return {
      statusCode: 503,
      body: {
        error: 'HDICR service unavailable',
        correlationId: id,
      } as any,
    };
  }
}

export { callHdicr, HdicrResponse };
```

### `src/lib/hdicr/actor-identity.ts`

Actor-specific endpoints:

```typescript
import { callHdicr } from './hdicr-http-client';

interface Actor {
  id: string;
  auth0_user_id: string;
  registry_id: string;
  verification_status: 'unverified' | 'pending' | 'verified';
  created_at: string;
  updated_at: string;
}

/**
 * Get actor by Auth0 user ID
 */
async function getActorByAuth0Id(auth0UserId: string): Promise<Actor | null> {
  const response = await callHdicr<Actor>(
    `/api/representation/actor-by-auth0/${auth0UserId}`
  );

  if (response.statusCode === 200) {
    return response.body;
  }

  if (response.statusCode === 404) {
    return null; // Actor not found
  }

  throw new Error(
    `Failed to fetch actor: ${response.statusCode} - ${
      response.body?.error || 'Unknown error'
    }`
  );
}

export { getActorByAuth0Id, Actor };
```

---

## Step 5: Database Configuration

### `src/lib/db.ts`

TI database connection (using TI_DATABASE_URL only):

```typescript
import { Pool } from 'pg';

// Create connection pool for TI database only
const tiPool = new Pool({
  connectionString: process.env.TI_DATABASE_URL,
  max: 10, // Smaller pool for serverless
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

tiPool.on('error', (error) => {
  console.error('[TI DB] Unexpected error on idle client', error);
});

/**
 * Execute query against TI database
 */
async function queryTiDb<T = any>(
  text: string,
  params?: any[]
): Promise<T[]> {
  const start = Date.now();
  let client;

  try {
    client = await tiPool.connect();
    const result = await client.query(text, params);
    const duration = Date.now() - start;

    console.log('[TI DB Query]', {
      duration: `${duration}ms`,
      rows: result.rows.length,
    });

    return result.rows as T[];
  } catch (error) {
    console.error('[TI DB Error]', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  } finally {
    if (client) client.release();
  }
}

export { queryTiDb, tiPool };
```

---

## Step 6: Create Vercel Configuration

### `vercel.json`

Vercel deployment config:

```json
{
  "buildCommand": "next build",
  "outputDirectory": ".next",
  "installCommand": "npm install",
  "env": {
    "TI_DATABASE_URL": "@ti_database_url",
    "HDICR_API_URL": "@hdicr_api_url",
    "AUTH0_M2M_CLIENT_ID": "@auth0_m2m_client_id",
    "AUTH0_M2M_CLIENT_SECRET": "@auth0_m2m_client_secret",
    "AUTH0_M2M_AUDIENCE": "@auth0_m2m_audience",
    "AUTH0_DOMAIN": "@auth0_domain",
    "AUTH0_CLIENT_ID": "@auth0_client_id",
    "AUTH0_CLIENT_SECRET": "@auth0_client_secret",
    "AUTH0_BASE_URL": "@auth0_base_url"
  }
}
```

---

## Step 7: Test Locally

```bash
# Start development server
npm run dev

# Open browser
# http://localhost:3000

# Test HDICR integration
# Navigate to dashboard (requires HDICR running on localhost:4001)
# Should see actor data from HDICR
```

---

## Step 8: Deploy to Vercel

### Create Vercel Project

1. Go to https://vercel.com/new
2. Select "Import Git Repository"
3. Choose `trulyimagined-web` repo
4. Click "Import"

### Configure Environment Variables

In Vercel project → Settings → Environment Variables:

```
TI_DATABASE_URL = postgresql://...
HDICR_API_URL = https://hdicr.trulyimagined.com
AUTH0_M2M_CLIENT_ID = ...
AUTH0_M2M_CLIENT_SECRET = ... (mark as Sensitive)
AUTH0_M2M_AUDIENCE = https://hdicr.trulyimagined.com
AUTH0_DOMAIN = your-tenant.auth0.com
AUTH0_CLIENT_ID = ...
AUTH0_CLIENT_SECRET = ... (mark as Sensitive)
AUTH0_BASE_URL = https://trulyimagined.com
```

### Add Custom Domain

1. Vercel project → Settings → Domains
2. Add `trulyimagined.com`
3. Follow DNS instructions
4. HTTPS enabled automatically

### Deploy

Push to main branch:

```bash
git push origin main
```

Vercel automatically builds and deploys. Monitor in Vercel dashboard.

---

## Step 9: Test in Production

```bash
# Visit production URL
https://trulyimagined.com

# Test auth flow
# Log in via Auth0

# Test HDICR integration
# Navigate to dashboard
# Verify actor data loads from HDICR
```

---

## Monitoring & Troubleshooting

### Vercel Logs

Vercel → Deployments → Logs (watch for errors)

### Common Issues

**"Cannot reach HDICR"**
- Verify `HDICR_API_URL` in Vercel env vars
- Verify HDICR is deployed and accessible
- Check correlation IDs in logs

**"Auth0 token fetch failed"**
- Verify `AUTH0_M2M_CLIENT_ID` and `AUTH0_M2M_CLIENT_SECRET`
- Verify M2M app exists in Auth0
- Check Auth0 logs

**"Database connection failed"**
- Verify `TI_DATABASE_URL` is correct
- Test connection from local machine
- Check RDS security group allows Vercel IPs

---

## Deployment Checklist

- [ ] Repository created on GitHub
- [ ] `.env.example` documents all required variables
- [ ] `.env.local` configured for local development
- [ ] `vercel.json` created and configured
- [ ] HDICR HTTP client implemented
- [ ] TI database connection configured (TI_DATABASE_URL only)
- [ ] Local testing passes (can call HDICR from TI)
- [ ] Vercel project created
- [ ] All environment variables set in Vercel
- [ ] Custom domain configured
- [ ] First deployment successful
- [ ] Production testing passes

---

## Next: Deploy HDICR

Once TI is live, follow **HDICR-REPO-SETUP.md** to deploy HDICR service.
