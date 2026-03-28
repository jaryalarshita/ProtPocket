# ProtPocket — Phase 1 & Phase 2 Implementation Plan
### Instructions for Coding Agent (Claude Opus 4.6)
### READ EVERY WORD. DO NOT SKIP STEPS. DO NOT ASSUME.

---

## GROUND RULES FOR THE AGENT

1. **Never invent API response shapes.** Every API field used in code must be verified against the exact sample responses provided in this document.
2. **Never assume an API endpoint exists.** Only use endpoints explicitly listed here.
3. **Never proceed to the next step if the current step's verification check fails.** Stop and report the error.
4. **Every file you create must be listed in the File Output Map at the end of its phase.**
5. **If an API returns an unexpected shape, log the raw response and halt — do not try to adapt silently.**
6. **Hardcoded fallback JSON is not optional.** It must be created before any live API call is written.

---

## REPOSITORY STRUCTURE

Before writing any code, create this exact folder structure. Nothing more, nothing less.

```
ProtPocket/
├── backend/                  # Go / GoFr service
│   ├── main.go
│   ├── go.mod
│   ├── go.sum
│   ├── handlers/
│   │   ├── search.go
│   │   ├── complex.go
│   │   └── undrugged.go
│   ├── services/
│   │   ├── alphafold.go
│   │   ├── chembl.go
│   │   └── uniprot.go
│   ├── models/
│   │   └── complex.go
│   ├── scoring/
│   │   └── gap_score.go
│   └── data/
│       └── hero_complexes.json   ← THE FALLBACK. Created in Phase 1.
├── frontend/                 # Next.js (Phase 3 onwards — DO NOT CREATE YET)
└── README.md
```

**Create only the `backend/` tree and `README.md` now. Do not create `frontend/` — that is Phase 3.**

---

---

# PHASE 1 — DATA CURATION & VALIDATION

**Goal:** Produce a verified, complete `hero_complexes.json` file with 30 protein complexes. This file is the demo safety net. If every external API fails during the hackathon demo, the app still works using this file.

**Output:** `backend/data/hero_complexes.json`

**Time budget:** 2 hours

---

## STEP 1.1 — Understand the Data Model

Before curating any data, internalize the exact shape every complex object must have. This is the canonical model. Every field is required. No field may be null unless explicitly marked optional.

```json
{
  "alphafold_id": "string — AlphaFold complex ID, e.g. AF-0000000066503175",
  "uniprot_id": "string — UniProt accession, e.g. P04637",
  "protein_name": "string — human-readable name, e.g. 'Cellular tumor antigen p53'",
  "gene_name": "string — gene symbol, e.g. 'TP53'",
  "organism": "string — full organism name, e.g. 'Homo sapiens'",
  "organism_id": "integer — NCBI taxonomy ID, e.g. 9606 for human",
  "is_who_pathogen": "boolean — true if organism is in WHO priority pathogen list",
  "disease_associations": ["array of strings — disease names from UniProt"],
  "monomer_plddt_avg": "float — average pLDDT of the single-chain prediction (0–100)",
  "dimer_plddt_avg": "float — average pLDDT of the complex prediction (0–100)",
  "disorder_delta": "float — (dimer_plddt_avg - monomer_plddt_avg), can be negative",
  "drug_count": "integer — number of approved drugs from ChEMBL targeting this protein",
  "known_drug_names": ["array of strings — drug names, empty array if none"],
  "gap_score": "float — computed gap score, see formula in Step 1.4",
  "monomer_structure_url": "string — direct URL to monomer .cif file",
  "complex_structure_url": "string — direct URL to complex .cif file",
  "category": "string — one of: 'human_disease', 'who_pathogen', 'high_disorder_delta'",
  "demo_highlight": "boolean — true for the 3 complexes used in the live demo"
}
```

---

## STEP 1.2 — Curate the 30 Hero Complexes

Select exactly 30 complexes split across three categories:

**Category A: Human Disease (10 complexes)**
These must be human proteins (organism_id: 9606) with known disease associations. Prefer proteins where the monomer is known to be disordered and the dimer is stable.

Required selections (these 5 are mandatory — look up their UniProt IDs):
- TP53 (tumor suppressor, cancer)
- BRCA1 (breast cancer)
- EGFR (lung/colon cancer)
- BCL2 (apoptosis, lymphoma)
- STAT3 (signal transduction, multiple cancers)

Find 5 more human disease proteins from UniProt with known homodimer structures. Search UniProt at `https://www.uniprot.org/uniprotkb?query=homodimer+AND+disease+AND+organism_id:9606&format=json`.

**Category B: WHO Priority Pathogens (10 complexes)**
The WHO priority pathogen list (2024) includes these organisms. Select proteins from at least 5 different organisms:

```
CRITICAL PATHOGENS (select at least 3 proteins from this group):
- Mycobacterium tuberculosis (organism_id: 83332)
- Klebsiella pneumoniae (organism_id: 573)
- Acinetobacter baumannii (organism_id: 470)
- Pseudomonas aeruginosa (organism_id: 287)
- Staphylococcus aureus (organism_id: 1280)

HIGH PRIORITY PATHOGENS (select at least 2 proteins from this group):
- Enterococcus faecium (organism_id: 1352)
- Helicobacter pylori (organism_id: 85962)
- Salmonella typhi (organism_id: 90370)
```

For each pathogen protein, prefer proteins involved in cell division (FtsZ), DNA replication (GyrA, GyrB), or cell wall synthesis (MurA, MurB, MurC) — these are known antibiotic targets with structural data.

**Category B is_who_pathogen field: set to `true` for all 10 of these.**

**Category C: High Disorder Delta (10 complexes)**
These are the "structural reveal" stars — proteins where the monomer is highly disordered (monomer_plddt_avg < 55) and the dimer is well-ordered (dimer_plddt_avg > 75). The disorder_delta must be > 20 for all 10.

Mix of human and pathogen proteins is fine for this category. The slime mold protein from the EMBL article (Q55DI5, Dictyostelium discoideum) must be one of these 10.

---

## STEP 1.3 — Fetch Data for Each Complex

For each of the 30 complexes, execute the following data-gathering sequence. Do this for every single complex — no shortcuts.

### Sub-step 1.3a — Fetch UniProt metadata

**Endpoint:** `https://rest.uniprot.org/uniprotkb/{UNIPROT_ID}?format=json`

**Example for TP53:**
```
GET https://rest.uniprot.org/uniprotkb/P04637?format=json
```

**Extract these fields from the response:**
```
protein_name  ← response.proteinDescription.recommendedName.fullName.value
gene_name     ← response.genes[0].geneName.value
organism      ← response.organism.scientificName
organism_id   ← response.organism.taxonId
disease_associations ← response.comments
  (filter where comment.commentType === "DISEASE", extract comment.disease.diseaseId or comment.disease.description)
```

**If UniProt returns a 404:** The UniProt ID is wrong. Look up the correct ID at https://www.uniprot.org. Do not proceed with a wrong ID.

### Sub-step 1.3b — Fetch AlphaFold monomer pLDDT

**Endpoint:** `https://alphafold.ebi.ac.uk/api/prediction/{UNIPROT_ID}`

**Example:**
```
GET https://alphafold.ebi.ac.uk/api/prediction/P04637
```

**Expected response shape (array, take index 0):**
```json
[{
  "entryId": "AF-P04637-F1",
  "gene": "TP53",
  "uniprotAccession": "P04637",
  "uniprotId": "TP53_HUMAN",
  "uniprotDescription": "Cellular tumor antigen p53",
  "taxId": 9606,
  "organismsScientificName": "Homo sapiens",
  "uniprotStart": 1,
  "uniprotEnd": 393,
  "uniprotSequence": "MEEPQSDPSVEPPLSQETFSDLWKLLPENNVLSPLPSQAMDDLMLSPDDIEQWFTEDP...",
  "modelCreatedDate": "2022-06-01",
  "latestVersion": 4,
  "allVersions": [1, 2, 3, 4],
  "isReviewed": true,
  "isReferenceProteome": true,
  "cifUrl": "https://alphafold.ebi.ac.uk/files/AF-P04637-F1-model_v4.cif",
  "bcifUrl": "https://alphafold.ebi.ac.uk/files/AF-P04637-F1-model_v4.bcif",
  "pdbUrl": "https://alphafold.ebi.ac.uk/files/AF-P04637-F1-model_v4.pdb",
  "paeImageUrl": "https://alphafold.ebi.ac.uk/files/AF-P04637-F1-predicted_aligned_error_v4.png",
  "paeDocUrl": "https://alphafold.ebi.ac.uk/files/AF-P04637-F1-predicted_aligned_error_v4.json"
}]
```

**Set `monomer_structure_url`** = response[0].cifUrl

**To get `monomer_plddt_avg`:** The average pLDDT is NOT directly in this response. You must fetch the pLDDT scores from the PAE doc or compute it from the CIF file. Use this approach:

Fetch the pLDDT JSON:
```
GET https://alphafold.ebi.ac.uk/files/AF-{UNIPROT_ID}-F1-predicted_aligned_error_v4.json
```
This returns a PAE matrix, not raw pLDDT. 

**CORRECT approach for pLDDT average:** Fetch the `.pdb` file and extract the B-factor column (AlphaFold stores pLDDT in the B-factor field of PDB format):
```
GET https://alphafold.ebi.ac.uk/files/AF-{UNIPROT_ID}-F1-model_v4.pdb
```
Parse lines starting with `ATOM`. Column 61–66 (0-indexed: chars 60–65) is the B-factor = pLDDT score per atom. Average all CA (alpha carbon) atoms only (column 13–14 = " CA").

**pLDDT extraction pseudocode:**
```python
lines = pdb_text.split('\n')
plddt_values = []
for line in lines:
    if line.startswith('ATOM') and line[12:16].strip() == 'CA':
        plddt = float(line[60:66].strip())
        plddt_values.append(plddt)
monomer_plddt_avg = sum(plddt_values) / len(plddt_values)
```

**Round to 2 decimal places.**

### Sub-step 1.3c — Fetch AlphaFold complex pLDDT and complex structure URL

The complex structures released in March 2026 are homodimers. The API endpoint for complexes is:

```
GET https://alphafold.ebi.ac.uk/api/prediction/{UNIPROT_ID}?type=complex
```

**NOTE:** If this endpoint does not return complex data (it may still be rolling out), use the search endpoint:
```
GET https://alphafold.ebi.ac.uk/api/search?query={UNIPROT_ID}&type=complex&format=json
```

**If NEITHER endpoint returns complex data for a protein:** This protein does not yet have a complex prediction in the DB. Replace it with a different protein. Do not fabricate complex data.

**Set `complex_structure_url`** from the complex prediction's cifUrl.

**Set `dimer_plddt_avg`** using the same PDB B-factor extraction method as Step 1.3b, but on the complex PDB file.

**Set `disorder_delta`** = `dimer_plddt_avg - monomer_plddt_avg` (can be negative, keep as-is).

### Sub-step 1.3d — Fetch ChEMBL drug count

**Step 1: Get ChEMBL target ID from UniProt ID**
```
GET https://www.ebi.ac.uk/chembl/api/data/target/search.json?q={UNIPROT_ID}
```

**Extract:** `response.targets[0].target_chembl_id` — e.g. `CHEMBL2107`

If no target found: set `drug_count = 0`, `known_drug_names = []`. Do not error.

**Step 2: Get approved drugs for this target**
```
GET https://www.ebi.ac.uk/chembl/api/data/drug_indication.json?target_chembl_id={TARGET_ID}&max_phase=4
```

`max_phase=4` means Phase 4 = approved drugs only. This avoids counting experimental compounds.

**Extract:**
- `drug_count` = `response.page_meta.total_count`
- `known_drug_names` = array of `response.drug_indications[].molecule_pref_name` (deduplicated, max 5 names)

**If ChEMBL API is down or returns 500:** Set `drug_count = -1` (unknown), `known_drug_names = []`. This is a valid state — the frontend will display "Coverage Unknown".

---

## STEP 1.4 — Compute Gap Score for Each Complex

After all API data is fetched, compute the gap score using this exact formula:

```
gap_score = plddt_norm × undrugged_factor × who_multiplier + disorder_bonus
```

Where:
```
plddt_norm       = dimer_plddt_avg / 100
                   (if dimer_plddt_avg is unavailable, use monomer_plddt_avg / 100)

undrugged_factor = 1 - (drug_count / max(drug_count_in_dataset, 1))
                   BUT: if drug_count == 0, undrugged_factor = 1.0 exactly
                   AND: if drug_count == -1 (unknown), undrugged_factor = 0.5

who_multiplier   = 2.0 if is_who_pathogen == true, else 1.0

disorder_bonus   = max(disorder_delta, 0) / 100
                   (only add bonus if disorder_delta is positive)
```

**Round gap_score to 4 decimal places.**

**Example calculation for an M. tuberculosis FtsZ protein:**
```
dimer_plddt_avg  = 82.4  → plddt_norm = 0.824
drug_count       = 0     → undrugged_factor = 1.0
is_who_pathogen  = true  → who_multiplier = 2.0
disorder_delta   = 28.6  → disorder_bonus = 0.286

gap_score = 0.824 × 1.0 × 2.0 + 0.286 = 1.934
```

---

## STEP 1.5 — Mark Demo Highlights

Exactly 3 complexes must have `"demo_highlight": true`. Choose these 3 based on:

1. **Human cancer protein** with `demo_highlight: true` — must be from Category A, prefer TP53 if its complex data is available
2. **WHO pathogen protein** with `demo_highlight: true` — must be from Category B, highest gap_score in the dataset
3. **Highest disorder_delta protein** with `demo_highlight: true` — highest disorder_delta across all 30 complexes

All other 27 complexes have `"demo_highlight": false`.

---

## STEP 1.6 — Assemble and Write hero_complexes.json

Assemble all 30 objects into a JSON array. Validate:

- [ ] Array has exactly 30 elements
- [ ] Every element has all 18 fields from the data model in Step 1.1
- [ ] No field is `null` (use empty array `[]` for empty arrays, `-1` for unknown drug_count)
- [ ] Exactly 3 elements have `demo_highlight: true`
- [ ] Exactly 10 elements have `category: "human_disease"`
- [ ] Exactly 10 elements have `category: "who_pathogen"`
- [ ] Exactly 10 elements have `category: "high_disorder_delta"`
- [ ] All `is_who_pathogen: true` entries are from the WHO pathogen organism list
- [ ] All `gap_score` values are computed (not 0.0)
- [ ] All `monomer_structure_url` values are valid AlphaFold `.cif` URLs
- [ ] All `complex_structure_url` values are valid AlphaFold `.cif` URLs

Write to: `backend/data/hero_complexes.json`

---

## STEP 1.7 — Validate Structure URLs Are Accessible

For all 3 `demo_highlight: true` complexes, make an HTTP HEAD request to both `monomer_structure_url` and `complex_structure_url`. Verify HTTP 200 response. If any URL returns non-200, find the correct URL and update the JSON before proceeding.

```bash
curl -I "https://alphafold.ebi.ac.uk/files/AF-P04637-F1-model_v4.cif"
# Must return: HTTP/2 200
```

---

## PHASE 1 COMPLETION CHECKLIST

Before proceeding to Phase 2, confirm all of these:

- [ ] `backend/data/hero_complexes.json` exists
- [ ] File parses as valid JSON (run: `python3 -c "import json; json.load(open('backend/data/hero_complexes.json'))"`)
- [ ] Exactly 30 objects in the array
- [ ] All 18 fields present in every object
- [ ] 3 demo_highlight complexes confirmed with valid, accessible .cif URLs
- [ ] Gap scores all computed and non-zero

**DO NOT START PHASE 2 UNTIL ALL PHASE 1 CHECKS PASS.**

---

---

# PHASE 2 — BACKEND (GoFr API Service)

**Goal:** A running GoFr HTTP server with 3 routes that serve live data from AlphaFold, ChEMBL, and UniProt — with automatic fallback to hero_complexes.json if any external API fails.

**Output:** A running server at `http://localhost:8080`

**Time budget:** 8 hours

---

## STEP 2.1 — Initialize Go Module

```bash
cd backend/
go mod init github.com/ProtPocket/backend
```

**Install GoFr:**
```bash
go get gofr.dev/pkg/gofr
```

**Verify go.mod contains:**
```
module github.com/ProtPocket/backend

go 1.21

require (
    gofr.dev v1.x.x
)
```

---

## STEP 2.2 — Define the Data Model

Create `backend/models/complex.go`:

```go
package models

// Complex represents a protein complex with all metadata needed by the frontend.
// All fields must be populated. Use -1 for unknown drug counts, 0.0 for unavailable scores.
type Complex struct {
    AlphafoldID        string   `json:"alphafold_id"`
    UniprotID          string   `json:"uniprot_id"`
    ProteinName        string   `json:"protein_name"`
    GeneName           string   `json:"gene_name"`
    Organism           string   `json:"organism"`
    OrganismID         int      `json:"organism_id"`
    IsWHOPathogen      bool     `json:"is_who_pathogen"`
    DiseaseAssoc       []string `json:"disease_associations"`
    MonomerPLDDTAvg    float64  `json:"monomer_plddt_avg"`
    DimerPLDDTAvg      float64  `json:"dimer_plddt_avg"`
    DisorderDelta      float64  `json:"disorder_delta"`
    DrugCount          int      `json:"drug_count"`
    KnownDrugNames     []string `json:"known_drug_names"`
    GapScore           float64  `json:"gap_score"`
    MonomerStructURL   string   `json:"monomer_structure_url"`
    ComplexStructURL   string   `json:"complex_structure_url"`
    Category           string   `json:"category"`
    DemoHighlight      bool     `json:"demo_highlight"`
}

// SearchResult wraps the search response with metadata.
type SearchResult struct {
    Query    string    `json:"query"`
    Count    int       `json:"count"`
    Source   string    `json:"source"` // "live" or "fallback"
    Results  []Complex `json:"results"`
}
```

---

## STEP 2.3 — Implement the WHO Pathogen Checklist

Create `backend/scoring/gap_score.go`:

This file contains two things: the WHO pathogen list and the gap score computation.

```go
package scoring

import "math"

// WHOPathogenOrganismIDs is the hardcoded list of NCBI taxonomy IDs for
// WHO priority pathogens (2024 list). DO NOT modify without checking the
// official WHO list: https://www.who.int/publications/i/item/9789240093461
var WHOPathogenOrganismIDs = map[int]bool{
    // CRITICAL PRIORITY
    83332:  true, // Mycobacterium tuberculosis
    573:    true, // Klebsiella pneumoniae
    470:    true, // Acinetobacter baumannii
    287:    true, // Pseudomonas aeruginosa
    1280:   true, // Staphylococcus aureus (MRSA)
    // HIGH PRIORITY
    1352:   true, // Enterococcus faecium
    85962:  true, // Helicobacter pylori
    90370:  true, // Salmonella typhi
    1613:   true, // Listeria monocytogenes
    1423:   true, // Bacillus cereus
    // MEDIUM PRIORITY
    1351:   true, // Enterococcus faecalis
    1282:   true, // Staphylococcus epidermidis
    216816: true, // Bifidobacterium longum (gut pathogen)
    1301:   true, // Streptococcus pyogenes
    1314:   true, // Streptococcus pneumoniae
}

// IsWHOPathogen returns true if the organism is on the WHO priority pathogen list.
func IsWHOPathogen(organismID int) bool {
    return WHOPathogenOrganismIDs[organismID]
}

// ComputeGapScore calculates the gap score for a complex.
// Formula: plddt_norm × undrugged_factor × who_multiplier + disorder_bonus
//
// Parameters:
//   dimerPLDDT    - average pLDDT of the complex (0-100). Use monomer if complex unavailable.
//   drugCount     - number of approved drugs. Use -1 if unknown.
//   maxDrugCount  - maximum drug_count in the current dataset (for normalization).
//   isWHOPathogen - whether organism is on WHO priority list.
//   disorderDelta - dimer_plddt_avg minus monomer_plddt_avg.
func ComputeGapScore(dimerPLDDT float64, drugCount int, maxDrugCount int, isWHOPathogen bool, disorderDelta float64) float64 {
    // pLDDT normalization
    plddtNorm := dimerPLDDT / 100.0

    // Undrugged factor
    var undruggedFactor float64
    switch {
    case drugCount == -1:
        undruggedFactor = 0.5 // unknown coverage
    case drugCount == 0:
        undruggedFactor = 1.0 // fully undrugged
    default:
        denominator := math.Max(float64(maxDrugCount), 1.0)
        undruggedFactor = 1.0 - (float64(drugCount) / denominator)
    }

    // WHO multiplier
    whoMultiplier := 1.0
    if isWHOPathogen {
        whoMultiplier = 2.0
    }

    // Disorder bonus (only positive delta contributes)
    disorderBonus := 0.0
    if disorderDelta > 0 {
        disorderBonus = disorderDelta / 100.0
    }

    rawScore := plddtNorm*undruggedFactor*whoMultiplier + disorderBonus

    // Round to 4 decimal places
    return math.Round(rawScore*10000) / 10000
}
```

---

## STEP 2.4 — Implement the AlphaFold Service

Create `backend/services/alphafold.go`:

```go
package services

import (
    "encoding/json"
    "fmt"
    "io"
    "net/http"
    "strconv"
    "strings"
)

const alphafoldBaseURL = "https://alphafold.ebi.ac.uk/api"
const alphafoldFilesURL = "https://alphafold.ebi.ac.uk/files"

// AlphaFoldPrediction matches the shape of the AlphaFold API /prediction/{id} response.
// IMPORTANT: Only fields we actually use are mapped. Do not add unmapped fields.
type AlphaFoldPrediction struct {
    EntryID     string `json:"entryId"`
    UniprotAcc  string `json:"uniprotAccession"`
    Gene        string `json:"gene"`
    Description string `json:"uniprotDescription"`
    TaxID       int    `json:"taxId"`
    OrgName     string `json:"organismsScientificName"`
    CifURL      string `json:"cifUrl"`
    PdbURL      string `json:"pdbUrl"`
}

// FetchMonomerPrediction calls the AlphaFold API for a single UniProt ID.
// Returns the first prediction in the array response.
// Returns error if the response is not a valid array or is empty.
func FetchMonomerPrediction(uniprotID string) (*AlphaFoldPrediction, error) {
    url := fmt.Sprintf("%s/prediction/%s", alphafoldBaseURL, uniprotID)
    resp, err := http.Get(url)
    if err != nil {
        return nil, fmt.Errorf("alphafold GET failed for %s: %w", uniprotID, err)
    }
    defer resp.Body.Close()

    if resp.StatusCode == 404 {
        return nil, fmt.Errorf("alphafold: no prediction found for UniProt ID %s", uniprotID)
    }
    if resp.StatusCode != 200 {
        return nil, fmt.Errorf("alphafold: unexpected status %d for %s", resp.StatusCode, uniprotID)
    }

    body, err := io.ReadAll(resp.Body)
    if err != nil {
        return nil, fmt.Errorf("alphafold: failed to read response body: %w", err)
    }

    var predictions []AlphaFoldPrediction
    if err := json.Unmarshal(body, &predictions); err != nil {
        return nil, fmt.Errorf("alphafold: failed to parse response for %s: %w. Raw: %s", uniprotID, err, string(body[:min(200, len(body))]))
    }

    if len(predictions) == 0 {
        return nil, fmt.Errorf("alphafold: empty predictions array for %s", uniprotID)
    }

    return &predictions[0], nil
}

// FetchPLDDTAverage downloads the PDB file for a UniProt ID and computes
// the average pLDDT score across all CA (alpha carbon) atoms.
// AlphaFold stores pLDDT in the B-factor column of PDB format.
func FetchPLDDTAverage(pdbURL string) (float64, error) {
    resp, err := http.Get(pdbURL)
    if err != nil {
        return 0, fmt.Errorf("plddt fetch: GET failed for %s: %w", pdbURL, err)
    }
    defer resp.Body.Close()

    if resp.StatusCode != 200 {
        return 0, fmt.Errorf("plddt fetch: status %d for %s", resp.StatusCode, pdbURL)
    }

    body, err := io.ReadAll(resp.Body)
    if err != nil {
        return 0, fmt.Errorf("plddt fetch: read failed: %w", err)
    }

    lines := strings.Split(string(body), "\n")
    var plddtValues []float64

    for _, line := range lines {
        // PDB ATOM record format:
        // Columns 1-4:   "ATOM"
        // Columns 13-16: atom name (e.g. " CA ")
        // Columns 61-66: B-factor (= pLDDT in AlphaFold PDB files)
        if len(line) < 66 {
            continue
        }
        if line[0:4] != "ATOM" {
            continue
        }
        atomName := strings.TrimSpace(line[12:16])
        if atomName != "CA" {
            continue
        }
        bFactorStr := strings.TrimSpace(line[60:66])
        bFactor, err := strconv.ParseFloat(bFactorStr, 64)
        if err != nil {
            continue // skip unparseable lines
        }
        plddtValues = append(plddtValues, bFactor)
    }

    if len(plddtValues) == 0 {
        return 0, fmt.Errorf("plddt fetch: no CA atoms found in PDB file %s", pdbURL)
    }

    sum := 0.0
    for _, v := range plddtValues {
        sum += v
    }
    avg := sum / float64(len(plddtValues))

    // Round to 2 decimal places
    return float64(int(avg*100+0.5)) / 100, nil
}

// BuildMonomerPDBURL constructs the PDB file URL for a UniProt ID.
// AlphaFold PDB files follow this predictable pattern.
func BuildMonomerPDBURL(uniprotID string) string {
    return fmt.Sprintf("%s/AF-%s-F1-model_v4.pdb", alphafoldFilesURL, uniprotID)
}

func min(a, b int) int {
    if a < b {
        return a
    }
    return b
}
```

---

## STEP 2.5 — Implement the ChEMBL Service

Create `backend/services/chembl.go`:

```go
package services

import (
    "encoding/json"
    "fmt"
    "io"
    "net/http"
)

const chemblBaseURL = "https://www.ebi.ac.uk/chembl/api/data"

// ChEMBLTargetSearchResponse matches /target/search.json response shape.
type ChEMBLTargetSearchResponse struct {
    Targets []struct {
        TargetChEMBLID string `json:"target_chembl_id"`
        PreferredName  string `json:"pref_name"`
    } `json:"targets"`
    PageMeta struct {
        TotalCount int `json:"total_count"`
    } `json:"page_meta"`
}

// ChEMBLDrugIndicationResponse matches /drug_indication.json response shape.
type ChEMBLDrugIndicationResponse struct {
    DrugIndications []struct {
        MoleculePrefName string `json:"molecule_pref_name"`
    } `json:"drug_indications"`
    PageMeta struct {
        TotalCount int `json:"total_count"`
    } `json:"page_meta"`
}

// FetchDrugCoverage queries ChEMBL for approved drugs targeting a UniProt protein.
// Returns (drugCount, drugNames, error).
// drugCount = -1 means ChEMBL is unreachable (unknown coverage).
// drugCount = 0 means no approved drugs found (confirmed undrugged).
func FetchDrugCoverage(uniprotID string) (int, []string, error) {
    // Step 1: Resolve UniProt ID → ChEMBL target ID
    targetURL := fmt.Sprintf("%s/target/search.json?q=%s", chemblBaseURL, uniprotID)
    resp, err := http.Get(targetURL)
    if err != nil {
        // ChEMBL is unreachable — return unknown, not error (do not fail the whole request)
        return -1, []string{}, nil
    }
    defer resp.Body.Close()

    if resp.StatusCode != 200 {
        return -1, []string{}, nil
    }

    body, err := io.ReadAll(resp.Body)
    if err != nil {
        return -1, []string{}, nil
    }

    var targetResp ChEMBLTargetSearchResponse
    if err := json.Unmarshal(body, &targetResp); err != nil {
        return -1, []string{}, nil
    }

    if len(targetResp.Targets) == 0 {
        // No ChEMBL entry for this protein — it's undrugged as far as ChEMBL knows
        return 0, []string{}, nil
    }

    chemblID := targetResp.Targets[0].TargetChEMBLID

    // Step 2: Fetch approved drugs (max_phase=4) for this target
    drugURL := fmt.Sprintf("%s/drug_indication.json?target_chembl_id=%s&max_phase=4&limit=10", chemblBaseURL, chemblID)
    resp2, err := http.Get(drugURL)
    if err != nil {
        return -1, []string{}, nil
    }
    defer resp2.Body.Close()

    if resp2.StatusCode != 200 {
        return -1, []string{}, nil
    }

    body2, err := io.ReadAll(resp2.Body)
    if err != nil {
        return -1, []string{}, nil
    }

    var drugResp ChEMBLDrugIndicationResponse
    if err := json.Unmarshal(body2, &drugResp); err != nil {
        return -1, []string{}, nil
    }

    // Deduplicate drug names and cap at 5
    seen := map[string]bool{}
    var drugNames []string
    for _, d := range drugResp.DrugIndications {
        if d.MoleculePrefName != "" && !seen[d.MoleculePrefName] {
            seen[d.MoleculePrefName] = true
            drugNames = append(drugNames, d.MoleculePrefName)
            if len(drugNames) >= 5 {
                break
            }
        }
    }

    return drugResp.PageMeta.TotalCount, drugNames, nil
}
```

---

## STEP 2.6 — Implement the UniProt Service

Create `backend/services/uniprot.go`:

```go
package services

import (
    "encoding/json"
    "fmt"
    "io"
    "net/http"
    "net/url"
)

const uniprotBaseURL = "https://rest.uniprot.org/uniprotkb"

// UniProtEntry matches the fields we need from the UniProt REST API.
type UniProtEntry struct {
    ProteinDescription struct {
        RecommendedName struct {
            FullName struct {
                Value string `json:"value"`
            } `json:"fullName"`
        } `json:"recommendedName"`
    } `json:"proteinDescription"`
    Genes []struct {
        GeneName struct {
            Value string `json:"value"`
        } `json:"geneName"`
    } `json:"genes"`
    Organism struct {
        ScientificName string `json:"scientificName"`
        TaxonID        int    `json:"taxonId"`
    } `json:"organism"`
    Comments []struct {
        CommentType string `json:"commentType"`
        Disease     struct {
            DiseaseID   string `json:"diseaseId"`
            Description string `json:"description"`
        } `json:"disease"`
    } `json:"comments"`
}

// FetchUniProtEntry fetches protein metadata from UniProt by accession ID.
func FetchUniProtEntry(uniprotID string) (*UniProtEntry, error) {
    fetchURL := fmt.Sprintf("%s/%s?format=json", uniprotBaseURL, uniprotID)
    resp, err := http.Get(fetchURL)
    if err != nil {
        return nil, fmt.Errorf("uniprot GET failed for %s: %w", uniprotID, err)
    }
    defer resp.Body.Close()

    if resp.StatusCode == 404 {
        return nil, fmt.Errorf("uniprot: accession %s not found", uniprotID)
    }
    if resp.StatusCode != 200 {
        return nil, fmt.Errorf("uniprot: status %d for %s", resp.StatusCode, uniprotID)
    }

    body, err := io.ReadAll(resp.Body)
    if err != nil {
        return nil, fmt.Errorf("uniprot: read failed for %s: %w", uniprotID, err)
    }

    var entry UniProtEntry
    if err := json.Unmarshal(body, &entry); err != nil {
        return nil, fmt.Errorf("uniprot: parse failed for %s: %w", uniprotID, err)
    }

    return &entry, nil
}

// SearchUniProt searches UniProt by query string and returns the top UniProt IDs.
// Used for the search-by-disease or search-by-protein-name feature.
func SearchUniProt(query string, limit int) ([]string, error) {
    encodedQuery := url.QueryEscape(query + " AND reviewed:true")
    searchURL := fmt.Sprintf("%s/search?query=%s&format=json&size=%d&fields=accession,id", uniprotBaseURL, encodedQuery, limit)

    resp, err := http.Get(searchURL)
    if err != nil {
        return nil, fmt.Errorf("uniprot search failed for '%s': %w", query, err)
    }
    defer resp.Body.Close()

    if resp.StatusCode != 200 {
        return nil, fmt.Errorf("uniprot search: status %d for '%s'", resp.StatusCode, query)
    }

    body, err := io.ReadAll(resp.Body)
    if err != nil {
        return nil, fmt.Errorf("uniprot search: read failed: %w", err)
    }

    var result struct {
        Results []struct {
            PrimaryAccession string `json:"primaryAccession"`
        } `json:"results"`
    }
    if err := json.Unmarshal(body, &result); err != nil {
        return nil, fmt.Errorf("uniprot search: parse failed: %w. Raw: %s", err, string(body[:min(200, len(body))]))
    }

    var ids []string
    for _, r := range result.Results {
        ids = append(ids, r.PrimaryAccession)
    }
    return ids, nil
}
```

---

## STEP 2.7 — Implement the Fallback Loader

This is critical. Create `backend/data/loader.go`:

```go
package data

import (
    _ "embed"
    "encoding/json"
    "fmt"
    "github.com/ProtPocket/backend/models"
)

//go:embed hero_complexes.json
var heroComplexesJSON []byte

// LoadHeroComplexes loads the hardcoded hero complexes from the embedded JSON file.
// This is used as a fallback when live APIs fail, and as the data source for
// the /undrugged endpoint.
func LoadHeroComplexes() ([]models.Complex, error) {
    var complexes []models.Complex
    if err := json.Unmarshal(heroComplexesJSON, &complexes); err != nil {
        return nil, fmt.Errorf("failed to parse hero_complexes.json: %w", err)
    }
    return complexes, nil
}

// FindHeroByGeneOrProtein searches the hero complexes by gene name or protein name (case-insensitive).
// Returns all matching complexes.
func FindHeroByGeneOrProtein(query string, complexes []models.Complex) []models.Complex {
    queryLower := strings.ToLower(query)
    var results []models.Complex
    for _, c := range complexes {
        if strings.Contains(strings.ToLower(c.GeneName), queryLower) ||
           strings.Contains(strings.ToLower(c.ProteinName), queryLower) ||
           strings.Contains(strings.ToLower(c.Organism), queryLower) {
            results = append(results, c)
        }
    }
    return results
}
```

Add `"strings"` import at the top.

---

## STEP 2.8 — Implement the Search Handler

Create `backend/handlers/search.go`:

```go
package handlers

import (
    "sort"
    "sync"

    "gofr.dev/pkg/gofr"

    "github.com/ProtPocket/backend/data"
    "github.com/ProtPocket/backend/models"
    "github.com/ProtPocket/backend/scoring"
    "github.com/ProtPocket/backend/services"
)

// SearchHandler handles GET /search?q={query}
// Query can be: protein name, gene name, disease name, or organism name.
//
// Behavior:
// 1. Try to find matches in hero_complexes.json first (instant, no API calls)
// 2. If no hero matches, attempt live AlphaFold + ChEMBL + UniProt pipeline
// 3. If live pipeline fails, return hero matches with source="fallback"
// 4. Always return source field: "live" or "fallback"
func SearchHandler(ctx *gofr.Context) (interface{}, error) {
    query := ctx.Param("q")
    if query == "" {
        return nil, fmt.Errorf("query parameter 'q' is required")
    }

    // Load hero complexes (always available — embedded in binary)
    heroComplexes, err := data.LoadHeroComplexes()
    if err != nil {
        // This should never happen unless hero_complexes.json is malformed
        return nil, fmt.Errorf("critical: failed to load hero complexes: %w", err)
    }

    // Search hero complexes first
    heroMatches := data.FindHeroByGeneOrProtein(query, heroComplexes)

    // Attempt live search via UniProt
    liveResults, liveErr := performLiveSearch(query)

    if liveErr != nil || len(liveResults) == 0 {
        // Live search failed or returned nothing — use hero fallback
        source := "fallback"
        if len(heroMatches) == 0 {
            source = "no_results"
        }
        sortByGapScore(heroMatches)
        return models.SearchResult{
            Query:   query,
            Count:   len(heroMatches),
            Source:  source,
            Results: heroMatches,
        }, nil
    }

    // Merge live results with any hero matches (deduplicated by uniprot_id)
    merged := mergeResults(liveResults, heroMatches)
    sortByGapScore(merged)

    return models.SearchResult{
        Query:   query,
        Count:   len(merged),
        Source:  "live",
        Results: merged,
    }, nil
}

// performLiveSearch queries UniProt for matching protein IDs, then enriches
// each with AlphaFold and ChEMBL data concurrently.
func performLiveSearch(query string) ([]models.Complex, error) {
    // Get UniProt IDs matching the query (max 10 results)
    uniprotIDs, err := services.SearchUniProt(query, 10)
    if err != nil || len(uniprotIDs) == 0 {
        return nil, err
    }

    // Enrich each UniProt ID concurrently
    var mu sync.Mutex
    var wg sync.WaitGroup
    var results []models.Complex
    maxDrugCount := 0

    for _, uid := range uniprotIDs {
        wg.Add(1)
        go func(uniprotID string) {
            defer wg.Done()

            c, err := buildComplexFromUniProt(uniprotID)
            if err != nil {
                // Log but don't fail — one bad protein shouldn't kill the search
                return
            }

            mu.Lock()
            if c.DrugCount > maxDrugCount {
                maxDrugCount = c.DrugCount
            }
            results = append(results, *c)
            mu.Unlock()
        }(uid)
    }
    wg.Wait()

    // Now compute gap scores (requires knowing maxDrugCount across the dataset)
    for i := range results {
        results[i].GapScore = scoring.ComputeGapScore(
            results[i].DimerPLDDTAvg,
            results[i].DrugCount,
            maxDrugCount,
            results[i].IsWHOPathogen,
            results[i].DisorderDelta,
        )
    }

    return results, nil
}

// buildComplexFromUniProt fetches all data for one UniProt ID from external APIs.
// Returns nil + error if AlphaFold has no prediction for this protein.
func buildComplexFromUniProt(uniprotID string) (*models.Complex, error) {
    // Fetch UniProt metadata
    uniEntry, err := services.FetchUniProtEntry(uniprotID)
    if err != nil {
        return nil, err
    }

    // Fetch AlphaFold prediction
    afPred, err := services.FetchMonomerPrediction(uniprotID)
    if err != nil {
        return nil, err
    }

    // Fetch monomer pLDDT average
    monomerPDB := services.BuildMonomerPDBURL(uniprotID)
    monomerPLDDT, err := services.FetchPLDDTAverage(monomerPDB)
    if err != nil {
        monomerPLDDT = 0.0 // Non-fatal — use 0 if unavailable
    }

    // Fetch drug coverage from ChEMBL (non-fatal if fails)
    drugCount, drugNames, _ := services.FetchDrugCoverage(uniprotID)

    // Determine WHO pathogen status
    isWHO := scoring.IsWHOPathogen(uniEntry.Organism.TaxonID)

    // Extract disease associations from UniProt comments
    var diseases []string
    for _, comment := range uniEntry.Comments {
        if comment.CommentType == "DISEASE" {
            if comment.Disease.DiseaseID != "" {
                diseases = append(diseases, comment.Disease.DiseaseID)
            }
        }
    }

    // Extract gene name safely
    geneName := ""
    if len(uniEntry.Genes) > 0 {
        geneName = uniEntry.Genes[0].GeneName.Value
    }

    c := &models.Complex{
        UniprotID:          uniprotID,
        ProteinName:        uniEntry.ProteinDescription.RecommendedName.FullName.Value,
        GeneName:           geneName,
        Organism:           uniEntry.Organism.ScientificName,
        OrganismID:         uniEntry.Organism.TaxonID,
        IsWHOPathogen:      isWHO,
        DiseaseAssoc:       diseases,
        MonomerPLDDTAvg:    monomerPLDDT,
        DimerPLDDTAvg:      0.0, // Complex prediction fetch is Phase 2 bonus — see NOTE below
        DisorderDelta:      0.0,
        DrugCount:          drugCount,
        KnownDrugNames:     drugNames,
        MonomerStructURL:   afPred.CifURL,
        ComplexStructURL:   "", // Set when complex prediction is available
        Category:           inferCategory(isWHO, diseases),
        DemoHighlight:      false,
        AlphafoldID:        afPred.EntryID,
        GapScore:           0.0, // Computed after all results gathered
    }

    // NOTE: Fetching complex (dimer) pLDDT would require the complex API endpoint.
    // For live searches, we use monomerPLDDT as a proxy for GapScore computation
    // if dimerPLDDT is unavailable. The hero_complexes.json has accurate dimer data.
    if c.DimerPLDDTAvg == 0.0 {
        c.DimerPLDDTAvg = c.MonomerPLDDTAvg
    }

    return c, nil
}

// inferCategory determines the category of a complex based on its properties.
func inferCategory(isWHO bool, diseases []string) string {
    if isWHO {
        return "who_pathogen"
    }
    if len(diseases) > 0 {
        return "human_disease"
    }
    return "high_disorder_delta"
}

// sortByGapScore sorts a slice of Complex in descending order of GapScore.
func sortByGapScore(complexes []models.Complex) {
    sort.Slice(complexes, func(i, j int) bool {
        return complexes[i].GapScore > complexes[j].GapScore
    })
}

// mergeResults combines live results and hero matches, deduplicating by UniprotID.
// Live results take precedence over hero data for the same protein.
func mergeResults(live, hero []models.Complex) []models.Complex {
    seen := map[string]bool{}
    var merged []models.Complex
    for _, c := range live {
        seen[c.UniprotID] = true
        merged = append(merged, c)
    }
    for _, c := range hero {
        if !seen[c.UniprotID] {
            merged = append(merged, c)
        }
    }
    return merged
}
```

---

## STEP 2.9 — Implement the Complex Detail Handler

Create `backend/handlers/complex.go`:

```go
package handlers

import (
    "fmt"
    "gofr.dev/pkg/gofr"
    "github.com/ProtPocket/backend/data"
)

// ComplexDetailHandler handles GET /complex/:id
// :id can be either a UniProt ID (e.g. P04637) or an AlphaFold ID (e.g. AF-P04637-F1)
//
// First looks in hero_complexes.json for instant response.
// Falls back to live API fetch if not found in hero data.
func ComplexDetailHandler(ctx *gofr.Context) (interface{}, error) {
    id := ctx.PathParam("id")
    if id == "" {
        return nil, fmt.Errorf("path parameter 'id' is required")
    }

    // Normalize: if it's an AlphaFold ID like AF-P04637-F1, extract the UniProt part
    uniprotID := normalizeToUniProtID(id)

    // Check hero complexes first
    heroComplexes, err := data.LoadHeroComplexes()
    if err != nil {
        return nil, fmt.Errorf("critical: failed to load hero complexes: %w", err)
    }

    for _, c := range heroComplexes {
        if c.UniprotID == uniprotID || c.AlphafoldID == id {
            return c, nil
        }
    }

    // Not in hero list — try live build
    c, err := buildComplexFromUniProt(uniprotID)
    if err != nil {
        return nil, fmt.Errorf("complex not found in hero list and live fetch failed for %s: %w", uniprotID, err)
    }

    return c, nil
}

// normalizeToUniProtID extracts the UniProt accession from an AlphaFold ID.
// "AF-P04637-F1" → "P04637"
// "P04637" → "P04637" (unchanged)
func normalizeToUniProtID(id string) string {
    if len(id) > 3 && id[:3] == "AF-" {
        parts := strings.Split(id, "-")
        if len(parts) >= 2 {
            return parts[1]
        }
    }
    return id
}
```

Add `"strings"` to imports.

---

## STEP 2.10 — Implement the Undrugged Targets Handler

Create `backend/handlers/undrugged.go`:

```go
package handlers

import (
    "gofr.dev/pkg/gofr"
    "github.com/ProtPocket/backend/data"
    "github.com/ProtPocket/backend/models"
)

// UndruggedHandler handles GET /undrugged?limit={n}&filter={category}
//
// Query params:
//   limit  - number of results to return (default: 25, max: 50)
//   filter - one of: "all", "who_pathogen", "human_disease" (default: "all")
//
// Always uses hero_complexes.json — this endpoint never makes live API calls.
// It is a pre-computed research prioritization tool.
func UndruggedHandler(ctx *gofr.Context) (interface{}, error) {
    limitStr := ctx.Param("limit")
    filter := ctx.Param("filter")

    limit := 25
    if limitStr != "" {
        parsed, err := strconv.Atoi(limitStr)
        if err == nil && parsed > 0 && parsed <= 50 {
            limit = parsed
        }
    }
    if filter == "" {
        filter = "all"
    }

    heroComplexes, err := data.LoadHeroComplexes()
    if err != nil {
        return nil, fmt.Errorf("failed to load hero complexes: %w", err)
    }

    // Filter by category
    var filtered []models.Complex
    for _, c := range heroComplexes {
        if filter == "all" || c.Category == filter {
            filtered = append(filtered, c)
        }
    }

    // Sort by gap score descending
    sortByGapScore(filtered)

    // Cap at limit
    if len(filtered) > limit {
        filtered = filtered[:limit]
    }

    return map[string]interface{}{
        "filter":  filter,
        "count":   len(filtered),
        "results": filtered,
    }, nil
}
```

Add `"strconv"` to imports.

---

## STEP 2.11 — Wire Everything in main.go

Create `backend/main.go`:

```go
package main

import (
    "gofr.dev/pkg/gofr"
    "github.com/ProtPocket/backend/handlers"
)

func main() {
    app := gofr.New()

    // Search proteins/diseases — returns ranked list by gap score
    // Example: GET /search?q=TP53
    // Example: GET /search?q=tuberculosis
    app.GET("/search", handlers.SearchHandler)

    // Get full detail for one complex
    // Example: GET /complex/P04637
    // Example: GET /complex/AF-P04637-F1
    app.GET("/complex/{id}", handlers.ComplexDetailHandler)

    // Get pre-ranked undrugged targets dashboard
    // Example: GET /undrugged
    // Example: GET /undrugged?filter=who_pathogen&limit=10
    app.GET("/undrugged", handlers.UndruggedHandler)

    app.Run()
}
```

---

## STEP 2.12 — Run and Verify

**Step 1: Build**
```bash
cd backend/
go build ./...
```
Fix any compilation errors before proceeding. Do not run if build fails.

**Step 2: Run**
```bash
go run main.go
```
Server should start at `http://localhost:8080`

**Step 3: Test each endpoint manually**

Test 1 — Hero fallback search:
```bash
curl "http://localhost:8080/search?q=TP53"
```
Expected: JSON with `source: "fallback"` or `source: "live"`, results array with at least 1 complex, all 18 fields present.

Test 2 — WHO pathogen search:
```bash
curl "http://localhost:8080/search?q=tuberculosis"
```
Expected: Results where `is_who_pathogen: true`, gap scores > 1.0.

Test 3 — Complex detail:
```bash
curl "http://localhost:8080/complex/P04637"
```
Expected: Single complex object for TP53, all fields populated.

Test 4 — Undrugged dashboard:
```bash
curl "http://localhost:8080/undrugged?filter=who_pathogen&limit=5"
```
Expected: Top 5 WHO pathogen complexes sorted by gap_score descending.

Test 5 — Unknown protein (edge case):
```bash
curl "http://localhost:8080/search?q=xyzunknownprotein999"
```
Expected: `count: 0`, `source: "no_results"`, empty `results` array. Must NOT return a 500 error.

Test 6 — Empty query (edge case):
```bash
curl "http://localhost:8080/search"
```
Expected: HTTP 400 with error message. Must NOT panic.

**ALL 6 TESTS MUST PASS BEFORE PHASE 2 IS COMPLETE.**

---

## PHASE 2 COMPLETION CHECKLIST

- [ ] `go build ./...` completes with zero errors
- [ ] All 3 routes registered in main.go
- [ ] Server starts without panicking
- [ ] Test 1 passes (TP53 search returns results)
- [ ] Test 2 passes (tuberculosis search returns WHO pathogen results)
- [ ] Test 3 passes (complex detail returns full object)
- [ ] Test 4 passes (undrugged dashboard sorted by gap score)
- [ ] Test 5 passes (unknown query returns empty results, not 500)
- [ ] Test 6 passes (missing query returns 400, not panic)
- [ ] No goroutine leaks (each goroutine has a defer wg.Done())
- [ ] ChEMBL failure returns drug_count=-1, does not fail the request
- [ ] hero_complexes.json is embedded in binary (go:embed directive present)

---

## FILE OUTPUT MAP

After completing both phases, this is the exact file tree that must exist:

```
ProtPocket/
├── backend/
│   ├── main.go
│   ├── go.mod
│   ├── go.sum
│   ├── handlers/
│   │   ├── search.go
│   │   ├── complex.go
│   │   └── undrugged.go
│   ├── services/
│   │   ├── alphafold.go
│   │   ├── chembl.go
│   │   └── uniprot.go
│   ├── models/
│   │   └── complex.go
│   ├── scoring/
│   │   └── gap_score.go
│   └── data/
│       ├── hero_complexes.json   ← 30 verified complexes
│       └── loader.go
└── README.md
```

No other files should exist at this stage. Frontend directory must NOT be created yet.

---

*Phase 1 + Phase 2 Implementation Plan*
*ProtPocket — HackMol 7.0*
*Feed this document directly to the coding agent. Execute steps in order. Do not skip verification checks.*
