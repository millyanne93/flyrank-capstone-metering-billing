# Usage Metering & Billing Engine — FlyRank Capstone

A production-ready usage metering and billing engine with idempotent metering, quota enforcement, and Stripe subscription integration.

## 🎯 Project Overview

Every SaaS product must answer three questions:
1. **How much has this customer used?** (metering)
2. **What does it cost?** (pricing)
3. **Have they reached their plan limits?** (quota enforcement)

This engine answers all three with idempotent metering, token pricing, and Stripe integration.

## 🚀 Features

### Phase 1: Design & Setup ✅
- Complete architecture design
- Stripe test mode configured
- Pro Plan Price ID created
- PostgreSQL with Docker

### Phase 2: Core Billing Logic ✅
- Idempotent usage metering (exactly-once)
- Quota enforcement (429 when exceeded)
- AI token pricing (cached input + reasoning)
- Usage rollup with cost calculation
- Subscription status checks (402 for inactive)

### Phase 3: Stripe Integration ✅
- Checkout session creation
- Webhook signature verification
- Webhook deduplication
- Subscription plan synchronization

### Phase 4: Cost & Finalization ⏳
- Final documentation
- Project completion

## 🛠️ Tech Stack

- **Backend**: Node.js + Express + TypeScript
- **Database**: PostgreSQL (via Docker)
- **Payments**: Stripe (test mode only)
- **Validation**: Schema validation
- **Testing**: curl + bash scripts

## 📦 Quick Start

### Prerequisites
- Node.js (v18+)
- Docker & Docker Compose
- Stripe CLI (for webhook testing)
- Stripe account (test mode)

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/flyrank-capstone-metering-billing.git
cd flyrank-capstone-metering-billing
```
# Install dependencies
npm install

# Start PostgreSQL
docker-compose up -d

# Run migrations
npm run migrate

# Seed plans (Free + Pro)
npm run seed

# Start the server
npm run dev
Environment Variables
Create a .env file:
```bash
env
PORT=3000
NODE_ENV=development
DATABASE_URL=postgresql://postgres:postgres@localhost:5434/metering_billing
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PRO_PRICE_ID=price_...
STRIPE_WEBHOOK_SECRET=whsec_...
LOG_LEVEL=debug
```
## 📡 API Endpoints
```bash
Health Check
Method	Endpoint	Description
GET	/health	Health check
Metering & Usage
Method	Endpoint	Description
POST	/api/generate	Record usage (idempotent)
GET	/api/usage/:tenantId	Get usage summary
Stripe Integration
Method	Endpoint	Description
POST	/api/checkout	Create Stripe Checkout session
POST	/api/webhooks/stripe	Stripe webhook handler
```
## 🧪 Testing
Record an API Call
```bash
curl -X POST http://localhost:3000/api/generate \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: test-key-1" \
  -d '{
    "tenant_id": "11111111-1111-1111-1111-111111111111",
    "usage_type": "api_call",
    "quantity": 1
  }'
Create Checkout Session
bash
curl -X POST http://localhost:3000/api/checkout \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "11111111-1111-1111-1111-111111111111",
    "success_url": "http://localhost:3000/success",
    "cancel_url": "http://localhost:3000/cancel"
  }'

Get Usage Summary
bash
curl http://localhost:3000/api/usage/11111111-1111-1111-1111-111111111111
```
##📊 Database Schema
```bash
Tables
Table	Purpose
tenants	Customer organizations
plans	Subscription plans with quotas
usage_events	Metered usage (idempotent)
webhook_events	Stripe webhook deduplication
Plans
Plan	API Calls / Month	AI Tokens / Month	Price
Free	1,000	100,000	$0
Pro	10,000	1,000,000	$29/month
```

## 🔐 Key Design Decisions
Idempotency via database constraint - idempotency_key UNIQUE

Quota check after idempotency - Retries return same result

Token pricing with cached input - Cached tokens = 75% cheaper

Reasoning tokens = output tokens - No separate free category

Stripe test mode only - No real money ever

## 📈 Phase Status
```bash
Phase	Status	Completion
Phase 1: Design & Setup	✅ Complete	100%
Phase 2: Core Billing Logic	✅ Complete	100%
Phase 3: Stripe Integration	✅ Complete	100%
Phase 4: Cost & Finalization	⏳ Pending	0%
```
## 📝 Documentation
DESIGN.md — Architecture and design decisions

EVIDENCE.md — Definition of Done proof

BUILDLOG.md — AI usage and lessons learned

## 📄 License
MIT

Built with as part of the FlyRank Capstone Program
