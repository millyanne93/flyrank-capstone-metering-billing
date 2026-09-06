import { Router, Request, Response } from 'express';
import { createCheckoutSession } from '../services/stripe/stripe.service';
import { getTenantById } from '../repositories/tenants.repository';
import { getPlanByName } from '../repositories/plans.repository';
import { log } from '../config';

const router = Router();

router.post('/api/checkout', async (req: Request, res: Response) => {
  try {
    const { tenant_id, success_url, cancel_url } = req.body;
    
    if (!tenant_id) {
      return res.status(400).json({ error: 'Missing tenant_id' });
    }
    
    if (!success_url) {
      return res.status(400).json({ error: 'Missing success_url' });
    }
    
    if (!cancel_url) {
      return res.status(400).json({ error: 'Missing cancel_url' });
    }
    
    const tenant = await getTenantById(tenant_id);
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }
    
    const proPlan = await getPlanByName('pro');
    if (!proPlan) {
      return res.status(500).json({ error: 'Pro plan not found' });
    }
    
    if (tenant.plan_id === proPlan.id) {
      return res.status(400).json({ 
        error: 'Already on Pro plan',
        message: 'This tenant is already subscribed to the Pro plan',
      });
    }
    
    const result = await createCheckoutSession(
      tenant_id,
      tenant.email,
      success_url,
      cancel_url
    );
    
    res.json({
      success: true,
      session_id: result.sessionId,
      url: result.url,
      message: 'Checkout session created successfully',
    });
  } catch (error: any) {
    log('error', 'Error in /api/checkout', { error: error.message });
    res.status(500).json({
      error: 'Failed to create Checkout session',
      message: error.message,
    });
  }
});

export default router;
