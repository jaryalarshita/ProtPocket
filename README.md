# ProtPocket
### Theme Alignment: MedTech / Healthcare + AI & Machine Learning

---

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [The Innovation — What We're Actually Building](#2-the-innovation)
3. [Solution Architecture](#3-solution-architecture)
4. [Tech Stack (Aligned to Sponsors)](#4-tech-stack)
5. [System Design](#5-system-design)
6. [Feature Breakdown](#6-feature-breakdown)
7. [Implementation Plan — Hour by Hour](#7-implementation-plan)
8. [API & Data Sources](#8-api--data-sources)
9. [Demo Day Script](#9-demo-day-script)
10. [Why This Wins](#10-why-this-wins)
11. [Team Role Split](#11-team-role-split)
12. [Risk Register](#12-risk-register)

---

## 1. Problem Statement

### The Biological Context

Proteins are the machinery of life. But they rarely work alone — they bind to each other, forming **protein complexes** that carry out almost every function in the human body: switching genes on and off, fighting pathogens, building tissue, signalling between cells.

For decades, scientists could only study proteins in isolation. On March 16, 2026 — **less than two weeks before this hackathon** — EMBL-EBI, Google DeepMind, NVIDIA, and Seoul National University released the largest dataset of AI-predicted protein complex structures ever assembled: **1.7 million high-confidence homodimer structures** added to the AlphaFold Database, with 18 million more available for bulk download.

### The Problem No One Has Solved Yet

This dataset is enormous, raw, and completely unexplored. Right now:

- **Researchers** have to manually query individual proteins through the AlphaFold Database — there is no discovery layer, no ranking, no disease context.
- **The "disordered → ordered" phenomenon** is buried in the data. Many proteins appear structurally disordered as a monomer but snap into a stable, functional shape only when paired with their partner — revealing biology that single-chain models miss entirely. There is no tool that surfaces these dramatic structural transitions.
- **The drug target gap is invisible.** Among the WHO's priority pathogens — the deadliest bacteria and viruses on Earth — we now have predicted complex structures. But nobody has mapped which of these complexes represent undrugged interactions: proteins that are biologically critical but have no existing approved drug targeting them.

### The Core Problem Statement

> *Scientists and drug discovery teams cannot efficiently identify which newly predicted protein complexes represent the highest-priority, undrugged targets for disease intervention — and there is no tool that makes the structural story of these complexes visually and narratively accessible.*

---

## 2. The Innovation

This is not a pretty frontend over an API. Here is what we are actually building that doesn't exist yet:

### Innovation 1: Automated Drug Target Gap Finder

We cross-reference three independent data sources in real time:

1. **AlphaFold Database** — structure + confidence score of a complex
2. **ChEMBL / DrugBank** — known drugs and their protein targets
3. **WHO Priority Pathogen List** — the 19 pathogens WHO has designated as critical

Our pipeline flags complexes where:
- Confidence score is high (> 70 pLDDT)
- The protein is from a WHO priority pathogen OR a human cancer/disease gene
- No approved drug currently targets this interaction

**Output:** A ranked "Undrugged Targets" list — a research prioritization tool that would take a scientist weeks to compile manually, delivered in seconds.

### Innovation 2: The Structural Reveal Engine

We surface the "disordered → ordered" transition that is the defining scientific insight of the new dataset. For each complex, we compute and display:

- **Monomer disorder score** — using pLDDT per-residue scores from the single-chain AlphaFold model
- **Dimer order gain** — the delta in structural confidence when the complex is formed
- **Visual side-by-side** — 3D viewer showing the floppy monomer next to the locked dimer

Complexes with the highest disorder-to-order delta are surfaced as "Hidden Structure" cases — the ones where the biology was completely invisible until the partner was added. This is a metric no existing tool computes or ranks by.

### Innovation 3: AI Narrative Synthesis

The AlphaFold Database gives you coordinates and confidence numbers. It gives you no meaning. We use the Claude API to synthesize a plain-English research brief per complex, pulling context from the protein's known biology, its disease associations, and its structural novelty score. This turns a structure file into an insight.

---

## 3. Solution Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     ProtPocket UI                      │
│         (Next.js + Mol* 3D Viewer + Tailwind)           │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│                    GoFr Backend (Go)                     │
│  ┌─────────────────┐  ┌──────────────┐  ┌───────────┐  │
│  │  Search Engine  │  │  Gap Finder  │  │ AI Synth  │  │
│  │  (protein/dis-  │  │  Pipeline    │  │ (Claude   │  │
│  │   ease lookup)  │  │              │  │  API)     │  │
│  └────────┬────────┘  └──────┬───────┘  └─────┬─────┘  │
└───────────┼───────────────────┼────────────────┼────────┘
            │                   │                │
   ┌────────▼──────┐  ┌────────▼──────┐  ┌──────▼──────┐
   │ AlphaFold DB  │  │ ChEMBL API    │  │ PubMed API  │
   │ REST API      │  │ (drug targets)│  │ (literature)│
   └───────────────┘  └───────────────┘  └─────────────┘
```

### Data Flow

1. User searches a protein name, disease, or organism
2. GoFr backend queries AlphaFold API for matching complexes + confidence data
3. Gap Finder pipeline checks ChEMBL for known drugs targeting those proteins
4. Disorder delta is computed from per-residue pLDDT scores
5. Claude API synthesizes a research brief combining all signals
6. Frontend renders search results ranked by "gap score" (high confidence + undrugged)
7. User clicks a complex → 3D Mol* viewer loads monomer + dimer side by side
8. Structural reveal animation plays; AI brief displayed below

---

## 4. Tech Stack

Every major technology choice is deliberately aligned to HackMol 7.0's sponsors and judging criteria.

### Frontend

| Technology | Reason |
|---|---|
| **Next.js 14** (App Router) | Production-grade React, SSR for fast initial load, easy deployment to Vercel |
| **V0 by Vercel** *(Gold Sponsor)* | Use V0 to rapidly prototype and generate the initial UI components — explicitly leverages the sponsor's tool, which judges will notice and appreciate |
| **Tailwind CSS** | Utility-first, fast to build with, works seamlessly with V0 output |
| **Mol* Viewer** | The industry-standard open-source 3D protein structure viewer used by PDB and AlphaFold Database itself. Embeddable as a React component. Handles PDB/mmCIF files natively. |
| **Framer Motion** | Smooth animations for the monomer → dimer structural reveal transition |

### Backend

| Technology | Reason |
|---|---|
| **GoFr** *(Gold Sponsor)* | GoFr is a Go microservice framework — explicitly a HackMol sponsor. Using it as our backend framework directly supports the sponsor relationship and demonstrates awareness. Fast, structured, production-ready. |
| **Go** | Excellent for concurrent API calls (fetching AlphaFold + ChEMBL + PubMed simultaneously with goroutines) |

### AI & Intelligence Layer

| Technology | Reason |
|---|---|
| **Claude API (Anthropic)** | Powers the narrative synthesis layer — given a protein complex's metadata, generates a plain-English research brief explaining the biology, disease relevance, and drug target status |
| **Custom Gap Scoring Algorithm** | Our own logic: `gap_score = confidence_pLDDT × (1 - drug_coverage) × who_priority_multiplier` |
| **Disorder Delta Computation** | Computed from per-residue pLDDT from monomer vs. complex predictions |

### Deployment & Infrastructure

| Technology | Reason |
|---|---|
| **Vercel** *(V0 is Vercel's product — Gold Sponsor)* | Deploy Next.js frontend to Vercel for zero-config deployment with a live URL ready for demo day |
| **Railway / Render** | Deploy GoFr backend as a containerized service |
| **Devfolio** *(Silver Sponsor)* | Project submission platform — ensures visibility to sponsor judges |

### Data Sources (All Free / Open)

| Source | What We Use |
|---|---|
| **AlphaFold Database REST API** | Protein structure data, pLDDT scores, complex predictions |
| **ChEMBL REST API** | Drug-target associations, approved drug coverage per protein |
| **UniProt API** | Protein metadata, gene names, organism, disease associations |
| **WHO Priority Pathogen List** | Hardcoded list of 19 pathogens; used as a filter multiplier |

---

## 5. System Design

### The Gap Score Algorithm

This is the core innovation of ProtPocket. Every complex in our results is ranked by a Gap Score:

```
Gap Score = pLDDT_confidence × (1 - drug_coverage) × who_multiplier × disorder_delta_bonus

Where:
- pLDDT_confidence    = AlphaFold confidence score normalized 0–1 (from 0–100)
- drug_coverage       = 0 if no drugs target this protein, 1 if fully covered
- who_multiplier      = 2.0 if organism is on WHO priority pathogen list, else 1.0
- disorder_delta_bonus= (dimer_avg_pLDDT - monomer_avg_pLDDT) / 100, bonus for dramatic reveals
```

A perfect gap score target: a high-confidence complex (0.9) in a WHO pathogen (×2.0) with no drugs (×1.0) and a dramatic structural reveal (+0.3 bonus) → score of ~2.1. These are the entries we surface at the top.

### Database Schema (in-memory / cached)

```
Complex {
  alphafold_id        string
  protein_name        string
  uniprot_id          string
  organism            string
  is_who_pathogen     bool
  disease_associations []string
  monomer_plddt_avg   float
  dimer_plddt_avg     float
  disorder_delta      float
  drug_count          int
  known_drug_names    []string
  gap_score           float
  ai_brief            string  // generated by Claude, cached
  structure_url       string  // mmCIF file URL for Mol* viewer
}
```

### Caching Strategy

Claude API calls are expensive per-request. We pre-generate AI briefs for our 30 curated "hero" complexes at startup and cache them. For live searches, briefs are generated on first query and cached in memory for the session.

---

## 6. Feature Breakdown

### Feature 1: Smart Search

- Input: protein name (e.g. "TP53"), disease (e.g. "tuberculosis"), or organism (e.g. "M. tuberculosis")
- Output: ranked list of protein complexes sorted by Gap Score
- Each card shows: protein name, organism, confidence badge (color-coded), WHO pathogen flag, drug count chip, disorder delta indicator

### Feature 2: The Undrugged Targets Dashboard

- A pre-computed leaderboard of the highest Gap Score complexes across all 20 studied species
- Filterable by: WHO pathogen only | Human disease only | High disorder delta only
- This is the research tool that justifies the project's existence beyond a pretty UI

### Feature 3: The Structural Reveal

- Click any complex → detail page opens
- Two Mol* viewers side by side: Monomer (left) vs. Dimer (right)
- Both colored by pLDDT score (blue = confident, red = disordered)
- "Reveal" button triggers an animation: the monomer view transitions to the dimer with a smooth morph effect
- Below: disorder delta metric displayed as a visual bar — "this protein gained X% structural confidence when paired"

### Feature 4: AI Research Brief

- Rendered below the 3D viewer
- Covers: what this protein does, what goes wrong in disease, why the interaction matters, current drug landscape, why this is a priority target
- Tone: written for a researcher, not a student — precise, citable, useful
- Generated by Claude API with a structured prompt including pLDDT, disease associations, drug count, and organism context

### Feature 5: Export & Share

- "Copy cite-ready summary" button — outputs a structured summary of the complex with AlphaFold ID, gap score, and AI brief
- Shareable URL per complex (e.g. ProtPocket.app/complex/AF-0000000066503175)

---

## 7. Implementation Plan — Hour by Hour

### Pre-Hackathon (Before March 28)

- [ ] Read AlphaFold API docs thoroughly; test endpoints for pLDDT data
- [ ] Test ChEMBL API for drug-target queries
- [ ] Identify and manually curate 30 "hero" complexes (10 human disease, 10 WHO pathogens, 10 high disorder delta) — this is your demo safety net
- [ ] Set up GitHub repo with monorepo structure: `/frontend` (Next.js) and `/backend` (Go/GoFr)
- [ ] Get Claude API key ready; test a brief generation prompt
- [ ] Use V0 by Vercel to generate initial UI wireframe/components (this is fast and leverages the sponsor tool)

---

### Hour 0–2: Kickoff & Setup

**All team members**
- Finalize repo structure, agree on API contracts between frontend and backend
- Set up Vercel project linked to GitHub (auto-deploy on push)
- Set up Railway project for GoFr backend
- Load the 30 hero complexes into a JSON file as a hardcoded fallback — this is your insurance policy if APIs fail during demo

**GoFr Backend skeleton:**
```go
// main.go
package main

import "gofr.dev/pkg/gofr"

func main() {
    app := gofr.New()
    app.GET("/search", SearchHandler)
    app.GET("/complex/:id", ComplexDetailHandler)
    app.GET("/undrugged", UndruggedTargetsHandler)
    app.Run()
}
```

---

### Hour 2–8: Backend Core

**Backend developer (primary)**

Build the three core handlers:

**SearchHandler** — queries AlphaFold API by protein name → fetches pLDDT → queries ChEMBL for drug coverage → computes gap score → returns ranked list

```go
func SearchHandler(ctx *gofr.Context) (interface{}, error) {
    query := ctx.Param("q")
    
    // 1. Query AlphaFold API
    complexes := fetchAlphaFoldComplexes(query)
    
    // 2. For each, check ChEMBL drug coverage (concurrent goroutines)
    var wg sync.WaitGroup
    for i := range complexes {
        wg.Add(1)
        go func(c *Complex) {
            defer wg.Done()
            c.DrugCount = fetchChEMBLDrugCount(c.UniprotID)
            c.IsWHOPathogen = checkWHOList(c.Organism)
            c.GapScore = computeGapScore(c)
        }(&complexes[i])
    }
    wg.Wait()
    
    // 3. Sort by gap score descending
    sort.Slice(complexes, func(i, j int) bool {
        return complexes[i].GapScore > complexes[j].GapScore
    })
    
    return complexes, nil
}
```

**ComplexDetailHandler** — fetches full pLDDT per-residue data, computes disorder delta, triggers Claude brief generation

**UndruggedTargetsHandler** — returns pre-computed top 20 gap score complexes from hero list

---

### Hour 8–16: Frontend Core

**Frontend developer (primary)**

Use V0 by Vercel to generate the base component set: search bar, result card, detail page layout. Then customize heavily.

**Search Results Page:**
- Dark background (scientific tool aesthetic — dark navy, not black)
- Result cards with: protein name, organism chip, confidence badge (green/yellow/red), WHO flag (red badge), drug count chip, gap score as a horizontal bar
- Sorted by gap score by default; toggle filters on the right

**Detail Page — the money shot:**
- Two-panel layout, 50/50
- Left: Mol* viewer initialized with monomer mmCIF URL (colored by pLDDT)
- Right: Mol* viewer initialized with complex mmCIF URL
- Below viewers: disorder delta bar visualization
- Below that: AI research brief (streamed in typewriter effect for drama)

**Mol* React integration:**
```jsx
import { createPluginUI } from 'molstar/lib/mol-plugin-ui';

export function ProteinViewer({ structureUrl, label }) {
  const containerRef = useRef(null);
  
  useEffect(() => {
    const plugin = createPluginUI(containerRef.current, {
      layoutIsExpanded: false,
      layoutShowControls: false,
    });
    plugin.loadStructureFromUrl(structureUrl, 'mmcif');
    plugin.representation.structure.themes.colorTheme = 'plddt-confidence';
    return () => plugin.dispose();
  }, [structureUrl]);

  return <div ref={containerRef} style={{ height: '400px' }} />;
}
```

---

### Hour 16–22: The Structural Reveal Animation + AI Brief

**Full team**

**Reveal Animation:**
- Both viewers load simultaneously on page open
- "Reveal the Complex" button triggers: left panel fades out, right panel expands full-width, then a Framer Motion transition overlays a brief "assembly" animation (two chains appearing and rotating into locked position)
- This is the emotional high point of the demo

**Claude API Integration:**
```javascript
// /api/brief/route.js (Next.js API route)
export async function POST(req) {
  const { complex } = await req.json();
  
  const prompt = `You are a structural biologist writing a research brief.
  
  Protein: ${complex.protein_name}
  Organism: ${complex.organism}  
  WHO Priority Pathogen: ${complex.is_who_pathogen}
  AlphaFold Confidence (monomer): ${complex.monomer_plddt_avg}%
  AlphaFold Confidence (complex): ${complex.dimer_plddt_avg}%
  Structural disorder gain: ${complex.disorder_delta}% improvement in complex form
  Approved drugs targeting this protein: ${complex.drug_count}
  Known disease associations: ${complex.disease_associations.join(', ')}
  
  Write a 4-sentence research brief covering:
  1. What this protein complex does biologically
  2. What goes wrong in disease when this interaction is disrupted
  3. Why the structural reveal (monomer disorder → dimer order) matters
  4. The drug discovery opportunity — specifically if this is undrugged
  
  Write for an expert audience. Be precise and specific. Do not be generic.`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 400,
    messages: [{ role: 'user', content: prompt }]
  });
  
  return Response.json({ brief: response.content[0].text });
}
```

---

### Hour 22–26: Undrugged Targets Dashboard

**Backend + Frontend together**

Build the dashboard view — this is the second major feature after search:

- Full-page table/grid of top 25 highest gap-score complexes
- Columns: Rank | Protein | Organism | WHO Pathogen | Confidence | Drugs Known | Disorder Delta | Gap Score
- Color-coded rows: red = WHO pathogen + undrugged, orange = human disease + undrugged, yellow = moderate gap
- Clicking any row → goes to detail page

This is what gives the project its "research tool" credibility beyond a visualization demo.

---

### Hour 26–28: Polish, Edge Cases, Demo Path

**All team members**

- Hardcode the 3 demo paths into a "Featured" section on the homepage:
  - **TP53** — human cancer, disordered monomer, dramatic reveal
  - **Mycobacterium tuberculosis FtsZ** — WHO pathogen, undrugged, high gap score
  - One more high disorder-delta complex for pure visual impact
- Test search with edge cases: misspelled proteins, unknown proteins, empty results — handle gracefully
- Ensure Mol* viewers load within 3 seconds (preload hero structures)
- Mobile-responsive check (judges may demo on phones)
- Set up a custom domain if possible via Vercel (ProtPocket.vercel.app at minimum)

---

### Hour 28–30: Buffer, Rehearsal, Submission

- Freeze code at Hour 28 — no new features, only bug fixes
- Submit to Devfolio with: project title, 2-minute demo video, GitHub link, tech stack list (mention GoFr and V0 explicitly)
- Rehearse the demo script (see Section 9) twice as a team
- Prepare 3 "deep technical questions" answers: the gap score formula, the disorder delta computation, the Claude prompt structure

---

## 8. API & Data Sources

### AlphaFold Database REST API

Base URL: `https://alphafold.ebi.ac.uk/api`

Key endpoints:
- `GET /prediction/{qualifier}` — fetch prediction by UniProt ID, returns pLDDT, structure URLs
- `GET /search?q={query}&type=complex` — search for complexes (new endpoint added with the March 2026 update)
- Structure files: `https://alphafold.ebi.ac.uk/files/AF-{id}-F1-model_v4.cif`

### ChEMBL REST API

Base URL: `https://www.ebi.ac.uk/chembl/api/data`

Key endpoints:
- `GET /target/search?q={uniprot_id}` — find ChEMBL target ID from UniProt
- `GET /activity?target_chembl_id={id}&type=IC50` — get drug activity data
- Drug count = number of unique approved molecules with activity against this target

### UniProt REST API

Base URL: `https://rest.uniprot.org/uniprotkb`

Key endpoints:
- `GET /search?query={name}&format=json` — protein metadata, disease associations, organism
- `GET /{uniprot_id}` — full protein record

### Claude API (Anthropic)

- Model: `claude-sonnet-4-20250514`
- Used for: research brief generation (400 tokens max per brief)
- Rate: cached for hero complexes, generated on-demand for live searches

---

## 9. Demo Day Script

**Time budget: 90 seconds max before judges ask questions**

---

**[0:00]** Open ProtPocket homepage. No slides. Live site.

*"Proteins don't work alone. They form complexes — and two weeks ago, the AlphaFold Database released 1.7 million of them for the first time. The problem? Nobody can easily find which ones matter most for disease. ProtPocket fixes that."*

**[0:15]** Type "tuberculosis" in the search bar. Results appear ranked by Gap Score.

*"We built a Gap Score — it ranks complexes by how confident the prediction is, how critical the pathogen is, and crucially — whether any drug exists for this target. Red badges mean WHO priority pathogens. Zero here means zero approved drugs."*

**[0:30]** Click the top result — an M. tuberculosis complex with gap score ~1.8.

*"Now here's the science that makes this dataset special."*

Two panels load — disordered monomer on the left, stable dimer on the right, both colored by pLDDT (blue = confident, red = disordered).

*"This protein alone looks like spaghetti — 40% structural confidence. But when it meets its partner, it snaps into a precise, functional shape — 82% confidence. That structure was completely invisible before this dataset existed. And no drug targets it."*

**[0:55]** Point at the AI brief below the viewer.

*"ProtPocket synthesizes a plain-English research brief for every complex — combining the structural data, disease context, and drug landscape. A scientist would spend days pulling this together. We do it in seconds."*

**[1:10]** Switch to the Undrugged Targets dashboard.

*"And here's the dashboard — a ranked leaderboard of the highest-priority undrugged complexes across all 20 species in the dataset. This is a research prioritization tool that didn't exist before this hackathon."*

**[1:25]** Land the conclusion.

*"ProtPocket turns the world's largest protein complex dataset into actionable drug discovery intelligence. Built in 30 hours on top of data released 12 days ago."*

---

## 10. Why This Wins

### Against the Judging Criteria

| Criterion | How ProtPocket Scores |
|---|---|
| **Innovation** | Gap Score algorithm, disorder delta surfacing, and narrative synthesis are all novel. The dataset itself is 12 days old — we are among the first builders in the world to work with it. |
| **Technical Depth** | Concurrent multi-API pipeline in Go, custom scoring algorithm, Mol* 3D viewer integration, Claude API synthesis, full-stack deployment |
| **Scalability** | GoFr backend is built for microservice scale. AlphaFold Database has 30M complexes; our architecture handles it via pagination and caching |
| **Design** | Dark, scientific aesthetic. Mol* viewer is the same tool used by PDB and EMBL-EBI. Framer Motion reveals. Not a generic dashboard. |
| **Real-World Impact** | Drug discovery impact is concrete. WHO pathogens + undrugged targets = lives saved if even one lead comes from this tool |

### Sponsor Alignment

| Sponsor | How We Use Them |
|---|---|
| **V0 by Vercel** (Gold) | UI component generation — explicitly mentioned in demo |
| **GoFr** (Gold) | Entire backend framework — explicitly named in tech stack |
| **Devfolio** (Silver) | Project submitted through platform |
| **HackerRank** (Gold) | Team members can demonstrate coding profiles if asked |

### The Unfair Advantage

The AlphaFold protein complex dataset was released **March 16, 2026 — 12 days before this hackathon**. No existing tool has built on top of it. The narrative practically writes itself: *"We built in 30 hours what didn't exist two weeks ago."* That's a story no other team at HackMol 7.0 can tell about their dataset.

---

## 11. Team Role Split

### Recommended for a 4-person team

**Person 1 — Backend Lead**
- GoFr API setup and all three route handlers
- AlphaFold + ChEMBL + UniProt API integration
- Gap Score algorithm implementation
- Concurrent goroutine management

**Person 2 — Frontend Lead**
- Next.js setup, V0 component generation and customization
- Search results page and card components
- Undrugged Targets dashboard
- Vercel deployment

**Person 3 — 3D & Animation**
- Mol* viewer React integration (monomer + dimer panels)
- Framer Motion structural reveal animation
- pLDDT color theme configuration
- Detail page layout

**Person 4 — AI & Data**
- Claude API integration and prompt engineering
- Hero complex curation (30 manually selected complexes)
- Disorder delta computation logic
- Demo prep and fallback JSON data

---

## 12. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| AlphaFold API is slow or rate-limited | Medium | High | Pre-fetch and cache 30 hero complexes in JSON at startup. Demo always uses these. |
| ChEMBL API returns incomplete drug data | Medium | Medium | Default drug_count to -1 (unknown) rather than 0; display as "Coverage Unknown" |
| Mol* viewer fails to load in demo browser | Low | High | Pre-load structure files as local static assets for the 3 demo complexes |
| Claude API rate limit during demo | Low | Medium | Cache all AI briefs for hero complexes at startup; demo never hits live generation |
| Complex AlphaFold search API doesn't return expected fields | Medium | High | Build a scraper fallback using the bulk download manifest + static JSON |
| GoFr deployment fails | Low | High | Backend can be replaced with Next.js API routes as an emergency fallback |
| 30-hour time overrun | High | Medium | Feature priority: Gap Score + Search (must) → Detail View + Mol* (must) → AI Brief (should) → Dashboard (nice to have) |

---

## Appendix: Key Resources

- AlphaFold Database: https://alphafold.ebi.ac.uk
- AlphaFold API Docs: https://alphafold.ebi.ac.uk/api-docs
- Mol* Viewer: https://molstar.org
- GoFr Framework: https://gofr.dev
- V0 by Vercel: https://v0.dev
- ChEMBL API: https://www.ebi.ac.uk/chembl/api/data/docs
- WHO Priority Pathogens: https://www.who.int/publications/i/item/9789240093461
- Original EMBL-EBI Announcement: https://www.embl.org/news/science-technology/first-complexes-alphafold-database/
- NVIDIA Preprint on methodology: https://research.nvidia.com/labs/dbr/assets/data/manuscripts/afdb.html

---
