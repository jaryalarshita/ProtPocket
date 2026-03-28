import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '../common/Badge';
import { GapScoreBar } from '../common/GapScoreBar';

export function TargetTable({ data = [], filter = 'all', onFilterChange }) {
  const navigate = useNavigate();

  const filters = [
    { id: 'all', label: 'All Targets' },
    { id: 'who_pathogen', label: 'WHO Pathogens' },
    { id: 'human_disease', label: 'Human Disease' },
  ];

  return (
    <div className="w-full bg-bg-secondary border border-border rounded overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-row items-center justify-between px-4 h-[56px] border-b border-border bg-bg-secondary">
        <div className="flex flex-row gap-2">
          {filters.map((f) => {
            const isActive = filter === f.id;
            return (
              <button
                key={f.id}
                onClick={() => onFilterChange(f.id)}
                className={`font-body text-sm px-3 py-1.5 rounded border transition-colors duration-150 ${
                  isActive 
                    ? 'border-accent text-accent bg-accent-dim' 
                    : 'border-transparent text-text-secondary hover:text-text-primary'
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>
        <div className="font-mono text-xs text-text-muted">
          {data.length} TARGETS
        </div>
      </div>

      {/* Table */}
      <div className="w-full overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-bg-tertiary border-b border-border">
              <th className="py-3 px-4 font-mono text-[11px] uppercase text-text-muted font-normal w-[48px]">#</th>
              <th className="py-3 px-4 font-mono text-[11px] uppercase text-text-muted font-normal">Protein</th>
              <th className="py-3 px-4 font-mono text-[11px] uppercase text-text-muted font-normal">Organism</th>
              <th className="py-3 px-4 font-mono text-[11px] uppercase text-text-muted font-normal">Confidence</th>
              <th className="py-3 px-4 font-mono text-[11px] uppercase text-text-muted font-normal text-center">Drugs</th>
              <th className="py-3 px-4 font-mono text-[11px] uppercase text-text-muted font-normal">Delta</th>
              <th className="py-3 px-4 font-mono text-[11px] uppercase text-text-muted font-normal w-[200px]">Gap Score</th>
              <th className="py-3 px-4 font-mono text-[11px] uppercase text-text-muted font-normal">Flags</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, index) => {
              const { 
                uniprot_id, protein_name, gene_name, organism, 
                dimer_plddt_avg, drug_count, disorder_delta, gap_score, 
                is_who_pathogen, review_status 
              } = row;

              return (
                <tr 
                  key={uniprot_id}
                  onClick={() => navigate(`/complex/${uniprot_id}`)}
                  className="group border-b border-border-subtle last:border-b-0 cursor-pointer hover:bg-[#BFDBFE] transition-colors duration-150"
                >
                  <td className="py-4 px-4 font-mono text-xs text-text-muted align-top pt-5">
                    {index + 1}
                  </td>
                  <td className="py-4 px-4 align-top">
                    <div className="font-display font-bold text-[13px] text-text-primary group-hover:text-accent transition-colors leading-tight mb-1">
                      {protein_name}
                    </div>
                    <div className="font-mono text-[11px] text-accent">{gene_name}</div>
                  </td>
                  <td className="py-4 px-4 align-top pt-5">
                    <div className="italic text-xs text-text-secondary truncate max-w-[150px]" title={organism}>
                      {organism}
                    </div>
                  </td>
                  <td className="py-4 px-4 align-top pt-5">
                    <div className="font-mono text-xs text-text-primary">
                      {(dimer_plddt_avg || 0).toFixed(1)}%
                    </div>
                  </td>
                  <td className="py-4 px-4 align-top pt-5 text-center">
                    <div className="font-mono text-xs text-text-primary">
                      {drug_count === -1 ? '?' : drug_count}
                    </div>
                  </td>
                  <td className="py-4 px-4 align-top pt-5">
                    <div className={`font-mono text-xs ${disorder_delta > 0 ? 'text-success' : 'text-text-primary'}`}>
                      {disorder_delta > 0 ? '+' : ''}{(disorder_delta || 0).toFixed(1)}
                    </div>
                  </td>
                  <td className="py-4 px-4 align-top pt-5">
                    <GapScoreBar score={gap_score} showLabel={true} />
                  </td>
                  <td className="py-4 px-4 align-top pt-5">
                    <div className="flex flex-col gap-1.5 items-start">
                      {review_status === 'unreviewed' && <Badge variant="unreviewed">Unreviewed</Badge>}
                      {is_who_pathogen && <Badge variant="who">WHO pathogen</Badge>}
                      {drug_count === 0 && <Badge variant="undrugged">Undrugged</Badge>}
                    </div>
                  </td>
                </tr>
              );
            })}
            {data.length === 0 && (
              <tr>
                <td colSpan="8" className="py-8 text-center text-text-muted font-mono text-sm">
                  No targets found for this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
