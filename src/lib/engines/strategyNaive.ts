import { Action } from './strategy';

export function determineNaiveAction(retryCount: number, paymentType: string): Action {
  // Blindly retry max 3 times for everything, ignoring the cause
  if (retryCount >= 3) {
    return 'escalate';
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
