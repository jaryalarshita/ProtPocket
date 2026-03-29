import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '../common/Badge';
import { GapScoreBar } from '../common/GapScoreBar';

export function ResultCard({ complex }) {
  const navigate = useNavigate();

  const {
    uniprot_id,
    protein_name,
    gene_name,
    organism,
    is_who_pathogen,
    dimer_plddt_avg,
    disorder_delta,
    drug_count,
    gap_score,
    category
  } = complex;

  const handleCardClick = () => {
    navigate(`/complex/${uniprot_id}`);
  };

  const getDrugBadgeVariant = (count) => {
    if (count === -1) return 'unknown';
    if (count === 0) return 'undrugged';
    return 'drugged';
  };

  const getDrugBadgeText = (count) => {
    if (count === -1) return 'DRUGS UNKNOWN';
    if (count === 0) return 'UNDRUGGED';
    return `${count} DRUGS`;
  };

  return (
    <div
      onClick={handleCardClick}
      className="flex flex-col gap-4 p-5 bg-bg-secondary border border-border rounded hover:border-accent cursor-pointer transition-colors duration-150"
    >
      <div className="flex flex-row justify-between items-start gap-4">
        <h3 className="font-display font-bold text-[18px] leading-tight text-text-primary">
          {protein_name}
        </h3>
        <div className="flex flex-row items-center gap-2 flex-wrap justify-end">
          {is_who_pathogen && <Badge variant="who">WHO PATHOGEN</Badge>}
          <Badge variant={getDrugBadgeVariant(drug_count)}>
            {getDrugBadgeText(drug_count)}
          </Badge>
        </div>
      </div>

      <div className="flex flex-row items-center justify-start gap-2">
        <span className="font-mono text-[13px] text-accent">{gene_name}</span>
        <span className="text-text-muted">·</span>
        <span className="italic text-[16px] text-text-secondary">{organism}</span>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="font-mono text-[12px] uppercase tracking-[0.06em] text-text-muted">Gap Score</div>
        <GapScoreBar score={gap_score} showLabel={true} />
      </div>

      <div className="grid grid-cols-3 gap-px bg-border rounded overflow-hidden mt-1 border border-border">
        <div className="flex flex-col items-center justify-center p-3 bg-bg-tertiary">
          <span className="font-mono text-[12px] uppercase text-text-muted mb-1">Confidence</span>
          <span className="font-mono text-[13px] text-text-primary">{(dimer_plddt_avg || 0).toFixed(1)}%</span>
        </div>
        <div className="flex flex-col items-center justify-center p-3 bg-bg-tertiary">
          <span className="font-mono text-[12px] uppercase text-text-muted mb-1">Disorder Delta</span>
          <span className={`font-mono text-[13px] ${disorder_delta > 0 ? 'text-success' : 'text-text-primary'}`}>
            {disorder_delta > 0 ? '+' : ''}{(disorder_delta || 0).toFixed(1)}
          </span>
        </div>
        <div className="flex flex-col items-center justify-center p-3 bg-bg-tertiary text-center">
          <span className="font-mono text-[10px] uppercase text-text-muted mb-1">Exists</span>
          <span className="font-mono text-[11px] text-text-primary uppercase break-words w-full">
            {disorder_delta > 0 ? "Both Monomer and Homodimer" : 'Monomer Only'}
          </span>
        </div>
      </div>
    </div>
  );
}
