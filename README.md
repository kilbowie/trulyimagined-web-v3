# Truly Imagined v3 🎭

**Global Performer Digital Identity Registry**

A microservices-based platform empowering performers with control over their digital identity, consent boundaries, and licensing preferences.

## Core Principles

- **Identity:** Secure performer identity management
- **Consent:** Granular consent boundaries for AI usage
- **Control:** Performer-owned licensing preferences
- **Auditability:** Complete audit trail of all actions

---

## 🏗️ Architecture

```
trulyimagined-web-v3/
├── apps/
│   └── web/                    # Next.js frontend (React, Tailwind)
├── services/
│   ├── identity-service/       # Lambda: Identity management
│   ├── consent-service/        # Lambda: Consent recording
│   └── licensing-service/      # Lambda: Licensing preferences
├── infra/
│   ├── api-gateway/            # AWS SAM template
│   ├── auth/                   # Auth0 configuration
│   ├── database/               # PostgreSQL client
│   └── stripe/                 # Payment integration (future)
└── shared/
    ├── types/                  # Shared TypeScript types
    ├── utils/                  # Utility functions
    └── middleware/             # Auth0 JWT validation
```

### Technology Stack

**Frontend:**
- Next.js 14 (App Router)
- React 18
- Tailwind CSS
- TypeScript

**Backend:**
- AWS Lambda (Node.js 18)
- API Gateway
- PostgreSQL (AWS RDS)
- Auth0 (Authentication)

**Infrastructure:**
- AWS SAM (Serverless Application Model)
- pnpm (Monorepo management)
- TypeScript (End-to-end type safety)

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- pnpm 8+
- Docker (for local development)
- AWS CLI + SAM CLI (for deployment)
- PostgreSQL (local or AWS RDS)

### 1. Install Dependencies

```bash
# Install pnpm globally (if not already installed)
npm install -g pnpm

# Install all dependencies
pnpm install
```

### 2. Setup Environment Variables

```bash
# Copy example env file
cp .env.example .env.local

# Edit .env.local with your values
# - DATABASE_URL
# - AUTH0_DOMAIN, AUTH0_CLIENT_ID, AUTH0_CLIENT_SECRET
# - API_GATEWAY_URL
```

### 3. Setup Database

```bash
# Option A: Docker PostgreSQL
docker run --name trulyimagined-db \
  -e POSTGRES_DB=trulyimagined_v3 \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=password \
  -p 5432:5432 \
  -d postgres:15

# Option B: Use existing PostgreSQL
# Update DATABASE_URL in .env.local
```

Run migrations:

```bash
# TODO: Add migration scripts
# psql $DATABASE_URL < migrations/001_initial_schema.sql
```

### 4. Start Development Server

```bash
# Terminal 1: Start Next.js frontend
pnpm dev

# Terminal 2: Start local API (SAM)
cd infra/api-gateway
sam local start-api --port 3001

# Frontend: http://localhost:3000
# API: http://localhost:3001
```

---

## 📦 Monorepo Commands

```bash
# Install all dependencies
pnpm install

# Build all packages
pnpm build

# Run type checking
pnpm type-check

# Lint all code
pnpm lint

# Format all code
pnpm format

# Clean all build artifacts
pnpm clean

# Start Next.js dev server
pnpm dev
```

### Package-Specific Commands

```bash
# Work in specific package
pnpm --filter web dev
pnpm --filter @trulyimagined/identity-service build
pnpm --filter @trulyimagined/types type-check
```

---

## 🧪 Testing

```bash
# Run all tests
pnpm test

# Test specific service
pnpm --filter identity-service test
```

---

## 🚢 Deployment

### Build Services

```bash
# Build all services for production
pnpm build
```

### Deploy to AWS

```bash
# First time: Guided deployment
cd infra/api-gateway
sam deploy --guided

# Subsequent deployments
sam deploy

# Deploy specific stack
sam deploy --stack-name trulyimagined-v3-prod
```

### Deploy Frontend (Vercel)

```bash
# Connect to Vercel
vercel link

# Deploy to production
vercel --prod

# Set environment variables in Vercel dashboard
# - AUTH0_DOMAIN
# - AUTH0_CLIENT_ID
# - AUTH0_CLIENT_SECRET
# - API_GATEWAY_URL (from SAM output)
```

---

## 📁 Project Structure

### Frontend (apps/web)

```
apps/web/
├── src/
│   ├── app/              # Next.js App Router
│   │   ├── layout.tsx    # Root layout
│   │   ├── page.tsx      # Home page
│   │   └── ...           # Other pages
│   └── components/       # React components
├── public/               # Static assets
└── package.json
```

### Services

Each service is a standalone Lambda function:

```
services/identity-service/
├── src/
│   └── index.ts         # Lambda handler
├── dist/                # Compiled output
├── package.json
└── tsconfig.json
```

### Shared Packages

```
shared/
├── types/               # Shared TypeScript types
│   └── src/index.ts
├── utils/               # Utility functions
│   └── src/index.ts
└── middleware/          # Auth0 JWT validation
    └── src/index.ts
```

---

## 🔐 Security

- **Authentication:** Auth0 JWT tokens
- **Authorization:** Role-based access control (RBAC)
- **Database:** SSL/TLS connections to RDS
- **API:** CORS configured for trusted origins
- **Secrets:** Environment variables, never committed

---

## 🗄️ Database Schema

See `infra/database/migrations/` for schema definitions.

Key tables:
- `performers` - Performer identities
- `consent_boundaries` - AI usage consent (versioned)
- `licensing_preferences` - Licensing rules (versioned)
- `audit_logs` - Complete audit trail

---

## 🎯 Development Roadmap

### ✅ STEP 0: Infrastructure (COMPLETE)

- [x] Monorepo structure
- [x] TypeScript configuration
- [x] Next.js frontend scaffold
- [x] Lambda service scaffolds
- [x] Database connection layer
- [x] AWS SAM template
- [x] Auth0 middleware

### 🚧 STEP 1: Identity Service (Next)

- [ ] Implement identity CRUD operations
- [ ] Connect to database
- [ ] Add Auth0 integration
- [ ] Add validation (Zod schemas)

### 🚧 STEP 2: Consent Service

- [ ] Implement consent recording
- [ ] Versioning system
- [ ] Audit trail
- [ ] GDPR compliance

### 🚧 STEP 3: Licensing Service

- [ ] Implement licensing preferences
- [ ] Approval workflows
- [ ] Fee calculations

### 🚧 STEP 4: Frontend Implementation

- [ ] Dashboard
- [ ] Identity form
- [ ] Consent boundaries UI
- [ ] Licensing preferences UI

---

## 📚 Documentation

- [AWS SAM Deployment](infra/api-gateway/README.md)
- [Database Schema](infra/database/README.md)
- [Auth0 Setup](infra/auth/README.md)
- [API Documentation](docs/API.md) (TODO)

---

## 🤝 Contributing

This is a private project. Contact the project owner for collaboration.

---

## 📄 License

Proprietary - All rights reserved © 2026 Truly Imagined

---

## 🆘 Support

For issues or questions:
- Check existing documentation
- Review error logs
- Contact: support@trulyimagined.com

---

**Built with ❤️ for performers, by performers**
