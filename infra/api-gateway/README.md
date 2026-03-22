# AWS SAM Deployment Guide

## Prerequisites

1. Install AWS CLI: https://aws.amazon.com/cli/
2. Install AWS SAM CLI: https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html
3. Configure AWS credentials: `aws configure`

## Build Services

```bash
# Build all services
pnpm build

# Or build individually
cd services/identity-service && pnpm build
cd services/consent-service && pnpm build
cd services/licensing-service && pnpm build
```

## Local Development

```bash
# Start local API Gateway
cd infra/api-gateway
sam local start-api --port 3001

# Test locally
curl http://localhost:3001/identity
```

## Deploy to AWS

```bash
# First time deployment (guided)
cd infra/api-gateway
sam deploy --guided

# Subsequent deployments
sam deploy
```

## Environment Variables

Update `samconfig.toml` with your values:

```toml
parameter_overrides = [
  "DatabaseURL=\"postgresql://user:pass@your-rds.amazonaws.com:5432/db\"",
  "Auth0Domain=\"your-tenant.auth0.com\"",
  "Auth0Audience=\"https://api.trulyimagined.com\""
]
```

## Testing Endpoints

After deployment, SAM will output the API Gateway URL:

```
https://xxxxx.execute-api.eu-west-2.amazonaws.com/prod
```

Test endpoints:
- POST /identity - Create performer identity
- GET /identity/{id} - Get performer identity
- POST /consent - Record consent
- GET /consent/{performerId} - Get consent
- POST /licensing - Set licensing preferences
- GET /licensing/{performerId} - Get licensing

## Logs

View Lambda logs:

```bash
sam logs -n IdentityFunction --tail
sam logs -n ConsentFunction --tail
sam logs -n LicensingFunction --tail
```
