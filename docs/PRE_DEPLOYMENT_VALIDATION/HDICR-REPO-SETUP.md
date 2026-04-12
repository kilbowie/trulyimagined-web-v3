# HDICR - Repository Setup & AWS Lambda Deployment Guide

**Repository**: `hdicr-service` (separate from TI)  
**Deployment**: AWS Lambda + API Gateway (via SAM)  
**Domain**: `hdicr.trulyimagined.com`  
**Status**: Ready to implement

---

## Overview

This guide covers setting up the **HDICR (Human Digital Identity, Consent & Registry)** service as a standalone Node.js Lambda function deployed via AWS SAM.

**Key points:**
- Separate repository (independent from TI)
- Deployed to AWS Lambda + API Gateway
- Custom domain: `hdicr.trulyimagined.com`
- M2M authentication via Auth0
- No shared code or dependencies with TI

---

## Repository Structure

```
hdicr-service/
├── src/
│   ├── index.ts                    # Lambda handler
│   ├── app.ts                      # Express app
│   ├── services/
│   │   ├── identity/               # Identity resolution
│   │   ├── consent/                # Consent management
│   │   ├── representation/         # Actor representation
│   │   └── licensing/              # Licensing service
│   ├── middleware/
│   │   ├── auth.ts                 # Token validation
│   │   ├── correlation.ts          # Correlation IDs
│   │   ├── logging.ts              # Structured logging
│   │   └── error-handler.ts        # Error handling
│   ├── db/
│   │   ├── connection.ts           # Database pool (HDICR_DATABASE_URL)
│   │   └── queries.ts              # Database queries
│   └── types/
│       ├── actor.ts                # Actor interfaces
│       ├── identity.ts             # Identity interfaces
│       └── consent.ts              # Consent interfaces
├── authorizer/
│   └── src/
│       └── index.ts                # API Gateway authorizer
├── dist/                           # Compiled output
├── .env.example
├── .env.local
├── infra/
│   └── template.yaml               # SAM CloudFormation template
├── tsconfig.json
├── package.json
├── README.md
└── .gitignore
```

---

## Step 1: Create Repository

### Option A: From Scratch
```bash
# Create new Node.js project
mkdir hdicr-service
cd hdicr-service
git init
npm init -y

# Create directory structure
mkdir -p src/{services,middleware,db,types}
mkdir -p authorizer/src
mkdir -p infra
mkdir dist

git remote add origin https://github.com/YOUR_USERNAME/hdicr-service.git
git add .
git commit -m "initial: create hdicr service structure"
git push -u origin main
```

### Option B: From Existing Code
If you have existing HDICR code:
```bash
# Move services into src/services/
# Move middleware into src/middleware/
# Move db code into src/db/
# Create authorizer as separate Lambda function
# Remove any TI-specific code
```

---

## Step 2: Install Dependencies

### `package.json`

```json
{
  "name": "hdicr-service",
  "version": "1.0.0",
  "description": "HDICR - Human Digital Identity, Consent & Registry",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "dev": "tsx watch src/index.ts",
    "start": "node dist/index.js",
    "test": "jest",
    "lint": "eslint src/",
    "clean": "rm -rf dist/"
  },
  "dependencies": {
    "express": "^4.18.0",
    "pg": "^8.11.0",
    "jsonwebtoken": "^9.0.0",
    "jwks-rsa": "^3.0.0",
    "uuid": "^9.0.0",
    "winston": "^3.11.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.0",
    "@types/node": "^20.0.0",
    "@types/jsonwebtoken": "^9.0.0",
    "typescript": "^5.0.0",
    "tsx": "^3.0.0",
    "jest": "^29.0.0",
    "@types/jest": "^29.0.0"
  }
}
```

Install:
```bash
npm install
```

---

## Step 3: Configure Environment Variables

### `.env.example`

```bash
# ===== Database (HDICR) =====
HDICR_DATABASE_URL=postgresql://user:password@host:5432/hdicr?sslmode=require

# ===== Auth0 (M2M Token Validation) =====
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_AUDIENCE=https://hdicr.trulyimagined.com

# ===== Environment =====
NODE_ENV=development
LOG_LEVEL=info
```

### `.env.local` (Local Development)

```bash
HDICR_DATABASE_URL=postgresql://localhost:5432/hdicr
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_AUDIENCE=https://hdicr.trulyimagined.com
NODE_ENV=development
LOG_LEVEL=debug
```

---

## Step 4: Create Lambda Handler

### `src/index.ts`

Lambda handler entry point:

```typescript
import { APIGatewayProxyHandler } from 'aws-lambda';
import app from './app';

/**
 * Lambda handler wrapper for Express app
 */
const handler: APIGatewayProxyHandler = async (event, context) => {
  // Prevent Lambda from waiting for event loop to drain
  context.callbackWaitsForEmptyEventLoop = false;

  // Log incoming request
  console.log('[Lambda] Incoming request', {
    httpMethod: event.httpMethod,
    path: event.path,
    correlationId: event.headers['x-correlation-id'] || 'no-correlation-id',
  });

  return new Promise((resolve, reject) => {
    // Wrap Express app for Lambda
    const express = require('express');
    const handler = express.default(event, context, (err: any, result: any) => {
      if (err) {
        console.error('[Lambda] Error', { error: err.message });
        reject(err);
      } else {
        resolve(result);
      }
    });

    // Call the handler
    handler(event, context, (err: any, result: any) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
};

export { handler };
```

### `src/app.ts`

Express application:

```typescript
import express, { Express } from 'express';
import { correlationIdMiddleware } from './middleware/correlation';
import { authMiddleware } from './middleware/auth';
import { loggingMiddleware } from './middleware/logging';
import { errorHandler } from './middleware/error-handler';

// Import service routers
import { representationRouter } from './services/representation';
import { identityRouter } from './services/identity';
import { consentRouter } from './services/consent';
import { licensingRouter } from './services/licensing';

const app: Express = express();

// Middleware
app.use(express.json());
app.use(loggingMiddleware);
app.use(correlationIdMiddleware);

// Health check (no auth required)
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

// API routes (all require auth)
app.use(authMiddleware);

app.use('/api/representation', representationRouter);
app.use('/api/identity', identityRouter);
app.use('/api/consent', consentRouter);
app.use('/api/licensing', licensingRouter);

// Error handling
app.use(errorHandler);

export default app;
```

---

## Step 5: Implement Middleware

### `src/middleware/correlation.ts`

Correlation ID tracking:

```typescript
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

declare global {
  namespace Express {
    interface Request {
      correlationId: string;
    }
  }
}

/**
 * Extract or generate correlation ID for request tracing
 */
export function correlationIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const correlationId = req.headers['x-correlation-id'] || uuidv4();
  req.correlationId = String(correlationId);
  res.setHeader('X-Correlation-ID', correlationId);

  console.log('[Request]', {
    method: req.method,
    path: req.path,
    correlationId: req.correlationId,
  });

  next();
}
```

### `src/middleware/auth.ts`

M2M token validation:

```typescript
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JwksClient } from 'jwks-rsa';

const jwksClient = new JwksClient({
  jwksUri: `https://${process.env.AUTH0_DOMAIN}/.well-known/jwks.json`,
});

/**
 * Validate Bearer token from Auth0
 * Returns 401 if token is missing
 * Returns 403 if token is invalid/expired
 */
export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;

  // Missing token = 401
  if (!authHeader?.startsWith('Bearer ')) {
    console.warn('[Auth] Missing token', {
      correlationId: req.correlationId,
    });
    return res.status(401).json({
      error: 'Unauthorized',
      correlationId: req.correlationId,
    });
  }

  const token = authHeader.slice(7);

  try {
    // Decode and verify JWT
    const decoded = jwt.decode(token, { complete: true });

    if (!decoded || !decoded.header.kid) {
      throw new Error('Invalid token format');
    }

    // Get signing key from JWKS
    const key = await jwksClient.getSigningKey(decoded.header.kid);
    const publicKey = key.getPublicKey();

    // Verify token signature and claims
    const verified = jwt.verify(token, publicKey, {
      audience: process.env.AUTH0_AUDIENCE,
      issuer: `https://${process.env.AUTH0_DOMAIN}/`,
    });

    // Token is valid, continue
    console.log('[Auth] Token validated', {
      correlationId: req.correlationId,
      clientId: (verified as any).sub,
    });

    next();
  } catch (error) {
    // Invalid or expired token = 403
    console.error('[Auth] Token validation failed', {
      correlationId: req.correlationId,
      error: error instanceof Error ? error.message : String(error),
    });

    return res.status(403).json({
      error: 'Forbidden',
      correlationId: req.correlationId,
    });
  }
}
```

### `src/middleware/logging.ts`

Request/response logging:

```typescript
import { Request, Response, NextFunction } from 'express';

export function loggingMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log('[Response]', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      correlationId: (req as any).correlationId,
    });
  });

  next();
}
```

### `src/middleware/error-handler.ts`

Error handling:

```typescript
import { Request, Response, NextFunction } from 'express';

export function errorHandler(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  console.error('[Error]', {
    message: error.message,
    stack: error.stack,
    correlationId: (req as any).correlationId,
  });

  res.status(500).json({
    error: 'Internal Server Error',
    correlationId: (req as any).correlationId,
  });
}
```

---

## Step 6: Database Configuration

### `src/db/connection.ts`

HDICR database pool:

```typescript
import { Pool } from 'pg';

const hdicrPool = new Pool({
  connectionString: process.env.HDICR_DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

hdicrPool.on('error', (error) => {
  console.error('[HDICR DB] Unexpected error', error);
});

/**
 * Execute query against HDICR database
 */
async function queryHdicr<T = any>(
  text: string,
  params?: any[]
): Promise<T[]> {
  const start = Date.now();
  let client;

  try {
    client = await hdicrPool.connect();
    const result = await client.query(text, params);
    const duration = Date.now() - start;

    console.log('[HDICR DB Query]', {
      duration: `${duration}ms`,
      rows: result.rows.length,
    });

    return result.rows as T[];
  } catch (error) {
    console.error('[HDICR DB Error]', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  } finally {
    if (client) client.release();
  }
}

export { queryHdicr, hdicrPool };
```

---

## Step 7: Create API Gateway Authorizer

### `authorizer/src/index.ts`

Custom authorizer for API Gateway:

```typescript
import { APIGatewayAuthorizerHandler } from 'aws-lambda';
import jwt from 'jsonwebtoken';
import { JwksClient } from 'jwks-rsa';

const jwksClient = new JwksClient({
  jwksUri: `https://${process.env.AUTH0_DOMAIN}/.well-known/jwks.json`,
});

/**
 * API Gateway custom authorizer
 * Validates Bearer tokens and returns IAM policy
 */
const authorizer: APIGatewayAuthorizerHandler = async (event) => {
  const token = event.authorizationToken?.replace('Bearer ', '');

  if (!token) {
    throw new Error('Unauthorized');
  }

  try {
    const decoded = jwt.decode(token, { complete: true });

    if (!decoded || !decoded.header.kid) {
      throw new Error('Invalid token');
    }

    const key = await jwksClient.getSigningKey(decoded.header.kid);
    const publicKey = key.getPublicKey();

    jwt.verify(token, publicKey, {
      audience: process.env.AUTH0_AUDIENCE,
      issuer: `https://${process.env.AUTH0_DOMAIN}/`,
    });

    // Token is valid - return allow policy
    return {
      principalId: (decoded.payload as any).sub,
      policyDocument: {
        Version: '2012-10-17',
        Statement: [
          {
            Action: 'execute-api:Invoke',
            Effect: 'Allow',
            Resource: event.methodArn,
          },
        ],
      },
    };
  } catch (error) {
    console.error('[Authorizer] Token validation failed', error);
    throw new Error('Unauthorized');
  }
};

export { authorizer as handler };
```

---

## Step 8: Create SAM Template

### `infra/template.yaml`

Use the SAM template provided in your package (copy from outputs).

**Key parameters to update:**

```yaml
Parameters:
  CustomDomainName:
    Type: String
    Default: hdicr.trulyimagined.com  # ← Update to your domain
  
  CertificateArn:
    Type: String
    # Get this from AWS Certificate Manager
    # Must be in us-east-1 region

Environment Variables:
  HDICR_DATABASE_URL: !Ref HDICRDatabaseURL
  AUTH0_DOMAIN: !Ref Auth0Domain
  AUTH0_AUDIENCE: https://hdicr.trulyimagined.com
```

---

## Step 9: Test Locally

### Run Express App Locally

```bash
# Install tsx for TypeScript execution
npm install -D tsx

# Start development server
npm run dev

# Should output: Server listening on port 3001
# Test health endpoint:
curl http://localhost:3001/health
```

### Run with SAM Locally (Optional)

```bash
# Build SAM template
sam build -t infra/template.yaml

# Start local API Gateway
sam local start-api

# Test endpoints:
curl http://localhost:3000/health
```

---

## Step 10: Deploy to AWS Lambda

### Prerequisites

1. **AWS Account** with credentials configured
2. **ACM Certificate** for `hdicr.trulyimagined.com` (in us-east-1)
   - Go to AWS Certificate Manager → Request certificate
  - Domain: `hdicr.trulyimagined.com`
   - Validation method: DNS
   - Copy the certificate ARN
3. **S3 Bucket** for SAM deployments
   ```bash
   aws s3 mb s3://hdicr-sam-artifacts-$(date +%s)
   ```

### Deploy

```bash
# Build
sam build -t infra/template.yaml

# Deploy (first time)
sam deploy --guided \
  --stack-name hdicr-production \
  --s3-prefix hdicr-prod \
  --parameter-overrides \
    HDICRDatabaseURL=$HDICR_DATABASE_URL \
    Auth0Domain=your-tenant.auth0.com \
    Auth0Audience=https://hdicr.trulyimagined.com \
    CertificateArn=arn:aws:acm:us-east-1:xxx:certificate/yyy

# Deploy (subsequent updates)
sam deploy
```

### Configure DNS

After SAM deployment completes:

1. Get API Gateway endpoint from CloudFormation stack outputs
2. Add CNAME record at your DNS provider:
   ```
  Name: hdicr
   Value: d-xxxxx.execute-api.eu-west-1.amazonaws.com
   ```
3. Wait for DNS to propagate (5-15 minutes)
4. Test: `curl https://hdicr.trulyimagined.com/health`

---

## Step 11: Test in Production

```bash
# Health check
curl https://hdicr.trulyimagined.com/health

# Test with bearer token (from TI application)
curl -H "Authorization: Bearer <token>" \
  https://hdicr.trulyimagined.com/api/representation/actor-by-auth0/user_id

# Check CloudWatch logs
# AWS Console → CloudWatch → Logs → /aws/lambda/hdicr-production
```

---

## Deployment Checklist

- [ ] Repository created on GitHub
- [ ] `.env.example` documents all required variables
- [ ] `.env.local` configured for local development
- [ ] `src/index.ts` Lambda handler implemented
- [ ] `src/app.ts` Express app implemented
- [ ] Middleware implemented (auth, correlation, logging, error-handler)
- [ ] Services implemented (representation, identity, consent, licensing)
- [ ] Database connection configured (HDICR_DATABASE_URL only)
- [ ] Authorizer Lambda implemented
- [ ] `infra/template.yaml` configured with correct domain/certificate
- [ ] Local testing passes (`npm run dev`)
- [ ] AWS credentials configured
- [ ] ACM certificate created for `hdicr.trulyimagined.com`
- [ ] S3 bucket created for SAM artifacts
- [ ] `sam deploy --guided` completes successfully
- [ ] DNS CNAME record configured
- [ ] Production testing passes
- [ ] CloudWatch logs show proper flow

---

## Monitoring

### CloudWatch Logs

```bash
# View HDICR logs
aws logs tail /aws/lambda/hdicr-production --follow

# View authorizer logs
aws logs tail /aws/lambda/hdicr-authorizer-production --follow
```

### CloudWatch Alarms

SAM template creates alarms for:
- Lambda errors > 5 per 5 minutes
- Lambda duration > 5 seconds (average)
- API Gateway 4xx errors > 10 per 5 minutes

---

## Troubleshooting

**"Cannot connect to database"**
- Verify RDS security group allows Lambda access
- Verify `HDICR_DATABASE_URL` is correct
- Check CloudWatch logs for connection errors

**"Auth0 token validation failed"**
- Verify M2M app exists in Auth0
- Verify audience: `https://hdicr.trulyimagined.com`
- Check Auth0 logs for token issues

**"Custom domain not working"**
- Verify ACM certificate is in us-east-1
- Verify DNS CNAME record is correct
- Wait 5-15 minutes for DNS propagation
- Check Certificate Manager for certificate status

---

## Next: Deploy TI

Once HDICR is live at `hdicr.trulyimagined.com`, follow **TI-REPO-SETUP.md** to deploy TI application and configure it to call HDICR.
