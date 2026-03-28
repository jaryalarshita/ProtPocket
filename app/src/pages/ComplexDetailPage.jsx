import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useComplex } from '../hooks/useComplex';
import { ComplexHeader } from '../components/complex/ComplexHeader';
import { ProteinViewer } from '../components/complex/viewer/ProteinViewer';
import { MetricsPanel } from '../components/complex/MetricsPanel';
import { BindingSitesPanel } from '../components/complex/BindingSitesPanel';
import { LoadingState } from '../components/common/LoadingState';
import { ErrorState } from '../components/common/ErrorState';

export function ComplexDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { complex, loading, error } = useComplex(id);
  const viewerRef = React.useRef(null);

  return (
    <div className="w-full flex flex-col items-center">
      <div className="w-full max-w-[1400px] px-6 py-[48px] flex flex-col gap-6">

        <button
          onClick={() => navigate(-1)}
          className="font-mono text-[11px] uppercase tracking-wider w-24 text-center py-2 bg-bg-tertiary border border-border flex items-center justify-center gap-2 text-text-secondary hover:text-text-primary hover:bg-border-subtle hover:border-border-subtle rounded transition-colors duration-150"
        >
          ← BACK
        </button>

        {loading && <LoadingState message="Loading complex structure..." />}
        {error && <ErrorState message={error} />}

        {!loading && !error && complex && (
          <div className="flex flex-col">
            <ComplexHeader complex={complex} />
            <ProteinViewer
              ref={viewerRef}
              monomerUrl={complex.monomer_structure_url}
              complexUrl={complex.complex_structure_url}
              monomerPlddt={complex.monomer_plddt_avg}
              dimerPlddt={complex.dimer_plddt_avg}
              disorderDelta={complex.disorder_delta}
            />
            <MetricsPanel complex={complex} />

            <BindingSitesPanel
              complexId={id}
              onHighlightPocket={(indices, target) => viewerRef.current?.highlightPocket?.(indices, target)}
              onClearHighlight={(target) => {
                viewerRef.current?.clearPocketHighlight?.(target);
                viewerRef.current?.clearConformations?.(target);
              }}
              proteinPdbId={complex.complex_structure_url?.replace(/\.cif$/i, '.pdb') || complex.uniprot_id || ''}
              onConformationChange={(confs, mode, target) => viewerRef.current?.setConformations?.(confs, mode, target)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
