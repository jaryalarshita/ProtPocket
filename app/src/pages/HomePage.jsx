import React from 'react';
import { useNavigate } from 'react-router-dom';
import { SearchBar } from '../components/search/SearchBar';
import { DEMO_PROTEINS } from '../config';
import { MolstarPanel } from '../components/complex/viewer/MolstarPanel';

export function HomePage() {
  const navigate = useNavigate();

  const handleSearch = (query) => {
    navigate(`/search?q=${encodeURIComponent(query)}`);
  };

  const stats = [
    { value: '1.7M', label: 'Complex Predictions' },
    { value: '15', label: 'WHO Priority Pathogen Families' },
    { value: '20', label: 'Studied Species' },
  ];

  const pipelineSteps = [
    {
      num: '01',
      title: 'Discover',
      desc: 'Sifting through 1.7M AlphaFold complexes for high-confidence, undrugged WHO and human disease targets.'
    },
    {
      num: '02',
      title: 'Reveal',
      desc: 'Calculating thermodynamic Disorder Delta to find hidden structures that only stabilize upon dimerization.'
    },
    {
      num: '03',
      title: 'Target',
      desc: 'Running fpocket to autonomously identify geometric cavities situated on these stabilizing interfaces.'
    },
    {
      num: '04',
      title: 'Dock',
      desc: 'Performing high-throughput molecular docking of candidates directly inside the pocket using AutoDock Vina.'
    }
  ];

  return (
    <div className="flex flex-col w-full min-h-screen">

      {/* Section 1 — Hero */}
      <section className="w-full border-b border-border bg-bg-primary">
        <div className="max-w-[800px] mx-auto px-6 py-[100px] flex flex-col gap-8 text-center items-center">
          <div className="flex flex-col gap-5 items-center w-full">
            <span className="font-mono text-[11px] uppercase tracking-wider bg-accent-dim dark:border dark:border-accent/30 text-[#1E3A8A] dark:text-accent px-4 py-1.5 rounded-full transition-colors duration-150 shadow-sm">
              End-to-End Drug Lead Generation Platform
            </span>
            <h1 className="font-display font-bold text-[52px] leading-tight text-[#1E3A8A] dark:text-text-primary transition-colors duration-150">
              From predicted complex to drug lead. Fast.
            </h1>
            <p className="font-body text-[18px] text-text-secondary leading-relaxed max-w-[680px] transition-colors duration-150">
              ProtPocket surfaces the highest-priority undrugged targets from the AlphaFold complex dataset. We compute structural gap scores and interface pocket viability to jumpstart novel therapeutic design.
            </p>
          </div>

          <div className="w-full max-w-[600px] mt-6 text-left drop-shadow-sm">
            <SearchBar onSearch={handleSearch} loading={false} />
          </div>
        </div>
      </section>

      {/* Section 2 — Stats Strip */}
      <section className="w-full border-b border-border bg-bg-secondary transition-colors duration-150">
        <div className="max-w-[1200px] mx-auto grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border">
          {stats.map((stat, idx) => (
            <div key={idx} className="flex flex-col items-center justify-center py-12 px-6 text-center hover:bg-bg-tertiary transition-colors duration-200">
              <span className="font-mono text-[36px] font-bold text-accent mb-2 transition-colors duration-150">{stat.value}</span>
              <span className="font-body font-semibold text-[12px] uppercase tracking-[0.1em] text-text-muted transition-colors duration-150">{stat.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Section 3 — The Pipeline */}
      <section className="w-full border-b border-border bg-bg-primary py-[80px]">
        <div className="max-w-[1200px] mx-auto px-6 flex flex-col gap-12">
          <div className="flex flex-col gap-2 items-center text-center max-w-[700px] mx-auto">
            <h2 className="font-display font-bold text-[32px] text-text-primary">The Pipeline</h2>
            <p className="font-body text-[16px] text-text-secondary leading-relaxed">
              We cross-reference AlphaFold structures, ChEMBL drug data, and WHO priority lists in real-time, feeding the best candidates into our autonomous pocket analysis engine.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {pipelineSteps.map((step, idx) => (
              <div key={idx} className="flex flex-col gap-4 p-6 bg-bg-secondary border border-border rounded-lg relative overflow-hidden group hover:border-accent transition-colors duration-300 shadow-sm">
                <div className="absolute -right-4 -top-6 text-[100px] font-display font-bold text-border-subtle opacity-30 select-none group-hover:text-accent-dim transition-colors duration-300">
                  {step.num}
                </div>
                <h3 className="font-display font-bold text-[20px] text-text-primary mt-4 relative z-10">{step.title}</h3>
                <p className="font-body text-[14px] text-text-secondary leading-relaxed relative z-10">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Section 4 — The Science (Interface Pockets) */}
      <section className="w-full border-b border-border bg-bg-secondary py-[80px]">
        <div className="max-w-[1400px] mx-auto px-6 flex flex-col xl:flex-row gap-12 items-center">
          <div className="flex-1 xl:max-w-[450px] flex flex-col gap-6">
            <span className="font-mono text-[12px] uppercase text-accent tracking-widest border border-accent/30 bg-accent/10 px-3 py-1 rounded w-fit">
              The Holy Grail of PPIs
            </span>
            <h2 className="font-display font-bold text-[32px] text-text-primary leading-tight">
              Targeting the Disorder Delta
            </h2>
            <p className="font-body text-[16px] text-text-secondary leading-relaxed">
              Many proteins appear completely disordered as single monomers, but snap into highly stable structures when bound to their partner. We call this the <strong>Disorder Delta</strong>.
            </p>
            <p className="font-body text-[16px] text-text-secondary leading-relaxed">
              By combining thermodynamic confidence scoring (pLDDT) with geometric cavity detection (<code className="font-mono text-[14px] bg-bg-tertiary px-1 rounded">fpocket</code>), ProtPocket flags cavities that sit exactly on these newly stabilized interfaces. These are the prime targets for Protein-Protein Interaction (PPI) inhibitors.
            </p>
          </div>
          <div className="xl:flex-[2.5] w-full bg-bg-tertiary border border-border rounded-lg flex flex-col md:flex-row items-center justify-center relative overflow-hidden shadow-inner h-[450px]">
             {/* Dual Mol* Viewer Setup for Q55DI5 */}
             <div className="flex-1 w-full h-full relative border-r border-border">
                <MolstarPanel
                  structureUrl="https://alphafold.ebi.ac.uk/files/AF-Q55DI5-F1-model_v6.cif"
                  label="Monomer (Q55DI5)"
                  visible={true}
                  representation="cartoon"
                  plddt={42.1} // actual value from demo data
                  hideControls={true}
                />
             </div>
             <div className="flex-1 w-full h-full relative">
                <MolstarPanel
                  structureUrl="https://alphafold.ebi.ac.uk/files/AF-0000000066503175-model_v1.cif"
                  label="Complex (Homodimer)"
                  visible={true}
                  representation="cartoon"
                  plddt={85.4} // actual value from demo data
                  hideControls={true}
                />
             </div>
          </div>
        </div>
      </section>

      {/* Section 5 — Featured Complexes */}
      <section className="w-full bg-bg-primary border-b border-border">
        <div className="max-w-[1200px] mx-auto px-6 py-[80px] flex flex-col gap-10">
          <div className="flex flex-col gap-2 items-center text-center">
            <h2 className="font-display font-bold text-[32px] text-text-primary">Analyze Live Targets</h2>
            <span className="font-mono text-sm text-text-muted">Select a curated complex to see the pipeline in action</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {DEMO_PROTEINS.map((protein) => (
              <div
                key={protein.id}
                onClick={() => navigate(`/complex/${protein.id}`)}
                className="flex flex-col gap-4 p-6 bg-bg-secondary border border-border rounded-lg hover:border-accent hover:shadow-[0_4px_20px_rgba(0,0,0,0.05)] cursor-pointer transition-all duration-300"
              >
                <div className="flex justify-between items-start">
                  <span className="font-display font-bold text-[22px] text-accent tracking-tight">{protein.label}</span>
                  <div className="w-8 h-8 rounded-full bg-bg-tertiary flex items-center justify-center text-text-muted group-hover:text-accent transition-colors">
                    ↗
                  </div>
                </div>
                <span className="font-body text-[14px] text-text-secondary leading-relaxed">{protein.description}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

    </div>
  );
}
