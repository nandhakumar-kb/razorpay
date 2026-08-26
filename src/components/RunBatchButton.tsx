'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function RunBatchButton({ 
  action, 
  label, 
  strategy 
}: { 
  action: () => Promise<number>, 
  label: string, 
  strategy: string 
}) {
  const router = useRouter();
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
        // Refresh the router to fetch updated Server Component stats after each batch
        router.refresh();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setProgress(0);
      setIsLoading(false);
      router.refresh();
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
