import React, { useState, useRef, useImperativeHandle, forwardRef, useMemo } from 'react';
import { MolstarPanel } from './MolstarPanel';
import { DisorderDeltaBar } from './DisorderDeltaBar';

/**
 * ProteinViewer — Displays monomer and dimer Mol* viewers side by side.
 * Supports synchronized conformations (docking results) for both monomer and dimer.
 */
export const ProteinViewer = forwardRef(
  ({ 
    monomerUrl, 
    complexUrl, 
    monomerPlddt, 
    dimerPlddt, 
    disorderDelta,
    monomerConformations = null,
    complexConformations = null,
    activeModeMonomer = null,
    activeModeComplex = null
  }, ref) => {
    const [isZoomed, setIsZoomed] = useState(false);
    const [activeHighlight, setActiveHighlight] = useState(null); // { indices, target }
    const [representation, setRepresentation] = useState('cartoon');
    
    // Internal state for docking results triggered via imperative API
    const [monomerDocking, setMonomerDocking] = useState({ conformations: null, activeMode: null });
    const [complexDocking, setComplexDocking] = useState({ conformations: null, activeMode: null });

    const mConfs = monomerConformations ?? monomerDocking.conformations;
    const mMode = activeModeMonomer ?? monomerDocking.activeMode;
    const cConfs = complexConformations ?? complexDocking.conformations;
    const cMode = activeModeComplex ?? complexDocking.activeMode;

    const monomerViewerRef = useRef(null);
    const complexViewerRef = useRef(null);

    useImperativeHandle(ref, () => ({
      highlightPocket: (residueIndices, target = 'complex') => {
        setActiveHighlight({ indices: residueIndices, target });
      },
      clearPocketHighlight: () => {
        setActiveHighlight(null);
      },
      setConformations: (confs, mode, target = 'complex') => {
        if (target === 'monomer' || target === 'both') {
          setMonomerDocking({ conformations: confs, activeMode: mode });
        }
        if (target === 'complex' || target === 'both') {
          setComplexDocking({ conformations: confs, activeMode: mode });
        }
      },
      clearConformations: (target = 'both') => {
        if (target === 'monomer' || target === 'both') {
          setMonomerDocking({ conformations: null, activeMode: null });
        }
        if (target === 'complex' || target === 'both') {
          setComplexDocking({ conformations: null, activeMode: null });
        }
      },
    }));

    // Close zoom on Escape key
    React.useEffect(() => {
      if (!isZoomed) return;
      const handleKey = (e) => {
        if (e.key === 'Escape') setIsZoomed(false);
      };
      window.addEventListener('keydown', handleKey);
      return () => window.removeEventListener('keydown', handleKey);
    }, [isZoomed]);

    const expandButton = useMemo(
      () => (
        <div className="flex flex-row justify-end items-center gap-4">
          <div className="flex bg-bg-tertiary rounded border border-border p-1">
            {[
              { label: 'Cartoon', value: 'cartoon' },
              { label: 'Ball & Stick', value: 'ball-and-stick' },
              { label: 'Surface', value: 'gaussian-surface' },
              { label: 'Spheres', value: 'spacefill' },
            ].map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setRepresentation(opt.value)}
                className={`px-3 py-1 font-mono text-[10px] uppercase tracking-wider rounded transition-colors ${
                  representation === opt.value
                    ? 'bg-bg-primary border border-border-subtle shadow-[0_1px_2px_rgba(0,0,0,0.4)] text-text-primary'
                    : 'text-text-muted hover:text-text-secondary'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setIsZoomed(true)}
            className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider px-3 py-1.5 rounded border border-border bg-bg-tertiary text-text-secondary hover:text-text-primary hover:border-accent transition-colors duration-150"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
            </svg>
            Expand View
          </button>
        </div>
      ),
      [representation, setIsZoomed]
    );

    const renderMonomer = (zoomed = false) => (
      <MolstarPanel
        ref={zoomed ? null : monomerViewerRef}
        structureUrl={monomerUrl}
        label="Monomer (single chain)"
        plddt={monomerPlddt}
        description="Disordered regions visible in isolation."
        visible
        highlightIndices={
          activeHighlight?.target === 'monomer' ||
          activeHighlight?.target === 'comparison' ||
          activeHighlight?.target === 'both'
            ? activeHighlight.indices
            : null
        }
        representation={representation}
        conformations={mConfs}
        activeMode={mMode}
      />
    );

    const renderComplex = (zoomed = false) => (
      <MolstarPanel
        ref={zoomed ? null : complexViewerRef}
        structureUrl={complexUrl}
        label="Homodimer (complex)"
        plddt={dimerPlddt}
        description="Functional domain revealed in complex form."
        visible
        highlightIndices={
          activeHighlight?.target === 'complex' ||
          activeHighlight?.target === 'comparison' ||
          activeHighlight?.target === 'both'
            ? activeHighlight.indices
            : null
        }
        representation={representation}
        conformations={cConfs}
        activeMode={cMode}
      />
    );

    return (
      <div className="flex flex-col gap-2">
        {expandButton}

        <div className={`flex flex-row w-full border border-border rounded overflow-visible ${isZoomed ? 'invisible h-0 overflow-hidden' : ''}`}>
          <div className="flex flex-1" style={{ minWidth: 0 }}>
            {renderMonomer(false)}
          </div>

          <div className="flex-none overflow-hidden" style={{ width: 48, height: '400px' }}>
            <DisorderDeltaBar disorderDelta={disorderDelta} visible />
          </div>

          <div className="flex flex-1 overflow-hidden" style={{ minWidth: 0 }}>
            {renderComplex(false)}
          </div>
        </div>

        {/* pLDDT Legend */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 py-3 px-4 bg-bg-secondary border border-border rounded">
          <span className="font-mono text-[10px] uppercase text-text-muted tracking-wider">AlphaFold Confidence (pLDDT):</span>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#2b4cdb', boxShadow: '0 0 0 1px rgba(0,0,0,0.1) inset' }} />
              <span className="font-mono text-[10px] text-text-primary">Very High (&gt;90)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#8fa8ef', boxShadow: '0 0 0 1px rgba(0,0,0,0.1) inset' }} />
              <span className="font-mono text-[10px] text-text-primary">Confident (70-90)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#f0e0c0', boxShadow: '0 0 0 1px rgba(0,0,0,0.1) inset' }} />
              <span className="font-mono text-[10px] text-text-primary">Low (50-70)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#db2b2b', boxShadow: '0 0 0 1px rgba(0,0,0,0.1) inset' }} />
              <span className="font-mono text-[10px] text-text-primary">Very Low (&lt;50)</span>
            </div>
          </div>
        </div>

        {/* Fullscreen zoom overlay */}
        {isZoomed && (
          <div className="fixed inset-0 z-50 flex flex-col bg-bg-primary">
            <div className="flex-none flex items-center justify-between px-6 py-3 border-b border-border bg-bg-secondary">
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-accent" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
                </svg>
                <span className="font-mono text-sm uppercase tracking-wider text-text-primary font-bold">Structure Comparison</span>
              </div>
              <button
                type="button"
                onClick={() => setIsZoomed(false)}
                className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider px-4 py-2 rounded border border-border bg-bg-tertiary text-text-secondary hover:text-text-primary transition-colors"
              >
                Close · ESC
              </button>
            </div>

            <div className="flex-1 flex flex-row min-h-0">
              <div className="flex-1 flex flex-col min-w-0 border-r border-border">
                {renderMonomer(true)}
              </div>
              <div className="flex-none" style={{ width: 48 }}>
                <DisorderDeltaBar disorderDelta={disorderDelta} visible />
              </div>
              <div className="flex-1 flex flex-col min-w-0 border-l border-border">
                {renderComplex(true)}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
);
