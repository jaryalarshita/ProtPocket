import React from 'react';

export function MoleculePicker({
  fragments,
  isLoading,
  error,
  selectedFragment,
  onSelect,
  onConfirm,
  isDockingRunning,
  onRetry,
}) {
  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
            />
          </svg>
          <span className="font-mono text-[11px] uppercase tracking-wider text-text-secondary">
            Select Molecule
          </span>
        </div>
        {fragments.length > 0 && (
          <span className="font-mono text-xs bg-purple-500/15 text-purple-400 border border-purple-500/30 px-2 py-0.5 rounded">
            {fragments.length}
          </span>
        )}
      </div>

      <div className="max-h-80 overflow-y-auto">
        {isLoading && (
          <div className="flex flex-col items-center gap-2 py-8">
            <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            <span className="font-mono text-[10px] uppercase text-text-muted tracking-wider">
              Fetching ChEMBL fragments…
            </span>
          </div>
        )}

        {!isLoading && error && (
          <div className="flex flex-col items-center gap-2 py-6">
            <span className="font-mono text-xs text-danger">{error}</span>
            <button
              type="button"
              onClick={onRetry}
              className="font-mono text-[10px] uppercase tracking-wider text-text-secondary hover:text-text-primary transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {!(isLoading || error) && fragments.length === 0 && (
          <span className="font-mono text-xs text-text-muted py-6 block text-center">
            No ChEMBL fragments matched this pocket. Try again or pick another pocket.
          </span>
        )}

        {!isLoading && !error && fragments.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {fragments.map((frag) => (
              <div
                key={frag.chembl_id}
                onClick={() => !isDockingRunning && onSelect(frag)}
                className={`rounded-lg border p-3 transition-all ${
                  isDockingRunning
                    ? 'cursor-not-allowed opacity-60'
                    : selectedFragment?.chembl_id === frag.chembl_id
                      ? 'border-accent bg-accent/5 shadow-[0_0_0_1px] shadow-accent/20 cursor-pointer'
                      : 'border-border-subtle bg-bg-primary hover:border-purple-500/40 cursor-pointer'
                }`}
              >
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span className="font-mono text-sm font-bold text-purple-400">{frag.chembl_id}</span>
                  {frag.name && frag.name !== frag.chembl_id && (
                    <span className="font-mono text-[10px] text-text-muted truncate">{frag.name}</span>
                  )}
                </div>
                <code
                  title={frag.smiles}
                  className="font-mono text-[10px] text-text-secondary bg-bg-tertiary px-2 py-1 rounded block mb-2 truncate"
                >
                  {frag.smiles?.slice(0, 60)}
                  {frag.smiles?.length > 60 ? '…' : ''}
                </code>
                <div className="flex gap-4">
                  <div>
                    <span className="font-mono text-[10px] uppercase text-text-muted block">MW</span>
                    <span className="font-mono text-sm font-bold text-text-primary">
                      {frag.mw != null ? frag.mw.toFixed(1) : '—'}
                    </span>
                  </div>
                  <div>
                    <span className="font-mono text-[10px] uppercase text-text-muted block">LogP</span>
                    <span className="font-mono text-sm font-bold text-text-primary">
                      {frag.logp != null ? frag.logp.toFixed(2) : '—'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-border pt-3 mt-3 flex items-center justify-between gap-4">
        <span className="font-mono text-xs text-text-muted">
          {selectedFragment
            ? `${selectedFragment.chembl_id} · MW ${selectedFragment.mw != null ? selectedFragment.mw.toFixed(1) : '—'}`
            : 'No molecule selected'}
        </span>
        <button
          type="button"
          onClick={onConfirm}
          disabled={!selectedFragment || isDockingRunning}
          className={`font-mono text-[10px] uppercase tracking-wider px-4 py-1.5 rounded border transition-colors flex items-center gap-2 ${
            !selectedFragment || isDockingRunning
              ? 'border-border text-text-muted bg-bg-tertiary cursor-not-allowed'
              : 'border-accent text-accent bg-accent/10 hover:bg-accent/20'
          }`}
        >
          {isDockingRunning ? (
            <>
              <span className="w-3 h-3 border border-accent border-t-transparent rounded-full animate-spin" />
              Running Vina…
            </>
          ) : (
            'Run Docking'
          )}
        </button>
      </div>
    </div>
  );
}
