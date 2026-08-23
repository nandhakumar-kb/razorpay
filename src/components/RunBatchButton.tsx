'use client';

import { useState } from 'react';

export function RunBatchButton({ 
  action, 
  label, 
  strategy 
}: { 
  action: () => Promise<number>, 
  label: string, 
  strategy: string 
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  const runAll = async () => {
    if (isLoading) return;
    setIsLoading(true);
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
      setProgress(0); // Reset after completion
      setIsLoading(false);
    }
  };

  return (
    <button 
      onClick={runAll} 
      disabled={isLoading}
      className={`btn ${strategy === 'ai' ? 'btn-primary' : 'btn-outline'}`}
      style={{ width: '100%' }}
    >
      {isLoading ? `Processing... (${progress} done)` : label}
    </button>
  );
}
