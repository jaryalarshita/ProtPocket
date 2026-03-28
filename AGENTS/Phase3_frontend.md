# ProtPocket — Phase 3 Frontend Implementation Plan
### React + Vite + Tailwind CSS
### For Coding Agent — Read completely before writing a single line

---

## OVERVIEW

Phase 3 builds the complete frontend shell of ProtPocket. By the end of this phase you will have four fully functional pages — Homepage, Search Results, Complex Detail, and Undrugged Dashboard — wired to the live GoFr backend running at `localhost:8080`. The Mol* 3D viewer is NOT part of this phase (that is Phase 4). A placeholder panel is used in its place.

---

## AESTHETIC DIRECTION

**Concept:** Scientific instrument. Dark, precise, data-dense. Think research terminal — not a startup landing page. Every element earns its place. No decoration for decoration's sake.

**Rules that cannot be broken:**
- Dark background throughout. `#0a0a0a` for the page, `#111111` for cards and panels.
- No gradients anywhere. Not even subtle ones.
- No emojis anywhere in the UI.
- One accent color only: green (`#4ade80`). Used sparingly — gene names, active states, undrugged badges, positive deltas.
- Red (`#f87171`) for WHO pathogen flags only.
- Yellow (`#fbbf24`) for medium gap scores only.
- All numeric data (pLDDT scores, gap scores, drug counts) must render in a monospace font — `IBM Plex Mono`.
- Headings in `Syne` (weight 700). Body text in `Inter` (weight 400).
- Borders are `1px solid #242424`. No box shadows anywhere.
- Border radius is `4px` everywhere. No pills. No circles.
- Transitions on interactive elements only, max `150ms ease`.

Load `IBM Plex Mono`, `Syne`, and `Inter` from Google Fonts in `index.html`.

---

## STACK

- **React 18** via Vite (`npm create vite@latest -- --template react`)
- **Tailwind CSS v3** with a custom theme
- **React Router v6** for routing
- No other packages. No component libraries. No icon libraries.

---

## TAILWIND CONFIGURATION

In `tailwind.config.js`, extend the default theme with custom color tokens and font families so that semantic class names work throughout the app:

**Colors to add under `theme.extend.colors`:**
- `bg.primary` → `#0a0a0a`
- `bg.secondary` → `#111111`
- `bg.tertiary` → `#1a1a1a`
- `border.DEFAULT` → `#242424`
- `border.subtle` → `#1c1c1c`
- `text.primary` → `#e8e8e8`
- `text.secondary` → `#888888`
- `text.muted` → `#555555`
- `accent.DEFAULT` → `#4ade80`
- `accent.dim` → `#1a3a24`
- `danger.DEFAULT` → `#f87171`
- `danger.dim` → `#3a1a1a`
- `warning.DEFAULT` → `#fbbf24`
- `warning.dim` → `#3a2e10`

**Fonts to add under `theme.extend.fontFamily`:**
- `mono` → `['IBM Plex Mono', 'monospace']`
- `display` → `['Syne', 'sans-serif']`
- `body` → `['Inter', 'sans-serif']`

Set `content` to scan `./src/**/*.{js,jsx}`. Set `darkMode: false` — the app is always dark.

---

## PROJECT STRUCTURE

```
frontend/
├── index.html
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── package.json
└── src/
    ├── main.jsx
    ├── App.jsx
    ├── config.js
    ├── index.css
    ├── hooks/
    │   ├── useSearch.js
    │   ├── useComplex.js
    │   └── useUndrugged.js
    ├── components/
    │   ├── layout/
    │   │   └── Navbar.jsx
    │   ├── common/
    │   │   ├── Badge.jsx
    │   │   ├── GapScoreBar.jsx
    │   │   ├── LoadingState.jsx
    │   │   └── ErrorState.jsx
    │   ├── search/
    │   │   ├── SearchBar.jsx
    │   │   └── ResultCard.jsx
    │   ├── complex/
    │   │   ├── ComplexHeader.jsx
    │   │   ├── MetricsPanel.jsx
    │   │   └── ViewerPlaceholder.jsx
    │   └── dashboard/
    │       └── TargetTable.jsx
    └── pages/
        ├── HomePage.jsx
        ├── SearchPage.jsx
        ├── ComplexDetailPage.jsx
        └── DashboardPage.jsx
```

---

## CONFIG FILE — `src/config.js`

Single source of truth for all external references. Must export:

- `API_BASE` — set to `/api`. Vite proxy will rewrite this to `http://localhost:8080`.
- `DEMO_PROTEINS` — array of 3 objects for the homepage featured section. Each object has `id` (UniProt ID), `label` (gene name to display), and `description` (one-line context string). Use these three:
  - `{ id: 'P04637', label: 'TP53', description: 'Tumor suppressor · Human · 5 known drugs' }`
  - `{ id: 'P9WIU3', label: 'FtsZ', description: 'Cell division · M. tuberculosis · 0 known drugs' }`
  - `{ id: 'Q55DI5', label: 'Q55DI5', description: 'Transcription factor · D. discoideum · Dramatic reveal' }`

---

## VITE PROXY SETUP

In `vite.config.js`, configure the dev server proxy so that requests to `/api/*` are forwarded to `http://localhost:8080/*` with the `/api` prefix stripped. This prevents CORS issues during development.

---

## API ENDPOINTS

All three hooks call these GoFr backend routes. Understand the shape before building.

---

### Endpoint 1 — Search

**Request:** `GET /api/search?q={query}`

Called from `useSearch.js` when the user submits a query. The query can be a protein name, gene name, disease, or organism.

**Response shape:**
```json
{
  "data": {
    "query": "TP53",
    "count": 3,
    "source": "live",
    "results": [ ...Complex objects... ]
  }
}
```

GoFr wraps every response in a `data` key. Always read `response.data` before accessing any field.

`source` will be `"live"` (real APIs hit), `"fallback"` (hero JSON used), or `"no_results"`.

**Fields from each Complex object that the frontend uses:**

| Field | Type | Used for |
|---|---|---|
| `uniprot_id` | string | React key, navigation to `/complex/:id` |
| `protein_name` | string | Card and page heading |
| `gene_name` | string | Accent mono label |
| `organism` | string | Italic secondary text |
| `is_who_pathogen` | boolean | WHO badge visibility |
| `dimer_plddt_avg` | float | Confidence chip and metric |
| `monomer_plddt_avg` | float | Metrics panel comparison |
| `disorder_delta` | float | Disorder chip and metric |
| `drug_count` | integer | Drug badge (-1 = unknown, 0 = undrugged) |
| `known_drug_names` | string[] | Drug tags in metrics panel |
| `gap_score` | float | GapScoreBar |
| `category` | string | Category chip |
| `alphafold_id` | string | Shown in detail page header |
| `disease_associations` | string[] | Disease tags in detail header |
| `monomer_structure_url` | string | Passed to ViewerPlaceholder |
| `complex_structure_url` | string | Passed to ViewerPlaceholder (may be empty) |

---

### Endpoint 2 — Complex Detail

**Request:** `GET /api/complex/:id`

Called from `useComplex.js` where `:id` is the `uniprot_id` (e.g. `P04637`).

**Response shape:**
```json
{
  "data": { ...single full Complex object... }
}
```

Same field shape as above. For hero complexes all fields are populated. For live-fetched complexes, `complex_structure_url` may be an empty string and `disorder_delta` may be `0`. Handle both without crashing.

---

### Endpoint 3 — Undrugged Dashboard

**Request:** `GET /api/undrugged?filter={filter}&limit={limit}`

Called from `useUndrugged.js`. Valid filter values: `all`, `who_pathogen`, `human_disease`. Default limit: `25`.

**Response shape:**
```json
{
  "data": {
    "filter": "who_pathogen",
    "count": 10,
    "results": [ ...Complex objects sorted by gap_score descending... ]
  }
}
```

---

## HOOKS

All API calls happen exclusively through these three hooks. No `fetch` in components.

---

### `useSearch.js`

**State managed:** `results` (array, default `[]`), `loading` (bool), `error` (string or null), `source` (string or null), `query` (string).

**Exposed functions:**
- `search(q)` — trims the query, sets loading true, fetches `/api/search?q=...`, unwraps `response.data`, sets `results` and `source`. On any error, sets `error` and keeps `results` as `[]`. Always sets `loading` to false in a finally block.
- `clear()` — resets all state to defaults.

---

### `useComplex.js`

**Args:** `id` (string).

**State managed:** `complex` (object or null), `loading` (bool), `error` (string or null).

Fetches `/api/complex/:id` in a `useEffect` with `[id]` as dependency. If `id` is falsy, do nothing. Resets `complex` to null on each new fetch before the response arrives. Unwraps `response.data`. Sets `error` if the response is not ok or fetch throws.

---

### `useUndrugged.js`

**Args:** `filter` (string, default `'all'`), `limit` (number, default `25`).

**State managed:** `data` (array), `loading`, `error`.

Fetches `/api/undrugged?filter=...&limit=...` in a `useEffect` with `[filter, limit]` as dependency. Unwraps `response.data.results`.

---

## COMPONENTS

---

### Navbar

Sticky top, full-width, `1px` bottom border in default border color.

Inner content max-width `1200px`, centered, height `56px`, flex row space-between.

**Left side — Brand:**
"ProtPocket" in `font-display` at 18px next to a small mono muted tag "protein complex intelligence". Both wrapped in a Link to `/`.

**Right side — Nav links:**
Two links: "Search" → `/search`, "Undrugged Targets" → `/dashboard`. Use `useLocation()` to compare `pathname`. Active link: white text + green bottom border (`2px`). Inactive: secondary text color, no border, hover to primary text.

---

### Badge

Inline chip component. Props: `variant`, `children`.

All badges share: `11px` font, uppercase, slight letter-spacing (`0.06em`), `4px` radius, small horizontal padding (`8px`), thin border.

Variant styles:
- `who` — danger text, danger-dim background, danger border
- `undrugged` — accent text, accent-dim background, accent border
- `drugged` — muted text, tertiary background, subtle border
- `unknown` — warning text, warning-dim background, warning border

---

### GapScoreBar

Props: `score` (float), `showLabel` (boolean).

A flex row: track on the left (flex-1), label on the right (mono, fixed width).

Track height: `3px`, tertiary background, `2px` radius. Fill width: `Math.min(score / 2.0, 1) * 100%`. Fill color:
- `score >= 1.5` → accent green
- `score >= 0.8` → warning yellow
- `score < 0.8` → muted

Label: score to 4 decimal places in monospace. Color matches fill color. Only rendered when `showLabel` is true.

---

### LoadingState

Centered flex column. A CSS-only circular spinner (`border-top` in accent, rest of border in subtle color, `animation: spin`), below it the `message` prop in small mono muted text. Default message: `"Loading..."`. Padding: `96px` top and bottom.

---

### ErrorState

Centered flex column. A small "ERR" label with a danger-color border, below it the `message` prop in muted text. Padding: `96px` top and bottom.

---

### SearchBar

Props: `onSearch(query)`, `loading`, `initialValue`.

A single-line input fused with a submit button. The entire unit has one outer border that turns accent-green on focus-within.

Input: flex-1, dark secondary background, no inner border, body font, `15px`. Placeholder in muted color. Disabled when `loading`.

Button: mono font, tertiary background, left border separating it from input. On hover (not disabled): accent background, dark text. Disabled when `loading` is true or input value is empty.

Below the input row: a single hint line in small mono muted color — `Try: TP53 · tuberculosis · BRCA1 · Staphylococcus aureus`.

Submit fires on button click AND on `Enter` key press in the input.

---

### ResultCard

One card per Complex object in search results. Entire card is clickable — navigates to `/complex/:uniprot_id`. Hover: border changes to accent green.

**Internal layout (flex column, `16px` gap between rows):**

**Row 1 — Top bar:**
Left: protein name in `font-display` at `18px`. Right: badge stack — WHO badge (if `is_who_pathogen`) then drug count badge.

**Row 2 — Meta line:**
Gene name in accent monospace · separator dot · organism in italic secondary text.

**Row 3 — Gap Score:**
Small "Gap Score" uppercase label above a full-width GapScoreBar with label shown.

**Row 4 — Data chips:**
Three equal-width cells in a row, divided by `1px` borders forming a small grid. Each cell has a micro uppercase label on top, value below.
- Cell 1: label "Confidence", value `{dimer_plddt_avg.toFixed(1)}%` in mono
- Cell 2: label "Disorder Delta", value `{delta > 0 ? '+' : ''}{disorder_delta.toFixed(1)}` in mono, accent color if positive
- Cell 3: label "Category", value from `category` with underscores replaced by spaces

---

### ComplexHeader

Top section of the detail page, separated from the rest by a `1px` bottom border.

**Line 1:** AlphaFold ID in small muted mono on the left. Badge row on the right.

**Line 2:** Protein name as `h1` in `font-display` at `32px`.

**Line 3:** Gene name in accent mono · dot · organism in italic · dot · UniProt ID as a small external link to `https://www.uniprot.org/uniprotkb/{uniprot_id}` (opens new tab, accent color on hover).

**Line 4 (conditional):** If `disease_associations` is a non-empty array, show a small "Disease Associations" label above a row of flat tag chips — one per disease string.

---

### MetricsPanel

A bordered panel (`bg-secondary`, `1px border`, `4px radius`), padded `24px`.

Panel heading: "Structural Metrics" in `h3` with a muted sublabel "AlphaFold pLDDT confidence scores".

**4-column metric grid** (divided by `1px` borders):

- **Cell 1 — Monomer Confidence:** `monomer_plddt_avg.toFixed(1)` + `%` unit. Sublabel: "Single chain". Default dark background.
- **Cell 2 — Dimer Confidence:** `dimer_plddt_avg.toFixed(1)` + `%` unit. Sublabel: "Complex form". Tertiary background, value in accent green. This is the "after" number — it should look better than Cell 1.
- **Cell 3 — Disorder Delta:** Value with `+` prefix if positive. Sublabel: "Structural gain" if positive, "No gain" if zero or negative. Accent color if positive.
- **Cell 4 — Gap Score:** `gap_score.toFixed(4)`. No unit. Background tinted by score level (accent-dim if ≥1.5, warning-dim if ≥0.8, plain if lower). Sublabel: "Drug priority index".

**Below the grid (conditional):** If `known_drug_names` is non-empty, a "Known Drugs" label above a flex-wrap row of small mono tag chips — one per drug name.

---

### ViewerPlaceholder

**Phase 3 placeholder only. No Mol* here.**

A two-panel layout divided by a `1px` vertical border. Left panel: Monomer. Right panel: Homodimer. Each panel is `360px` tall.

**Panel header bar** (with bottom border): Panel label on the left ("Monomer (single chain)" / "Homodimer (complex)") as small uppercase label. pLDDT confidence value on the right in small mono accent text (e.g. `62.4% confidence`).

**Panel body** (centered content): Three items stacked with small gap:
1. Small uppercase muted label: `3D VIEWER — PHASE 4`
2. CIF filename only (last segment of the URL) in small mono muted text. If URL is empty, show `No structure available`.
3. If the URL is non-empty, a small "Download .cif" link that opens the URL in a new tab. Style: accent color, thin accent border, `4px` radius, hover shows accent-dim background.

**Panel footer** (with top border, secondary background): one-line italic description. Left panel: "Disordered regions visible in isolation." Right panel: "Functional domain revealed in complex form."

---

### TargetTable

Full-width component. A toolbar above the table, a scrollable table below.

**Toolbar (secondary background, `1px` bottom border):**
Left: filter button group. Right: target count in muted mono.

Filter buttons: "All Targets" (`filter=all`), "WHO Pathogens" (`filter=who_pathogen`), "Human Disease" (`filter=human_disease`). Active button: accent border and text, accent-dim background. Inactive: default border, secondary text, hover to primary text.

**Table columns:**

| Column | Content |
|---|---|
| `#` | Row rank 1-indexed, muted mono |
| `Protein` | Protein name (13px) with gene name below in small accent mono |
| `Organism` | Italic secondary text, truncated if long |
| `Confidence` | `dimer_plddt_avg.toFixed(1)%` in mono |
| `Drugs` | Drug count in mono, `?` if -1 |
| `Delta` | Disorder delta in mono, green + `+` prefix if positive |
| `Gap Score` | Compact GapScoreBar with label |
| `Flags` | WHO badge and/or Undrugged badge as applicable |

**Table behavior:** Header row in tertiary background. Data rows: hover changes background, cursor pointer. Clicking any row navigates to `/complex/:uniprot_id`. Subtle bottom border between rows, none on last row.

---

## PAGES

---

### HomePage

Three vertically stacked sections, each separated by a `1px` bottom border except the last.

**Section 1 — Hero:**
Max-width `720px` centered. Padding `96px` vertical. Stacked content:
1. Small accent uppercase label: `AlphaFold Complex Database · March 2026`
2. `h1`: "Find undrugged protein complexes. Fast." at `48px` in `font-display`
3. Subtitle paragraph (secondary text): 2 sentences explaining what ProtPocket does — surface the highest-priority undrugged targets from the new AlphaFold complex dataset using gap scoring
4. SearchBar component — on submit, navigate to `/search?q={query}`

**Section 2 — Stats Strip:**
Max-width `1200px` centered. Horizontal flex row of 4 stats with `1px` vertical dividers between them. Each stat: large mono number above a small uppercase label.
- `1.7M` / Complex Predictions
- `20` / Studied Species
- `19` / WHO Priority Pathogens
- `17M` / GPU Hours Saved

**Section 3 — Featured Complexes:**
Max-width `1200px` centered. Padding `64px` vertical. Section heading "Featured Complexes" in `h2` with a muted "Demo targets" sublabel. Below: 3-column grid of cards, one per `DEMO_PROTEINS` entry from config. Each card: gene label in large accent mono, description in small secondary text. Border, hover accent border, cursor pointer. Clicking navigates to `/complex/:id`.

---

### SearchPage

On mount and whenever the `?q=` URL param changes, fire `search(q)` from `useSearch`. Use `useSearchParams` to read and write the param. When a new search is submitted, update the URL with `setSearchParams({ q: newQuery })`.

**Layout:**
- SearchBar at top (pre-filled with current `?q=` value, fires `setSearchParams` on submit)
- If loading: LoadingState with message "Querying AlphaFold + ChEMBL..."
- If error: ErrorState with the error message
- If results: a header line showing `"{count} results for "{query}"` and `source: {source}` in muted mono, then a flex column of ResultCards with `12px` gap
- If no results after a search: centered empty state with the query and suggestions
- If no search yet (page opened clean): only the search bar, nothing below

---

### ComplexDetailPage

Read `:id` from URL with `useParams`. Pass to `useComplex(id)`.

**Layout — single column, max-width `1100px` centered, `48px` padding:**
1. "Back" button at top (calls `navigate(-1)`): mono font, tertiary background, subtle border
2. ComplexHeader
3. ViewerPlaceholder (passes `monomer_structure_url`, `complex_structure_url`, both pLDDT averages)
4. MetricsPanel
5. Research Brief placeholder — dashed-border box, centered content: heading "Research Brief" + small muted text explaining it appears in Phase 5

Show LoadingState while `loading`. Show ErrorState if `error`. Render sections only when `complex` is non-null.

---

### DashboardPage

Local state: `filter` with `useState('all')`. Pass `filter` and limit `25` to `useUndrugged`. Hook auto re-fetches when filter changes.

**Layout — max-width `1200px` centered, `48px` padding:**
1. Page header: `h1` "Undrugged Target Leaderboard" + paragraph description (what gap score is, how list is ordered)
2. LoadingState while loading
3. ErrorState on error
4. TargetTable with `data`, `filter`, and `onFilterChange` props when data is ready

---

## VERIFICATION CHECKLIST

Every item must pass before calling Phase 3 complete.

**Functional:**
- [ ] `npm run dev` starts at `localhost:3000` with zero console errors
- [ ] Homepage loads with hero, stats strip, and 3 featured cards
- [ ] Clicking a featured card navigates to the correct detail page
- [ ] Submitting the homepage search bar navigates to `/search?q=...`
- [ ] Search page auto-fires from the URL param on load
- [ ] Result cards render with all fields populated
- [ ] Clicking a result card navigates to the detail page
- [ ] Detail page renders ComplexHeader, ViewerPlaceholder, MetricsPanel
- [ ] `complex_structure_url` being empty does not crash ViewerPlaceholder
- [ ] Dashboard page loads with all 30 hero complexes
- [ ] Filter buttons change the table contents
- [ ] Clicking a table row navigates to the correct detail page
- [ ] Back button returns to previous page
- [ ] Unknown query shows empty state, not an error

**Visual:**
- [ ] Background is `#0a0a0a` everywhere — no white or grey backgrounds
- [ ] No gradients in any element
- [ ] No emojis anywhere
- [ ] Numbers render in IBM Plex Mono
- [ ] Headings render in Syne
- [ ] Only green, red, yellow accents — no other hues
- [ ] Active nav link has green bottom border
- [ ] WHO badge is red
- [ ] Undrugged badge is green
- [ ] Gap score bar fill color reflects score level
- [ ] Positive disorder delta is green with `+` prefix

---

*Phase 3 — Frontend Shell*
*ProtPocket · HackMol 7.0*
*Hand this document directly to the coding agent. Do not proceed to Phase 4 until all checklist items pass.*
ENDOFFILE
