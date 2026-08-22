import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const FAILURE_CAUSES = [
  { code: 'BAD_REQUEST_ERROR', method: 'card', cause: 'invalid_card' },
  { code: 'GATEWAY_ERROR', method: 'card', cause: 'gateway_timeout' },
  { code: 'BAD_REQUEST_ERROR', method: 'upi', cause: 'insufficient_funds' },
  { code: 'BAD_REQUEST_ERROR', method: 'netbanking', cause: 'bank_offline' },
  { code: 'RISK_FLAGGED', method: 'card', cause: 'fraud_suspected' },
];

async function main() {
  console.log('Seeding synthetic data...');

  // Clear existing data
  await prisma.approvalQueue.deleteMany();
  await prisma.recoveryEvent.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.successRate.deleteMany();

  // 1. Create a few dummy customers
  const customers = await Promise.all([
    prisma.customer.create({ data: { name: 'Acme Corp', contact: 'acme@example.com', plan: 'pro' } }),
    prisma.customer.create({ data: { name: 'Globex', contact: '9876543210', plan: 'basic' } }),
    prisma.customer.create({ data: { name: 'Soylent', contact: 'soylent@example.com', plan: 'pro' } }),
  ]);

  console.log(`Created ${customers.length} customers.`);

  // 2. Generate 50 failed transactions
  const transactionsData = [];
  for (let i = 0; i < 50; i++) {
    const customer = customers[Math.floor(Math.random() * customers.length)];
    const failureTemplate = FAILURE_CAUSES[Math.floor(Math.random() * FAILURE_CAUSES.length)];
    const paymentType = Math.random() > 0.5 ? 'one_time' : 'subscription';
    
    // Some transactions have retryCount > 0
    const retryCount = Math.random() > 0.8 ? (Math.random() > 0.5 ? 2 : 3) : 0; 
    
    // Amount between 100 INR and 5000 INR (10000 to 500000 paise)
    const amount = Math.floor(Math.random() * 490000) + 10000;

    transactionsData.push({
      customerId: customer.id,
      amount,
      method: failureTemplate.method,
      paymentType,
      status: 'failed',
      failureCode: failureTemplate.code,
      retryCount,
    });
  }

  const createdTransactions = await prisma.$transaction(
    transactionsData.map((data) => prisma.transaction.create({ data }))
  );

  // Removed historical seeding to keep the demo 100% honest and start at 0%
  // 3. Initialize Success Rates learning table with some base stats (optional, but helps with demo)
  const causes = ['invalid_card', 'gateway_timeout', 'insufficient_funds', 'bank_offline'];
  const actions = ['create_payment_link', 'trigger_mandate_retry', 'escalate'];
  
  const successRatesData = [];
  for (const cause of causes) {
    for (const action of actions) {
      successRatesData.push({
        cause,
        action,
        attempts: 10, // dummy base
        successes: cause === 'insufficient_funds' && action === 'trigger_mandate_retry' ? 6 : 2, // arbitrary
        successRate: cause === 'insufficient_funds' && action === 'trigger_mandate_retry' ? 0.6 : 0.2,
      });
    }
  }

  await prisma.successRate.createMany({
    data: successRatesData,
  });
  
  console.log('Seeded success_rates table.');
  console.log('Seeding complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
