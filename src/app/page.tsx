import { prisma } from '@/lib/prisma';
import { runRecoveryPipeline, executeRecoveryAction } from '@/lib/pipeline';
import { revalidatePath } from 'next/cache';

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
    await runRecoveryPipeline('naive');
    revalidatePath('/');
  };

  const runAI = async () => {
    'use server';
    await runRecoveryPipeline('ai');
    revalidatePath('/');
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

  return (
    <div className="container">
      <div className="header">
        <h1>AI Revenue Recovery Dashboard</h1>
        <p>Real-time analytics and recovery engine monitoring.</p>
      </div>

      {stats.error && (
        <div className="card" style={{ backgroundColor: '#ffebee', color: '#c62828', borderColor: '#ef5350', marginBottom: '2rem' }}>
          <h3>⚠️ Database Connection Error</h3>
          <p>{stats.error}</p>
          <p style={{ marginTop: '1rem', fontSize: '0.9rem' }}>
            <strong>How to fix:</strong> Ensure you have added <code>DATABASE_URL</code> to your Vercel Environment Variables, and that you have pushed your schema to the remote database using <code>npx prisma db push</code>.
          </p>
        </div>
      )}

      <div className="grid-2">
        <div className="card">
          <h2>Naive Baseline Strategy</h2>
          <div className="grid-2" style={{ marginBottom: '1rem' }}>
            <div className="stat-box">
              <span className="stat-label">Recovery Rate</span>
              <span className="stat-value">{stats.naive.rate}%</span>
            </div>
            <div className="stat-box">
              <span className="stat-label">Amount Recovered</span>
              <span className="stat-value">₹{(stats.naive.amountRecovered / 100).toLocaleString()}</span>
            </div>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            Protects: ₹{(stats.naive.amountProtected / 100).toLocaleString()} ({stats.naive.total} events)
          </p>
          <form action={runNaive}>
            <button className="btn btn-outline" style={{ width: '100%' }}>Run Naive Batch</button>
          </form>
        </div>

        <div className="card" style={{ borderColor: 'var(--accent-color)' }}>
          <h2 style={{ color: 'var(--accent-color)' }}>AI Strategy</h2>
          <div className="grid-2" style={{ marginBottom: '1rem' }}>
            <div className="stat-box">
              <span className="stat-label" style={{ color: 'var(--accent-color)' }}>Recovery Rate</span>
              <span className="stat-value">{stats.ai.rate}%</span>
            </div>
            <div className="stat-box">
              <span className="stat-label" style={{ color: 'var(--accent-color)' }}>Amount Recovered</span>
              <span className="stat-value">₹{(stats.ai.amountRecovered / 100).toLocaleString()}</span>
            </div>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            Protects: ₹{(stats.ai.amountProtected / 100).toLocaleString()} ({stats.ai.total} events)
          </p>
          <form action={runAI}>
            <button className="btn btn-primary" style={{ width: '100%' }}>Run AI Pipeline Batch</button>
          </form>
        </div>
      </div>

      {stats.approvalQueue.length > 0 && (
        <div className="card" style={{ marginBottom: '2rem', borderColor: 'var(--warning-color)' }}>
          <h2 style={{ color: 'var(--warning-color)' }}>Pending Approvals (High Value)</h2>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Amount</th>
                  <th>Diagnosis</th>
                  <th>Proposed Action</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {stats.approvalQueue.map((evt: any) => (
                  <tr key={evt.id}>
                    <td>{evt.transaction.customer.name}</td>
                    <td style={{ color: 'var(--accent-color)' }}>₹{evt.transaction.amount / 100}</td>
                    <td>{evt.diagnosis}</td>
                    <td>{evt.actionTaken}</td>
                    <td>
                      <form action={approveEvent}>
                        <input type="hidden" name="eventId" value={evt.id} />
                        <button className="btn btn-primary" style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem' }}>
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

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2>Audit Trail</h2>
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
                  <td>{evt.transactionId.substring(0, 8)}...</td>
                  <td>
                    <span className={`badge ${evt.strategyType === 'ai' ? 'info' : ''}`}>
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
                    <span className={`badge ${evt.outcome === 'recovered' ? 'success' : evt.outcome === 'escalated' ? 'danger' : 'info'}`}>
                      {evt.outcome}
                    </span>
                  </td>
                </tr>
              ))}
              {stats.events.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                    No recovery events found. Run a batch above.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
