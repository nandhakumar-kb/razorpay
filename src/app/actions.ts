'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { executeRecoveryAction } from '@/lib/pipeline';

export async function simulateAction(eventId: string) {
  const event = await prisma.recoveryEvent.findUnique({ 
    where: { id: eventId }, 
    include: { transaction: true } 
  });
  if (!event || event.outcome !== 'pending') return;

  await prisma.recoveryEvent.update({
    where: { id: eventId },
    data: { 
      outcome: 'recovered',
      recoveredAmount: event.transaction.amount
    }
  });

  if (event.diagnosis && event.actionTaken !== 'none') {
     const existing = await prisma.successRate.findUnique({
       where: { cause_action: { cause: event.diagnosis, action: event.actionTaken } }
     });
     if (existing) {
       await prisma.successRate.update({
         where: { cause_action: { cause: event.diagnosis, action: event.actionTaken } },
         data: {
           successes: { increment: 1 },
           successRate: (existing.successes + 1) / existing.attempts
         }
       });
     }
  }
  revalidatePath('/');
}

export async function approveEventAction(formData: FormData) {
  const eventId = formData.get('eventId') as string;
  await prisma.recoveryEvent.update({
    where: { id: eventId },
    data: { actionStatus: 'approved' }
  });
  await executeRecoveryAction(eventId);
  revalidatePath('/');
}

export async function runNaiveAction() {
  const { runRecoveryPipeline } = await import('@/lib/pipeline');
  const count = await runRecoveryPipeline('naive');
  revalidatePath('/');
  return count;
}

export async function runAIAction() {
  const { runRecoveryPipeline } = await import('@/lib/pipeline');
  const count = await runRecoveryPipeline('ai');
  revalidatePath('/');
  return count;
}
