import { query, queryOne } from '../db/client';

export interface Plan {
  id: string;
  name: string;
  description?: string;
  monthly_api_call_limit: number;
  monthly_token_limit: number;
  stripe_price_id?: string;
  created_at: Date;
  updated_at: Date;
}

export async function getPlanById(id: string): Promise<Plan | null> {
  return await queryOne<Plan>('SELECT * FROM plans WHERE id = $1', [id]);
}

export async function getPlanByName(name: string): Promise<Plan | null> {
  return await queryOne<Plan>('SELECT * FROM plans WHERE name = $1', [name]);
}

export async function getPlanByStripePriceId(
  stripePriceId: string
): Promise<Plan | null> {
  return await queryOne<Plan>(
    'SELECT * FROM plans WHERE stripe_price_id = $1',
    [stripePriceId]
  );
}

export async function getAllPlans(): Promise<Plan[]> {
  return await query<Plan>('SELECT * FROM plans ORDER BY monthly_api_call_limit ASC');
}

export async function getFreePlan(): Promise<Plan | null> {
  return await getPlanByName('free');
}

export async function getProPlan(): Promise<Plan | null> {
  return await getPlanByName('pro');
}
