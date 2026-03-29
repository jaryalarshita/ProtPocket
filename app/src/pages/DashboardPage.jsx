import React, { useState } from 'react';
import { useUndrugged } from '../hooks/useUndrugged';
import { TargetTable } from '../components/dashboard/TargetTable';
import { LoadingState } from '../components/common/LoadingState';
import { ErrorState } from '../components/common/ErrorState';

export function DashboardPage() {
  const [filter, setFilter] = useState('all');
  const { data, loading, error } = useUndrugged(filter, 30);

  return (
    <div className="w-full flex flex-col items-center">
      <div className="w-full max-w-[1200px] px-6 py-[48px] flex flex-col gap-8">
        
        <div className="flex flex-col gap-3 max-w-[800px]">
          <h1 className="font-display font-bold text-[32px] text-text-primary">
            Undrugged Target Leaderboard
          </h1>
          <p className="font-body text-[15px] text-text-secondary leading-relaxed">
            Complexes are ranked by their structural gap score—the difference in AlphaFold confidence 
            between the monomeric and homodimeric states. A higher score indicates a region that only 
            becomes ordered upon interaction, revealing a potentially druggable cryptic pocket.
          </p>
        </div>

        {loading && <LoadingState message="Fetching leaderboard data..." />}
        {error && <ErrorState message={error} />}

        {!loading && !error && data && data.length > 0 && (
          <TargetTable 
            data={data} 
            filter={filter} 
            onFilterChange={setFilter} 
          />
        )}
        {!loading && !error && (!data || data.length === 0) && (
          <div className="flex flex-col items-center justify-center p-12 bg-bg-secondary border border-border rounded text-center gap-2">
            <span className="font-mono text-sm text-text-muted">No targets found for the selected filter.</span>
          </div>
        )}
      </div>
    </div>
  );
}
