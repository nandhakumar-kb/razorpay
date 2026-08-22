import { prisma } from '@/lib/prisma';
import { runRecoveryPipeline } from '@/lib/pipeline';
import { revalidatePath } from 'next/cache';

async function fetchStats() {
  const events = await prisma.recoveryEvent.findMany({
    include: { transaction: true }
  });

  const naiveEvents = events.filter(e => e.strategyType === 'naive');
  const aiEvents = events.filter(e => e.strategyType === 'ai');

  const calcStats = (evts: typeof events) => {
    const total = evts.length;
    const recovered = evts.filter(e => e.outcome === 'recovered').length;
    const rate = total > 0 ? ((recovered / total) * 100).toFixed(1) : '0.0';
    const amountProtected = evts.reduce((sum, e) => sum + e.transaction.amount, 0);
    const amountRecovered = evts.filter(e => e.outcome === 'recovered').reduce((sum, e) => sum + e.transaction.amount, 0);
    
    return { total, recovered, rate, amountProtected, amountRecovered };
  };

  return {
    naive: calcStats(naiveEvents),
    ai: calcStats(aiEvents),
    events: events.slice(0, 50), // display latest 50
  };
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

  return (
    <div className="container">
      <div className="header">
        <h1>AI Revenue Recovery Dashboard</h1>
        <p>Real-time analytics and recovery engine monitoring.</p>
      </div>

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
              {stats.events.map((evt) => (
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
                    <span className={`badge ${evt.actionStatus === 'approved' || evt.actionStatus === 'executed' ? 'success' : evt.actionStatus === 'pending_approval' ? 'warning' : 'danger'}`}>
                      {evt.actionStatus.replace('_', ' ')}
                    </span>
                  </td>
                  <td>{evt.outcome}</td>
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
