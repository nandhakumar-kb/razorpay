import { FailureCause } from './classifier';

export type Action = 'create_payment_link' | 'trigger_mandate_retry' | 'escalate' | 'none';

interface StrategyContext {
  cause: FailureCause;
  retryCount: number;
  paymentType: string;
  amount: number;
}

export function determineAction(context: StrategyContext): Action {
  // Hard limits
  if (context.retryCount >= 3) {
    return 'escalate'; // Max retries exceeded
  }
  
  if (context.cause === 'fraud_suspected') {
    return 'escalate'; // Always escalate suspected fraud
  }

  // Strategy Table
  if (context.paymentType === 'subscription') {
    if (context.cause === 'insufficient_funds' || context.cause === 'bank_offline') {
      // It's a mandate, retrying makes sense, maybe in a few days, but for now we trigger it.
      return 'trigger_mandate_retry';
    }
    
    if (context.cause === 'invalid_card') {
      // Can't auto-retry an invalid card mandate reliably, need user to update payment method
      return 'create_payment_link';
    }
  }

  if (context.paymentType === 'one_time') {
    if (context.cause === 'insufficient_funds' || context.cause === 'invalid_card') {
      // Must prompt user for new payment method
      return 'create_payment_link';
    }
    
    if (context.cause === 'gateway_timeout' || context.cause === 'bank_offline') {
      // Could potentially auto-retry, but for one-time, creating a link is safer
      return 'create_payment_link';
    }
  }

  return 'escalate'; // Fallback
}
