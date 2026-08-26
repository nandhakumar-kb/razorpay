'use client';

import { useState, useTransition } from 'react';

export function RunBatchButton({ 
  action, 
  label, 
  strategy 
}: { 
  action: () => Promise<number>, 
  label: string, 
  strategy: string 
}) {
  const [isPending, startTransition] = useTransition();
  const [progress, setProgress] = useState(0);

  const runAll = () => {
    if (isPending) return;
    
    startTransition(async () => {
      let processed = 0;
      try {
        while (true) {
          const batchSize = await action();
          if (batchSize === 0) break;
          processed += batchSize;
          setProgress(processed);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setProgress(0);
      }
    });
  };

  return (
    <button 
      onClick={runAll} 
      disabled={isPending}
      className={`btn ${strategy === 'ai' ? 'btn-primary' : 'btn-outline'}`}
      style={{ width: '100%' }}
    >
      {isPending ? `Processing... (${progress} done)` : label}
    </button>
  );
}
