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

  const runAll = async () => {
    let processed = 0;
    while (true) {
      const batchSize = await action();
      if (batchSize === 0) break;
      processed += batchSize;
      setProgress(processed);
    }
    setProgress(0); // Reset after completion
  };

  return (
    <button 
      onClick={() => startTransition(runAll)} 
      disabled={isPending}
      className={`btn ${strategy === 'ai' ? 'btn-primary' : 'btn-outline'}`}
      style={{ width: '100%' }}
    >
      {isPending ? `Processing... (${progress} done)` : label}
    </button>
  );
}
