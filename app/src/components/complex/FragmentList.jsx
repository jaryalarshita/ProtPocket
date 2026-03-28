import React from 'react';

/**
 * FragmentList — displays suggested fragment molecules from the ChEMBL database for a pocket.
 */
export function FragmentList({ fragments }) {
  if (!fragments || fragments.length === 0) {
    return (
      <div className="text-center py-4">
        <span className="font-mono text-xs uppercase text-text-muted tracking-wider">
          No fragment suggestions available
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <svg className="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
        </svg>
        <span className="font-mono text-sm uppercase tracking-wider text-text-secondary font-bold">
          ChEMBL Fragment Suggestions
        </span>
        <span className="font-mono text-xs bg-purple-500/15 text-purple-400 border border-purple-500/30 px-2 py-0.5 rounded">
          {fragments.length}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {fragments.map((frag, idx) => (
          <div
            key={frag.chembl_id || idx}
            className="flex flex-col gap-2 p-4 bg-bg-primary border border-border-subtle rounded-lg hover:border-purple-500/40 transition-colors"
          >
            {/* Header: Name + ChEMBL link */}
            <div className="flex flex-col gap-0.5">
              <a
                href={`https://www.ebi.ac.uk/chembl/compound_report_card/${frag.chembl_id}/`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-sm font-bold text-purple-400 hover:text-purple-300 hover:underline transition-colors block truncate"
                title={frag.name || frag.chembl_id}
              >
                {frag.name || frag.chembl_id}
              </a>
              {frag.name && frag.name !== frag.chembl_id && (
                <span className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
                  {frag.chembl_id}
                </span>
              )}
            </div>

            {/* SMILES */}
            {frag.smiles && (
              <code className="font-mono text-xs text-text-secondary bg-bg-tertiary px-3 py-1.5 rounded break-all select-all cursor-text block">
                {frag.smiles}
              </code>
            )}

            {/* Properties row */}
            <div className="flex gap-6 mt-1">
              <div className="flex flex-col">
                <span className="font-mono text-[10px] uppercase tracking-wider text-text-muted">MW</span>
                <span className="font-mono text-sm text-text-primary font-bold">{frag.mol_weight?.toFixed(1)}</span>
              </div>
              <div className="flex flex-col">
                <span className="font-mono text-[10px] uppercase tracking-wider text-text-muted">LogP</span>
                <span className="font-mono text-sm text-text-primary font-bold">{frag.logp?.toFixed(2)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
