CREATE TABLE IF NOT EXISTS usage_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    usage_type TEXT NOT NULL CHECK (usage_type IN ('api_call', 'ai_token')),
    quantity INTEGER NOT NULL,
    idempotency_key TEXT NOT NULL UNIQUE,
    token_breakdown JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_usage_events_tenant_id ON usage_events(tenant_id);
CREATE INDEX idx_usage_events_tenant_type ON usage_events(tenant_id, usage_type);
CREATE INDEX idx_usage_events_created_at ON usage_events(created_at);
CREATE INDEX idx_usage_events_idempotency_key ON usage_events(idempotency_key);
