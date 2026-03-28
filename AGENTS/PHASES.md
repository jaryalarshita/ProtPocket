Here's a clean breakdown of all the phases:

---

## Phase 1 — Data & Curation (Pre-work / Hour 0–2)
The foundation everything else sits on.

- Manually curate 30 "hero" complexes from AlphaFold DB
- Store them in a static JSON file — this is your demo safety net if APIs fail
- Map out which UniProt IDs correspond to WHO pathogens
- Verify that structure `.cif` URLs are accessible and load in Mol*
- Test all three external APIs manually (AlphaFold, ChEMBL, UniProt) — understand their response shapes before writing a single route

---

## Phase 2 — Backend (Hour 2–10)
GoFr (Go) service that is the brain of the app.

**Three routes to build:**
- `/search?q=` — takes a protein/disease name, hits AlphaFold + ChEMBL + UniProt concurrently, computes gap score, returns ranked list
- `/complex/:id` — returns full detail for one complex including per-residue pLDDT for disorder delta computation
- `/undrugged` — returns pre-ranked top 25 gap score complexes from hero list

**Core logic to implement:**
- Gap score algorithm
- Disorder delta computation
- WHO pathogen checklist
- Concurrent API calls with goroutines

---

## Phase 3 — Frontend Shell (Hour 8–16)
Next.js app, use V0 by Vercel to scaffold fast.

**Three pages:**
- **Home / Search** — search bar + result cards ranked by gap score
- **Detail Page** — two Mol* viewers side by side + metrics + AI brief
- **Undrugged Dashboard** — ranked table of top targets

**Component priorities:**
- Search bar with loading state
- Result card (confidence badge, WHO flag, drug count chip, gap score bar)
- The two-panel 3D viewer layout

---

## Phase 4 — 3D Visualization (Hour 12–20)
This is the hardest and most impressive part technically.

- Integrate Mol* viewer as a React component
- Load monomer `.cif` from AlphaFold URL
- Load dimer `.cif` from AlphaFold URL
- Apply pLDDT color theme to both (blue = confident, red = disordered)
- Build the "Reveal" button — Framer Motion transition from monomer view expanding to dimer
- Display disorder delta as a visual metric bar between the two panels

This phase has the highest risk of eating time — timebox it hard.

---

## Phase 5 — AI Pipeline (Hour 16–22)
Claude API integration for the narrative layer.

- Write the structured prompt (protein name + pLDDT + disease + drug count + organism → 4-sentence research brief)
- Build a Next.js API route that calls Claude
- Stream the response to the frontend (typewriter effect for demo drama)
- Pre-generate and cache briefs for all 30 hero complexes at app startup
- For live searches, generate on first query and cache in memory

---

## Phase 6 — Integration & Glue (Hour 20–26)
Connecting all phases together end to end.

- Wire backend search response into frontend cards
- Wire complex detail API into Mol* viewer URL construction
- Wire Claude brief into detail page below the viewer
- End-to-end test: type a protein name → see results → click → see 3D → see brief
- Handle error states gracefully (unknown protein, API timeout, no results)

---

## Phase 7 — Polish & Demo Prep (Hour 26–30)
Where good projects become winning projects.

- Hardcode 3 demo paths as "Featured" on homepage (TP53, TB pathogen, high disorder complex)
- Preload all hero structure files so Mol* renders instantly during demo
- Final visual polish — spacing, badges, color consistency
- Rehearse demo script twice as a team
- Freeze code, submit to Devfolio, push final build to Vercel

---

**The dependency chain in one line:**

```
Phase 1 → Phase 2 → Phase 3 + Phase 4 (parallel) → Phase 5 → Phase 6 → Phase 7
```

Phases 3 and 4 can run in parallel if two people split frontend shell vs. 3D viewer work — that's where you save the most time.