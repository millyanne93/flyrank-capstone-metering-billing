import { query, queryOne } from '../db/client';

export interface UsageEvent {
  id: string;
  tenant_id: string;
  usage_type: 'api_call' | 'ai_token';
  quantity: number;
  idempotency_key: string;
  token_breakdown?: {
    input_tokens?: number;
    cached_input_tokens?: number;
    output_tokens?: number;
    reasoning_tokens?: number;
    billable_input_tokens?: number;
    billable_cached_tokens?: number;
    billable_output_tokens?: number;
  };
  created_at: Date;
}

export async function createUsageEvent(
  tenantId: string,
  usageType: 'api_call' | 'ai_token',
  quantity: number,
  idempotencyKey: string,
  tokenBreakdown?: any
): Promise<UsageEvent> {
  const rows = await query<UsageEvent>(
    `INSERT INTO usage_events 
     (tenant_id, usage_type, quantity, idempotency_key, token_breakdown)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [tenantId, usageType, quantity, idempotencyKey, tokenBreakdown]
  );
  return rows[0];
}

export async function getUsageEventByIdempotencyKey(
  idempotencyKey: string
): Promise<UsageEvent | null> {
  return await queryOne<UsageEvent>(
    'SELECT * FROM usage_events WHERE idempotency_key = $1',
    [idempotencyKey]
  );
}

export async function getUsageEventsByTenant(
  tenantId: string,
  startDate?: Date,
  endDate?: Date
): Promise<UsageEvent[]> {
  let queryText = 'SELECT * FROM usage_events WHERE tenant_id = $1';
  const params: any[] = [tenantId];
  let paramIndex = 2;
  
  if (startDate) {
    queryText += ` AND created_at >= $${paramIndex}`;
    params.push(startDate);
    paramIndex++;
  }
  
  if (endDate) {
    queryText += ` AND created_at <= $${paramIndex}`;
    params.push(endDate);
    paramIndex++;
  }
  
  queryText += ' ORDER BY created_at DESC';
  
  return await query<UsageEvent>(queryText, params);
}

export async function getTenantUsageSummary(
  tenantId: string,
  startDate: Date,
  endDate: Date
): Promise<{
  api_calls: number;
  ai_tokens: number;
  total_cost: number;
}> {
  const rows = await query<{
    api_calls: string;
    ai_tokens: string;
    total_cost: string;
  }>(
    `SELECT 
       COALESCE(SUM(CASE WHEN usage_type = 'api_call' THEN quantity ELSE 0 END), 0) as api_calls,
       COALESCE(SUM(CASE WHEN usage_type = 'ai_token' THEN quantity ELSE 0 END), 0) as ai_tokens,
       COALESCE(
         SUM(
           (token_breakdown->>'billable_input_tokens')::numeric * 0.000003 +
           (token_breakdown->>'billable_cached_tokens')::numeric * 0.00000075 +
           (token_breakdown->>'billable_output_tokens')::numeric * 0.000015
         ), 0
       ) as total_cost
     FROM usage_events
     WHERE tenant_id = $1
       AND created_at >= $2
       AND created_at <= $3`,
    [tenantId, startDate, endDate]
  );
  
  return {
    api_calls: parseInt(rows[0]?.api_calls || '0'),
    ai_tokens: parseInt(rows[0]?.ai_tokens || '0'),
    total_cost: parseFloat(rows[0]?.total_cost || '0'),
  };
}
