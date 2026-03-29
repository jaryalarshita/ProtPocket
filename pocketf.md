# ProtPocket: Binding Site Prediction & Fragment Suggestion Pipeline

## The Scientific Gap

In modern structural biology, **AlphaFold** has revolutionized our understanding of protein shapes, and databases like **ChEMBL** contain datasets of millions of synthesizable chemical compounds. However, a massive analytical gap remains: *Given a newly predicted protein structure, where exactly should a drug bind to inhibit its function, and what should that initial lead compound look like?*

Historically, identifying cryptic or transient binding pockets (especially at Protein-Protein Interaction interfaces) has required expensive molecular dynamics simulations or wet-lab mutagenesis. Finding a compound that binds to these specific pockets requires extensive high-throughput screening.

## What ProtPocket Has Achieved

With the `pocketf` (fpocket integration) pipeline, ProtPocket automates the transition from **Structure Prediction** to **Target Identification** and **Lead Generation** in a single platform. We have achieved a novel computational approach that identifies high-value druggable targets by combining geometric pocket detection with AlphaFold confidence metrics.

### 1. Disorder Delta (Δ pLDDT) Analysis
Proteins often contain Intrinsically Disordered Regions (IDRs) that only adopt a stable 3D structure when interacting with a partner (Folding-Upon-Binding). By comparing the AlphaFold per-residue confidence (pLDDT) of a single chain (Monomer) against its complex (Homodimer), ProtPocket calculates a **Disorder Delta**.
* **High ∆ pLDDT** precisely maps the interface regions critical to the protein's assembly and function.

### 2. Geometric Pocket Hunting
Using the powerful `fpocket` algorithm, the architecture scans the entire surface of the protein complex using Voronoi tessellation and alpha-spheres to find cavities. It scores these pockets on volume, hydrophobicity, polarity, and overall druggability.

### 3. The "Interface Pocket" Discovery
This is the scientific breakthrough of the pipeline. By cross-referencing the geometric `fpocket` output with our thermodynamic `Disorder Delta`, ProtPocket dynamically filters the pockets. If a geometrically perfect pocket consists of residues that showed a massive gain in structural stability upon complex formation (average ∆ pLDDT ≥ 5.0), it is flagged as an **Interface Pocket**. 
* These pockets are the "Holy Grail" of drug discovery: they represent allosteric sites or direct Protein-Protein Interaction (PPI) inhibitors, which are substantially more effective than standard competitive active-site inhibitors.

### 4. Automated Fragment Suggestion
Once an Interface Pocket is identified, ProtPocket calculates the physical constraints (Volume, Hydrophobicity). The system automatically suggests lead-like small-molecule fragments (with properties like Molecular Weight and LogP) that could act as a starting scaffold for drug chemists.

---

## The End-to-End Pipeline Flow (Case Study: Q55DI5)

To illustrate how ProtPocket accomplishes this, let's trace the exact execution path when a researcher searches for the protein **Q55DI5**:

```mermaid
graph TD
    %% Styling
    classDef user fill:#6366f1,stroke:#4f46e5,stroke-width:2px,color:#fff
    classDef alphafold fill:#10b981,stroke:#059669,stroke-width:2px,color:#fff
    classDef backend fill:#f59e0b,stroke:#d97706,stroke-width:2px,color:#fff
    classDef fpocket fill:#ef4444,stroke:#dc2626,stroke-width:2px,color:#fff
    classDef zinc fill:#8b5cf6,stroke:#7c3aed,stroke-width:2px,color:#fff;
    classDef frontend fill:#ec4899,stroke:#db2777,stroke-width:2px,color:#fff

    A([User searches for Q55DI5]):::user --> B{AlphaFold DB Lookup}:::alphafold
    B -->|Monomer ID| C[Fetch Monomer pLDDT]:::alphafold
    B -->|Complex ID (ModelEntity)| D[Fetch Homodimer pLDDT]:::alphafold
    
    C --> E(Disorder Delta Calculation):::backend
    D --> E
    
    A --> F([User clicks 'Run Pocket Analysis']):::user
    D --> |Download Complex CIF| G[Spawns fpocket Subprocess]:::fpocket
    
    G --> H[fpocket identifies cavities & scores]:::fpocket
    H --> I(Backend traverses _info.txt & PDBs):::backend
    
    I --> J{Average ∆ pLDDT ≥ 5.0?}:::backend
    J -->|Yes| K[Flag as Interface Pocket]:::backend
    J -->|No| L[Mark as Standard Pocket]:::backend
    
    K --> M[Query Database for Fragments]:::zinc
    
    M --> N[Frontend renders Pocket Cards]:::frontend
    L --> N
    
    N --> O([User clicks 'Highlight in Viewer']):::user
    O --> P[Mol* natively focuses & paints pocket cyan/green]:::frontend
```

### Phase 1: Structure Retrieval & Delta Computation
1. **User Search:** The user inputs the UniProt ID **Q55DI5**.
2. **AlphaFold Query:** The ProtPocket Go backend queries the AlphaFold API. It discovers the monomer Entry ID alongside the complex `modelEntityId` (e.g., `AF-0000000012345678`), pinpointing the exact mmCIF structure URLs.
3. **Disorder Calculation:** The backend parses the confidence JSONs for Q55DI5. It computes the ∆ pLDDT for every single residue. For instance, if an unstructured tail in the monomer stabilizes during dimerization, its ∆ pLDDT spikes, mapping a functional interface.

### Phase 2: Pocket Hunting
4. **Trigger Analysis:** The user clicks "Run Pocket Analysis" on the Q55DI5 `BindingSitesPanel`.
5. **Secure Execution:** The Go backend securely downloads the complex mmCIF file into a local `./tmp` directory—crucial for bypassing strict app confinement boundaries (like `snap`).
6. **fpocket Subprocess:** The backend spawns an `fpocket` subprocess targeting the downloaded Q55DI5 structure. `fpocket` runs its Voronoi sphere algorithms to identify geometric cavities on the protein surface.
7. **Parsing Output:** The `services/fpocket.go` module parses the resulting `_info.txt` alongside individual pocket atomic coordinate PDBs. It maps the exact subset of residues for each cavity (e.g., mapping indices back to sequences like `ASP23, HIS25, LYS59`).

### Phase 3: Filtering & Enrichment
8. **Interface Cross-referencing:** The backend calculates the average ∆ pLDDT specifically for the residues comprising each Q55DI5 pocket. If a pocket geometrically sits on residues that gained significant structure (average ∆ pLDDT ≥ 5.0), it receives the coveted **Interface Badge**.
9. **ZINC Polling:** For these high-value interface pockets, the `fragments.go` service asynchronously calls the ZINC REST API. It matches the physical architecture of the Q55DI5 pocket against known chemical SMILES to suggest synthesizable hit compounds.

### Phase 4: Visualization
10. **Frontend Rendering:** The React application receives the aggregated data and renders interactive Pocket Cards detailing Q55DI5's druggability scores, structural metrics, and suggested ZINC fragments.
11. **Native Mol* Highlighting:** When the user clicks "Highlight in Viewer" on a Q55DI5 pocket:
    * The frontend forwards the parsed `residueIndices` directly to the `useMolstar` hook via a React `forwardRef`.
    * It maps the indices to either `label_seq_id` (CIF standard) or `auth_seq_id` (PDB standard) to ensure flawless sequence matching.
    * Utilizing the native `Mol*` `lociSelects` API, the viewer instantly highlights the specific binding pocket in the application's native green accent color, dynamically resetting the camera to perfectly frame the pocket. 

This creates an incredibly intuitive, responsive, and scientifically rigorous environment for identifying the exact starting point of a targeted drug design campaign—taking Q55DI5 from an unknown structure to a viable drug target in seconds.
