import { Plan } from '../../repositories/plans.repository';

export interface QuotaCheckResult {
  allowed: boolean;
  current_usage: number;
  limit: number;
  remaining: number;
  requested_quantity: number;
  message?: string;
  status_code?: 429 | 402;
}

export function checkQuota(
  currentUsage: number,
  requestedQuantity: number,
  limit: number,
  planName: string
): QuotaCheckResult {
  const total = currentUsage + requestedQuantity;
  
  if (total <= limit) {
    return {
      allowed: true,
      current_usage: currentUsage,
      limit: limit,
      remaining: limit - total,
      requested_quantity: requestedQuantity,
    };
  }
  
  // Exceeded quota
  const message = `${planName} plan quota exceeded. ` +
    `Current: ${currentUsage}, Requested: ${requestedQuantity}, ` +
    `Limit: ${limit}. Upgrade to Pro for higher limits.`;
  
  return {
    allowed: false,
    current_usage: currentUsage,
    limit: limit,
    remaining: 0,
    requested_quantity: requestedQuantity,
    message,
    status_code: 429,
  };
}

export function checkSubscriptionStatus(
  status?: 'active' | 'past_due' | 'canceled' | 'trialing'
): { allowed: boolean; status_code?: 402; message?: string } {
  if (status === 'active' || status === 'trialing') {
    return { allowed: true };
  }
  
  return {
    allowed: false,
    status_code: 402, 
    message: `Subscription is ${status || 'inactive'}. Please update payment method.`,
  };
}
