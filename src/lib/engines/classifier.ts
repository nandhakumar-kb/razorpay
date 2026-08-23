// Maps Razorpay or gateway failure codes to internal cause buckets

export type FailureCause = 'invalid_card' | 'gateway_timeout' | 'insufficient_funds' | 'bank_offline' | 'fraud_suspected' | 'unknown';

export function classifyFailure(failureCode: string | null): FailureCause {
  if (!failureCode) return 'unknown';

  const code = failureCode.toUpperCase();
  
  // Note: These are example heuristics based on typical failure reasons
  // In production, this would map directly to Razorpay's documented error codes.
  if (code.includes('BAD_REQUEST_ERROR')) {
    // We would ideally look at the sub-error code, but for this demo:
    return 'invalid_card';
  }
  
  if (code.includes('GATEWAY_ERROR') || code.includes('SERVER_ERROR') || code.includes('TIMEOUT')) {
    return 'gateway_timeout';
  }
  
  if (code.includes('INSUFFICIENT_FUNDS') || code.includes('BALANCE')) {
    return 'insufficient_funds';
  }
  
  if (code.includes('BANK_OFFLINE') || code.includes('DOWNTIME')) {
    return 'bank_offline';
  }

  if (code.includes('RISK') || code.includes('FRAUD')) {
    return 'fraud_suspected';
  }

  return 'unknown';
}

export type AbandonmentCause = 'cart_abandoned' | 'checkout_timeout' | 'unknown';

export function classifyAbandonment(code: string | null): AbandonmentCause {
  if (!code) return 'unknown';
  const c = code.toUpperCase();
  if (c.includes('TIMEOUT')) return 'checkout_timeout';
  if (c.includes('ABANDONED')) return 'cart_abandoned';
  return 'unknown';
}

export type OverdueCause = 'invoice_expired' | 'unpaid_30_days' | 'unknown';

export function classifyOverdue(code: string | null): OverdueCause {
  if (!code) return 'unknown';
  const c = code.toUpperCase();
  if (c.includes('EXPIRED')) return 'invoice_expired';
  if (c.includes('30_DAYS')) return 'unpaid_30_days';
  return 'unknown';
}
