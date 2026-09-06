import { query, queryOne } from '../db/client';
import { log } from '../config';

export interface Tenant {
  id: string;
  name: string;
  email: string;
  stripe_customer_id?: string;
  plan_id?: string;
  subscription_status?: 'active' | 'past_due' | 'canceled' | 'trialing';
  created_at: Date;
  updated_at: Date;
}

export async function createTenant(
  name: string,
  email: string,
  planId?: string
): Promise<Tenant> {
  const rows = await query<Tenant>(
    `INSERT INTO tenants (name, email, plan_id, subscription_status)
     VALUES ($1, $2, $3, 'active')
     RETURNING *`,
    [name, email, planId]
  );
  return rows[0];
}

export async function getTenantById(id: string): Promise<Tenant | null> {
  return await queryOne<Tenant>('SELECT * FROM tenants WHERE id = $1', [id]);
}

export async function getTenantByStripeCustomerId(
  stripeCustomerId: string
): Promise<Tenant | null> {
  return await queryOne<Tenant>(
    'SELECT * FROM tenants WHERE stripe_customer_id = $1',
    [stripeCustomerId]
  );
}

export async function updateTenantPlan(
  tenantId: string,
  planId: string,
  subscriptionStatus: string
): Promise<Tenant | null> {
  const rows = await query<Tenant>(
    `UPDATE tenants 
     SET plan_id = $1, subscription_status = $2, updated_at = NOW()
     WHERE id = $3
     RETURNING *`,
    [planId, subscriptionStatus, tenantId]
  );
  return rows[0] || null;
}

export async function updateTenantStripeCustomerId(
  tenantId: string,
  stripeCustomerId: string
): Promise<Tenant | null> {
  const rows = await query<Tenant>(
    `UPDATE tenants 
     SET stripe_customer_id = $1, updated_at = NOW()
     WHERE id = $2
     RETURNING *`,
    [stripeCustomerId, tenantId]
  );
  return rows[0] || null;
}

export async function getAllTenants(): Promise<Tenant[]> {
  return await query<Tenant>('SELECT * FROM tenants ORDER BY created_at DESC');
}
