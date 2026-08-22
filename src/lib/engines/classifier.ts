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
  
  if (code.includes('GATEWAY_ERROR')) {
    return 'gateway_timeout';
  }
  
  if (code.includes('INSUFFICIENT_FUNDS')) {
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
