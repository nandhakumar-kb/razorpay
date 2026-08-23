'use client';

import React, { useState } from 'react';
import { CheckCircle2, Clock, User, AlertTriangle, Info, ChevronDown, ChevronUp } from 'lucide-react';

const DIAGNOSIS_MAP: Record<string, string> = {
  invalid_card: "their card was declined (invalid or expired)",
  gateway_timeout: "their bank's server was temporarily slow to respond",
  insufficient_funds: "there wasn't enough balance at the time",
  bank_offline: "their bank's system was briefly unavailable",
  fraud_suspected: "the transaction was flagged for unusual activity",
  customer_abandoned: "they left the checkout page without paying",
  mandate_failed: "their recurring mandate failed",
};

const ACTION_MAP: Record<string, string> = {
  create_payment_link: "sent them a new payment link so they can complete the purchase another way",
  trigger_mandate_retry: "retried their recurring payment automatically, since this type of failure is usually temporary",
  escalate: "flagged this for a human to review, rather than guessing",
  none: "took no action",
};

function getDiagnosisText(diagnosis: string | null) {
  if (!diagnosis) return "an unknown issue occurred";
  return DIAGNOSIS_MAP[diagnosis] || `the system diagnosed it as ${diagnosis.replace('_', ' ')}`;
}

function getActionText(action: string) {
  return ACTION_MAP[action] || `performed a ${action.replace('_', ' ')} action`;
}

function getResultText(outcome: string, status: string) {
  if (outcome === 'recovered') return "Result: recovered — they completed the payment.";
  if (outcome === 'escalated') return "Result: handed to a human for review.";
  if (status === 'failed') return "Result: the recovery action failed to execute.";
  if (outcome === 'skipped') return "Result: ignored — no recovery needed.";
  return "Result: still pending — waiting to see if they complete it.";
}

function getStatusIcon(outcome: string, status: string) {
  if (outcome === 'recovered') return <CheckCircle2 size={24} color="var(--success-color)" />;
  if (outcome === 'escalated') return <User size={24} color="var(--text-secondary)" />;
  if (status === 'failed') return <AlertTriangle size={24} color="var(--danger-color)" />;
  if (outcome === 'skipped') return <Info size={24} color="var(--text-muted)" />;
  return <Clock size={24} color="var(--info-color)" />;
}

export function AuditTrail({ events, simulateAction }: { events: any[], simulateAction?: (id: string) => void }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [visibleCount, setVisibleCount] = useState(10);

  const toggleExpand = (id: string) => setExpanded(p => ({ ...p, [id]: !p[id] }));

  if (events.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '64px', color: 'var(--text-muted)', background: 'var(--panel-bg)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
        <p>No recovery events found. Run a batch above to see the audit trail.</p>
      </div>
    );
  }

  const visibleEvents = events.slice(0, visibleCount);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ background: '#F8FAFC', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '13px', color: 'var(--text-secondary)' }}>
        <strong>Legend:</strong> Status shows whether the system finished acting. Result shows what actually happened. An escalated case can show 'done' as its status — that means the system correctly finished the job of handing it to a human, not that something went wrong.
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {visibleEvents.map((evt) => {
          const isExpanded = expanded[evt.id];
          return (
            <div key={evt.id} style={{ background: 'var(--panel-bg)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px', transition: 'all 0.2s ease' }}>
              <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                <div style={{ paddingTop: '4px' }}>
                  {getStatusIcon(evt.outcome, evt.actionStatus)}
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '14px', color: 'var(--text-primary)' }}>
                  <div>
                    <strong>WHAT:</strong> Payment of ₹{evt.transaction.amount / 100} from {evt.transaction.customer.name} failed.
                  </div>
                  <div>
                    <strong>WHY:</strong> Reason: {getDiagnosisText(evt.diagnosis)}.
                  </div>
                  <div>
                    <strong>HOW:</strong> Action taken: {getActionText(evt.actionTaken)}.
                  </div>
                  <div style={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {getResultText(evt.outcome, evt.actionStatus)}
                    {evt.outcome === 'pending' && evt.actionStatus !== 'failed' && simulateAction && (
                      <button 
                        onClick={() => simulateAction(evt.id)} 
                        className="btn btn-outline" 
                        style={{ height: '24px', padding: '0 8px', fontSize: '11px' }}
                      >
                        Simulate Pay
                      </button>
                    )}
                  </div>
                  
                  <div style={{ marginTop: '8px' }}>
                    <button 
                      onClick={() => toggleExpand(evt.id)} 
                      style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', padding: 0 }}
                    >
                      {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      {isExpanded ? "Hide Details" : "Show Details"}
                    </button>
                  </div>

                  {isExpanded && (
                    <div style={{ marginTop: '12px', padding: '12px', background: 'var(--surface-color)', borderRadius: '6px', fontSize: '13px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div><span style={{ color: 'var(--text-muted)' }}>Txn ID:</span> {evt.transactionId}</div>
                      <div><span style={{ color: 'var(--text-muted)' }}>Strategy:</span> <span style={{textTransform: 'uppercase'}}>{evt.strategyType}</span></div>
                      <div><span style={{ color: 'var(--text-muted)' }}>Raw Diagnosis:</span> {evt.diagnosis || 'null'}</div>
                      <div><span style={{ color: 'var(--text-muted)' }}>Raw Action:</span> {evt.actionTaken}</div>
                      <div><span style={{ color: 'var(--text-muted)' }}>Action Status:</span> {evt.actionStatus}</div>
                      <div><span style={{ color: 'var(--text-muted)' }}>Final Outcome:</span> {evt.outcome}</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {visibleCount < events.length && (
        <div style={{ textAlign: 'center', marginTop: '8px' }}>
          <button 
            className="btn btn-outline" 
            onClick={() => setVisibleCount(c => Math.min(c + 10, events.length))}
            style={{ minWidth: '200px' }}
          >
            Show More ({events.length - visibleCount} remaining)
          </button>
        </div>
      )}
    </div>
  );
}
