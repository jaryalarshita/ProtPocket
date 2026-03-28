import React, { useState } from 'react';
import { useBindingSites } from '../../hooks/useBindingSites';
import { PocketTableRow } from './PocketTableRow';
import { ComparisonTab } from './ComparisonTab';

/**
 * BindingSitesPanel — predicted binding sites section for the complex detail page.
 * Lazy-loads binding site data and displays pocket cards with highlighting support.
 */
export function BindingSitesPanel({ complexId, onHighlightPocket, onClearHighlight, proteinPdbId, onConformationChange }) {
  const [enabled, setEnabled] = useState(true);
  const [activePocketIdx, setActivePocketIdx] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const [activeTab, setActiveTab] = useState('monomer'); // 'monomer', 'complex', 'comparison'


  const { pockets, totalPockets, monomerPockets, monomerTotalPockets, interfaceCount, loading, error, comparison } = useBindingSites(
    complexId,
    enabled,
    showAll
  );

  const handleHighlight = (residueIndices, pocketIdx, targetOverride) => {
    const target = targetOverride || activeTab;
    if (activePocketIdx === pocketIdx) {
      // Toggle off
      setActivePocketIdx(null);
      onClearHighlight?.(target);
    } else {
      setActivePocketIdx(pocketIdx);
      onHighlightPocket?.(residueIndices, target);
    }
  };

  const handleTabSwitch = (tab) => {
    if (activePocketIdx !== null) {
      onClearHighlight?.(activeTab);
      setActivePocketIdx(null);
    }
    setActiveTab(tab);
  };

  // Gate hidden for now: no CTA, `enabled` stays false → no binding-sites fetch.
  if (!enabled) {
    return null;
  }

  // Loading state
  if (loading) {
    return (
      <div className="mt-8 bg-bg-secondary border border-border rounded p-8 flex flex-col items-center gap-3">
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        <div className="flex flex-col items-center gap-1">
          <span className="font-mono text-[11px] uppercase tracking-wider text-text-muted">
            Running fpocket analysis...
          </span>
          <span className="font-body text-xs text-text-muted">
            Downloading structure, identifying pockets, cross-referencing pLDDT data
          </span>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="mt-8 bg-bg-secondary border border-danger/30 rounded p-6 flex flex-col items-center gap-3">
        <span className="font-mono text-[10px] uppercase text-danger tracking-wider border border-danger px-2 py-0.5 rounded">
          Analysis Failed
        </span>
        <span className="font-mono text-xs text-text-muted text-center">{error}</span>
        <button
          onClick={() => setEnabled(false)}
          className="font-mono text-[10px] uppercase tracking-wider px-4 py-1.5 rounded border border-border text-text-secondary hover:text-text-primary transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  const allDisplayedPockets = activeTab === 'monomer' ? monomerPockets : pockets;
  const displayedTotal = activeTab === 'monomer' ? monomerTotalPockets : totalPockets;
  const displayedPockets = showAll ? allDisplayedPockets : allDisplayedPockets.slice(0, 5);

  // Empty state overall
  if (pockets?.length === 0 && monomerPockets?.length === 0) {
    return (
      <div className="mt-8 bg-bg-secondary border border-border rounded p-6 flex flex-col items-center gap-2">
        <h3 className="font-display font-bold text-lg text-text-primary">Binding Sites</h3>
        <p className="font-mono text-xs text-text-muted">
          No druggable pockets identified on this structure.
        </p>
      </div>
    );
  }

  // Results
  return (
    <div className="mt-8 bg-bg-secondary border border-border rounded p-6 flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <h3 className="font-display font-bold text-lg text-text-primary">
              Predicted Binding Sites
            </h3>

            {/* Tabs */}
            <div className="flex bg-bg-tertiary rounded border border-border p-1">
              <button
                onClick={() => handleTabSwitch('monomer')}
                className={`px-3 py-1 font-mono text-[10px] uppercase tracking-wider rounded transition-colors ${
                  activeTab === 'monomer'
                    ? 'bg-bg-primary border border-border-subtle shadow-[0_1px_2px_rgba(0,0,0,0.4)] text-text-primary'
                    : 'text-text-muted hover:text-text-secondary'
                }`}
              >
                Monomer
              </button>
              <button
                onClick={() => handleTabSwitch('complex')}
                className={`px-3 py-1 font-mono text-[10px] uppercase tracking-wider rounded transition-colors ${
                  activeTab === 'complex'
                    ? 'bg-bg-primary border border-border-subtle shadow-[0_1px_2px_rgba(0,0,0,0.4)] text-text-primary'
                    : 'text-text-muted hover:text-text-secondary'
                }`}
              >
                Complex (Dimer)
              </button>
              <button
                onClick={() => handleTabSwitch('comparison')}
                className={`px-3 py-1 font-mono text-[10px] uppercase tracking-wider rounded transition-colors ${
                  activeTab === 'comparison'
                    ? 'bg-bg-primary border border-border-subtle shadow-[0_1px_2px_rgba(0,0,0,0.4)] text-text-primary'
                    : 'text-text-muted hover:text-text-secondary'
                }`}
              >
                Comparison Analysis
              </button>
            </div>

            {activeTab !== 'comparison' && (
              <span className="font-mono text-[10px] text-text-muted bg-bg-tertiary px-2 py-0.5 rounded border border-border-subtle flex items-center justify-center">
                {displayedTotal} total → {displayedPockets.length} shown
              </span>
            )}
          </div>
          <p className="font-mono text-[11px] text-text-muted uppercase tracking-wider">
            {activeTab === 'comparison' ? 'Dimerization comparative analysis' : `fpocket analysis ${activeTab === 'complex' ? 'with disorder delta filtering' : 'single chain'}`}
          </p>
        </div>

        {activeTab === 'complex' && interfaceCount > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-success/10 border border-success/20">
            <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
            <span className="font-mono text-[10px] uppercase tracking-wider text-success">
              {interfaceCount} interface pocket{interfaceCount > 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>

      {activeTab === 'comparison' ? (
        <ComparisonTab
          comparison={comparison}
          activePocketIdx={activePocketIdx}
          handleHighlight={handleHighlight}
          proteinPdbId={proteinPdbId}
          onConformationChange={onConformationChange}
        />
      ) : (
        <>
          {/* Pocket table */}
          <div className="overflow-x-auto border border-border rounded">
            <table className="w-full text-left border-collapse">
              <thead className="bg-bg-tertiary border-b border-border">
                <tr>
                  <th className="px-4 py-2 font-mono text-xs uppercase tracking-wider text-text-muted">ID</th>
                  <th className="px-4 py-2 font-mono text-xs uppercase tracking-wider text-text-muted">Score</th>
                  <th className="px-4 py-2 font-mono text-xs uppercase tracking-wider text-text-muted">Vol</th>
                  <th className="px-4 py-2 font-mono text-xs uppercase tracking-wider text-text-muted">Hydro</th>
                  <th className="px-4 py-2 font-mono text-xs uppercase tracking-wider text-text-muted">Polar</th>
                  <th className="px-4 py-2 font-mono text-xs uppercase tracking-wider text-text-muted">pLDDT</th>
                  <th className="px-4 py-2 font-mono text-xs uppercase tracking-wider text-text-muted">Center</th>
                  <th className="px-4 py-2 font-mono text-xs uppercase tracking-wider text-text-muted">Residues</th>
                  <th className="px-4 py-2 font-mono text-xs uppercase tracking-wider text-text-muted items-center justify-center text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayedPockets.length > 0 ? (
                  displayedPockets.map((pocket, idx) => (
                    <PocketTableRow
                      key={pocket.pocket_id}
                      pocket={pocket}
                      activeTab={activeTab}
                      isActive={activePocketIdx === idx}
                      onHighlight={(residueIndices) => handleHighlight(residueIndices, idx)}
                      proteinPdbId={proteinPdbId}
                      onConformationChange={(confs, mode) => onConformationChange?.(confs, mode, activeTab)}
                    />
                  ))
                ) : (
                  <tr>
                    <td colSpan="9" className="px-4 py-8 text-center text-text-muted font-mono text-sm">
                      No pockets found for the {activeTab} structure.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Show All Button */}
          {displayedTotal > displayedPockets.length && !loading && !showAll && (
            <div className="flex justify-center mt-2">
              <button
                onClick={() => setShowAll(true)}
                className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-text-secondary hover:text-text-primary transition-colors"
              >
                <span>Show all {displayedTotal} pockets in {activeTab}</span>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
          )}
          {loading && showAll && (
            <div className="flex justify-center mt-2">
              <span className="font-mono text-xs uppercase text-text-muted animate-pulse">Running full analysis...</span>
            </div>
          )}
        </>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 pt-2 border-t border-border-subtle">
        <span className="font-mono text-[9px] uppercase tracking-wider text-text-muted">Legend:</span>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-success" />
          <span className="font-mono text-[9px] text-text-muted">Interface pocket (Δ pLDDT ≥ 5.0)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-text-muted" />
          <span className="font-mono text-[9px] text-text-muted">Standard pocket</span>
        </div>
      </div>
    </div>
  );
}
