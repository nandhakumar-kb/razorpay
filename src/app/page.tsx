import { prisma } from '@/lib/prisma';
import { runRecoveryPipeline, executeRecoveryAction } from '@/lib/pipeline';
import { revalidatePath } from 'next/cache';
import { RunBatchButton } from '@/components/RunBatchButton';
import { Activity, ArrowRight, ShieldCheck, Cpu, BrainCircuit, Search, CheckCircle2, AlertTriangle, Info, ShieldAlert } from 'lucide-react';

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

  const calcStats = (evts: typeof events) => {
    const total = evts.length;
    const recovered = evts.filter((e: any) => e.outcome === 'recovered').length;
    const rate = total > 0 ? ((recovered / total) * 100).toFixed(1) : '0.0';
    const amountProtected = evts.reduce((sum: number, e: any) => sum + e.transaction.amount, 0);
    const amountRecovered = evts.filter((e: any) => e.outcome === 'recovered').reduce((sum: number, e: any) => sum + e.transaction.amount, 0);
    
    return { total, recovered, rate, amountProtected, amountRecovered };
  };

    return {
      naive: calcStats(naiveEvents),
      ai: calcStats(aiEvents),
      events: events.slice(0, 50),
      approvalQueue,
      error: null,
    };
  } catch (error: any) {
    console.error("Database fetch error:", error);
    return {
      naive: { total: 0, recovered: 0, rate: '0.0', amountProtected: 0, amountRecovered: 0 },
      ai: { total: 0, recovered: 0, rate: '0.0', amountProtected: 0, amountRecovered: 0 },
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
    // Immediately execute after approval
    await executeRecoveryAction(eventId);
    revalidatePath('/');
  };

  const simulatePayment = async (formData: FormData) => {
    'use server';
    const eventId = formData.get('eventId') as string;
    
    const event = await prisma.recoveryEvent.findUnique({ where: { id: eventId } });
    if (!event || event.outcome !== 'pending') return;

    await prisma.recoveryEvent.update({
      where: { id: eventId },
      data: { outcome: 'recovered' }
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
        <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
           <a href="#" style={{ fontSize: '14px', fontWeight: 600, color: 'var(--primary-blue)' }}>Sign in</a>
           <button className="btn btn-primary">Get Started</button>
        </div>
      </nav>

      <div className="container">
        
        {/* HERO SECTION */}
        <div className="hero-section">
           <div>
             <div style={{ color: 'var(--primary-blue)', fontWeight: 700, letterSpacing: '0.05em', marginBottom: '16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BrainCircuit size={16} /> BUILT AI NATIVE
             </div>
             <h1 className="hero-title">AI that turns payments into decisions.</h1>
             <p style={{ fontSize: '18px', color: 'var(--text-secondary)', marginBottom: '32px', maxWidth: '480px' }}>
                Recover failed payments before they become lost revenue. AI detects the failure, identifies the cause and recommends the safest recovery action.
             </p>
             <div style={{ display: 'flex', gap: '16px' }}>
               <button className="btn btn-primary">Try the product <ArrowRight size={16} /></button>
               <button className="btn btn-outline">View Architecture</button>
             </div>
           </div>
           
           <div style={{ background: 'var(--surface-color)', padding: '40px', borderRadius: '16px', border: '1px solid var(--border-color)', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)' }}>
              <h3 style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '32px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, textAlign: 'center' }}>Agentic Recovery Workflow</h3>
              <div className="ai-workflow" style={{ justifyContent: 'center' }}>
                 <div className="workflow-node"><Activity size={16} /> Input</div>
                 <ArrowRight size={16} style={{ color: 'var(--border-color)' }} />
                 <div className="workflow-node active" style={{ boxShadow: '0 4px 12px rgba(51, 102, 255, 0.15)' }}><BrainCircuit size={16} /> AI Agent</div>
                 <ArrowRight size={16} style={{ color: 'var(--border-color)' }} />
                 <div className="workflow-node"><Search size={16} /> Decision</div>
                 <ArrowRight size={16} style={{ color: 'var(--border-color)' }} />
                 <div className="workflow-node"><Cpu size={16} /> Action</div>
                 <ArrowRight size={16} style={{ color: 'var(--border-color)' }} />
                 <div className="workflow-node"><ShieldCheck size={16} /> Audit</div>
              </div>
           </div>
        </div>

        {/* DASHBOARD SECTION */}
        <div className="dashboard-container">
          
          <div style={{ marginBottom: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
            <div>
              <h2 className="section-title" style={{ marginBottom: '8px' }}>Executive Dashboard</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '15px' }}>Real-time recovery metrics and intelligence oversight.</p>
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
              <p style={{ marginTop: '12px', fontSize: '13px', color: '#991B1B' }}>
                <strong>How to fix:</strong> Ensure you have added <code>DATABASE_URL</code> to your environment variables and pushed your schema using <code>npx prisma db push</code>.
              </p>
            </div>
          )}

          {/* METRICS CARDS */}
          <div className="grid-2" style={{ marginBottom: '48px' }}>
            <div className="card">
              <h3 className="card-title">Naive Baseline Strategy</h3>
              <div className="grid-2" style={{ marginBottom: '24px' }}>
                <div className="stat-box">
                  <span className="stat-label">Recovery Rate</span>
                  <span className="stat-value" style={{ color: 'var(--text-primary)' }}>{stats.naive.rate}%</span>
                </div>
                <div className="stat-box">
                  <span className="stat-label">Amount Recovered</span>
                  <span className="stat-value" style={{ color: 'var(--text-primary)' }}>₹{(stats.naive.amountRecovered / 100).toLocaleString()}</span>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                  Total Protected: ₹{(stats.naive.amountProtected / 100).toLocaleString()}
                </div>
                <RunBatchButton action={runNaive} label="Run Naive Batch" strategy="naive" />
              </div>
            </div>

            <div className="card" style={{ border: '1px solid var(--primary-light)', background: 'radial-gradient(circle at 100% 0%, var(--primary-ultralight), #FFFFFF 60%)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <h3 className="card-title" style={{ color: 'var(--primary-dark)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <BrainCircuit size={18} color="var(--primary-blue)" /> AI Strategy
                </h3>
                <span className="badge blue" style={{ fontSize: '11px' }}>Recommended</span>
              </div>
              
              <div className="grid-2" style={{ marginBottom: '24px' }}>
                <div className="stat-box">
                  <span className="stat-label" style={{ color: 'var(--primary-blue)' }}>Recovery Rate</span>
                  <span className="stat-value" style={{ color: 'var(--primary-dark)' }}>{stats.ai.rate}%</span>
                </div>
                <div className="stat-box">
                  <span className="stat-label" style={{ color: 'var(--primary-blue)' }}>Amount Recovered</span>
                  <span className="stat-value" style={{ color: 'var(--primary-dark)' }}>₹{(stats.ai.amountRecovered / 100).toLocaleString()}</span>
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

          {/* APPROVAL QUEUE */}
          {stats.approvalQueue.length > 0 && (
            <div className="card" style={{ marginBottom: '48px', borderColor: 'var(--warning-color)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
                <ShieldAlert size={20} color="var(--warning-color)" />
                <h3 className="card-title" style={{ margin: 0, color: 'var(--warning-color)' }}>Pending Approvals (High Value)</h3>
              </div>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Customer</th>
                      <th>Amount</th>
                      <th>Diagnosis</th>
                      <th>Proposed Action</th>
                      <th>AI Reasoning</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.approvalQueue.map((evt: any) => (
                      <tr key={evt.id}>
                        <td style={{ fontWeight: 500 }}>{evt.transaction.customer.name}</td>
                        <td style={{ color: 'var(--primary-blue)', fontWeight: 600 }}>₹{evt.transaction.amount / 100}</td>
                        <td><span className="badge" style={{ background: 'var(--surface-color)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>{evt.diagnosis}</span></td>
                        <td>{evt.actionTaken}</td>
                        <td style={{ fontSize: '13px', maxWidth: '300px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>{evt.reasoningLog}</td>
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
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h3 className="card-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}><ShieldCheck size={18} /> Audit Trail</h3>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Info size={14} /> Showing latest 50 events
              </div>
            </div>
            
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Txn ID</th>
                    <th>Strategy</th>
                    <th>Diagnosis</th>
                    <th>Action</th>
                    <th>Status</th>
                    <th>Outcome</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.events.map((evt: any) => (
                    <tr key={evt.id}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--text-secondary)' }}>{evt.transactionId.substring(0, 8)}...</td>
                      <td>
                        <span className={`badge ${evt.strategyType === 'ai' ? 'blue' : ''}`} style={{ background: evt.strategyType !== 'ai' ? 'var(--surface-color)' : '', color: evt.strategyType !== 'ai' ? 'var(--text-secondary)' : '', border: evt.strategyType !== 'ai' ? '1px solid var(--border-color)' : '' }}>
                          {evt.strategyType}
                        </span>
                      </td>
                      <td>{evt.diagnosis || '-'}</td>
                      <td>{evt.actionTaken}</td>
                      <td>
                        <span className={`badge ${evt.actionStatus === 'approved' || evt.actionStatus === 'executed' ? 'success' : evt.actionStatus === 'pending_approval' ? 'warning' : evt.actionStatus === 'failed' ? 'danger' : 'info'}`}>
                          {evt.actionStatus.replace('_', ' ')}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span className={`badge ${evt.outcome === 'recovered' ? 'success' : evt.outcome === 'escalated' ? 'danger' : evt.outcome === 'skipped' ? 'warning' : 'info'}`}>
                            {evt.outcome}
                          </span>
                          {evt.outcome === 'pending' && evt.actionStatus !== 'failed' && (
                            <form action={simulatePayment}>
                              <input type="hidden" name="eventId" value={evt.id} />
                              <button className="btn btn-outline" style={{ padding: '0 8px', height: '24px', fontSize: '11px' }}>
                                Simulate Pay
                              </button>
                            </form>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {stats.events.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '64px', color: 'var(--text-muted)' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                          <Activity size={32} color="var(--border-color)" />
                          No recovery events found. Run a batch above.
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
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
