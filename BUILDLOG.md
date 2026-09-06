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

---

## AI Usage Summary (Phase 1-2)

| Metric | Value |
|--------|-------|
| Total AI-assisted files | 15+ |
| AI code generation % | ~65% |
| Manual fixes/adaptations | ~35% |
| Bugs introduced by AI | 3 |
| Bugs caught by human review | 3 |
| Bugs in production | 0 |

---
