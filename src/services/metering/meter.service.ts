import { createUsageEvent, getUsageEventByIdempotencyKey } from '../../repositories/usageEvents.repository';
import { getTenantById } from '../../repositories/tenants.repository';
import { getPlanById } from '../../repositories/plans.repository';
import { getTenantUsageSummary } from '../../repositories/usageEvents.repository';
import { checkQuota, checkSubscriptionStatus } from '../quota/quota.service';
import { calculateTokenCost, calculateApiCallCost, TokenBreakdown } from '../pricing/pricing.service';
import { log } from '../../config';

export interface MeterRequest {
  tenantId: string;
  usageType: 'api_call' | 'ai_token';
  quantity: number;
  idempotencyKey: string;
  tokenBreakdown?: TokenBreakdown;
}

export interface MeterResult {
  success: boolean;
  event?: any;
  idempotent?: boolean;
  message?: string;
  status_code?: number;
  cost?: number;
}

export async function meterUsage(request: MeterRequest): Promise<MeterResult> {
  log('debug', 'Metering request', { 
    tenantId: request.tenantId,
    usageType: request.usageType,
    quantity: request.quantity,
    idempotencyKey: request.idempotencyKey 
  });

  const existingEvent = await getUsageEventByIdempotencyKey(request.idempotencyKey);
  if (existingEvent) {
    log('info', 'Idempotent request detected - returning original', { idempotencyKey: request.idempotencyKey });
    return {
      success: true,
      event: existingEvent,
      idempotent: true,
      message: 'Event already recorded (idempotent retry)',
    };
  }

  const tenant = await getTenantById(request.tenantId);
  if (!tenant) {
    return {
      success: false,
      message: 'Tenant not found',
      status_code: 404,
    };
  }

  if (!tenant.plan_id) {
    return {
      success: false,
      message: 'Tenant has no plan assigned',
      status_code: 400,
    };
  }

  const plan = await getPlanById(tenant.plan_id);
  if (!plan) {
    return {
      success: false,
      message: 'Plan not found',
      status_code: 404,
    };
  }

  const subscriptionCheck = checkSubscriptionStatus(tenant.subscription_status);
  if (!subscriptionCheck.allowed) {
    log('warn', 'Subscription not active', { 
      tenantId: request.tenantId, 
      status: tenant.subscription_status 
    });
    return {
      success: false,
      message: subscriptionCheck.message,
      status_code: subscriptionCheck.status_code,
    };
  }

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const usageSummary = await getTenantUsageSummary(request.tenantId, monthStart, monthEnd);
  
  let currentUsage: number;
  let limit: number;
  
  if (request.usageType === 'api_call') {
    currentUsage = usageSummary.api_calls;
    limit = plan.monthly_api_call_limit;
  } else {
    currentUsage = usageSummary.ai_tokens;
    limit = plan.monthly_token_limit;
  }

  const quotaCheck = checkQuota(
    currentUsage,
    request.quantity,
    limit,
    plan.name
  );

  if (!quotaCheck.allowed) {
    log('warn', 'Quota exceeded', {
      tenantId: request.tenantId,
      usageType: request.usageType,
      currentUsage,
      limit,
    });
    return {
      success: false,
      message: quotaCheck.message,
      status_code: quotaCheck.status_code,
    };
  }

  let cost = 0;
  let tokenBreakdown = null;

  if (request.usageType === 'ai_token' && request.tokenBreakdown) {
    const pricingResult = calculateTokenCost(request.tokenBreakdown);
    cost = pricingResult.total_cost;
    tokenBreakdown = {
      input_tokens: request.tokenBreakdown.input_tokens,
      cached_input_tokens: request.tokenBreakdown.cached_input_tokens,
      output_tokens: request.tokenBreakdown.output_tokens,
      reasoning_tokens: request.tokenBreakdown.reasoning_tokens,
      billable_input_tokens: pricingResult.billable_input_tokens,
      billable_cached_tokens: pricingResult.billable_cached_tokens,
      billable_output_tokens: pricingResult.billable_output_tokens,
    };
  } else {
    cost = calculateApiCallCost();
  }

  try {
    const event = await createUsageEvent(
      request.tenantId,
      request.usageType,
      request.quantity,
      request.idempotencyKey,
      tokenBreakdown
    );

    log('info', 'Usage recorded', {
      eventId: event.id,
      tenantId: request.tenantId,
      usageType: request.usageType,
      quantity: request.quantity,
      cost,
    });

    return {
      success: true,
      event,
      cost,
      message: 'Usage recorded successfully',
    };
  } catch (error: any) {
    if (error.code === '23505') {
      const existing = await getUsageEventByIdempotencyKey(request.idempotencyKey);
      if (existing) {
        log('info', 'Concurrent request won - returning original', { idempotencyKey: request.idempotencyKey });
        return {
          success: true,
          event: existing,
          idempotent: true,
          message: 'Event already recorded (concurrent retry)',
        };
      }
    }
    
    log('error', 'Failed to create usage event', { error: error.message });
    throw error;
  }
}
