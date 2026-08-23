import { Action } from './strategy';

export function determineNaiveAction(retryCount: number, paymentType: string, eventType: string): Action {
  // Blindly retry max 3 times for everything, ignoring the cause
  if (retryCount >= 3) {
    return 'escalate';
  }

  if (eventType === 'checkout_abandonment' || eventType === 'overdue_receivable') {
    return 'create_payment_link';
  }

  // Blindly create a payment link for one-time
  if (paymentType === 'one_time') {
    return 'create_payment_link';
  }

  // Blindly trigger mandate retry for subscription
  if (paymentType === 'subscription') {
    return 'trigger_mandate_retry';
  }

  return 'escalate';
}
