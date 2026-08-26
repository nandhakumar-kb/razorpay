import { PrismaClient } from '@prisma/client';
import { runFullBatch } from '../src/lib/pipeline';

const prisma = new PrismaClient();

async function main() {
  console.log('Running full AI batch pipeline...');
  const processed = await runFullBatch('ai');
  console.log(`Processed ${processed} transactions through AI pipeline.`);

  console.log('Simulating successful payment for all AI recovery events...');
  
  // Find all events that are either pending or pending_approval
  const events = await prisma.recoveryEvent.findMany({
    where: {
      strategyType: 'ai',
      outcome: { not: 'recovered' }
    }
  });

  let recoveredCount = 0;

  for (const event of events) {
    // If it was escalated or skipped, skip it
    if (event.actionTaken === 'escalate' || event.actionTaken === 'none') {
      continue;
    }

    await prisma.recoveryEvent.update({
      where: { id: event.id },
      data: {
        actionStatus: 'executed',
        outcome: 'recovered',
        reasoningLog: (event.reasoningLog || '') + '\n[SIMULATION]: Payment successfully received from customer via link.',
      }
    });

    if (event.diagnosis) {
      const existing = await prisma.successRate.findUnique({
        where: { cause_action: { cause: event.diagnosis, action: event.actionTaken } }
      });

      if (existing) {
        // If it was already marked as pending success (0 successes), just increment success
        // since the pipeline might have already incremented attempts.
        const wasSuccessfulBefore = existing.successes > 0;
        if (!wasSuccessfulBefore) {
            await prisma.successRate.update({
                where: { cause_action: { cause: event.diagnosis, action: event.actionTaken } },
                data: {
                successes: existing.successes + 1,
                successRate: (existing.successes + 1) / existing.attempts
                }
            });
        }
      }
    }
    
    recoveredCount++;
  }

  console.log(`Successfully simulated payment for ${recoveredCount} events.`);
  console.log('Dashboard is now fully populated!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
