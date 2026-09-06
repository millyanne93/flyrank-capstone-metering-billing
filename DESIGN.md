# Design Doc — Usage Metering & Billing Engine

## 1. Problem

Every tenant on a plan needs three questions answered correctly: how much have they
used, what does it cost, and have they hit their limit? This system meters billable
actions, enforces plan quotas at an exact boundary, calculates cost using real-world
AI token pricing rules (cached input tokens are cheaper, reasoning tokens count as
output), and keeps a tenant's plan in sync with Stripe through signature-verified,
deduplicated webhooks.

**The core discipline:** correctness under retry and correctness at the boundary
matter more than feature breadth. A usage-metering endpoint that's called twice
(client retry, network blip) must record the event exactly once. A tenant sitting at
exactly their quota limit must get a precise, documented, testable answer — not
"probably fine" behavior that happens to work in the demo.

## 2. Non-goal

**No overage billing — hitting the limit hard-blocks, no pay-as-you-go beyond quota.**
Once a tenant's usage would exceed their plan's limit, the request is rejected
(429/402); there is no mechanism to let usage continue past the limit at an
additional per-unit charge. Overage billing and proration are both listed as
separate stretch goals in the brief — declaring this now protects build time for
idempotent metering and boundary-exact quota math, which are what's actually graded
hardest in core scope.

## 3. Plans and quotas

| Plan | API calls / month | AI tokens / month |
|---|---|---|
| Free | 1,000 | 100,000 |
| Pro | 10,000 | 1,000,000 |

Quotas are stored as plain integer columns on the `plans` table, not hardcoded in
application logic — a plan's limits should be a data change, not a code change.

## 4. Data model

### `tenants`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `name` | text | |
| `stripe_customer_id` | text, nullable, unique | set once Checkout completes |
| `plan_id` | uuid, FK -> plans | |
| `subscription_status` | enum: active, past_due, canceled | mirrors Stripe, updated only by verified webhooks |
| `created_at` | timestamptz | |

### `plans`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `name` | text, unique | free, pro |
| `monthly_api_call_limit` | int | |
| `monthly_token_limit` | int | |
| `stripe_price_id` | text, nullable | null for free; set for pro once created in the Stripe dashboard |

### `usage_events` — the metering ledger
| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `tenant_id` | uuid, FK -> tenants, indexed | |
| `idempotency_key` | text, unique | client-supplied, from the Idempotency-Key header — see Section 6 |
| `usage_type` | enum: api_call, ai_tokens | |
| `quantity` | int | for api_call, always 1; for ai_tokens, the token count |
| `token_breakdown` | jsonb, nullable | populated only for ai_tokens — see Section 7 for the exact shape |
| `created_at` | timestamptz | |

> Why idempotency_key is unique at the database level, not just checked in
> application code: this is the entire mechanism behind Probe 1. A retried request
> with the same key attempts to INSERT a second row with a key that already
> exists — the INSERT fails on the constraint, and the handler catches that
> specific failure to return the original event's result rather than creating a
> new one. See Section 6 for the full request sequence.

### `webhook_events` — the Stripe deduplication ledger
| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `stripe_event_id` | text, unique | Stripe's own event id, e.g. evt_1N... |
| `event_type` | text | checkout.session.completed, etc. |
| `processed_at` | timestamptz | |

> Same mechanism as usage_events, applied to webhooks. Stripe explicitly warns
> that webhooks can be delivered more than once for the same event — this table's
> unique constraint on stripe_event_id is what makes "replay a real event twice ->
> processed once" (Probe 4) a database guarantee, not a hope.

### Indexes worth calling out
- usage_events(idempotency_key) — unique, enforces exactly-once metering
- usage_events(tenant_id, usage_type, created_at) — the rollup query's main index; every GET /usage call filters and sums along exactly these columns
- webhook_events(stripe_event_id) — unique, enforces exactly-once webhook processing
- tenants(stripe_customer_id) — unique, lookup path when a webhook arrives

## 5. API surface

| Method | Route | Purpose |
|---|---|---|
| POST | /api/generate | The one dummy billable endpoint — meters usage, checks quota, returns cost |
| GET | /api/usage | Current month's rollup: used, limit, cost, per usage type |
| POST | /api/checkout | Creates a Stripe Checkout session for the Pro plan |
| POST | /api/webhooks/stripe | Receives and verifies Stripe webhook events |

### 5a. The dummy billable endpoint

```
POST /api/generate
Idempotency-Key: 3f29a1c4-...
Content-Type: application/json

{ "input_tokens": 500, "cached_input_tokens": 200, "output_tokens": 150, "reasoning_tokens": 50 }
```

Simulates an AI call — no real model is invoked, per the brief's own scope note.
Returns the computed cost and the resulting usage event, or the quota-exceeded error
if the request would breach the tenant's limit.

## 6. Idempotent metering — the core mechanism

**Key source:** the client supplies an Idempotency-Key header, following Stripe's
own convention (chosen deliberately, since the brief explicitly points at Stripe's
idempotent-request pattern as the reference implementation). The server never
generates this key itself — a client-supplied key is what allows a client's own
retry logic to guarantee "this exact logical request, retried, maps to the same
key," which a server-derived hash of the request body cannot guarantee (two
genuinely different requests could hash identically depending on what's hashed, and
a client can't control that).

**The request sequence:**
```
1. Client sends POST /api/generate with an Idempotency-Key header
2. Server checks: does a usage_events row already exist with this idempotency_key?
     - EXISTS -> this is a retry. Return the ORIGINAL response (same cost, same
       event id) with the same status code as the first time. Do not re-check
       quota, do not create a new row. The retry is invisible to the tenant's usage.
     - DOES NOT EXIST -> continue to step 3
3. Compute the requested usage (tokens or 1 API call) and cost
4. Check quota (Section 8): would this request push the tenant over their limit?
     - YES -> return 429/402, do NOT insert a usage_events row (a rejected request
       was never "used," so it must not be metered)
     - NO -> continue to step 5
5. INSERT INTO usage_events (..., idempotency_key, ...)
     - If this INSERT fails on the unique constraint, another concurrent request
       with the same key won the race. Fall back to step 2's "return original"
       behavior rather than erroring.
6. Return 200 with the cost and event details
```

**Why step 2 must run before step 4 (quota), not after:** if quota were checked
first and idempotency second, a retried request that happens to arrive after the
tenant's usage changed (a different, unrelated request pushed them over quota in
between) could get a different answer on the retry than the original — an
idempotent operation must return the same result every time, not just avoid
double-counting.

## 7. Cost calculation — AI token pricing

Token categories do not simply add together. The pinned rule set:

```
billable_input_tokens  = input_tokens (fresh, uncached)
billable_cached_tokens = cached_input_tokens          (priced lower than fresh input)
billable_output_tokens = output_tokens + reasoning_tokens   (reasoning bills as output)

total_cost = (billable_input_tokens  * PRICE_INPUT_PER_TOKEN)
           + (billable_cached_tokens * PRICE_CACHED_INPUT_PER_TOKEN)
           + (billable_output_tokens * PRICE_OUTPUT_PER_TOKEN)
```

Pricing constants are pinned in config (not hardcoded inline in the calculation
function), so EVIDENCE.md can show a worked example against a fixed, citable rate
card:

```json
{
  "PRICE_INPUT_PER_TOKEN": 0.000003,
  "PRICE_CACHED_INPUT_PER_TOKEN": 0.00000075,
  "PRICE_OUTPUT_PER_TOKEN": 0.000015
}
```

> Why reasoning_tokens folds into billable_output_tokens instead of getting
> its own line: per the brief's own framing, reasoning tokens are "hidden
> thinking" tokens some models produce — they are not a separate free category, and
> a calculator that gives them a $0 rate or a separate under-priced bucket would
> silently undercharge. Folding them into the output bucket at the output rate is
> the conservative, correct default absent a model-specific reasoning-token rate.

The full breakdown (all four raw quantities plus the three billable buckets) is
stored in usage_events.token_breakdown so GET /usage and EVIDENCE.md can show
the actual math, not just a final number.

## 8. Quota enforcement — boundary rule

**The exact rule:** a request is allowed if and only if
current_month_usage + requested_usage <= plan_limit. A request that would make
the total exceed the limit is rejected — including that a request landing exactly
on the limit is allowed (equal to, not exceeding, the limit).

Worked boundary example: a Free-plan tenant has used 999 of 1,000 API calls.
- A single-call request (999 + 1 = 1,000 <= 1,000) -> allowed, and this is the
  request that brings them to exactly their limit
- The next request after that (1,000 + 1 = 1,001 > 1,000) -> rejected, 429

**Status code choice:** 429 Too Many Requests for usage-quota exhaustion on an
active plan (the brief's own framing: "you've exceeded your usage limit"). 402
Payment Required is reserved for a distinct case — a subscription_status of
past_due or canceled, i.e. "your plan itself isn't in good standing," not merely
"you used up this month's allowance." Both responses include a message naming which
condition triggered them, since "a machine reads the status code, a human reads the
message" is the standard this brief holds responses to.

## 9. Stripe integration

**Checkout flow:** POST /api/checkout creates a Stripe Checkout Session for the
pro plan's stripe_price_id, in test mode, and returns the session URL for the
client to redirect to. No plan change happens at this point — the tenant's plan
only changes once a verified webhook confirms it (Section 10).

**Webhooks handled:**
- checkout.session.completed -> set tenants.plan_id to pro, subscription_status = 'active'
- customer.subscription.updated -> sync subscription_status from Stripe's status field
- customer.subscription.deleted -> set subscription_status = 'canceled', revert plan_id to free

## 10. Webhook verification and deduplication

```
1. Receive POST /api/webhooks/stripe with the raw request body and the
   Stripe-Signature header
2. Verify the signature against STRIPE_WEBHOOK_SECRET using Stripe's SDK helper,
   against the RAW (unparsed) body — not the JSON-parsed body, which will not
   match the signature
3. Signature invalid -> 400, do not process, do not touch the database
4. Signature valid -> check webhook_events for this event's stripe_event_id
     - EXISTS -> already processed. Return 200 (Stripe expects 2xx to stop
       retrying) but perform no state change.
     - DOES NOT EXIST -> INSERT the event id, then apply the plan/status update
       for this event type (Section 9)
```

> Why the raw body matters: this is a common, specific failure mode worth
> calling out in the doc rather than discovering it mid-implementation — most web
> frameworks parse the request body into JSON before your handler ever sees it, but
> Stripe's signature is computed over the exact raw bytes sent. If the framework's
> body-parsing middleware runs before the webhook route, verification will fail
> against a syntactically-valid, genuinely-from-Stripe request. The webhook route
> needs raw-body access configured specifically for that one path.

## 11. What success looks like

| Test | Expected result |
|---|---|
| Send the same POST /api/generate request twice with one Idempotency-Key | Exactly one usage_events row; both responses identical |
| Drive a tenant to exactly 1,000/1,000 API calls, then send one more | The 1,000th call succeeds; the 1,001st returns 429 with a message naming the quota |
| Complete a Stripe test Checkout | Webhook fires, tenant's plan_id flips to pro, GET /usage reflects the new 10,000/1,000,000 limits |
| Send a webhook with a forged/bad signature | 400, no database change |
| Replay a real webhook event twice (stripe trigger or manual resend) | Processed once; second delivery is a no-op 200 |
| Check GET /usage against a worked token-pricing example | Total cost matches the pinned pricing constants exactly, including cached-input and reasoning-token handling |

## 12. Open questions / decisions made

| Question | Decision |
|---|---|
| What happens to usage_events if quota is exceeded? | No row is inserted — a rejected request was never actually "used," so metering it would overcount against a tenant who was correctly blocked. |
| Why allow a request that lands exactly on the limit, rather than blocking it? | "Exceeds" is the documented trigger condition, not "reaches." A tenant with a 1,000-call limit is entitled to use all 1,000 — blocking the 1,000th call would silently give them only 999, which contradicts the plan's own stated limit. |
| What distinguishes 429 from 402? | 429 = usage exhausted on an otherwise-good plan. 402 = the subscription itself is not active (past_due/canceled). These are different failures and should not share a status code. |
| Why is token_breakdown stored per-event instead of only the final cost? | EVIDENCE.md needs to show the pricing math actually happened correctly, not just assert a plausible-looking total. Storing the raw + billable breakdown makes every cost figure independently checkable. |
| Why simulate AI tokens instead of calling a real model? | The brief explicitly scopes this out — "you're metering numbers, not calling a model." Simulated token counts exercise every pricing/quota rule without needing an API key or incurring any AI cost at all. |

## 13. Layering

```
routes/          — HTTP only: parse request, call service, map result to status code
services/
  metering/        — the idempotent record-usage sequence (Section 6), no SQL
  quota/            — the boundary check (Section 8), pure function given usage + limit
  pricing/          — the token cost calculation (Section 7), pure function, pinned constants
  stripe/           — checkout session creation, webhook signature verification + dispatch
repositories/     — all SQL lives here
```

quota/ and pricing/ are both pure functions with no database or HTTP
dependency — exactly the kind of logic that should have fast, isolated unit tests
proving the boundary and the token math independently of the rest of the system,
since Probes 2 and 5 are precision checks that don't need a full request cycle to
verify.

## 14. Flow diagram

```
┌────────────┐
│   Client   │
└─────┬──────┘
      │ POST /api/generate + Idempotency-Key
      ▼
┌─────────────────────┐    key exists?     ┌──────────────────────┐
│  Metering service    │────────yes────────▶│  Return original     │
│  (check key first)   │                    │  response, no new    │
└──────────┬───────────┘                    │  usage_events row    │
           │ no                             └──────────────────────┘
           ▼
┌─────────────────────┐   exceeds limit?   ┌──────────────────────┐
│   Quota check        │─────────yes───────▶│  429 / 402 + reason  │
│  (Section 8 rule)     │                   │  no row inserted     │
└──────────┬───────────┘                    └──────────────────────┘
           │ no
           ▼
┌─────────────────────┐
│  Pricing calc         │
│  (Section 7 rules)     │
└──────────┬───────────┘
           │
           ▼
┌─────────────────────┐
│  INSERT usage_event    │
│  (idempotency_key       │
│   UNIQUE constraint)    │
└──────────┬───────────┘
           │
           ▼
┌─────────────────────┐
│  200 + cost + event    │
└─────────────────────┘


┌────────────┐
│   Stripe   │
└─────┬──────┘
      │ signed webhook event
      ▼
┌─────────────────────┐   bad signature?   ┌──────────────────────┐
│  Verify signature      │────────yes───────▶│  400, no DB change   │
│  (raw body!)            │                  └──────────────────────┘
└──────────┬───────────┘
           │ valid
           ▼
┌─────────────────────┐   event id seen?   ┌──────────────────────┐
│  webhook_events         │────────yes──────▶│  200, no-op          │
│  dedup check             │                 └──────────────────────┘
└──────────┬───────────┘
           │ new
           ▼
┌─────────────────────┐
│  Update tenant plan /   │
│  subscription_status     │
└─────────────────────┘
```
