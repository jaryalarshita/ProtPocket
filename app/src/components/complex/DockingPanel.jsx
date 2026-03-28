import React, { useEffect } from 'react';
import { useDockingJob } from '../../hooks/useDockingJob';
import { useChemblFragments } from '../../hooks/useChemblFragments';
import { MoleculePicker } from './MoleculePicker';
import { ConformationBrowser } from './ConformationBrowser';

export function DockingPanel({ pocket, proteinPdbId, onConformationChange, apiBase = '/api' }) {
  const {
    fragments,
    isLoading: fragmentsLoading,
    error: fragmentsError,
    refetch: refetchFragments
  } = useChemblFragments(pocket.pocket_id, {
    volume: pocket.volume,
    hydrophobicity: pocket.hydrophobicity,
    polarity: pocket.polarity,
  }, apiBase);
  console.log(fragments);
  const {
    step,
    selectedFragment,
    conformations,
    activeConformation,
    jobError,
    jobId,
    selectFragment,
    submitDocking,
    setActiveConformation,
    reset,
  } = useDockingJob(apiBase);

  useEffect(() => {
    if (step === 'results' && activeConformation && conformations?.length) {
      onConformationChange?.(conformations, activeConformation.mode);
    }
  }, [step, activeConformation?.mode, conformations, onConformationChange]);

  if (fragmentsLoading && step === 'idle') {
    return (
      <div className="flex items-center gap-3 py-6 justify-center">
        <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        <span className="font-mono text-[10px] uppercase text-text-muted tracking-wider">
          Retrieving ChEMBL fragments for pocket #{pocket.pocket_id}…
        </span>
      </div>
    );
  }

  if (step === 'idle' || (step === 'error' && !jobError)) {
    return (
      <MoleculePicker
        fragments={fragments}
        isLoading={fragmentsLoading}
        error={fragmentsError}
        selectedFragment={selectedFragment}
        onSelect={selectFragment}
        onConfirm={() => submitDocking(pocket.pocket_id, proteinPdbId)}
        onRetry={refetchFragments}
        isDockingRunning={false}
      />
    );
  }

  if (step === 'running') {
    return (
      <>
        <MoleculePicker
          fragments={fragments}
          isLoading={false}
          error={null}
          selectedFragment={selectedFragment}
          onSelect={() => { }}
          onConfirm={() => { }}
          onRetry={() => { }}
          isDockingRunning
        />
        <div className="flex items-start gap-2 mt-3 px-3 py-2 bg-bg-primary border border-warning/20 rounded">
          <div className="w-3 h-3 border border-warning border-t-transparent rounded-full animate-spin flex-none mt-0.5" />
          <span className="font-mono text-[10px] text-text-muted leading-relaxed">
            Vina is running on the server — typically 2–8 minutes for a drug-like fragment. You can navigate away; the
            result will appear automatically.
            {jobId && <span className="block mt-1 opacity-60">Job ID: {jobId}</span>}
          </span>
        </div>
      </>
    );
  }

  if (step === 'results') {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between px-3 py-2 bg-bg-primary border border-border-subtle rounded">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
              />
            </svg>
            <span className="font-mono text-xs text-text-secondary">
              {selectedFragment?.chembl_id}
              {selectedFragment?.name && selectedFragment.name !== selectedFragment.chembl_id && ` · ${selectedFragment.name}`}
              {selectedFragment?.mw != null && ` · MW ${selectedFragment.mw.toFixed(1)}`}
              {selectedFragment?.logp != null && ` · LogP ${selectedFragment.logp.toFixed(2)}`}
            </span>
          </div>
          <button
            type="button"
            onClick={reset}
            className="font-mono text-[10px] uppercase tracking-wider px-3 py-1 rounded border border-border bg-bg-tertiary text-text-secondary hover:text-text-primary hover:border-accent transition-colors"
          >
            Re-dock
          </button>
        </div>

        <ConformationBrowser
          conformations={conformations}
          activeMode={activeConformation?.mode ?? 1}
          onSelect={(c) => {
            setActiveConformation(c);
            onConformationChange?.(conformations, c.mode);
          }}
        />
      </div>
    );
  }

  if (step === 'error') {
    return (
      <div className="flex flex-col items-center gap-3 py-6">
        <span className="font-mono text-[10px] uppercase text-danger tracking-wider border border-danger px-2 py-0.5 rounded">
          ERR
        </span>
        <span className="font-mono text-xs text-text-muted text-center">{jobError}</span>
        <button
          type="button"
          onClick={reset}
          className="font-mono text-[10px] uppercase tracking-wider px-3 py-1.5 rounded border border-border text-text-secondary hover:text-text-primary transition-colors"
        >
          Reset
        </button>
      </div>
    );
  }

  return null;
}
