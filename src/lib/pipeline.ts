import { prisma } from './prisma';
import { classifyFailure } from './engines/classifier';
import { determineAction } from './engines/strategy';
import { determineNaiveAction } from './engines/strategyNaive';
import { composeRecoveryMessage } from './agents/messageComposer';
import { createPaymentLink, triggerMandateRetry } from './services/razorpay';

/**
 * Processes ONE batch of up to 5 failed transactions for the given strategy.
 * Kept small to stay under Vercel's serverless function timeout per invocation.
 * Returns the number of transactions it actually processed in this call —
 * 0 means there is nothing left to process for this strategy.
 */
export async function runRecoveryPipeline(strategy: 'naive' | 'ai') {
  const failedTransactions = await prisma.transaction.findMany({
    where: {
      status: 'failed',
      recoveryEvents: {
        none: {
          strategyType: strategy,
        },
      },
    },
    include: {
      customer: true,
      recoveryEvents: true,
    },
    take: 5, // Process in batches of 5 to prevent Vercel Serverless Function 10s timeout
  });

  const APPROVAL_THRESHOLD = 400000; // ₹4000 in paise

  for (const transaction of failedTransactions) {
    // Idempotency check — belt and suspenders on top of the query filter above
    const existingActiveEvent = transaction.recoveryEvents.find(
      (e: any) => e.strategyType === strategy
    );
    if (existingActiveEvent) {
      continue;
    }

    let cause = 'unknown';
    let action = 'none';
    let confidence: number | null = null;
    let reasoningLog = '';

    if (strategy === 'naive') {
      cause = classifyFailure(transaction.failureCode);
      action = determineNaiveAction(transaction.retryCount, transaction.paymentType);
      reasoningLog = `Naive strategy: Ignored cause. Selected action '${action}' based solely on payment type (${transaction.paymentType}).`;
    } else {
      cause = classifyFailure(transaction.failureCode);
      action = determineAction({
        cause: cause as any,
        retryCount: transaction.retryCount,
        paymentType: transaction.paymentType,
        amount: transaction.amount,
      });
      reasoningLog = `AI strategy: Detected cause '${cause}'. Selected action '${action}' based on retry count (${transaction.retryCount}) and payment type (${transaction.paymentType}).`;
    }

    const requiresApproval =
      transaction.amount > APPROVAL_THRESHOLD && action !== 'escalate' && action !== 'none';
    const initialStatus = requiresApproval ? 'pending_approval' : 'approved';

    const event = await prisma.recoveryEvent.create({
      data: {
        transactionId: transaction.id,
        diagnosis: cause,
        confidence,
        actionTaken: action,
        actionStatus: initialStatus,
        outcome: 'pending',
        strategyType: strategy,
        reasoningLog,
      },
    });

    if (requiresApproval) {
      await prisma.approvalQueue.create({
        data: {
          recoveryEventId: event.id,
          amount: transaction.amount,
        },
      });
      continue;
    }

    await executeRecoveryAction(event.id);
  }

  return failedTransactions.length;
}

/**
 * Runs runRecoveryPipeline repeatedly for a strategy until there is nothing
 * left to process (query returns 0). This is what the "Run Full Batch" button
 * should call — it guarantees the naive and AI strategies are evaluated
 * against the SAME complete set of seeded transactions, so the A/B comparison
 * on the dashboard is actually apples-to-apples.
 *
 * Loops via repeated awaited calls (not one giant synchronous loop) so each
 * individual runRecoveryPipeline() call still stays within the serverless
 * timeout — only the wrapper as a whole takes longer.
 */
export async function runFullBatch(strategy: 'naive' | 'ai', maxIterations = 30) {
  let totalProcessed = 0;
  let iterations = 0;
  let processedInThisChunk = 0;

  do {
    processedInThisChunk = await runRecoveryPipeline(strategy);
    totalProcessed += processedInThisChunk;
    iterations += 1;
  } while (processedInThisChunk > 0 && iterations < maxIterations);

  if (iterations >= maxIterations && processedInThisChunk > 0) {
    console.warn(
      `runFullBatch(${strategy}) hit maxIterations (${maxIterations}) without finishing. ` +
      `Increase maxIterations or check for a transaction stuck failing idempotency.`
    );
  }

  return totalProcessed;
}

export async function executeRecoveryAction(eventId: string) {
  const event = await prisma.recoveryEvent.findUnique({
    where: { id: eventId },
    include: { transaction: { include: { customer: true } } },
  });

  if (!event || event.actionStatus !== 'approved') return;

  const transaction = event.transaction;
  let outcome = 'pending';
  let reasoningLog = event.reasoningLog || '';

  try {
    if (event.actionTaken === 'create_payment_link') {
      const { message, confidence } = await composeRecoveryMessage(
        transaction.customer.name,
        transaction.amount,
        event.diagnosis || 'unknown',
        'create a payment link'
      );

      await prisma.recoveryEvent.update({
        where: { id: event.id },
        data: { confidence },
      });

      const link = await createPaymentLink(
        transaction.amount,
        transaction.customer.name,
        transaction.customer.contact || '',
        `Recovery for failed payment`,
        `${transaction.id}-${event.strategyType}`
      );

      reasoningLog += `\n[MOCKED SMS SENT]: "${message}"\nPayment Link created: ${link.short_url}`;
      outcome = 'pending';
    } else if (event.actionTaken === 'trigger_mandate_retry') {
      const invoice = await triggerMandateRetry(transaction.id, transaction.amount);
      reasoningLog += `\nTriggered mandate retry. Invoice ID: ${invoice.id}`;
      outcome = 'pending';
    } else if (event.actionTaken === 'escalate') {
      reasoningLog += `\nEscalated to human review. No automatic retry attempted.`;
      outcome = 'escalated';
    } else if (event.actionTaken === 'none') {
      reasoningLog += `\nNo recovery action available.`;
      outcome = 'skipped';
    }

    await prisma.recoveryEvent.update({
      where: { id: event.id },
      data: {
        actionStatus: 'executed',
        actionTimestamp: new Date(),
        reasoningLog,
        outcome,
      },
    });

    if (event.diagnosis && event.actionTaken !== 'none') {
      const isSuccess = outcome === 'recovered' ? 1 : 0;

      const existing = await prisma.successRate.findUnique({
        where: { cause_action: { cause: event.diagnosis, action: event.actionTaken } },
      });

      if (existing) {
        const newAttempts = existing.attempts + 1;
        const newSuccesses = existing.successes + isSuccess;
        await prisma.successRate.update({
          where: { cause_action: { cause: event.diagnosis, action: event.actionTaken } },
          data: {
            attempts: newAttempts,
            successes: newSuccesses,
            successRate: newSuccesses / newAttempts,
          },
        });
      } else {
        await prisma.successRate.create({
          data: {
            cause: event.diagnosis,
            action: event.actionTaken,
            attempts: 1,
            successes: isSuccess,
            successRate: isSuccess ? 1.0 : 0.0,
          },
        });
      }
    }
  } catch (error: any) {
    console.error('Execution error:', error);
    await prisma.recoveryEvent.update({
      where: { id: event.id },
      data: {
        actionStatus: 'failed',
        reasoningLog: reasoningLog + `\nExecution failed: ${error.message}`,
      },
    });
  }
}