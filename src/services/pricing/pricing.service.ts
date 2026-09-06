import { config } from '../../config';

export interface TokenBreakdown {
  input_tokens: number;
  cached_input_tokens: number;
  output_tokens: number;
  reasoning_tokens: number;
}

export interface PricingResult {
  billable_input_tokens: number;
  billable_cached_tokens: number;
  billable_output_tokens: number;
  total_cost: number;
  breakdown: TokenBreakdown;
}

export function calculateTokenCost(breakdown: TokenBreakdown): PricingResult {
  const { input_tokens, cached_input_tokens, output_tokens, reasoning_tokens } = breakdown;
  
  const billable_input_tokens = input_tokens;
  const billable_cached_tokens = cached_input_tokens;
  const billable_output_tokens = output_tokens + reasoning_tokens;
  
  const input_cost = billable_input_tokens * config.pricing.PRICE_INPUT_PER_TOKEN;
  const cached_cost = billable_cached_tokens * config.pricing.PRICE_CACHED_INPUT_PER_TOKEN;
  const output_cost = billable_output_tokens * config.pricing.PRICE_OUTPUT_PER_TOKEN;
  
  const total_cost = input_cost + cached_cost + output_cost;
  
  return {
    billable_input_tokens,
    billable_cached_tokens,
    billable_output_tokens,
    total_cost,
    breakdown,
  };
}

export function calculateApiCallCost(): number {
  return 0; 
}
