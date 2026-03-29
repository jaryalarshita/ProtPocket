import React, { useState, forwardRef, useImperativeHandle } from 'react';
import { motion } from 'framer-motion';
import { useTheme } from '../../../hooks/useTheme';
import { useMolstar } from './useMolstar';
import { ViewerHeader } from './ViewerHeader';
import { ViewerFooter } from './ViewerFooter';

export const MolstarPanel = React.memo(forwardRef(({ structureUrl, label, plddt, description, visible = true, highlightIndices = null, representation = 'cartoon', conformations = null, activeMode = null, hideControls = false }, ref) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const { theme } = useTheme();
  const { containerRef, isLoading, error, highlightPocket, clearPocketHighlight } = useMolstar({
    structureUrl,
    label,
    autoLoad: visible && !!structureUrl,
    highlightIndices,
    theme,
    representation,
    conformations,
    activeMode,
    hideControls,
  });

  useImperativeHandle(ref, () => ({
    highlightPocket,
    clearPocketHighlight
  }));

  if (!visible) return null;

  return (
    <motion.div 
      layout
      transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
      className={isFullscreen 
        ? "fixed inset-0 z-50 flex flex-col bg-bg-primary" 
        : "flex-1 flex flex-col h-[400px] min-w-0"
      }
    >
      <ViewerHeader label={label} plddt={plddt} />

      <div className="flex-1 relative bg-bg-primary overflow-visible">
        {/* Mol* canvas container */}
        <div
          ref={containerRef}
          className="absolute inset-0"
          style={{ width: '100%', height: '100%', position: 'absolute' }}
        />

        {conformations?.length > 0 && !isLoading && !error && (
          <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5 px-2 py-1 bg-bg-secondary/90 border border-orange-500/40 rounded backdrop-blur-sm">
            <div className="w-2 h-2 rounded-full bg-orange-500" />
            <span className="font-mono text-[9px] uppercase tracking-wider text-orange-400">
              {conformations.length} poses loaded
            </span>
          </div>
        )}

        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-bg-primary/80 z-10">
            <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            <span className="mt-2 font-mono text-[10px] uppercase text-text-muted tracking-[0.1em]">
              Loading structure...
            </span>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-bg-primary z-10 gap-2">
            <span className="font-mono text-[10px] uppercase text-danger tracking-[0.1em] border border-danger px-2 py-0.5 rounded">
              ERR
            </span>
            <span className="font-mono text-xs text-text-muted text-center px-4">
              {error}
            </span>
          </div>
        )}

        {/* No URL state */}
        {!structureUrl && !isLoading && !error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-bg-primary z-10 gap-2 p-6 text-center">
            <span className="font-mono text-[10px] uppercase text-text-muted tracking-[0.1em] leading-relaxed max-w-[80%]">
              Complex structure file not yet available on AlphaFold servers
            </span>
          </div>
        )}

        {/* Fullscreen toggle button */}
        {structureUrl && !isLoading && !error && (
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="absolute bottom-3 right-3 z-20 p-2 bg-bg-secondary hover:bg-bg-tertiary text-text-muted hover:text-text-primary rounded-md backdrop-blur-sm border border-border shadow-sm transition-all"
            title={isFullscreen ? "Minimize" : "Maximize"}
          >
            {isFullscreen ? (
               <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/></svg>
            ) : (
               <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
            )}
          </button>
        )}
      </div>

      <ViewerFooter description={description} url={structureUrl} />
    </motion.div>
  );
}));
