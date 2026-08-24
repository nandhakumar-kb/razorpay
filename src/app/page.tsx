import { prisma } from '@/lib/prisma';
import { runRecoveryPipeline, executeRecoveryAction } from '@/lib/pipeline';
import { revalidatePath } from 'next/cache';
import { RunBatchButton } from '@/components/RunBatchButton';
import { AuditTrail } from '@/components/AuditTrail';
import { ShieldCheck, BrainCircuit, CheckCircle2, AlertTriangle, ShieldAlert, Info } from 'lucide-react';

export const dynamic = 'force-dynamic';

async function fetchStats() {
  try {
    const events = await prisma.recoveryEvent.findMany({
      include: { transaction: { include: { customer: true } } },
      orderBy: { createdAt: 'desc' }
    });

    const naiveEvents = events.filter((e: any) => e.strategyType === 'naive');
    const aiEvents = events.filter((e: any) => e.strategyType === 'ai');
    const approvalQueue = events.filter((e: any) => e.actionStatus === 'pending_approval');

    const calcStats = (evts: typeof events, eventType?: string) => {
      const filtered = eventType ? evts.filter((e: any) => e.transaction.eventType === eventType) : evts;
      const total = filtered.length;
      const recovered = filtered.filter((e: any) => e.outcome === 'recovered').length;
      const rate = total > 0 ? ((recovered / total) * 100).toFixed(1) : '0.0';
      const amountProtected = filtered.reduce((sum: number, e: any) => sum + e.transaction.amount, 0);
      const amountRecovered = filtered.filter((e: any) => e.outcome === 'recovered').reduce((sum: number, e: any) => sum + e.transaction.amount, 0);
      
      return { total, recovered, rate, amountProtected, amountRecovered };
    };

    return {
      naive: calcStats(naiveEvents),
      ai: calcStats(aiEvents),
      naiveByEvent: {
        payment_failure: calcStats(naiveEvents, 'payment_failure'),
        checkout_abandonment: calcStats(naiveEvents, 'checkout_abandonment'),
        overdue_receivable: calcStats(naiveEvents, 'overdue_receivable'),
      },
      aiByEvent: {
        payment_failure: calcStats(aiEvents, 'payment_failure'),
        checkout_abandonment: calcStats(aiEvents, 'checkout_abandonment'),
        overdue_receivable: calcStats(aiEvents, 'overdue_receivable'),
      },
      events: events,
      approvalQueue,
      error: null,
    };
  } catch (error: any) {
    console.error("Database fetch error:", error);
    return {
      naive: { total: 0, recovered: 0, rate: '0.0', amountProtected: 0, amountRecovered: 0 },
      ai: { total: 0, recovered: 0, rate: '0.0', amountProtected: 0, amountRecovered: 0 },
      naiveByEvent: {}, aiByEvent: {},
      events: [],
      approvalQueue: [],
      error: error.message || "Failed to connect to database.",
    };
  }
}

export default async function Dashboard() {
  const stats = await fetchStats();

  const runNaive = async () => {
    'use server';
    const count = await runRecoveryPipeline('naive');
    revalidatePath('/');
    return count;
  };

  const runAI = async () => {
    'use server';
    const count = await runRecoveryPipeline('ai');
    revalidatePath('/');
    return count;
  };

  const approveEvent = async (formData: FormData) => {
    'use server';
    const eventId = formData.get('eventId') as string;
    await prisma.recoveryEvent.update({
      where: { id: eventId },
      data: { actionStatus: 'approved' }
    });
    await executeRecoveryAction(eventId);
    revalidatePath('/');
  };

  const simulateAction = async (eventId: string) => {
    'use server';
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
  };

  const deltaRate = (parseFloat(stats.ai.rate) - parseFloat(stats.naive.rate)).toFixed(1);
  const deltaRecovered = stats.ai.amountRecovered - stats.naive.amountRecovered;
  const isDataAvailable = stats.events.length > 0;

  return (
    <>
      <nav className="navbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontWeight: 800, fontSize: '18px', color: 'var(--primary-dark)', letterSpacing: '-0.02em' }}>
           <img src="https://razorpay.com/favicon.png" alt="Razorpay Logo" width={24} height={24} style={{ borderRadius: '4px' }} />
           RAZORPAY
        </div>
        <div className="nav-links">
           <a href="#">Product</a>
           <a href="#">Solutions</a>
           <a href="#" style={{ color: 'var(--primary-blue)', fontWeight: 600 }}>AI Infrastructure</a>
           <a href="#">Developers</a>
        </div>
      </nav>

      <div className="container">
        
        {/* HERO STRIP */}
        <div style={{ padding: '64px 0 48px', textAlign: 'center', borderBottom: '1px solid var(--border-color)', marginBottom: '48px' }}>
          {isDataAvailable ? (
            <>
              <h1 style={{ fontSize: '48px', fontWeight: 800, marginBottom: '16px', letterSpacing: '-0.03em' }}>
                ₹{(stats.ai.amountRecovered / 100).toLocaleString()} recovered out of ₹{(stats.ai.amountProtected / 100).toLocaleString()} at risk
              </h1>
              <p style={{ fontSize: '18px', color: 'var(--text-secondary)' }}>
                That's ₹{(stats.ai.amountRecovered / 100).toLocaleString()} more than doing nothing, and ₹{(deltaRecovered > 0 ? deltaRecovered / 100 : 0).toLocaleString()} more than blindly retrying every failure the same way.
              </p>
            </>
          ) : (
            <>
              <h1 style={{ fontSize: '48px', fontWeight: 800, marginBottom: '16px', letterSpacing: '-0.03em', color: 'var(--text-muted)' }}>
                Run a batch below to see real results
              </h1>
              <p style={{ fontSize: '18px', color: 'var(--text-secondary)' }}>
                The dashboard will update to show actual recovery metrics once synthetic data is processed.
              </p>
            </>
          )}
        </div>

        {/* DASHBOARD SECTION */}
        <div className="dashboard-container" style={{ paddingTop: 0 }}>
          
          <div style={{ marginBottom: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div>
              <h2 className="section-title" style={{ marginBottom: '8px' }}>Performance Comparison</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '15px' }}>Analyzing the difference between rules-based fallbacks and AI routing.</p>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}><CheckCircle2 size={14} color="var(--success-color)" /> System Online</div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}><ShieldCheck size={14} color="var(--primary-blue)" /> SOC2 Compliant</div>
            </div>
          </div>

          {stats.error && (
            <div className="card" style={{ backgroundColor: '#FEF2F2', borderColor: '#FCA5A5', marginBottom: '32px' }}>
              <h3 style={{ color: 'var(--danger-color)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}><AlertTriangle size={18} /> Database Connection Error</h3>
              <p style={{ color: '#7F1D1D', fontSize: '14px' }}>{stats.error}</p>
            </div>
          )}

          {/* METRICS CARDS */}
          <div className="grid-2" style={{ marginBottom: '48px' }}>
            {/* NAIVE PANEL */}
            <div className="card">
              <div style={{ marginBottom: '24px' }}>
                <h3 className="card-title">Naive Baseline</h3>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Retries every failure the same way, regardless of reason.</p>
              </div>

              <div className="grid-2" style={{ marginBottom: '24px' }}>
                <div className="stat-box">
                  <span className="stat-label">Total Recovery Rate</span>
                  <span className="stat-value">{stats.naive.rate}%</span>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{stats.naive.recovered} / {stats.naive.total} events</span>
                </div>
                <div className="stat-box">
                  <span className="stat-label">Total Amount Recovered</span>
                  <span className="stat-value">₹{(stats.naive.amountRecovered / 100).toLocaleString()}</span>
                </div>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                  Total Protected: ₹{(stats.naive.amountProtected / 100).toLocaleString()}
                </div>
                <RunBatchButton action={runNaive} label="Run Naive Batch" strategy="naive" />
              </div>
            </div>

            {/* AI PANEL */}
            <div className="card" style={{ border: '2px solid var(--primary-blue)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                <div>
                  <h3 className="card-title" style={{ color: 'var(--primary-dark)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <BrainCircuit size={18} color="var(--primary-blue)" /> AI Strategy
                  </h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Diagnoses the reason first, then picks the right fix for that specific reason.</p>
                </div>
              </div>

              <div className="grid-2" style={{ marginBottom: '24px' }}>
                <div className="stat-box">
                  <span className="stat-label" style={{ color: 'var(--primary-blue)' }}>Total Recovery Rate</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span className="stat-value" style={{ color: 'var(--primary-dark)' }}>{stats.ai.rate}%</span>
                    {isDataAvailable && parseFloat(deltaRate) > 0 && (
                      <span className="badge success" style={{ fontSize: '12px' }}>+{deltaRate} pts</span>
                    )}
                  </div>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{stats.ai.recovered} / {stats.ai.total} events</span>
                </div>
                <div className="stat-box">
                  <span className="stat-label" style={{ color: 'var(--primary-blue)' }}>Total Amount Recovered</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span className="stat-value" style={{ color: 'var(--primary-dark)' }}>₹{(stats.ai.amountRecovered / 100).toLocaleString()}</span>
                    {isDataAvailable && deltaRecovered > 0 && (
                      <span className="badge success" style={{ fontSize: '12px' }}>+₹{(deltaRecovered / 100).toLocaleString()}</span>
                    )}
                  </div>
                </div>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                  Total Protected: ₹{(stats.ai.amountProtected / 100).toLocaleString()}
                </div>
                <RunBatchButton action={runAI} label="Run AI Pipeline Batch" strategy="ai" />
              </div>
            </div>
          </div>

          {/* AI INFO PANEL */}
          <details className="card" style={{ marginBottom: '48px', padding: '24px', cursor: 'pointer' }}>
            <summary style={{ fontWeight: 600, fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px', outline: 'none' }}>
              <BrainCircuit size={18} /> How this works
            </summary>
            <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
               <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                 <span className="badge" style={{ background: 'var(--surface-color)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>Rules-based</span>
                 <p style={{ fontSize: '14px', color: 'var(--text-primary)' }}>We read the failure reason and match it to a known cause.</p>
               </div>
               <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                 <span className="badge" style={{ background: 'var(--surface-color)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>Rules-based</span>
                 <p style={{ fontSize: '14px', color: 'var(--text-primary)' }}>We look up the safest action for that cause — never invented, always from a fixed, capped list.</p>
               </div>
               <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                 <span className="badge blue">AI-powered</span>
                 <p style={{ fontSize: '14px', color: 'var(--text-primary)' }}>We write a clear, personalized message explaining what happened and what to do next.</p>
               </div>
            </div>
          </details>

          {/* APPROVAL QUEUE */}
          {stats.approvalQueue.length > 0 && (
            <div className="card" style={{ marginBottom: '48px', borderColor: 'var(--warning-color)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <ShieldAlert size={20} color="var(--warning-color)" />
                <h3 className="card-title" style={{ margin: 0, color: 'var(--warning-color)' }}>Pending Approvals</h3>
              </div>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '24px' }}>
                These are high-value cases (over ₹4,000) where the system pauses and waits for a person to approve before acting — it never auto-executes large amounts alone.
              </p>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Customer</th>
                      <th>Amount</th>
                      <th>Diagnosis</th>
                      <th>Action</th>
                      <th>Approve</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.approvalQueue.map((evt: any) => (
                      <tr key={evt.id}>
                         <td style={{ fontWeight: 500 }}>{evt.transaction.customer.name}</td>
                         <td style={{ color: 'var(--primary-blue)', fontWeight: 600 }}>₹{evt.transaction.amount / 100}</td>
                         <td>{evt.diagnosis}</td>
                         <td>{evt.actionTaken}</td>
                         <td>
                           <form action={approveEvent}>
                             <input type="hidden" name="eventId" value={evt.id} />
                             <button className="btn btn-primary" style={{ padding: '0 12px', height: '32px', fontSize: '12px' }}>
                               Approve Live
                             </button>
                           </form>
                         </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* AUDIT TRAIL */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
              <h3 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '28px', margin: 0, fontWeight: 800, color: '#111827', letterSpacing: '-0.02em' }}>
                <ShieldCheck size={28} strokeWidth={2.5} color="#111827" /> Audit Trail
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#6B7280', fontSize: '14px', paddingTop: '8px' }}>
                <Info size={16} /> Showing latest 50 events
              </div>
            </div>
            <p style={{ fontSize: '15px', color: '#4B5563', marginBottom: '24px' }}>Each card below is one failed payment, explained in plain language.</p>
            <AuditTrail events={stats.events} simulateAction={simulateAction} />
          </div>
          
        </div>
      </div>
      
      {/* FOOTER */}
      <footer style={{ borderTop: '1px solid var(--border-color)', padding: '48px 5%', marginTop: '64px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '14px', color: 'var(--text-secondary)' }}>
           <div style={{ width: '16px', height: '16px', background: 'var(--border-color)', borderRadius: '4px' }}></div>
           RAZORPAY DEMO
        </div>
        <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
          For Buildathon demonstration purposes only.
        </div>
      </footer>
    </>
  );
}
