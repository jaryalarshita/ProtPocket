<div align="center">
  <img src="./app/public/logo.png" width="120" alt="ProtPocket Logo" />
  <h1>ProtPocket : protein complex intelligence</h1>
  <p><strong>End-to-End Drug Lead Generation via the Disorder Delta</strong></p>
</div>

---

## 🔬 Abstract
ProtPocket is an advanced computational biology pipeline explicitly engineered to discover, analyze, and target **undrugged protein complexes**. Operating at the intersection of structural informatics and rational drug design, ProtPocket leverages the AlphaFold Protein Structure Database to find cryptic, high-value binding sites that only emerge during protein-protein interactions (PPIs).

By automating geometric cavity detection (`fpocket`), virtual screening, and molecular docking (AutoDock Vina), ProtPocket accelerates the hit-to-lead workflow for some of the world's most neglected pathogens and hardest-to-treat human diseases.

---

## 🧬 Theoretical Architecture: The "Disorder Delta"

The core innovation of ProtPocket lies in its structural gap scoring mechanism, which we term the **Disorder Delta**.

Many critical proteins, especially transcription factors and viral entry proteins, contain Intrinsically Disordered Regions (IDRs). As singular monomers, these regions are highly flexible and lack a defined 3D structure, rendering them effectively "undruggable" by traditional small molecules. 

However, upon binding to an interaction partner (forming a homodimer or heterodimer), these disordered regions often undergo a structural phase transition, folding into highly stable confirmations. 

ProtPocket exploits this behavior:
1. **Monomer Confidence (pLDDT)**: We evaluate the AlphaFold pLDDT (Predicted Local Distance Difference Test) of the monomer. Low pLDDT (<50) indicates high intrinsic disorder.
2. **Complex Confidence (pLDDT)**: We evaluate the pLDDT of the same sequence within the predicted homodimeric complex. A dramatic rise in pLDDT (>80) highlights a region forced into stability by the interaction.
3. **The Delta (Δ)**: The difference between these two scores (`Δ = Complex pLDDT - Monomer pLDDT`) flags the theoretical interface.
4. **Targeting the Interface**: By directing geometric cavity detection algorithms precisely at regions with a high Disorder Delta, we identify cryptic pockets that exist *only* in the functional complex state. Inhibiting these pockets theoretically prevents the protein-protein interaction from occurring at all.

This targeted approach zeroes in on the most vulnerable, mechanistically critical regions of a pathogen's structural machinery.

---

## ⚙️ The ProtPocket Pipeline

The platform operates autonomously through a 5-step pipeline:

### 1. Discover (Knowledge Graphing)
We ingest and sift through the 1.7 million structures in the AlphaFold Complex Database. We aggressively cross-reference this structural data against the **ChEMBL** pharmacological database and the **World Health Organization (WHO) Priority Pathogens list**. Any target with 0 known approved drugs that belongs to a high-threat pathogen (e.g., *M. tuberculosis*, *A. baumannii*) or aggressive human disease (e.g., *TP53*, *MYC*) is elevated to the dashboard.

### 2. Reveal (Disorder Delta Calculation)
The pipeline calculates the thermodynamic Disorder Delta for all filtered targets. Proteins showcasing a massive phase transition from chaotic monomer to stable dimer are ranked at the top of the **Undrugged Target Leaderboard**.

### 3. Target (Geometric Cavity Detection)
Using [**fpocket**](https://github.com/Discngine/fpocket), a Voronoi tessellation-based cavity detection algorithm, we scan the surface of the newly stabilized complex. We filter the results to isolate alpha-spheres that lie directly on the complex interface, ignoring irrelevant surface clefts.

### 4. Dock (Validation)
Finally, we perform high-throughput molecular docking of candidate compounds directly inside the identified pocket using [**AutoDock Vina**](https://github.com/ccsb-scripps/AutoDock-Vina). Promising binding affinities (kcal/mol) signify a high-confidence starting point for medicinal chemists.

---

## 🛠️ Technical Stack & Implementation

ProtPocket is built as a highly concurrent monorepo designed for speed and real-time visualization.

### Backend (Go)
- Designed with Go's `goroutines` to allow heavily parallelized live querying of the AlphaFold REST API, UniProt API, and ChEMBL API.
- Implements an intelligent, thread-safe memory Cache (`sync.RWMutex`) to prevent rate-limiting while serving the high-traffic Undrugged Target Leaderboard.
- **Framework**: `gofr.dev/pkg/gofr`
- **Scoring Engine**: Custom Go algorithms implementing the Disorder Gap Delta mathematical models.

### Frontend (React / Vite / TailwindCSS)
- A dark-mode, futuristic UI inspired by modern biotech, utilizing Vanilla Tailwind CSS for lightning-fast performance without heavy component libraries.
- React Router DOM for instantaneous page transitions.

### Structural Visualization (Mol*)
- We embed [**Mol***](https://molstar.org/), an ultra-fast WebGL macromolecular viewer capable of streaming `.cif` trajectory data directly from AlphaFold servers.
- **Custom Implementations**:
  - Live side-by-side comparative views of Monomeric vs. Complex topologies.
  - On-the-fly pLDDT confidence coloring (`blue` = rigid interface, `red` = disordered chaos).
  - Multi-pose trajectory viewing for AutoDock Vina binding conformation results.

---

## 🚀 Setup & Installation

### Prerequisites
- [Go (1.21+)](https://golang.org/dl/)
- [Node.js (18+)](https://nodejs.org/en/download/)

### 1. Start the Go Backend
The backend engine serves the API endpoints (e.g., `/search`, `/complex`, `/undrugged`).

```bash
cd ProtPocket
go mod download
go run main.go
# The server will start on http://localhost:8000
```

### 2. Start the React Frontend
The Vite dev server provides hot-module reloading for the UI.

```bash
cd ProtPocket/app
npm install
npm run dev
# The UI will load on http://localhost:5173
```

---

## 👥 Creators & Contributors
ProtPocket is proudly open-source and built for the global structural biology community.

- **Arshita Jaryal** - [GitHub](https://github.com/jaryalarshita)
- **Ayush Kumar** - [GitHub](https://github.com/ayush00git)
- **Divyansh Singh** - [GitHub](https://github.com/divyansh0x0)

---

## 📚 Scientific References & Attributions
This platform relies on the shoulders of giants. We heavily utilize data and tools from the following projects:

1. **AlphaFold Protein Structure Database**: DeepMind, EMBL-EBI. [Website](https://alphafold.ebi.ac.uk/)
2. **UniProt**: The Universal Protein Resource. [Website](https://www.uniprot.org/)
3. **ChEMBL**: EMBL-EBI database of bioactive molecules with drug-like properties. [Website](https://www.ebi.ac.uk/chembl/)
4. **fpocket**: Open source protein cavity detection. [GitHub](https://github.com/Discngine/fpocket)
5. **AutoDock Vina**: Fast, accurate open-source molecular docking. [GitHub](https://github.com/ccsb-scripps/AutoDock-Vina)
6. **Mol***: A comprehensive web-based macromolecular visualization toolkit. [Website](https://molstar.org/)

---
<div align="center">
  <p><em>"The shapes of proteins are the locks of biology; we are searching for the keys."</em></p>
</div>
