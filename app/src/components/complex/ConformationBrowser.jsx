import React from 'react';

export function ConformationBrowser({ conformations, activeMode, onSelect }) {
  if (!conformations?.length) return null;

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span className="font-mono text-[11px] uppercase tracking-wider text-text-secondary">Conformations</span>
        <span className="font-mono text-xs bg-bg-tertiary text-text-muted border border-border-subtle px-2 py-0.5 rounded">
          {conformations.length}
        </span>
        <span className="font-mono text-[10px] text-text-muted">Vina output</span>
      </div>

      <div className="max-h-72 overflow-y-auto flex flex-col gap-0.5">
        {conformations.map((c) => {
          const isActive = c.mode === activeMode;
          const affinityColor =
            c.binding_affinity <= -8.0 ? 'text-success' : c.binding_affinity <= -6.0 ? 'text-warning' : 'text-danger';

          return (
            <div
              key={c.mode}
              onClick={() => onSelect(c)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded cursor-pointer transition-colors ${
                isActive
                  ? 'bg-accent/10 border-l-2 border-l-accent pl-[10px]'
                  : 'hover:bg-bg-tertiary'
              }`}
            >
              <span className="font-mono text-xs font-bold text-text-muted bg-bg-tertiary px-1.5 py-0.5 rounded flex-none">
                #{c.mode}
              </span>

              {c.mode === 1 && (
                <span className="font-mono text-[9px] bg-success/15 text-success border border-success/30 px-1 py-0.5 rounded uppercase tracking-wider flex-none">
                  Best
                </span>
              )}

              <span className={`font-mono text-sm flex-1 ${affinityColor} font-bold`}>
                {c.binding_affinity > 0 ? '+' : ''}
                {c.binding_affinity.toFixed(2)}
                <span className="text-text-muted text-[10px] font-normal ml-1">kcal/mol</span>
              </span>

              <span className="font-mono text-[10px] text-text-muted flex-none">
                lb: {c.rmsd_lb.toFixed(1)} ub: {c.rmsd_ub.toFixed(1)}
              </span>
            </div>
          );
        })}
      </div>

      <p className="font-mono text-[9px] text-text-muted mt-2 text-center uppercase tracking-wider">
        Click a conformation to render it in the viewer
      </p>
    </div>
  );
}
