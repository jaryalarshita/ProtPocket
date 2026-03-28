# ProtPocket — Service Documentation

---

## What ProtPocket Does

ProtPocket is a protein complex drug target intelligence tool. It takes a protein name, gene name, disease, or organism as input and returns a ranked, contextualized analysis of whether that protein complex represents an urgent and undrugged research opportunity.

The core problem it solves: three critical biological databases — UniProt, AlphaFold, and ChEMBL — each hold a piece of the picture, but no single tool connects them, ranks the results by research urgency, and presents them in a way a researcher can act on immediately. ProtPocket does all of that in one query.

---

## Services

---

### 1. Multi-Database Aggregation

When a researcher queries ProtPocket, it simultaneously queries three independent biological databases and merges their responses into a single unified protein object.

**UniProt** provides the protein's identity — its full name, gene symbol, organism, taxonomy ID, and known disease associations. This is the starting point. Every other query depends on the UniProt accession ID that this lookup returns.

**AlphaFold Database** provides the structural data — the predicted 3D shape of the protein in both its monomer (single chain) and homodimer (complex) forms, along with per-residue confidence scores (pLDDT) for both. It also returns direct URLs to the structure files that can be loaded into a 3D viewer.

**ChEMBL** provides the drug landscape — how many approved drugs currently target this protein, and what those drugs are called. This is what determines whether a protein is "undrugged" or already covered by existing therapeutics.

Without ProtPocket, a researcher would need to visit three separate websites, run three separate queries, and manually connect the results. ProtPocket does this in a single API call.

---

### 2. Gap Score Computation

The Gap Score is ProtPocket's original algorithm. It answers one question: **how urgently does the world need a drug for this protein complex right now?**

It combines four signals into a single number:

- **Structural confidence** — how reliably AlphaFold has predicted the complex structure. A shaky prediction isn't worth a drug discovery program.
- **Drug coverage** — whether approved drugs already target this protein. Fully covered proteins score near zero. Undrugged proteins score maximum.
- **WHO pathogen status** — whether the organism is on the World Health Organization's priority pathogen list. These proteins receive a ×2.0 multiplier because the clinical urgency is highest.
- **Disorder delta bonus** — a small bonus for proteins that undergo a dramatic structural transformation in complex form, rewarding the most scientifically novel entries in the dataset.

The output is a single float ranked in descending order across all results. The highest gap score sits at the top of every list — the most critical undrugged target, first.

This algorithm does not exist in any existing tool or database. It was designed specifically for ProtPocket.

---

### 3. Disorder Delta Analysis

Disorder Delta measures how dramatically a protein's structural confidence changes when it forms a complex with its partner.

For many proteins, the single-chain (monomer) form is partially disordered — floppy, unpredictable, hard for AlphaFold to model with confidence. When two chains come together to form a homodimer, they lock each other into a stable, rigid shape that AlphaFold can model with much higher confidence.

ProtPocket computes this delta automatically:

```
Disorder Delta = Dimer pLDDT − Monomer pLDDT
```

A high positive delta means the protein's functional shape was completely hidden when studied in isolation — it only becomes visible and modelable in complex form. This is directly relevant to drug design: a drug targeting a disordered monomer would be targeting the wrong shape entirely. The complex form is the biologically relevant target.

ProtPocket surfaces proteins with the highest disorder delta as "structural reveal" cases — the most scientifically interesting entries in the new AlphaFold complex dataset.

---

### 4. Undrugged Target Identification

ChEMBL contains drug-target relationship data for thousands of proteins. But it does not rank proteins by how urgently a drug is needed, and it does not cross-reference that data with structural confidence or pathogen status.

ProtPocket automatically flags every protein with zero approved drugs as "Undrugged" and combines that signal with the gap score ranking. The result is a leaderboard — the Undrugged Targets Dashboard — that shows researchers exactly which high-confidence, disease-relevant protein complexes have no drug coverage, sorted by priority.

This is a research prioritization service. It replaces what would otherwise be days of manual cross-referencing across multiple databases.

---

### 5. WHO Pathogen Contextualization

The World Health Organization publishes a priority pathogen list — 19 bacteria and pathogens that represent the greatest global health threat due to antibiotic resistance and lack of effective treatments.

ProtPocket hardcodes this list as an internal lookup table keyed by NCBI taxonomy ID. Every protein query is automatically checked against this list. If the organism matches, the protein receives a WHO Priority Pathogen flag in the UI and a ×2.0 multiplier in the gap score.

This means a researcher searching for tuberculosis proteins, or Staphylococcus aureus proteins, or Klebsiella pneumoniae proteins will immediately see which results come from the most dangerous pathogens — without opening a second tab or consulting a separate document.

---

### 6. Research Priority Ranking

Every biological database returns results in its own order — usually alphabetical or by text relevance to the search term. Neither of those orderings reflects research urgency.

ProtPocket reorders every result set by gap score, descending. The most urgently needed, undrugged, high-confidence target always appears first. A researcher scanning 10 results does not need to evaluate each one manually — the ranking has already done that work.

This ranking is applied to both live search results and the pre-computed Undrugged Targets Dashboard.

---

### 7. AI Research Brief Generation *(Phase 5)*

Biological databases return numbers and identifiers. They do not explain what those numbers mean in plain language or what a researcher should do with them.

ProtPocket uses the Claude API to synthesize a 4-sentence research brief for every protein complex. The brief is generated by feeding all structured data — protein name, organism, pLDDT scores, disorder delta, drug count, disease associations, WHO status — into a structured prompt and returning a plain-English summary covering:

- What this protein complex does biologically
- What goes wrong in disease when this interaction is disrupted
- Why the structural reveal (monomer disorder to dimer order) matters
- The drug discovery opportunity and whether this is an undrugged target

This transforms raw data into actionable insight. A researcher, a student, or a judge at a hackathon can read four sentences and understand why this protein matters — without a PhD in structural biology.

---

### 8. Direct Structure File Access

Every protein complex result includes direct URLs to the AlphaFold `.cif` structure files for both the monomer and the homodimer. These are live links to the AlphaFold Database servers.

In Phase 3 these URLs are surfaced as downloadable links. In Phase 4 they are fed directly into the Mol* 3D viewer, which renders the structure interactively in the browser — colored by pLDDT confidence score so disordered regions (red) and confident regions (blue/green) are immediately visible.

This means a researcher can go from a protein name to an interactive 3D structure in two clicks.

---

## Summary Table

| Service | What It Replaces | Where It Runs |
|---|---|---|
| Multi-database aggregation | 3 manual database queries | GoFr backend |
| Gap score computation | Manual research prioritization | GoFr backend |
| Disorder delta analysis | Manual pLDDT comparison | GoFr backend |
| Undrugged target identification | Manual ChEMBL cross-referencing | GoFr backend |
| WHO pathogen contextualization | Manual list lookup | GoFr backend |
| Research priority ranking | Alphabetical/relevance ordering | GoFr backend |
| AI research brief generation | Literature review | Claude API|
| Direct structure file access | Navigating AlphaFold manually | Frontend|

---
