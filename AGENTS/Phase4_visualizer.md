# ProtPocket — Phase 4 Protein Visualizer Implementation Plan
### Mol* Viewer + pLDDT Coloring + Reveal Animation
### For Coding Agent — Read completely before writing a single line

---

## OVERVIEW

Phase 4 replaces the `ViewerPlaceholder.jsx` with a fully interactive Mol* 3D protein viewer. By the end of this phase, the Complex Detail Page will:

1. Render two side-by-side Mol* viewers — monomer (single chain) and homodimer (complex)
2. Load `.cif` structure files from AlphaFold URLs passed as props
3. Apply pLDDT confidence color theme (blue = confident, red = disordered)
4. Provide a "Reveal" button that uses Framer Motion to animate a transition from monomer-only view to the full side-by-side view
5. Display a "Disorder Delta" visual metric bar between the two panels showing the structural gain

The viewers must integrate seamlessly with the existing dark terminal aesthetic. No decoration for decoration's sake.

---

## GROUND RULES

1. **Do NOT modify any existing component outside the scope described here.** Only `ComplexDetailPage.jsx` changes its imports. All other work is new files.
2. **The `molstar` package is heavy.** Lazy-load the viewer components with `React.lazy` + `Suspense`.
3. **Never render Mol* UI chrome.** Use `PluginContext` directly without the default Mol* toolbar/sidebar.
4. **All color tokens must come from the existing Tailwind theme.** No new colors. The Mol* canvas background must match `#0a0a0a`.
5. **Framer Motion is a new dependency.** Install `framer-motion` — it is the only new dependency besides `molstar`.
6. **Do not add TypeScript.** The project is pure JSX.

---

## NEW DEPENDENCIES

Install exactly these two packages:

```bash
cd frontend/
npm install molstar framer-motion
```

**Versions to pin (if any issues arise):**
- `molstar` → `^4.x` (latest v4 stable)
- `framer-motion` → `^11.x` (latest v11 stable)

**Vite configuration note:** Mol* uses Web Workers. Add this to `vite.config.js` if worker loading fails:

```js
// In vite.config.js — add to the defineConfig object:
optimizeDeps: {
  include: ['molstar'],
},
worker: {
  format: 'es',
},
```

---

## UPDATED PROJECT STRUCTURE

```
frontend/src/
├── components/
│   ├── complex/
│   │   ├── ComplexHeader.jsx        ← NO CHANGES
│   │   ├── MetricsPanel.jsx         ← NO CHANGES
│   │   ├── ViewerPlaceholder.jsx    ← DELETED (replaced by ProteinViewer)
│   │   └── viewer/                  ← NEW DIRECTORY
│   │       ├── ProteinViewer.jsx    ← NEW — Main orchestrator component
│   │       ├── MolstarPanel.jsx     ← NEW — Single Mol* canvas wrapper
│   │       ├── ViewerHeader.jsx     ← NEW — Panel header bar
│   │       ├── ViewerFooter.jsx     ← NEW — Panel footer bar
│   │       ├── DisorderDeltaBar.jsx ← NEW — Vertical metric bar between panels
│   │       ├── RevealButton.jsx     ← NEW — Animated reveal trigger
│   │       └── useMolstar.js        ← NEW — Hook encapsulating Mol* lifecycle
│   └── ...
└── pages/
    └── ComplexDetailPage.jsx        ← MODIFIED — Import ProteinViewer instead of ViewerPlaceholder
```

---

## TAILWIND ADDITIONS

Add these to `tailwind.config.js` under `theme.extend`:

```js
// Under theme.extend.colors — add pLDDT color scale for the legend:
plddt: {
  veryHigh: '#0053D6',  // pLDDT > 90 (very high confidence — blue)
  high: '#65CBF3',      // 70 < pLDDT ≤ 90 (confident — light blue)
  low: '#FFDB13',       // 50 < pLDDT ≤ 70 (low confidence — yellow)
  veryLow: '#FF7D45',   // pLDDT ≤ 50 (very low — orange-red)
},
```

These are the standard AlphaFold pLDDT colors used across the literature. They are used only in the legend bar — the actual 3D coloring is handled inside Mol*.

---

## COMPONENT SPECIFICATIONS

---

### `useMolstar.js` — Mol* Lifecycle Hook

**Purpose:** Encapsulate all Mol* initialization, structure loading, and cleanup in a single reusable hook. No Mol* code should exist outside this hook.

**File:** `frontend/src/components/complex/viewer/useMolstar.js`

**Interface:**
```js
const { containerRef, isLoading, error, resetCamera } = useMolstar({
  structureUrl,   // string — URL to the .cif file
  label,          // string — label for the structure (e.g. "Monomer")
  autoLoad,       // boolean — whether to load immediately (default true)
});
```

**Returns:**
- `containerRef` — React ref to attach to the container `<div>`. The hook creates the Mol* `PluginContext` inside this div.
- `isLoading` — boolean, true while the .cif is being fetched and parsed
- `error` — string or null, set if loading fails
- `resetCamera` — function, resets the camera to the default zoom/position

**Implementation details:**

```js
import { useRef, useEffect, useState, useCallback } from 'react';
import { PluginContext } from 'molstar/lib/mol-plugin/context';
import { DefaultPluginSpec } from 'molstar/lib/mol-plugin/spec';
import { PluginConfig } from 'molstar/lib/mol-plugin/config';
import { ColorTheme } from 'molstar/lib/mol-theme/color';

export function useMolstar({ structureUrl, label = '', autoLoad = true }) {
  const containerRef = useRef(null);
  const pluginRef = useRef(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Initialize plugin
  useEffect(() => {
    if (!containerRef.current) return;

    const init = async () => {
      // Create a minimal spec — no default UI panels
      const spec = DefaultPluginSpec();

      // Override layout to hide all UI chrome
      spec.layout = {
        initial: {
          showControls: false,
          isExpanded: false,
        },
      };

      // Create the canvas element inside our container
      const canvas = document.createElement('canvas');
      containerRef.current.innerHTML = '';
      containerRef.current.appendChild(canvas);

      const plugin = new PluginContext(spec);
      await plugin.init();

      // Mount to our canvas container
      // NOTE: Mol* v4 uses plugin.initViewer with a canvas parent.
      // If PluginContext doesn't expose initViewer directly, use:
      //   plugin.canvas3d!.setProps({ ... })
      // after init.

      // Alternative initialization approach for headless canvas:
      const canvasEl = document.createElement('canvas');
      canvasEl.style.width = '100%';
      canvasEl.style.height = '100%';
      containerRef.current.innerHTML = '';
      containerRef.current.appendChild(canvasEl);

      // --- CRITICAL: Use createPlugin or PluginContext.create ---
      // The exact API depends on molstar version. The agent must check
      // the installed version's exports. Two known patterns:
      //
      // Pattern A (v3.x / early v4):
      //   import { createPlugin } from 'molstar/lib/mol-plugin-ui';
      //   const plugin = await createPlugin(containerRef.current, spec);
      //
      // Pattern B (v4.x headless):
      //   const plugin = new PluginContext(spec);
      //   await plugin.init();
      //   plugin.initViewer(canvas, container);
      //
      // USE THE ONE THAT WORKS. If createPlugin is available, prefer it.
      // Log errors and try both approaches.

      // Set dark background to match site theme
      if (plugin.canvas3d) {
        plugin.canvas3d.setProps({
          renderer: {
            backgroundColor: 0x0a0a0a,  // matches bg-primary
          },
        });
      }

      pluginRef.current = plugin;

      // Auto-load structure if URL provided
      if (autoLoad && structureUrl) {
        await loadStructure(plugin, structureUrl, label);
      }
    };

    init().catch((err) => {
      console.error('[useMolstar] init failed:', err);
      setError(err.message);
    });

    return () => {
      // Cleanup on unmount
      if (pluginRef.current) {
        pluginRef.current.dispose();
        pluginRef.current = null;
      }
    };
  }, []); // Only init once

  // Reload structure when URL changes
  useEffect(() => {
    if (!pluginRef.current || !structureUrl || !autoLoad) return;

    loadStructure(pluginRef.current, structureUrl, label);
  }, [structureUrl]);

  // Load a .cif file and apply pLDDT coloring
  const loadStructure = async (plugin, url, structureLabel) => {
    setIsLoading(true);
    setError(null);

    try {
      // Clear existing structures
      await plugin.clear();

      // Load the CIF from URL
      const data = await plugin.builders.data.download(
        { url, isBinary: false },
        { state: { isGhost: true } }
      );

      const trajectory = await plugin.builders.structure.parseTrajectory(data, 'mmcif');
      
      await plugin.builders.structure.hierarchy.applyPreset(
        trajectory,
        'default',
        {
          structure: {
            name: 'model',
            params: {},
          },
          showUnitcell: false,
          representationPreset: 'auto',
        }
      );

      // Apply pLDDT confidence coloring
      // pLDDT is stored as B-factor in AlphaFold structures
      // Mol* has a built-in 'uncertainty' color theme that maps B-factor → pLDDT colors
      //
      // The correct theme name in Mol* is 'uncertainty'
      // It uses the standard AlphaFold color scheme:
      //   > 90  → Blue   (#0053D6) — Very high confidence
      //   > 70  → Cyan   (#65CBF3) — Confident
      //   > 50  → Yellow (#FFDB13) — Low confidence
      //   ≤ 50  → Orange (#FF7D45) — Very low confidence
      //
      // Apply via:
      const structures = plugin.managers.structure.hierarchy.current.structures;
      for (const s of structures) {
        for (const c of s.components) {
          for (const r of c.representations) {
            await plugin.managers.structure.component.updateRepresentationsTheme(
              [r],
              {
                color: 'uncertainty',
                // The 'uncertainty' theme in Mol* reads the B-factor column
                // and applies the AlphaFold pLDDT color scale automatically
              }
            );
          }
        }
      }

      // Reset camera to frame the structure
      plugin.managers.camera.reset();

    } catch (err) {
      console.error(`[useMolstar] Load failed for ${url}:`, err);
      setError(`Failed to load structure: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const resetCamera = useCallback(() => {
    if (pluginRef.current?.managers?.camera) {
      pluginRef.current.managers.camera.reset();
    }
  }, []);

  return { containerRef, isLoading, error, resetCamera };
}
```

**Critical pLDDT coloring notes:**

The Mol* `'uncertainty'` color theme is specifically designed for AlphaFold structures. It reads the B-factor column from the structure file (where AlphaFold stores per-residue pLDDT scores) and maps them to the standard 4-color scale.

If the `'uncertainty'` theme name does not exist in the installed Mol* version, the agent must check:
1. `plugin.representation.structure.themes.colorThemeRegistry.list()` — to list all available themes
2. Try `'plddt-confidence'` or `'b-factor'` as alternative theme names
3. If none work, implement a custom color theme using `ColorTheme.Provider`:

```js
// Fallback: Custom pLDDT color theme
import { Color } from 'molstar/lib/mol-util/color';

function plddtColor(bFactor) {
  if (bFactor > 90) return Color(0x0053D6);  // Very high — blue
  if (bFactor > 70) return Color(0x65CBF3);  // Confident — light blue
  if (bFactor > 50) return Color(0xFFDB13);  // Low — yellow
  return Color(0xFF7D45);                     // Very low — orange
}
```

---

### `MolstarPanel.jsx` — Single Viewer Canvas

**Purpose:** Wraps the `useMolstar` hook into a renderable panel with loading/error states.

**File:** `frontend/src/components/complex/viewer/MolstarPanel.jsx`

**Props:**
| Prop | Type | Description |
|---|---|---|
| `structureUrl` | string | AlphaFold .cif URL |
| `label` | string | "Monomer" or "Homodimer" |
| `plddt` | number | Average pLDDT for the header |
| `description` | string | Footer description text |
| `visible` | boolean | Whether the panel is rendered (for reveal animation) |

**Implementation:**

```jsx
import React from 'react';
import { useMolstar } from './useMolstar';
import { ViewerHeader } from './ViewerHeader';
import { ViewerFooter } from './ViewerFooter';

export function MolstarPanel({ structureUrl, label, plddt, description, visible = true }) {
  const { containerRef, isLoading, error } = useMolstar({
    structureUrl,
    label,
    autoLoad: visible && !!structureUrl,
  });

  if (!visible) return null;

  return (
    <div className="flex-1 flex flex-col h-[400px] min-w-0">
      <ViewerHeader label={label} plddt={plddt} />

      <div className="flex-1 relative bg-bg-primary overflow-hidden">
        {/* Mol* canvas container */}
        <div
          ref={containerRef}
          className="absolute inset-0"
          style={{ width: '100%', height: '100%' }}
        />

        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-bg-primary/80 z-10">
            <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            <span className="mt-2 font-mono text-[10px] uppercase text-text-muted tracking-[0.1em]">
              Loading structure...
            </span>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-bg-primary z-10 gap-2">
            <span className="font-mono text-[10px] uppercase text-danger tracking-[0.1em] border border-danger px-2 py-0.5 rounded">
              ERR
            </span>
            <span className="font-mono text-xs text-text-muted text-center px-4">
              {error}
            </span>
          </div>
        )}

        {/* No URL state */}
        {!structureUrl && !isLoading && !error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-bg-primary z-10 gap-2">
            <span className="font-mono text-[10px] uppercase text-text-muted tracking-[0.1em]">
              No structure available
            </span>
          </div>
        )}
      </div>

      <ViewerFooter description={description} url={structureUrl} />
    </div>
  );
}
```

**Styling rules:**
- Canvas height: `400px` (up from 360px in placeholder, more room for 3D)
- Canvas background: `bg-bg-primary` (`#0a0a0a`) — must match Mol* renderer background
- Loading spinner: reuse the exact same spinner pattern from `LoadingState.jsx`
- Error state: reuse the exact pattern from `ErrorState.jsx` but inline

---

### `ViewerHeader.jsx` — Panel Header Bar

**File:** `frontend/src/components/complex/viewer/ViewerHeader.jsx`

**Props:** `label` (string), `plddt` (number)

**Renders:** Identical to the placeholder header — label on left, confidence on right. No changes needed from Phase 3 design.

```jsx
import React from 'react';

export function ViewerHeader({ label, plddt }) {
  return (
    <div className="flex flex-row justify-between items-center px-4 py-3 border-b border-border bg-bg-secondary">
      <span className="font-mono text-[11px] uppercase tracking-wider text-text-muted">
        {label}
      </span>
      <span className="font-mono text-xs text-accent">
        {(plddt || 0).toFixed(1)}% confidence
      </span>
    </div>
  );
}
```

---

### `ViewerFooter.jsx` — Panel Footer Bar

**File:** `frontend/src/components/complex/viewer/ViewerFooter.jsx`

**Props:** `description` (string), `url` (string|null)

**Renders:** Description text on left, download link on right.

```jsx
import React from 'react';

export function ViewerFooter({ description, url }) {
  const filename = url ? url.split('/').pop() : null;

  return (
    <div className="flex flex-row justify-between items-center px-4 py-3 border-t border-border bg-bg-secondary">
      <span className="italic text-[13px] text-text-secondary">{description}</span>
      {url && filename && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-[10px] text-text-muted hover:text-accent transition-colors duration-150"
        >
          {filename}
        </a>
      )}
    </div>
  );
}
```

---

### `DisorderDeltaBar.jsx` — Vertical Metric Between Panels

**Purpose:** A thin vertical visual element between the monomer and dimer panels. It displays the pLDDT delta value and a filled vertical bar showing how much structural confidence was gained.

**File:** `frontend/src/components/complex/viewer/DisorderDeltaBar.jsx`

**Props:**
| Prop | Type | Description |
|---|---|---|
| `monomerPlddt` | number | Monomer pLDDT average |
| `dimerPlddt` | number | Dimer pLDDT average |
| `visible` | boolean | Show only when both panels are visible |

**Visual design:**

```
┌──────────────────────────────────────────────┐
│  [Monomer Panel]  │ ▲ │  [Dimer Panel]       │
│                   │ █ │                       │
│                   │ █ │                       │
│                   │ █ │                       │
│                   │ ▼ │                       │
│                   │+18│                       │
│                   │.2 │                       │
└──────────────────────────────────────────────┘
```

- Width: `48px` (fixed)
- Background: `bg-bg-secondary`
- Borders: `1px` left and right in default border color
- Bar track: `3px` wide, `80%` height, centered, `bg-bg-tertiary`
- Bar fill: grows from bottom to top, height = `Math.min(Math.abs(delta) / 40, 1) * 100%`
- Fill color: green (`accent`) if delta positive, red (`danger`) if negative, muted if zero
- Value label: below the bar, mono font, `12px`, shows `+18.2` (with sign prefix)
- Sublabel: "STRUCTURALLY GAINED" in `9px` uppercase mono muted, below value

**Implementation:**

```jsx
import React from 'react';

export function DisorderDeltaBar({ monomerPlddt, dimerPlddt, visible }) {
  if (!visible) return null;

  const delta = (dimerPlddt || 0) - (monomerPlddt || 0);
  const isPositive = delta > 0;
  const fillPercent = Math.min(Math.abs(delta) / 40, 1) * 100;

  let fillColor = 'bg-text-muted';
  let textColor = 'text-text-muted';
  if (isPositive) {
    fillColor = 'bg-accent';
    textColor = 'text-accent';
  } else if (delta < 0) {
    fillColor = 'bg-danger';
    textColor = 'text-danger';
  }

  return (
    <div className="w-12 flex-none flex flex-col items-center justify-center bg-bg-secondary border-x border-border gap-3 py-6">
      {/* Vertical bar track */}
      <div className="relative w-[3px] flex-1 bg-bg-tertiary rounded-full overflow-hidden">
        <div
          className={`absolute bottom-0 left-0 right-0 ${fillColor} rounded-full transition-all duration-500`}
          style={{ height: `${fillPercent}%` }}
        />
      </div>

      {/* Delta value */}
      <div className="flex flex-col items-center gap-0.5">
        <span className={`font-mono text-xs font-bold ${textColor}`}>
          {isPositive ? '+' : ''}{delta.toFixed(1)}
        </span>
        <span className="font-mono text-[8px] uppercase tracking-wider text-text-muted text-center leading-tight">
          Delta
        </span>
      </div>
    </div>
  );
}
```

---

### `RevealButton.jsx` — Animated Reveal Trigger

**Purpose:** A button that triggers the monomer → dimer reveal animation. Initially, only the monomer panel is shown at full width. Clicking "Reveal Complex" animates the monomer panel to half-width while the dimer panel slides in from the right with the delta bar appearing between them.

**File:** `frontend/src/components/complex/viewer/RevealButton.jsx`

**Props:**
| Prop | Type | Description |
|---|---|---|
| `isRevealed` | boolean | Current state |
| `onReveal` | function | Toggle callback |
| `disabled` | boolean | Disabled if no complex URL |

**Implementation:**

```jsx
import React from 'react';
import { motion } from 'framer-motion';

export function RevealButton({ isRevealed, onReveal, disabled }) {
  return (
    <motion.button
      onClick={onReveal}
      disabled={disabled}
      whileHover={!disabled ? { scale: 1.02 } : {}}
      whileTap={!disabled ? { scale: 0.98 } : {}}
      className={`
        font-mono text-[11px] uppercase tracking-wider px-5 py-2.5 rounded
        border transition-colors duration-150
        ${disabled
          ? 'border-border-subtle text-text-muted cursor-not-allowed bg-bg-tertiary'
          : isRevealed
            ? 'border-border text-text-secondary bg-bg-tertiary hover:text-text-primary hover:border-border'
            : 'border-accent text-accent bg-accent-dim hover:bg-accent hover:text-bg-primary'
        }
      `}
    >
      {isRevealed ? '← Monomer Only' : 'Reveal Complex →'}
    </motion.button>
  );
}
```

**Button behavior:**
- Before reveal: "Reveal Complex →" — accent border, accent text, accent-dim background glow
- After reveal: "← Monomer Only" — default border, secondary text, flat tertiary background
- Disabled: when `complexUrl` is empty/null — muted text, no interaction

---

### `ProteinViewer.jsx` — Main Orchestrator Component

**Purpose:** The top-level component that replaces `ViewerPlaceholder`. Manages the reveal state, orchestrates the Framer Motion layout animations, and composes all viewer sub-components.

**File:** `frontend/src/components/complex/viewer/ProteinViewer.jsx`

**Props (same interface as ViewerPlaceholder for drop-in replacement):**
| Prop | Type | Description |
|---|---|---|
| `monomerUrl` | string | AlphaFold monomer .cif URL |
| `complexUrl` | string | AlphaFold dimer .cif URL |
| `monomerPlddt` | number | Average pLDDT for monomer |
| `dimerPlddt` | number | Average pLDDT for dimer |

**Implementation:**

```jsx
import React, { useState, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MolstarPanel } from './MolstarPanel';
import { DisorderDeltaBar } from './DisorderDeltaBar';
import { RevealButton } from './RevealButton';

// pLDDT Color Legend component (inline — simple enough)
function PlddtLegend() {
  const levels = [
    { color: '#0053D6', label: 'Very high (>90)' },
    { color: '#65CBF3', label: 'Confident (70-90)' },
    { color: '#FFDB13', label: 'Low (50-70)' },
    { color: '#FF7D45', label: 'Very low (<50)' },
  ];

  return (
    <div className="flex flex-row items-center gap-4">
      <span className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
        pLDDT
      </span>
      {levels.map((l) => (
        <div key={l.label} className="flex flex-row items-center gap-1.5">
          <div
            className="w-2.5 h-2.5 rounded-sm"
            style={{ backgroundColor: l.color }}
          />
          <span className="font-mono text-[10px] text-text-muted">{l.label}</span>
        </div>
      ))}
    </div>
  );
}

export function ProteinViewer({ monomerUrl, complexUrl, monomerPlddt, dimerPlddt }) {
  const [isRevealed, setIsRevealed] = useState(false);
  const hasComplex = !!complexUrl;

  return (
    <div className="flex flex-col gap-4">
      {/* Controls bar */}
      <div className="flex flex-row justify-between items-center">
        <PlddtLegend />
        <RevealButton
          isRevealed={isRevealed}
          onReveal={() => setIsRevealed((prev) => !prev)}
          disabled={!hasComplex}
        />
      </div>

      {/* Viewer panels */}
      <motion.div
        layout
        className="flex flex-row w-full border border-border rounded overflow-hidden"
        transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
      >
        {/* Monomer panel — always visible, shrinks from full to half */}
        <motion.div
          layout
          className="flex"
          style={{ flex: isRevealed ? '1 1 0%' : '1 1 100%' }}
          transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
        >
          <MolstarPanel
            structureUrl={monomerUrl}
            label="Monomer (single chain)"
            plddt={monomerPlddt}
            description="Disordered regions visible in isolation."
            visible={true}
          />
        </motion.div>

        {/* Disorder delta bar — appears between panels */}
        <AnimatePresence>
          {isRevealed && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 48, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
              className="overflow-hidden"
            >
              <DisorderDeltaBar
                monomerPlddt={monomerPlddt}
                dimerPlddt={dimerPlddt}
                visible={true}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Dimer panel — slides in from right */}
        <AnimatePresence>
          {isRevealed && (
            <motion.div
              layout
              className="flex flex-1"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 'auto', opacity: 1, flex: '1 1 0%' }}
              exit={{ width: 0, opacity: 0, flex: '0 0 0%' }}
              transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
            >
              <MolstarPanel
                structureUrl={complexUrl}
                label="Homodimer (complex)"
                plddt={dimerPlddt}
                description="Functional domain revealed in complex form."
                visible={true}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
```

**Animation choreography:**

1. **Initial state:** Monomer panel fills 100% width. No delta bar. No dimer panel. "Reveal Complex →" button glows in accent green.
2. **On click:** Monomer shrinks to ~50% width (animated, 500ms, ease-out). Delta bar fades in from 0 → 48px width (400ms). Dimer panel slides in from right 0 → 50% width (500ms). Button text changes to "← Monomer Only".
3. **On un-reveal:** Reverse — dimer slides out, delta bar collapses, monomer expands back to 100%.

**Easing:** `[0.4, 0, 0.2, 1]` — this is Material Design's standard easing. It matches the `150ms ease` transitions used elsewhere in the app for interactive elements, but runs longer (500ms) because this is a significant layout change.

---

## INTEGRATION INTO `ComplexDetailPage.jsx`

**Changes required:**

```diff
-import { ViewerPlaceholder } from '../components/complex/ViewerPlaceholder';
+import { ProteinViewer } from '../components/complex/viewer/ProteinViewer';
```

And in the JSX:

```diff
-            <ViewerPlaceholder 
-              monomerUrl={complex.monomer_structure_url}
-              complexUrl={complex.complex_structure_url}
-              monomerPlddt={complex.monomer_plddt_avg}
-              dimerPlddt={complex.dimer_plddt_avg}
-            />
+            <ProteinViewer 
+              monomerUrl={complex.monomer_structure_url}
+              complexUrl={complex.complex_structure_url}
+              monomerPlddt={complex.monomer_plddt_avg}
+              dimerPlddt={complex.dimer_plddt_avg}
+            />
```

**No other changes to ComplexDetailPage.** The prop interface is identical.

---

## CSS ADDITIONS

Add to `frontend/src/index.css`:

```css
/* Mol* canvas overrides — force dark background, remove default borders */
.msp-plugin {
  background: #0a0a0a !important;
  border: none !important;
}

.msp-plugin canvas {
  background: #0a0a0a !important;
}

/* Hide any Mol* UI chrome that leaks through */
.msp-layout-static,
.msp-plugin .msp-btn,
.msp-plugin .msp-control-row {
  display: none !important;
}
```

These overrides ensure Mol* doesn't introduce its own light-themed UI elements.

---

## MOL* INITIALIZATION — FALLBACK STRATEGY

Mol* has a complex API surface that changes between versions. The agent must handle this gracefully:

**Strategy: Try three initialization patterns in order.**

1. **Try `createPluginUI`** (if `molstar/lib/mol-plugin-ui` exports it):
   ```js
   import { createPluginUI } from 'molstar/lib/mol-plugin-ui';
   const plugin = await createPluginUI(container, { ...spec });
   ```

2. **Try `PluginContext` + `initViewer`** (headless canvas):
   ```js
   import { PluginContext } from 'molstar/lib/mol-plugin/context';
   const plugin = new PluginContext(spec);
   await plugin.init();
   plugin.initViewer(canvas, container);
   ```

3. **Try `Viewer` class** (high-level wrapper):
   ```js
   import { Viewer } from 'molstar/lib/apps/viewer/app';
   const viewer = await Viewer.create(container, { ...options });
   ```

The `useMolstar` hook should try pattern 1 first, catch errors, then try pattern 2, then pattern 3. The agent should log which pattern succeeded to the console.

**For loading CIF files, the agent should try:**

1. **`plugin.loadStructureFromUrl(url, format, isBinary)`** (if available as convenience method)
2. **Builder pattern** (as shown in the hook code above):
   ```js
   const data = await plugin.builders.data.download({ url });
   const trajectory = await plugin.builders.structure.parseTrajectory(data, 'mmcif');
   await plugin.builders.structure.hierarchy.applyPreset(trajectory, 'default');
   ```
3. **State transaction pattern** (low-level):
   ```js
   const data = await plugin.state.data.build()
     .toRoot()
     .apply(StateTransforms.Data.Download, { url })
     .apply(StateTransforms.Data.ParseCif)
     .commit();
   ```

---

## MOL* CSS IMPORT

Mol* requires its own CSS for the canvas to render correctly. Import it at the top of `useMolstar.js`:

```js
import 'molstar/lib/mol-plugin-ui/skin/light.scss';
// OR if using a pre-built CSS:
// import 'molstar/lib/mol-plugin-ui/skin/dark.scss';
```

**If SCSS imports fail** (Vite may not have a SCSS loader), the agent must either:
1. Install `sass` as a dev dependency: `npm install -D sass`
2. Or find the pre-compiled CSS file in the molstar package: `molstar/build/viewer/molstar.css`

Import the pre-compiled CSS in `main.jsx` or `index.css`:
```js
// In main.jsx:
import 'molstar/build/viewer/molstar.css';
```

---

## COMPLETE FILE OUTPUT MAP

| File | Action | Purpose |
|---|---|---|
| `frontend/src/components/complex/viewer/useMolstar.js` | NEW | Mol* lifecycle hook |
| `frontend/src/components/complex/viewer/MolstarPanel.jsx` | NEW | Single viewer canvas wrapper |
| `frontend/src/components/complex/viewer/ViewerHeader.jsx` | NEW | Panel header bar |
| `frontend/src/components/complex/viewer/ViewerFooter.jsx` | NEW | Panel footer bar |
| `frontend/src/components/complex/viewer/DisorderDeltaBar.jsx` | NEW | Vertical metric bar between panels |
| `frontend/src/components/complex/viewer/RevealButton.jsx` | NEW | Animated reveal trigger button |
| `frontend/src/components/complex/viewer/ProteinViewer.jsx` | NEW | Main orchestrator component |
| `frontend/src/pages/ComplexDetailPage.jsx` | MODIFY | Import ProteinViewer instead of ViewerPlaceholder |
| `frontend/src/index.css` | MODIFY | Add Mol* canvas overrides |
| `frontend/tailwind.config.js` | MODIFY | Add pLDDT color tokens |
| `frontend/vite.config.js` | MODIFY | Add Mol* optimizeDeps |
| `frontend/src/components/complex/ViewerPlaceholder.jsx` | DELETE | Replaced by ProteinViewer |

---

## VERIFICATION CHECKLIST

Every item must pass before calling Phase 4 complete.

**Setup:**
- [ ] `npm install` completes without errors
- [ ] `npm run dev` starts without build errors
- [ ] No console errors related to Mol* imports or missing modules

**Mol* Viewer:**
- [ ] Monomer structure loads from AlphaFold `.cif` URL on page load
- [ ] 3D canvas renders inside the dark panel — background matches `#0a0a0a`
- [ ] Structure is visible as a 3D cartoon/ribbon representation
- [ ] Mouse drag rotates the structure
- [ ] Mouse wheel zooms in/out
- [ ] No Mol* toolbar, sidebar, or UI chrome visible — only the 3D canvas
- [ ] Structure loads within 5 seconds on a broadband connection

**pLDDT Coloring:**
- [ ] Structure residues are colored by pLDDT (blue = confident, orange/red = disordered)
- [ ] Colors match the standard AlphaFold 4-color scale
- [ ] pLDDT legend bar above the viewer matches the actual colors on the structure

**Reveal Animation:**
- [ ] Page loads showing ONLY the monomer panel at full width
- [ ] "Reveal Complex →" button is visible and styled in accent green
- [ ] Clicking "Reveal Complex" smoothly animates:
  - Monomer shrinks from 100% to ~50% width
  - Dimer panel slides in from the right
  - Disorder delta bar appears between them
- [ ] Animation duration is ~500ms with no jank
- [ ] After reveal, dimer structure loads and displays with pLDDT coloring
- [ ] Button changes to "← Monomer Only"
- [ ] Clicking "← Monomer Only" reverses the animation smoothly
- [ ] If `complex_structure_url` is empty, button is disabled (muted, no interaction)

**Disorder Delta Bar:**
- [ ] Vertical bar shows between the two panels when revealed
- [ ] Bar height reflects the magnitude of the delta (capped at ±40)
- [ ] Positive delta (structural gain) shows green fill
- [ ] Negative delta shows red fill
- [ ] Delta value displayed as `+XX.X` or `-XX.X` with sign prefix
- [ ] "Delta" label in micro uppercase below the value

**Theme Consistency:**
- [ ] No light-colored elements leak from Mol*
- [ ] All fonts match the site (IBM Plex Mono for data, Syne for headings)
- [ ] All borders are `1px solid #242424`
- [ ] No gradients, shadows, or pills
- [ ] Loading spinner matches the site's accent green spinner
- [ ] Error state matches the site's red ERR pattern

**Edge Cases:**
- [ ] Empty `monomer_structure_url` shows "No structure available" — no crash
- [ ] Empty `complex_structure_url` disables reveal button — no crash
- [ ] Network error while loading CIF shows error state inside the panel
- [ ] Navigating away from the page disposes the Mol* plugin (no memory leaks)
- [ ] Multiple rapid clicks on reveal button don't cause animation glitches

---

## KNOWN RISKS AND MITIGATIONS

| Risk | Mitigation |
|---|---|
| Mol* API differs across v3/v4 | Try three initialization patterns; log which pattern works |
| Mol* CSS conflicts with Tailwind | Scope overrides in index.css with `.msp-plugin` selectors |
| Mol* web worker fails in Vite | Add `worker.format: 'es'` to vite config |
| SCSS import fails without sass | Install `sass` or use pre-compiled `molstar.css` |
| CORS on AlphaFold .cif files | AlphaFold serves `.cif` with CORS headers — no issue |
| Large bundle size from Mol* | Lazy-load with `React.lazy` — only fetched on detail page |
| React 19 compatibility | Mol* v4 targets React 18; monitor for `createRoot` warnings |

---

*Phase 4 — Protein Visualizer*
*ProtPocket · HackMol 7.0*
*Hand this document directly to the coding agent. Do not proceed to Phase 5 until all checklist items pass.*
