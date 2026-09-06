CREATE TABLE IF NOT EXISTS plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    monthly_api_call_limit INTEGER NOT NULL,
    monthly_token_limit INTEGER NOT NULL,
    stripe_price_id TEXT UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_plans_name ON plans(name);
CREATE INDEX idx_plans_stripe_price_id ON plans(stripe_price_id);
