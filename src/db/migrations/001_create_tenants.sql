CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    stripe_customer_id TEXT UNIQUE,
    plan_id UUID,
    subscription_status TEXT CHECK (subscription_status IN ('active', 'past_due', 'canceled', 'trialing')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tenants_stripe_customer_id ON tenants(stripe_customer_id);
CREATE INDEX idx_tenants_plan_id ON tenants(plan_id);
