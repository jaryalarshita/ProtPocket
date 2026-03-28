import React from 'react';
import { Badge } from '../common/Badge';

export function ComplexHeader({ complex }) {
  const {
    alphafold_id,
    protein_name,
    gene_name,
    organism,
    uniprot_id,
    disease_associations,
    is_who_pathogen,
    drug_count,
    review_status
  } = complex;

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
    <div className="flex flex-col gap-6 pb-6 border-b border-border mb-6">
      <div className="flex flex-row justify-between items-center">
        <span className="font-mono text-xs text-text-muted">{alphafold_id}</span>
        <div className="flex flex-row gap-2">
          {review_status === 'unreviewed' && <Badge variant="unreviewed">UNREVIEWED (TrEMBL)</Badge>}
          {is_who_pathogen && <Badge variant="who">WHO PATHOGEN</Badge>}
          <Badge variant={getDrugBadgeVariant(drug_count)}>
            {getDrugBadgeText(drug_count)}
          </Badge>
        </div>
      </div>
      
      <h1 className="font-display font-bold text-[32px] leading-tight text-text-primary">
        {protein_name}
      </h1>

      <div className="flex flex-row items-center gap-2">
        <span className="font-mono text-[15px] text-accent">{gene_name}</span>
        <span className="text-text-muted">·</span>
        <span className="italic text-[15px] text-text-secondary">{organism}</span>
        <span className="text-text-muted">·</span>
        <a 
          href={`https://www.uniprot.org/uniprotkb/${uniprot_id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-[13px] text-accent hover:text-[#1D4ED8] transition-colors duration-150 underline decoration-border-subtle hover:decoration-[#1D4ED8] underline-offset-4"
        >
          {uniprot_id} ↗
        </a>
      </div>

      {disease_associations && disease_associations.length > 0 && (
        <div className="flex flex-col gap-2 mt-2">
          <span className="font-mono text-[11px] uppercase tracking-wider text-text-muted">
            Disease Associations
          </span>
          <div className="flex flex-row flex-wrap gap-2">
            {disease_associations.map((disease, idx) => (
              <span 
                key={idx}
                className="font-body text-[13px] text-text-secondary bg-bg-tertiary border border-border px-2.5 py-1 rounded"
              >
                {disease}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
