import { prisma } from '../src/lib/prisma';
import { runFullBatch } from '../src/lib/pipeline';

async function main() {
  console.log('--- STARTING VERIFICATION RUN ---');
  
  console.log('Running Naive Batch...');
  const naiveCount = await runFullBatch('naive');
  
  console.log('Running AI Batch...');
  const aiCount = await runFullBatch('ai');
  
  console.log(`\n--- VERIFICATION REPORT ---`);
  console.log(`Naive processed: ${naiveCount}`);
  console.log(`AI processed:    ${aiCount}`);
  
  if (naiveCount === aiCount) {
    console.log(`✅ Event counts match! (${naiveCount} each)`);
  } else {
    console.log(`❌ Event counts DO NOT match!`);
  }
  
  const events = await prisma.recoveryEvent.findMany({
    include: { transaction: true }
  });
  
  const byType = (strategy: string, type: string) => 
    events.filter(e => e.strategyType === strategy && e.transaction.eventType === type).length;
    
  console.log('\n--- BREAKDOWN ---');
  console.log(`Payment Failures:     Naive=${byType('naive', 'payment_failure')} | AI=${byType('ai', 'payment_failure')}`);
  console.log(`Checkout Abandonment: Naive=${byType('naive', 'checkout_abandonment')} | AI=${byType('ai', 'checkout_abandonment')}`);
  console.log(`Overdue Receivables:  Naive=${byType('naive', 'overdue_receivable')} | AI=${byType('ai', 'overdue_receivable')}`);

  console.log('\nDone.');
}

main();
