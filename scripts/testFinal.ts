import { prisma } from '../src/lib/prisma';
import { runRecoveryPipeline } from '../src/lib/pipeline';


async function runFullBatch(strategy: 'naive' | 'ai') {
  let totalProcessed = 0;
  while (true) {
    const processed = await runRecoveryPipeline(strategy);
    if (processed === 0) break;
    totalProcessed += processed;
  }
  return totalProcessed;
}

async function main() {
  console.log("Starting Naive Batch...");
  await runFullBatch('naive');
  
  console.log("Starting AI Batch...");
  await runFullBatch('ai');

  const events = await prisma.recoveryEvent.findMany({
    include: { transaction: { include: { customer: true } } },
    orderBy: { createdAt: 'desc' }
  });

  const naiveEvents = events.filter((e: any) => e.strategyType === 'naive');
  const aiEvents = events.filter((e: any) => e.strategyType === 'ai');

  const calcStats = (evts: typeof events) => {
    const total = evts.length;
    const recovered = evts.filter((e: any) => e.outcome === 'recovered').length;
    const rate = total > 0 ? ((recovered / total) * 100).toFixed(1) : '0.0';
    return { total, recovered, rate };
  };

  const naiveStats = calcStats(naiveEvents);
  const aiStats = calcStats(aiEvents);
  
  // Output result
  console.log("=========================================");
  console.log(`Final Naive Recovery Rate %: ${naiveStats.rate}%`);
  console.log(`Final AI Recovery Rate %: ${aiStats.rate}%`);
  console.log(`Naive Event Count: ${naiveStats.total}`);
  console.log(`AI Event Count: ${aiStats.total}`);
  console.log("=========================================");
}

main().catch(console.error).finally(() => prisma.$disconnect());
