# Truly Imagined v3 🎭

## The Global Registry and Compliance Infrastructure for Human Digital Identity in AI

**We are not an AI tool. We are rights infrastructure.**

Truly Imagined provides the foundational registry and compliance layer that enables actors to register their digital identity, define consent boundaries, and license their likeness for AI-generated content.

---

## 🎯 Vision

By establishing the world's first **Identity Registry** and **Consent Ledger** for AI usage, we create the trust infrastructure that the industry needs to operate ethically and legally at scale.

### Core Value Proposition

**"Control and license your digital identity in AI"**

We enable actors to:

- **Register** their digital identity in a verified, global registry
- **Define** clear consent boundaries for AI usage
- **License** their likeness on their own terms
- **Audit** every usage decision through an immutable ledger

---

## 🏛️ Core Infrastructure Components

### 1. Identity Registry

Secure registration and verification of actor identities. This is the foundational layer that establishes trust and prevents unauthorized AI usage.

### 2. Consent Ledger (CRITICAL)

An append-only, timestamped log of all permissions and usage decisions. Future audit-ready and designed for regulatory compliance.

### 3. Licensing Control

Actor-owned preferences system that determines how, when, and where their digital identity can be licensed and monetized.

---

## 💡 Why This Matters

Truly Imagined prioritizes:

- **Trust over features**
- **Usage over scale**
- **Infrastructure over tools**
- **Compliance over convenience**

The goal is to **prove that human digital identity can be registered, controlled, and licensed in AI — and that people will use it.**

---

## 🧭 Guiding Principles

- **Identity:** Secure, verified actor identity management
- **Consent:** Immutable audit trail of all permissions
- **Control:** Actor-owned licensing decisions
- **Auditability:** Complete transparency and compliance-ready logging

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

## 🎯 90-Day Execution Roadmap

**See [ROADMAP.md](ROADMAP.md) for the complete 90-day execution plan.**

### Day 90 Success Metrics:

- 300–1,000 verified actors onboarded
- 3–5 agency relationships started
- Identity Registry + Consent Ledger live
- First licensed usage (minutes generated)
- First revenue signals

### Current Phase: **Phase 1 — Trust Layer + Registry Foundation** (Days 1–30)

**Step 1: Repositioning** ✅ COMPLETE

- Infrastructure and compliance messaging
- Clear value proposition
- Actor/agency explainers

**Step 2: Repository + Environment Setup** ✅ COMPLETE

- Monorepo structure configured
- TypeScript, ESLint, Prettier setup
- Environment variables templates
- Development environment verified

**Next Steps:**

- Step 3: Core Backend Infrastructure (PostgreSQL, AWS SAM, API Gateway)
- Step 4: Auth Layer (Auth0)
- Step 5: Identity Registry (MVP)
- Step 6: Consent Ledger (CRITICAL)
- Step 7: Basic Frontend

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
