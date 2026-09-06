import { query, closePool } from '../db/client';
import { log } from '../config';

async function seedPlans() {
  log('info', 'Seeding plans...');
  
  const plans = [
    {
      name: 'free',
      description: 'Free plan with basic limits',
      monthly_api_call_limit: 1000,
      monthly_token_limit: 100000,
      stripe_price_id: null,
    },
    {
      name: 'pro',
      description: 'Pro plan with higher limits',
      monthly_api_call_limit: 10000,
      monthly_token_limit: 1000000,
      stripe_price_id: process.env.STRIPE_PRO_PRICE_ID || null,
    },
  ];
  
  for (const plan of plans) {
    const existing = await query(
      'SELECT id FROM plans WHERE name = $1',
      [plan.name]
    );
    
    if (existing.length > 0) {
      log('info', ` Plan ${plan.name} already exists, skipping`);
      continue;
    }
    
    await query(
      `INSERT INTO plans 
       (name, description, monthly_api_call_limit, monthly_token_limit, stripe_price_id) 
       VALUES ($1, $2, $3, $4, $5)`,
      [
        plan.name,
        plan.description,
        plan.monthly_api_call_limit,
        plan.monthly_token_limit,
        plan.stripe_price_id,
      ]
    );
    
    log('info', `Created plan: ${plan.name}`);
  }
  
  log('info', 'Seeding complete');
  await closePool();
}

if (require.main === module) {
  seedPlans().catch((error) => {
    console.error('Seeding failed:', error);
    process.exit(1);
  });
}

export { seedPlans };
