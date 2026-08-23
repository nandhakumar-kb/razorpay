import { FailureCause } from './classifier';

export type Action = 'create_payment_link' | 'trigger_mandate_retry' | 'escalate' | 'none';

interface StrategyContext {
  cause: string;
  retryCount: number;
  paymentType: string;
  amount: number;
  eventType: string;
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
  if (context.eventType === 'checkout_abandonment') {
    return 'create_payment_link'; // send reminder to complete checkout
  }
  
  if (context.eventType === 'overdue_receivable') {
    if (context.amount > 100000) {
       // if overdue amount > 1000 INR, escalate to human, but let's say just send payment link for demo
       return 'create_payment_link';
    }
    return 'create_payment_link';
  }

  if (context.eventType === 'payment_failure') {
    if (context.paymentType === 'subscription') {
      if (context.cause === 'insufficient_funds' || context.cause === 'bank_offline') {
        return 'trigger_mandate_retry';
      }
      if (context.cause === 'invalid_card') {
        return 'create_payment_link';
      }
    }

    if (context.paymentType === 'one_time') {
      if (context.cause === 'insufficient_funds' || context.cause === 'invalid_card') {
        return 'create_payment_link';
      }
      if (context.cause === 'gateway_timeout' || context.cause === 'bank_offline') {
        return 'create_payment_link';
      }
    }
  }

  return 'escalate'; // Fallback
}
