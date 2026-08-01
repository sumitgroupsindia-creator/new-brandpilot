# BrandPilot

Enterprise AI Branding Platform — multi-tenant, AI-powered asset generation with wallet billing.

## Monorepo Structure

```
.
├── apps/
│   ├── api/          # NestJS REST API
│   ├── web/          # React user web app
│   ├── admin/        # React admin panel
│   └── mobile/       # Capacitor mobile shell
├── packages/
│   ├── shared/       # Types, validation, config registry
│   └── infra/        # Docker, Nginx, deployment configs
└── IMPLEMENTATION_PLAN.md
```

## Quick Start

```bash
# Install dependencies
pnpm install

# Configure environment
cp .env.example .env

# Start local infrastructure
pnpm docker:up

# Generate Prisma client
pnpm db:generate

# Preferred: run migrations and seed
pnpm db:migrate:dev
pnpm db:seed

# If migrate fails locally due shadow DB privileges, use:
# pnpm db:push && pnpm db:seed

# Start API and web app
pnpm dev
```

## Environment

Copy `.env.example` to `.env` and fill in real secrets.

## Phases

- **P0** Skeleton (monorepo, auth, tenants, config) ✅
- **P1** Wallet & Razorpay
- **P2** Frame engine & image generation
- **P3** Video, admin panel, analytics
- **P4** Capacitor native, hardening

See [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) for full details.
