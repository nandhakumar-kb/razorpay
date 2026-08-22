import { prisma } from './prisma';
import { classifyFailure } from './engines/classifier';
import { determineAction } from './engines/strategy';
import { determineNaiveAction } from './engines/strategyNaive';
import { composeRecoveryMessage } from './agents/messageComposer';
import { createPaymentLink, triggerMandateRetry } from './services/razorpay';

export async function runRecoveryPipeline(strategy: 'naive' | 'ai') {
  // Fetch failed transactions that don't have a completed recovery event for this strategy
  const failedTransactions = await prisma.transaction.findMany({
    where: {
      status: 'failed',
      recoveryEvents: {
        none: {
          strategyType: strategy,
          actionStatus: { notIn: ['skipped_duplicate', 'failed'] }
        }
      }
    },
    include: {
      customer: true,
      recoveryEvents: true,
    },
    take: 5 // Process in batches of 5 to prevent Vercel Serverless Function 10s timeout
  });

  const APPROVAL_THRESHOLD = 50000; // ₹500 in paise

  for (const transaction of failedTransactions) {
    // 1. Idempotency Check
    const existingActiveEvent = transaction.recoveryEvents.find(
      (e: any) => e.actionStatus !== 'skipped_duplicate' && e.actionStatus !== 'failed' 
             && e.strategyType === strategy
    );
    if (existingActiveEvent) {
      continue; // Skip, already processed for this strategy
    }

    // 2. Diagnosis and Action Selection
    let cause = 'unknown';
    let action = 'none';
    let confidence: number | null = null;
    let reasoningLog = '';

    if (strategy === 'naive') {
      cause = classifyFailure(transaction.failureCode); // We still diagnose to record it, but action ignores it
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

    // 3. Approval Gate check
    const requiresApproval = transaction.amount > APPROVAL_THRESHOLD && action !== 'escalate' && action !== 'none';
    const initialStatus = requiresApproval ? 'pending_approval' : 'approved';

    // 4. Create Recovery Event record
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
      }
    });

    if (requiresApproval) {
      await prisma.approvalQueue.create({
        data: {
          recoveryEventId: event.id,
          amount: transaction.amount,
        }
      });
      // Pause execution for this event, wait for human
      continue;
    }

    // 5. Execute Action if approved immediately
    await executeRecoveryAction(event.id);
  }
}

export async function executeRecoveryAction(eventId: string) {
  const event = await prisma.recoveryEvent.findUnique({
    where: { id: eventId },
    include: { transaction: { include: { customer: true } } }
  });

  if (!event || event.actionStatus !== 'approved') return;

  const transaction = event.transaction;
  let outcome = 'pending';
  let reasoningLog = event.reasoningLog || '';
  
  try {
    if (event.actionTaken === 'create_payment_link') {
      // 1. Compose message
      const { message, confidence } = await composeRecoveryMessage(
        transaction.customer.name,
        transaction.amount,
        event.diagnosis || 'unknown',
        'create a payment link'
      );
      
      // Update confidence from LLM
      await prisma.recoveryEvent.update({
        where: { id: event.id },
        data: { confidence }
      });
      
      // 2. Real API call
      const link = await createPaymentLink(
        transaction.amount,
        transaction.customer.name,
        transaction.customer.contact || '',
        `Recovery for failed payment`,
        transaction.id
      );
      
      reasoningLog += `\n[MOCKED SMS SENT]: "${message}"\nPayment Link created: ${link.short_url}`;
      outcome = 'pending'; // Waiting for customer to pay
      
    } else if (event.actionTaken === 'trigger_mandate_retry') {
       // Real API call
       const invoice = await triggerMandateRetry(transaction.id, transaction.amount);
       reasoningLog += `\nTriggered mandate retry. Invoice ID: ${invoice.id}`;
       outcome = 'pending';
       
    } else if (event.actionTaken === 'escalate') {
       reasoningLog += `\nEscalated to human review. No automatic retry attempted.`;
       outcome = 'escalated';
    }

    // Mark event as executed
    await prisma.recoveryEvent.update({
      where: { id: event.id },
      data: {
        actionStatus: 'executed',
        actionTimestamp: new Date(),
        reasoningLog,
        outcome,
      }
    });

    // Update Learning Loop (Success Rates)
    if (event.diagnosis && event.actionTaken !== 'none') {
      const isSuccess = outcome === 'recovered' ? 1 : 0;
      await prisma.successRate.upsert({
        where: {
          cause_action: { cause: event.diagnosis, action: event.actionTaken }
        },
        update: {
          attempts: { increment: 1 },
          successes: { increment: isSuccess },
        },
        create: {
          cause: event.diagnosis,
          action: event.actionTaken,
          attempts: 1,
          successes: isSuccess,
          successRate: isSuccess ? 1.0 : 0.0
        }
      });
      
      // We would ideally recalculate successRate periodically, or do it on read
    }
    
  } catch (error: any) {
     console.error("Execution error:", error);
     await prisma.recoveryEvent.update({
       where: { id: event.id },
       data: {
         actionStatus: 'failed',
         reasoningLog: reasoningLog + `\nExecution failed: ${error.message}`
       }
     });
  }
}
