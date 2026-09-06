import { Router, Request, Response } from 'express';
import { meterUsage } from '../services/metering/meter.service';
import { getTenantById } from '../repositories/tenants.repository';
import { getTenantUsageSummary } from '../repositories/usageEvents.repository';
import { getPlanById } from '../repositories/plans.repository';
import { log } from '../config';

const router = Router();

router.post('/api/generate', async (req: Request, res: Response) => {
  try {
    const idempotencyKey = req.headers['idempotency-key'] as string;
    
    if (!idempotencyKey) {
      return res.status(400).json({
        error: 'Missing Idempotency-Key header',
        message: 'All billable requests must include an Idempotency-Key header',
      });
    }
    
    const { tenant_id, usage_type, quantity, token_breakdown } = req.body;
    
    if (!tenant_id) {
      return res.status(400).json({ error: 'Missing tenant_id' });
    }
    
    if (!usage_type || !['api_call', 'ai_token'].includes(usage_type)) {
      return res.status(400).json({
        error: 'Invalid usage_type',
        message: 'usage_type must be "api_call" or "ai_token"',
      });
    }
    
    if (!quantity || quantity < 1) {
      return res.status(400).json({
        error: 'Invalid quantity',
        message: 'quantity must be a positive integer',
      });
    }
    
    if (usage_type === 'ai_token' && !token_breakdown) {
      return res.status(400).json({
        error: 'Missing token_breakdown',
        message: 'AI token usage requires token_breakdown object',
      });
    }
    
    const result = await meterUsage({
      tenantId: tenant_id,
      usageType: usage_type,
      quantity,
      idempotencyKey: idempotencyKey,
      tokenBreakdown: token_breakdown,
    });
    
    if (!result.success) {
      const statusCode = result.status_code || 400;
      return res.status(statusCode).json({
        success: false,
        error: result.message,
        idempotent: result.idempotent || false,
      });
    }
    
    return res.status(200).json({
      success: true,
      idempotent: result.idempotent || false,
      event: result.event,
      cost: result.cost || 0,
      message: result.message,
    });
  } catch (error: any) {
    log('error', 'Error in /api/generate', { error: error.message });
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
});

router.get('/api/usage/:tenantId', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    
    const tenant = await getTenantById(tenantId);
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }
    
    const plan = tenant.plan_id ? await getPlanById(tenant.plan_id) : null;
    
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    
    const usage = await getTenantUsageSummary(tenantId, monthStart, monthEnd);
    
    res.json({
      tenant_id: tenantId,
      tenant_name: tenant.name,
      plan: plan ? plan.name : 'No plan',
      period: {
        start: monthStart.toISOString(),
        end: monthEnd.toISOString(),
      },
      usage: {
        api_calls: {
          used: usage.api_calls,
          limit: plan ? plan.monthly_api_call_limit : 0,
          remaining: plan ? Math.max(0, plan.monthly_api_call_limit - usage.api_calls) : 0,
        },
        ai_tokens: {
          used: usage.ai_tokens,
          limit: plan ? plan.monthly_token_limit : 0,
          remaining: plan ? Math.max(0, plan.monthly_token_limit - usage.ai_tokens) : 0,
        },
        total_cost: usage.total_cost,
      },
      subscription_status: tenant.subscription_status,
    });
  } catch (error: any) {
    log('error', 'Error in /api/usage', { error: error.message });
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
});

export default router;
