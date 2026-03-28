# ProtPocket Binding Site Analysis Pipeline

This document outlines the complete architectural lifecycle triggered when a user requests binding site analysis via `GET /complex/{id}/binding-sites`. The system relies on a heavily customized pipeline intersecting `fpocket` geometric void detection, AlphaFold Structural B-Factors (pLDDT approximations), and ZINC15 small-molecule databases.

---

## 1. Request Intiation & Metadata Retrieval
**Location**: `handlers/bindingsites.go` (`BindingSiteHandler`)
- The endpoint normalizes a UniProt ID (e.g. `Q55DI5`) to ensure clean cache hashes.
- **`FetchComplexData`** (`services/alphafold.go`) is invoked:
  - Queries the AlphaFold EBI Search API directly (`/api/search?q={id}&type=complex`).
  - Iterates results to locate both a **Monomer** (IsComplex = false) and the native/latest **Dimer** (IsComplex = true) variations.
  - Extracts the exact EBI model `.cif` asset URLs and their unique tracking entity IDs (e.g., `AF-0000000066503175`).

---

## 2. Geometric Pocket Detection (`fpocket`)
**Location**: `services/fpocket.go` (`RunFpocket`)
Because AlphaFold protein models are entirely mathematical coordinate mappings without predefined cavities, `fpocket` runs Voronoi tessellation logic to map void properties.

- **Concurrent Execution**: `BindingSiteHandler` spins up parallel Go-Routines to process the Monomer and Dimer CIF files simultaneously against `fpocket`.
- **Download Fallback**: The parser attempts to replace suffix `.cif` with `.pdb`. If EBI responds 404 (due to size constraints blocking PDB conversions for multimers), it dynamically falls back to native `.cif` which `fpocket` also parses effortlessly.
- **Isolated Runtimes**: Standard `snap` configurations for `fpocket` cannot cleanly interoperate with local `/tmp` structures on Linux securely. Thus, temporary runtime containers (`tmp/fpocket-XXXXX`) are provisioned exclusively for each routine in the local PWD.
- **Output Parsing**:
  - `parseFpocketInfo`: Ingests `structure_info.txt`, gathering overarching chemical indicators (Druggability Score, Volume, Hydrophobicity, Polarity).
  - `parsePocketAtoms` (**The Secret Sauce**): Explicitly processes the output chunked `.pdb` per pocket (`pocket[N]_atm.pdb`). Crucially, this determines if a pocket spans chains (yielding geometrical `IsInterfacePocket` booleans) and extracts **B-factor columns (61-66)** caching localized structural pLDDT scores directly parsed from AlphaFold's structural translation!

---

## 3. Rigidity Modeling (Disorder Delta computation)
**Location**: `services/plddt.go` & `services/pocket_filter.go`
AlphaFold explicitly maps its atomic `B-factor` arrays to 0–100 percentile confidence metrics (pLDDT). 

To calculate `Δ pLDDT` (representing rigidification stabilization forces inherently caused by dimerization interactions), the server MUST baseline against the native monomer.
- `handlers/bindingsites.go` invokes `FetchMonomerPLDDT(monomerId)`. EBI successfully hosts `_confidence_v4.json` arrays specifically for standardized single-chain UniProts.
- `FilterInterfacePockets` loops geometrically mapped Native Dimer B-factors (pulled from step 2).
  - Calculates `Dimer B-Factor - Monomer JSON Score` for each explicitly shared residue. 
  - Generates the heavily-watched `avg_disorder_delta` (A positive score signifies strong pharmacological potential, proving that the localized interaction forces physically stiffened the loop natively upon binding!).

---

## 4. Sub-Pocket Pharmacological Binding (ZINC15 mapping)
**Location**: `services/fragments.go`
Once structural properties are assembled natively, small-molecule binders are curated.
- A concurrent `sync.WaitGroup` fires across every discovered Monomer and Dimer pocket simultaneously.
- Queries `zinc15.docking.org` for molecules under `500 Da` and logP < `5`, mapping to the specified volume geometries.
- ZINC parses the output recursively and serializes top hits into the `models.Fragment` interface array.

---

## 5. Topological Comparison (Monomer vs Dimer Mapping)
**Location**: `services/pocket_compare.go` (`ComparePockets`)
The `ComparisonResult` strictly calculates differences conceptually missed by traditional linear matching.

- **Conformational Emergent Targets**: A pocket physically generated via topological single-chain folding alterations specifically present inside complex variations but nowhere geographically close on the baseline Monomer. (Searches coordinates via `< 6.0 Å` Euclidean radius bounding boxes).
- **True Interface Pockets**: An `Emergent` geometry that structurally spans explicitly distinct Chain IDs (Chain A & Chain B intersections).
- **Metrics Consolidation**: Calculate Average Property Shifts (Volume, Polarity) natively, computing the **DDGI** (`Dimerization Druggability Gain Index`).

---

## 6. Response Layer & Frontend Render
**Location**: `app/src/components/complex/BindingSitesPanel.jsx` & `ComparisonTab.jsx`
- The system responds to the HTTP client containing serialized coordinates. React automatically unpacks `pocket_mapping` and arrays.
- `BindingSitesPanel` handles client-side limits natively, parsing grids visually mapped to the custom 3D web-GL library (`Mol*`).
- `ComparisonTab` dynamically renders `recharts` to trace out the "Golden Quadrant" of Druggable stabilization anomalies, overlaying UI elements dynamically indicating missing data fields gracefully.
