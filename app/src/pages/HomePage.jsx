import React from 'react';
import { useNavigate } from 'react-router-dom';
import { SearchBar } from '../components/search/SearchBar';
import { DEMO_PROTEINS } from '../config';

export function HomePage() {
  const navigate = useNavigate();

  const handleSearch = (query) => {
    navigate(`/search?q=${encodeURIComponent(query)}`);
  };

  const stats = [
    { value: '1.7M', label: 'Complex Predictions' },
    { value: '20', label: 'Studied Species' },
    { value: '15', label: 'WHO Priority Pathogen Families' },
  ];

  return (
    <div className="flex flex-col w-full min-h-screen">

      {/* Section 1 — Hero */}
      <section className="w-full border-b border-border">
        <div className="max-w-[720px] mx-auto px-6 py-[96px] flex flex-col gap-8 text-center items-center">
          <div className="flex flex-col gap-4 items-center w-full">
            <span className="font-mono text-[11px] uppercase tracking-wider bg-accent-dim dark:border dark:border-accent/30 text-[#1E3A8A] dark:text-accent px-4 py-1.5 rounded-full transition-colors duration-150">
              AlphaFold Complex Database · March 2026
            </span>
            <h1 className="font-display font-bold text-[48px] leading-tight text-[#1E3A8A] dark:text-text-primary transition-colors duration-150">
              Find undrugged protein complexes. Fast.
            </h1>
            <p className="font-body text-[16px] text-text-secondary leading-relaxed max-w-[600px] transition-colors duration-150">
              ProtPocket surfaces the highest-priority undrugged targets from the new AlphaFold complex dataset.
              We use structural gap scoring to identify targets ready for novel therapeutic design.
            </p>
          </div>

          <div className="w-full max-w-[540px] mt-4 text-left">
            <SearchBar onSearch={handleSearch} loading={false} />
          </div>
        </div>
      </section>

      {/* Section 2 — Stats Strip */}
      <section className="w-full border-b border-border bg-bg-secondary transition-colors duration-150">
        <div className="max-w-[1200px] mx-auto grid grid-cols-3 divide-x divide-border">
          {stats.map((stat, idx) => (
            <div key={idx} className="flex flex-col items-center justify-center py-10 px-4 text-center">
              <span className="font-mono text-[32px] text-text-primary mb-2 transition-colors duration-150">{stat.value}</span>
              <span className="font-body font-medium text-[11px] uppercase tracking-wider text-text-muted transition-colors duration-150">{stat.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Section 3 — Featured Complexes */}
      <section className="w-full flex-1">
        <div className="max-w-[1200px] mx-auto px-6 py-[64px] flex flex-col gap-8">
          <div className="flex flex-col gap-1 items-center text-center">
            <h2 className="font-display font-bold text-[24px] text-text-primary">Featured Complexes</h2>
            <span className="font-mono text-xs text-text-muted">Demo targets</span>
          </div>

          <div className="grid grid-cols-3 gap-6">
            {DEMO_PROTEINS.map((protein) => (
              <div
                key={protein.id}
                onClick={() => navigate(`/complex/${protein.id}`)}
                className="flex flex-col gap-3 p-6 bg-bg-secondary border border-border rounded hover:border-accent cursor-pointer transition-colors duration-150"
              >
                <span className="font-mono text-[24px] text-accent tracking-tight">{protein.label}</span>
                <span className="font-body text-[13px] text-text-secondary">{protein.description}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

    </div>
  );
}
