# ProtPocket — Research Notebook

## What It Is

The Research Notebook is a persistent workspace built into ProtPocket that lets researchers save protein complexes they find interesting, annotate them with their own observations, compare multiple complexes side by side, and export everything as a structured report. It turns ProtPocket from a one-time search tool into a continuous research companion.

Without the notebook, every ProtPocket session starts from scratch. A researcher who spends an hour finding five high-priority undrugged targets in tuberculosis proteins has no way to save that work, add context to it, or share it with their lab. The Research Notebook solves that entirely.

---

## Who It's For

**Structural biologists** who want to maintain a curated list of protein complexes worth investigating, annotated with their own hypotheses about drug binding sites or structural significance.

**Drug discovery teams** who need to compare multiple undrugged targets against each other and make a prioritization decision about where to focus their next research program.

**Academic researchers** who want to export a clean, citable report that documents their target selection rationale — including the gap scores, structural data, and AI-generated briefs — for inclusion in grant applications or lab reports.

---

## Core Features

---

### 1. Save to Notebook

Every search result card and every complex detail page has a bookmark button. Clicking it saves a complete snapshot of that protein complex — all metrics, structure URLs, disease associations, gap score, disorder delta — to the researcher's notebook.

The snapshot is taken at the moment of saving, meaning the data is preserved exactly as it was when the researcher found it. If AlphaFold updates its predictions later, the notebook retains the original values for reproducibility.

Saved proteins show a filled bookmark indicator on result cards so the researcher knows at a glance what they've already collected. Clicking the bookmark again removes the protein from the notebook.

---

### 2. The Notebook Page

A dedicated page at `/notebook` showing all saved protein complexes in a structured list. Each entry displays the full protein card with all metrics, plus the researcher's annotation below it and the date it was saved.

The list is sorted by gap score by default — the highest priority undrugged targets appear first. The researcher can also sort by date saved, organism, or disorder delta.

Each entry has an inline text field for annotations. The researcher clicks to edit and the note saves automatically. Notes are freeform — researchers use them for things like "potential binding site at ILE 232", "compare with BRCA1 in next experiment", or "discuss with team — high ipTM score suggests stable interface".

The page also shows summary statistics at the top: total proteins saved, how many are WHO pathogens, how many are undrugged, and the average gap score across the collection. This gives the researcher an instant sense of the quality of their shortlist.

---

### 3. Comparison View

When the researcher selects two to four proteins from their notebook using checkboxes, a "Compare Selected" button appears. Clicking it opens a full-width comparison table where metrics are rows and proteins are columns.

Every metric the system tracks is shown as a row:

- Protein name and gene
- Organism
- Monomer pLDDT confidence
- Dimer pLDDT confidence
- Disorder delta
- Number of approved drugs
- Known drug names
- Gap score
- WHO pathogen status
- Disease associations
- Interface confidence (ipTM score where available)
- AlphaFold entry ID

Cells are color-coded — within each metric row, the best value is highlighted in green and the worst in red. This makes it immediately obvious which protein is the strongest candidate across every dimension simultaneously.

The gap score row shows the full GapScoreBar component inline in each cell, not just the number — so the visual ranking is immediately clear.

The researcher can give the comparison a title ("Tuberculosis targets Q1 2026") and save it. Saved comparisons are accessible from the notebook page and can be re-opened, edited, or exported at any time.

---

### 4. AI Research Brief per Protein

Each saved protein in the notebook has an AI-generated research brief powered by Claude. The brief is four to six sentences covering:

- What this protein complex does biologically and why it matters
- What goes wrong in disease when this interaction is disrupted
- Why the structural reveal (disorder delta) is scientifically significant for this specific protein
- The current drug landscape — what exists and what the gap is
- A specific hypothesis about why this complex is worth investigating as a drug target

The brief is generated once when the protein is first saved and cached in MongoDB. The researcher can regenerate it at any time if they want a fresh perspective.

---

### 5. Comparison Summary Brief

When the researcher creates a comparison of multiple proteins, Claude generates a comparison-level brief that synthesizes across all selected targets. It covers which protein ranks highest by each criterion, what the proteins have in common structurally or biologically, and which one the AI considers the strongest drug discovery opportunity given the combined evidence.

This is not just individual briefs concatenated — it's a genuine cross-protein analysis that reasons about the relative merits of each target.

---

### 6. Report Export

The researcher can export their notebook or a specific comparison as a structured document in two formats.

**PDF Report**

A professionally formatted multi-page PDF suitable for sharing with a lab group, attaching to a grant application, or archiving as part of a research record.

Structure of the PDF:

- Cover page with title, date, and researcher session identifier
- Executive summary generated by Claude — a paragraph synthesizing the overall quality of the target collection and the key findings
- Summary table listing all saved proteins ranked by gap score
- Per-protein pages — one page per complex showing the protein name, organism, all numeric metrics, disease associations, structure file references, and the AI research brief
- Comparison section — the comparison table if a comparison was created, with the comparison brief below it
- Methodology section — a plain-English explanation of the gap score formula, the disorder delta computation, the data sources used, and the AlphaFold complex API discovery
- Data appendix — raw JSON for every saved protein for full reproducibility
- Citations — AlphaFold Database, UniProt, ChEMBL, EMBL-EBI, and the March 2026 complex dataset release

**Markdown Report**

A clean markdown document with the same structure as the PDF. Designed for pasting directly into a lab notebook, a GitHub repository, or any markdown-capable system. Includes all tables, metrics, and AI briefs in plain text format.

---

### 7. Session Persistence

The notebook persists across browser sessions using a device-generated UUID stored in the browser's localStorage. The UUID is sent with every notebook request as a session identifier. No account creation or login required.

This means a researcher can close the browser, come back the next day, and find their notebook exactly as they left it. Their annotations, comparisons, and saved proteins are all still there.

---

## What Gets Saved Per Protein

When a protein is saved to the notebook, the following data is stored as a snapshot in MongoDB:

- Full UniProt ID and AlphaFold ID
- Protein name, gene name, organism, organism ID
- Monomer pLDDT average
- Dimer pLDDT average
- Disorder delta
- Drug count and known drug names
- Gap score (with full breakdown: pLDDT norm, undrugged factor, WHO multiplier, disorder bonus)
- WHO pathogen status
- Disease associations
- Monomer structure URL
- Complex structure URL (if available)
- ipTM interface confidence score (if available)
- Category
- AI research brief text
- Timestamp of when it was saved
- Researcher annotation (empty string initially)

The snapshot approach means the notebook is a reproducible research record — the data reflects what AlphaFold and ChEMBL reported at the moment of discovery, not what they report at the moment the report is generated.

---

## Data Storage

MongoDB is used for all notebook persistence. Two collections are maintained.

The **notebooks** collection stores one document per session. Each document contains the session ID, timestamps, and an array of saved protein snapshots with their annotations.

The **comparisons** collection stores saved comparison objects. Each document contains the session ID, the list of UniProt IDs being compared, a user-defined title, any comparison notes, and the Claude-generated comparison brief.

Both collections are indexed by session ID for fast retrieval.

---

## User Flow — End to End

A researcher opens ProtPocket and searches "tuberculosis". The results page shows 12 proteins ranked by gap score. They see murC from Staphylococcus aureus at the top with gap score 1.88 and zero approved drugs. They click the bookmark icon — saved.

They click into the murC detail page and read the AI brief. They add an annotation: "high ipTM score — stable interface, good docking target. Follow up with Steinegger lab paper." They navigate back to search.

They search "FOS" and find it has disorder delta +46.2. They save it too. They keep going, building a shortlist of 6 proteins over the next 20 minutes.

They navigate to `/notebook`. They see all 6 proteins sorted by gap score. They select murC, ftsZ from M. tuberculosis, and FOS for comparison. The comparison table opens — FOS wins on disorder delta, murC wins on gap score, ftsZ has the WHO boost. They title the comparison "WHO pathogen vs cancer targets — Q1 shortlist" and save it.

They click Export → PDF. 30 seconds later a PDF downloads with a cover page, the comparison table, individual protein pages with AI briefs, and a methodology section. They attach it to their next lab meeting agenda.

---

## What This Enables That Didn't Exist Before

No existing structural bioinformatics tool combines all of the following in one place:

- Live gap score computation from real-time API data
- Persistent annotation of protein complexes
- Cross-protein comparison with visual ranking
- AI-generated research briefs grounded in structural and drug data
- One-click export to a citable PDF report

Researchers currently do all of this manually — querying multiple databases, copying data into spreadsheets, writing their own comparisons, and formatting reports by hand. The Research Notebook automates the entire workflow from discovery to documentation.

---

## Future Extensions

**Shared notebooks** — generate a read-only shareable link for a notebook or comparison, allowing a researcher to send their target list to a collaborator without any account required.

**Version history** — track how gap scores and AI briefs change over time as AlphaFold adds new complex predictions. Show a researcher when a protein they saved months ago has new structural data.

**Lab workspace** — multiple researchers share a single notebook, with per-user annotations visible alongside each other. Useful for research groups working on the same target list.

**Integration with literature** — pull recent PubMed papers for each saved protein and surface them in the notebook alongside the structural data. The AI brief incorporates recent publications automatically.

**Hypothesis tracking** — the researcher logs what they predicted about a protein, then comes back months later to record what the experimental results showed. ProtPocket becomes a longitudinal research journal, not just a discovery tool.

---

*ProtPocket Research Notebook — Feature Specification*
*Planned for Phase 6, post Claude API integration*