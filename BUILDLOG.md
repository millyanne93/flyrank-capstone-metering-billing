# BUILDLOG.md — AI Usage Log

## Phase 1: Design & Setup

### AI Tools Used
- **Tool**: Claude (via web interface)
- **Purpose**: Architecture design, data modeling, Stripe configuration
- **Frequency**: Heavy usage during Phase 1

### Where AI Helped

| File/Component | What AI Provided | My Changes |
|----------------|------------------|------------|
| DESIGN.md | Complete architecture design | Refined non-goals, added webhook_events table |
| Data model | 4 tables with relationships | Added token_breakdown JSONB |
| Stripe Setup | Test mode configuration guide | Added Price ID to .env |

### Where AI Got It Wrong

| Issue | What Happened | How I Fixed It |
|-------|---------------|----------------|
| uuid_generate_v4() | Postgres didn't have the extension | Used gen_random_uuid() instead |
| Stripe country selection | Kenya not available | Selected US for test mode |
| brew command | Not available on Linux | Used curl install script for Stripe CLI |

### Lessons Learned
1. **Postgres UUID generation** - Use `gen_random_uuid()` (no extension needed)
2. **Stripe test mode** - Accessible globally, no business verification needed
3. **Stripe CLI on Linux** - Use curl install script, not brew

---

## Phase 2: Core Billing Logic

### AI Tools Used
- **Tool**: Claude (via web interface)
- **Purpose**: Repository creation, service layer, route implementation
- **Frequency**: Heavy usage during Phase 2

### Where AI Helped

| File/Component | What AI Provided | My Changes |
|----------------|------------------|------------|
| repositories/ | All 4 repository files | Added getTenantUsageSummary |
| pricing.service.ts | Token pricing logic | Added billable buckets |
| quota.service.ts | Boundary checks | Added subscription status check |
| meter.service.ts | Idempotent metering | Added concurrent request handling |
| usage.routes.ts | API endpoints | Added error handling |

### Where AI Got It Wrong

| Issue | What Happened | How I Fixed It |
|-------|---------------|----------------|
| Tenant subscription_status | Set to null by default | Updated to default 'active' |
| Cost precision | Floating point issue | Left as is for demonstration |
| Webhook secret context | Initial context was live | Switched to sandbox context |

### Lessons Learned
1. **Subscription status must be set** - Default to 'active' for tenants
2. **Idempotency check before quota** - Retry must return same result
3. **Stripe CLI context** - Must switch to sandbox mode

### Phase 2 Status

| Feature | Status | Evidence |
|---------|--------|----------|
| Migrations | ✅ PASS | 4 tables created |
| Repositories | ✅ PASS | CRUD operations work |
| Pricing | ✅ PASS | $0.002475 cost calculated |
| Quota | ✅ PASS | Limits enforced |
| Metering | ✅ PASS | Idempotent recording |
| Routes | ✅ PASS | /api/generate and /api/usage |

## Phase 3: Stripe Integration

### AI Tools Used
- **Tool**: Claude (via web interface)
- **Purpose**: Stripe Checkout implementation, webhook handler, signature verification
- **Frequency**: Heavy usage during Phase 3 implementation

### Where AI Helped

| File/Component | What AI Provided | My Changes |
|----------------|------------------|------------|
| stripe.service.ts | Checkout session creation | Added tenant metadata |
| webhook.handler.ts | Webhook processing logic | Added raw body handling |
| subscription.routes.ts | /api/checkout endpoint | Added validation |

### Where AI Got It Wrong

| Issue | What Happened | How I Fixed It |
|-------|---------------|----------------|
| Webhook signature | Verification failed | Used express.raw() BEFORE express.json() |
| Webhook secret mismatch | CLI secret kept changing | Used permanent secret from Dashboard |
| Raw body not string | Buffer was breaking verification | Converted Buffer to string first |
| Wrong Stripe account | Price not found in account | Switched to correct account context |

### Lessons Learned
1. **express.raw() must come BEFORE express.json()** - Middleware order matters
2. **Webhook secret can be permanent** - Use Dashboard for consistent testing
3. **Stripe CLI context must match account** - Check with `stripe status`
4. **Raw body must be a string** - Convert Buffer with `.toString('utf8')`

### Phase 3 Status

| Feature | Status | Evidence |
|---------|--------|----------|
| Checkout Session | ✅ Working | Created successfully |
| Webhook Handler | ✅ Working | Events processed |
| Signature Verification | ✅ Working | No more errors |
| Tenant Upgrade | ✅ Working | `plan: "pro"` |
| Subscription Sync | ✅ Working | Status updated |

---

## AI Usage Summary (Phase 1-3)

| Metric | Value |
|--------|-------|
| Total AI-assisted files | 20+ |
| AI code generation % | ~65% |
| Manual fixes/adaptations | ~35% |
| Bugs introduced by AI | 4 |
| Bugs caught by human review | 4 |
| Bugs in production | 0 |

---
