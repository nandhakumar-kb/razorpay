import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const FAILURE_CAUSES = [
  { code: 'BAD_REQUEST_ERROR', method: 'card', cause: 'invalid_card' },
  { code: 'GATEWAY_ERROR', method: 'card', cause: 'gateway_timeout' },
  { code: 'INSUFFICIENT_FUNDS', method: 'upi', cause: 'insufficient_funds' },
  { code: 'BANK_OFFLINE', method: 'netbanking', cause: 'bank_offline' },
];

const ABANDONMENT_CAUSES = [
  { code: 'TIMEOUT', method: 'card', cause: 'checkout_timeout' },
  { code: 'ABANDONED', method: 'upi', cause: 'cart_abandoned' }
];

const OVERDUE_CAUSES = [
  { code: 'EXPIRED', method: 'card', cause: 'invoice_expired' },
  { code: '30_DAYS', method: 'netbanking', cause: 'unpaid_30_days' }
];

async function main() {
  console.log('Seeding synthetic data...');

  // Clear existing data — full reset, no leftovers from prior runs
  await prisma.approvalQueue.deleteMany();
  await prisma.recoveryEvent.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.successRate.deleteMany();

  // 1. Create dummy customers
  const customers = await Promise.all([
    prisma.customer.create({ data: { name: 'Acme Corp', contact: 'acme@example.com', plan: 'pro' } }),
    prisma.customer.create({ data: { name: 'Globex', contact: '9876543210', plan: 'basic' } }),
    prisma.customer.create({ data: { name: 'Soylent', contact: 'soylent@example.com', plan: 'pro' } }),
  ]);

  console.log(`Created ${customers.length} customers.`);

  const transactionsData = [];
  
  // 15 Payment Failures
  for (let i = 0; i < 15; i++) {
    const customer = customers[Math.floor(Math.random() * customers.length)];
    const failureTemplate = FAILURE_CAUSES[Math.floor(Math.random() * FAILURE_CAUSES.length)];
    const paymentType = Math.random() > 0.5 ? 'one_time' : 'subscription';
    const retryCount = Math.random() > 0.8 ? (Math.random() > 0.5 ? 2 : 3) : 0;
    const amount = Math.floor(Math.random() * 490000) + 10000;

    transactionsData.push({
      customerId: customer.id,
      amount,
      method: failureTemplate.method,
      paymentType,
      eventType: 'payment_failure',
      status: 'failed',
      failureCode: failureTemplate.code,
      retryCount,
    });
  }

  // 10 Checkout Abandonments
  for (let i = 0; i < 10; i++) {
    const customer = customers[Math.floor(Math.random() * customers.length)];
    const template = ABANDONMENT_CAUSES[Math.floor(Math.random() * ABANDONMENT_CAUSES.length)];
    const retryCount = Math.random() > 0.8 ? 3 : 0;
    const amount = Math.floor(Math.random() * 490000) + 10000;

    transactionsData.push({
      customerId: customer.id,
      amount,
      method: template.method,
      paymentType: 'one_time',
      eventType: 'checkout_abandonment',
      status: 'failed',
      failureCode: template.code,
      retryCount,
    });
  }

  // 10 Overdue Receivables
  for (let i = 0; i < 10; i++) {
    const customer = customers[Math.floor(Math.random() * customers.length)];
    const template = OVERDUE_CAUSES[Math.floor(Math.random() * OVERDUE_CAUSES.length)];
    const retryCount = Math.random() > 0.8 ? 3 : 0;
    const amount = Math.floor(Math.random() * 490000) + 10000;
    const dueDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago

    transactionsData.push({
      customerId: customer.id,
      amount,
      method: template.method,
      paymentType: 'subscription',
      eventType: 'overdue_receivable',
      status: 'failed',
      failureCode: template.code,
      retryCount,
      dueDate,
    });
  }

  const createdTransactions = await prisma.$transaction(
    transactionsData.map((data) => prisma.transaction.create({ data }))
  );

  console.log(`Created ${createdTransactions.length} synthetic transactions.`);

  // NOTE: We deliberately do NOT pre-seed fake recoveryEvent or successRate rows here.
  // Every number on the dashboard must come from an actual pipeline run so the
  // Recovery Rate / Amount Recovered figures are real, not decorative.
  // The dashboard should start at 0.0% / 0 events until "Run Batch" is clicked.

  console.log('Seeding complete. Dashboard will start clean — run a batch to generate real results.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });