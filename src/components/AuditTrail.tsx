'use client';

import React, { useState, useTransition } from 'react';
import { Check, Clock, Users, HelpCircle, Zap, CheckCircle2, User, Info, ChevronDown, ChevronUp } from 'lucide-react';

const DIAGNOSIS_MAP: Record<string, string> = {
  invalid_card: "their card was declined \u2014 it looks invalid or expired.",
  gateway_timeout: "their bank's server was briefly slow to respond \u2014 likely temporary.",
  insufficient_funds: "there wasn't enough balance at the time.",
  bank_offline: "their bank's system was briefly unavailable.",
  fraud_suspected: "the transaction was flagged for unusual activity.",
  customer_abandoned: "they left the checkout page without paying.",
  mandate_failed: "their recurring mandate failed.",
};

function getDiagnosisText(evt: any) {
  if (evt.transaction.retryCount >= 3) {
    return `this has now failed ${evt.transaction.retryCount} times \u2014 we couldn't confidently tell why this time.`;
  }
  return DIAGNOSIS_MAP[evt.diagnosis] || `we couldn't confidently tell why this time.`;
}

function getActionText(evt: any) {
  if (evt.actionTaken === 'create_payment_link') {
    if (evt.diagnosis === 'gateway_timeout') {
      return "sent them a new payment link right away, since this kind of failure usually isn't the customer's fault.";
    }
    return "sent them a new payment link so they could pay another way.";
  }
  if (evt.actionTaken === 'trigger_mandate_retry') return "retried their recurring payment automatically, since this type of failure is usually temporary.";
  if (evt.actionTaken === 'escalate') return "stopped trying automatically and handed it to a person to review \u2014 we never guess forever.";
  if (evt.actionTaken === 'none') return "took no action.";
  return `performed a ${evt.actionTaken.replace('_', ' ')} action.`;
}

function getResultText(outcome: string, status: string) {
  if (outcome === 'recovered') return "recovered \u2014 they completed the payment.";
  if (outcome === 'escalated') return "handed off \u2014 done correctly, waiting on a human now.";
  if (status === 'failed') return "failed \u2014 the recovery action encountered an error.";
  if (outcome === 'skipped') return "ignored \u2014 no recovery needed.";
  return "waiting to see if they complete it.";
}

function getResultIcon(outcome: string) {
  if (outcome === 'recovered') return <CheckCircle2 size={18} color="#16A34A" />;
  if (outcome === 'escalated') return <User size={18} color="#4B5563" />;
  if (outcome === 'pending') return <Clock size={18} color="#16A34A" />;
  return <Info size={18} color="#6B7280" />;
}

export function AuditTrail({ events, simulateAction }: { events: any[], simulateAction?: (id: string) => void }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [visibleCount, setVisibleCount] = useState(10);
  const [isPendingTrans, startTransition] = useTransition();

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
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {visibleEvents.map((evt) => {
          const isExpanded = expanded[evt.id];
          const isRecovered = evt.outcome === 'recovered';
          const isEscalated = evt.outcome === 'escalated';
          const isPending = evt.outcome === 'pending' && evt.actionStatus !== 'failed';
          
          let bigIconBg = '#6B7280';
          let BigIcon = Info;
          if (isRecovered) { bigIconBg = '#16A34A'; BigIcon = Check; }
          else if (isEscalated) { bigIconBg = '#6B7280'; BigIcon = Users; }
          else if (isPending) { bigIconBg = '#3B82F6'; BigIcon = Clock; }

          let pillBg = '#F3F4F6';
          let pillColor = '#4B5563';
          let PillIcon = Users;
          let pillTitle = 'Handed off';
          let pillSub = 'Waiting on human';

          if (isRecovered) {
            pillBg = '#DCFCE7'; pillColor = '#16A34A'; PillIcon = CheckCircle2;
            pillTitle = 'Recovered'; pillSub = 'Completed payment';
          } else if (isPending) {
            pillBg = '#DBEAFE'; pillColor = '#2563EB'; PillIcon = Clock;
            pillTitle = 'Pending'; pillSub = 'Waiting on customer';
          }

          const headingText = `\u20B9${(evt.transaction.amount / 100).toLocaleString()} payment from ${evt.transaction.customer.name} failed${evt.transaction.retryCount >= 3 ? `, ${evt.transaction.retryCount}rd attempt` : ''}.`;

          return (
            <div key={evt.id} style={{ background: 'var(--panel-bg)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '24px', transition: 'all 0.2s ease', display: 'flex', gap: '20px' }}>
              
              {/* Left Column: Big Solid Icon */}
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: bigIconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                 <BigIcon size={24} color="#FFFFFF" strokeWidth={2.5} />
              </div>

              {/* Right Column */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
                
                {/* Header Row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <h3 style={{ fontSize: '20px', fontWeight: 700, margin: 0, color: 'var(--primary-dark)', letterSpacing: '-0.01em', lineHeight: 1.3, maxWidth: '80%' }}>
                    {headingText}
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', backgroundColor: pillBg, padding: '6px 12px', borderRadius: '12px', textAlign: 'center', minWidth: '120px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: pillColor, fontWeight: 700, fontSize: '13px' }}>
                       <PillIcon size={14} strokeWidth={2.5} /> {pillTitle}
                    </div>
                    <div style={{ color: '#4B5563', fontSize: '11px', marginTop: '2px' }}>
                       {pillSub}
                    </div>
                  </div>
                </div>

                {/* Body Sentences */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '15px', color: '#1F2937' }}>
                  
                  <div style={{ display: 'flex', gap: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', minWidth: '130px' }}>
                       <HelpCircle size={20} color="#DC2626" />
                       <strong style={{ fontWeight: 600 }}>Why:</strong>
                    </div>
                    <div>{getDiagnosisText(evt)}</div>
                  </div>

                  <div style={{ display: 'flex', gap: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', minWidth: '130px' }}>
                       <Zap size={20} color="#3B82F6" />
                       <strong style={{ fontWeight: 600 }}>What we did:</strong>
                    </div>
                    <div>{getActionText(evt)}</div>
                  </div>

                  <div style={{ display: 'flex', gap: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', minWidth: '130px' }}>
                       {getResultIcon(evt.outcome)}
                       <strong style={{ fontWeight: 600 }}>Result:</strong>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                       {getResultText(evt.outcome, evt.actionStatus)}
                       {isPending && simulateAction && (
                         <button 
                           onClick={() => startTransition(() => simulateAction(evt.id))} 
                           disabled={isPendingTrans}
                           className="btn btn-outline" 
                           style={{ height: '24px', padding: '0 8px', fontSize: '11px', opacity: isPendingTrans ? 0.7 : 1 }}
                         >
                           {isPendingTrans ? '...' : 'Simulate Pay'}
                         </button>
                       )}
                    </div>
                  </div>

                </div>
                
                {/* Footer / Toggle */}
                <div style={{ marginTop: '4px' }}>
                  <button 
                    onClick={() => toggleExpand(evt.id)} 
                    style={{ background: 'transparent', border: 'none', color: '#3B82F6', fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', padding: 0 }}
                  >
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    {isExpanded ? "Hide technical details" : "Show technical details"}
                  </button>

                  {isExpanded && (
                    <div style={{ marginTop: '16px', padding: '10px 16px', background: '#F3F4F6', borderRadius: '8px', fontSize: '13px', fontFamily: 'var(--font-mono)', color: '#6B7280', display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                      <span>txn {evt.transactionId.substring(0, 8)}...</span>
                      <span>&middot;</span>
                      <span>cause: {evt.diagnosis || 'unknown'}</span>
                      <span>&middot;</span>
                      <span>action: {evt.actionTaken}</span>
                      <span>&middot;</span>
                      <span>strategy: {evt.strategyType}</span>
                    </div>
                  )}
                </div>

              </div>
            </div>
          );
        })}
      </div>

      {/* Load More Button */}
      {visibleCount < events.length && (
        <div style={{ textAlign: 'center', marginTop: '8px', marginBottom: '16px' }}>
          <button 
            className="btn btn-outline" 
            onClick={() => setVisibleCount(c => Math.min(c + 10, events.length))}
            style={{ minWidth: '200px' }}
          >
            Show More ({events.length - visibleCount} remaining)
          </button>
        </div>
      )}

      {/* Legend at Bottom */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px', color: '#1F2937', marginTop: '8px', paddingLeft: '12px' }}>
         <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}>
           <Info size={16} color="#3B82F6" />
           &quot;Done&quot; means the system finished acting.
         </div>
         <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '24px' }}>
           <CheckCircle2 size={14} color="#16A34A" />
           <strong>Recovered:</strong> The customer completed the payment.
         </div>
         <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '24px' }}>
           <Clock size={14} color="#1F2937" />
           <strong>Pending:</strong> We&apos;re waiting to see if the customer completes it.
         </div>
         <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '24px' }}>
           <Users size={14} color="#1F2937" />
           <strong>Handed off:</strong> We&apos;ve done our part and passed it to a human.
         </div>
      </div>
    </div>
  );
}
