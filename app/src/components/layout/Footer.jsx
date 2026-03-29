import React from 'react';

export function Footer() {
  return (
    <footer className="w-full bg-bg-primary border-t border-border mt-auto">
      <div className="max-w-[1200px] mx-auto px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-8">

          {/* Section 1: Project */}
          <div className="flex flex-col gap-4">
            <span className="font-display font-bold text-lg text-text-primary">ProtPocket</span>
            <p className="font-body text-sm text-text-secondary leading-relaxed max-w-sm">
              An end-to-end computational pipeline for surfacing undrugged protein complexes and generating high-confidence therapeutic leads by targeting the Disorder Delta.
            </p>
            <a
              href="https://github.com/ayush00git/ProtPocket"
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-xs uppercase tracking-wider text-accent hover:text-accent-dim transition-colors w-fit flex items-center gap-1.5 mt-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path></svg>
              View Repository
            </a>
          </div>

          {/* Section 2: Creators */}
          <div className="flex flex-col gap-4">
            <span className="font-mono text-xs uppercase tracking-widest text-text-muted">Creators & Contributors</span>
            <ul className="flex flex-col gap-3">
              <li>
                <a href="https://github.com/jaryalarshita" target="_blank" rel="noopener noreferrer" className="font-body text-sm text-text-secondary hover:text-text-primary transition-colors hover:underline decoration-border-subtle underline-offset-4">
                  Arshita Jaryal
                </a>
              </li>
              <li>
                <a href="https://github.com/ayush00git" target="_blank" rel="noopener noreferrer" className="font-body text-sm text-text-secondary hover:text-text-primary transition-colors hover:underline decoration-border-subtle underline-offset-4">
                  Ayush Kumar
                </a>
              </li>
              <li>
                <a href="https://github.com/divyansh0x0" target="_blank" rel="noopener noreferrer" className="font-body text-sm text-text-secondary hover:text-text-primary transition-colors hover:underline decoration-border-subtle underline-offset-4">
                  Divyansh Singh
                </a>
              </li>
            </ul>
          </div>

          {/* Section 3: Scientific References */}
          <div className="flex flex-col gap-4">
            <span className="font-mono text-xs uppercase tracking-widest text-text-muted">Scientific Resources</span>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-3">
              <li>
                <a href="https://alphafold.ebi.ac.uk/" target="_blank" rel="noopener noreferrer" className="font-body text-sm text-text-secondary hover:text-accent transition-colors flex items-center gap-1">
                  AlphaFold DB <span className="text-[10px] text-text-muted">↗</span>
                </a>
              </li>
              <li>
                <a href="https://www.uniprot.org/" target="_blank" rel="noopener noreferrer" className="font-body text-sm text-text-secondary hover:text-accent transition-colors flex items-center gap-1">
                  UniProt <span className="text-[10px] text-text-muted">↗</span>
                </a>
              </li>
              <li>
                <a href="https://www.ebi.ac.uk/chembl/" target="_blank" rel="noopener noreferrer" className="font-body text-sm text-text-secondary hover:text-accent transition-colors flex items-center gap-1">
                  ChEMBL <span className="text-[10px] text-text-muted">↗</span>
                </a>
              </li>
              <li>
                <a href="https://github.com/Discngine/fpocket" target="_blank" rel="noopener noreferrer" className="font-body text-sm text-text-secondary hover:text-accent transition-colors flex items-center gap-1">
                  fpocket <span className="text-[10px] text-text-muted">↗</span>
                </a>
              </li>
              <li>
                <a href="https://github.com/ccsb-scripps/AutoDock-Vina" target="_blank" rel="noopener noreferrer" className="font-body text-sm text-text-secondary hover:text-accent transition-colors flex items-center gap-1">
                  AutoDock Vina <span className="text-[10px] text-text-muted">↗</span>
                </a>
              </li>
              <li>
                <a href="https://molstar.org/" target="_blank" rel="noopener noreferrer" className="font-body text-sm text-text-secondary hover:text-accent transition-colors flex items-center gap-1">
                  Mol* Viewer <span className="text-[10px] text-text-muted">↗</span>
                </a>
              </li>
            </ul>
          </div>

        </div>

        <div className="w-full flex flex-col items-center justify-center pt-8 mt-12 border-t border-border-subtle">
          <span className="font-mono text-[10px] uppercase tracking-widest text-text-muted">
            © {new Date().getFullYear()} ProtPocket · Open Source Biology
          </span>
        </div>
      </div>
    </footer>
  );
}
