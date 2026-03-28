import React, { useState, useCallback, useRef, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ScatterChart, Scatter, ZAxis, Cell
} from 'recharts';
import { PocketTableRow } from './PocketTableRow';
import { FragmentList } from './FragmentList';

/** Mol* target from comparison tab: monomer + homodimer only when `is_conserved`, else homodimer only. */
function comparisonHighlightTarget(pocket) {
  return pocket.is_conserved ? 'both' : 'complex';
}

// Recharts chart margins — must match the margin prop on <ScatterChart>
const CHART_MARGIN = { top: 10, right: 30, bottom: 20, left: 40 };
const ZOOM_FACTOR = 1.3;
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 8;

function ScatterChartWithZoom({ data }) {
  // Compute the full (unzoomed) data extents once
  const fullExtent = useMemo(() => {
    const xValues = data.map(d => d.avg_delta);
    const yValues = data.map(d => d.druggability_score);
    return {
      xMin: Math.min(-5, Math.min(...xValues) - 1),
      xMax: Math.max(5, Math.max(...xValues) + 1),
      yMin: Math.min(...yValues) - 0.05,
      yMax: Math.max(...yValues) + 0.05,
    };
  }, [data]);

  // Viewport state — starts at the full extent
  const [viewport, setViewport] = useState(null);
  const vp = viewport || fullExtent;

  const zoomLevel = useMemo(() => {
    const fullW = fullExtent.xMax - fullExtent.xMin;
    const curW = vp.xMax - vp.xMin;
    return curW > 0 ? fullW / curW : 1;
  }, [fullExtent, vp]);

  // Ref for the chart container div so we can compute mouse position
  const chartRef = useRef(null);
  const dragRef = useRef(null);

  /**
   * Convert a pixel position (relative to the chart container) into data coordinates.
   * The "plot area" is the container minus the chart margins.
   */
  const pixelToData = useCallback((px, py, containerRect) => {
    const plotLeft = CHART_MARGIN.left;
    const plotTop = CHART_MARGIN.top;
    const plotWidth = containerRect.width - CHART_MARGIN.left - CHART_MARGIN.right;
    const plotHeight = containerRect.height - CHART_MARGIN.top - CHART_MARGIN.bottom;

    // Fraction within the plot area (clamped 0–1)
    const fx = Math.max(0, Math.min(1, (px - plotLeft) / plotWidth));
    // Y axis is flipped (top = high value)
    const fy = Math.max(0, Math.min(1, 1 - (py - plotTop) / plotHeight));

    return {
      dataX: vp.xMin + fx * (vp.xMax - vp.xMin),
      dataY: vp.yMin + fy * (vp.yMax - vp.yMin),
    };
  }, [vp]);

  /**
   * Use a native, non-passive listener to reliably prevent page scroll/zoom.
   * React's synthetic onWheel doesn't always allow preventDefault() for scroll blocking.
   */
  React.useEffect(() => {
    const chartEl = chartRef.current;
    if (!chartEl) return;

    const onWheelNative = (e) => {
      // Prevent browser zoom (ctrl+wheel) and page scroll
      e.preventDefault();

      const rect = chartEl.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      const { dataX, dataY } = pixelToData(px, py, rect);

      // Detect pinch-zoom (ctrlKey) vs normal scroll
      const isZoomIn = e.deltaY < 0;
      const factor = isZoomIn ? 1 / ZOOM_FACTOR : ZOOM_FACTOR;

      // Scale the distance from the cursor point
      const newXMin = dataX - (dataX - vp.xMin) * factor;
      const newXMax = dataX + (vp.xMax - dataX) * factor;
      const newYMin = dataY - (dataY - vp.yMin) * factor;
      const newYMax = dataY + (vp.yMax - dataY) * factor;

      // Clamp zoom level
      const newW = newXMax - newXMin;
      const fullW = fullExtent.xMax - fullExtent.xMin;
      const newZoom = fullW / newW;
      if (newZoom < MIN_ZOOM || newZoom > MAX_ZOOM) return;

      setViewport({ xMin: newXMin, xMax: newXMax, yMin: newYMin, yMax: newYMax });
    };

    chartEl.addEventListener('wheel', onWheelNative, { passive: false });
    return () => chartEl.removeEventListener('wheel', onWheelNative);
  }, [vp, fullExtent, pixelToData]);

  // ──────── Drag pan ────────
  const handleMouseDown = useCallback((e) => {
    if (e.button !== 0) return; // left click only
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startY: e.clientY, vpStart: { ...vp } };
    document.body.style.cursor = 'grabbing';

    const handleMouseMove = (me) => {
      const dr = dragRef.current;
      if (!dr) return;
      const rect = chartRef.current?.getBoundingClientRect();
      if (!rect) return;

      const plotWidth = rect.width - CHART_MARGIN.left - CHART_MARGIN.right;
      const plotHeight = rect.height - CHART_MARGIN.top - CHART_MARGIN.bottom;

      const dxPx = me.clientX - dr.startX;
      const dyPx = me.clientY - dr.startY;

      const dxData = -(dxPx / plotWidth) * (dr.vpStart.xMax - dr.vpStart.xMin);
      const dyData = (dyPx / plotHeight) * (dr.vpStart.yMax - dr.vpStart.yMin); // Y inverted

      setViewport({
        xMin: dr.vpStart.xMin + dxData,
        xMax: dr.vpStart.xMax + dxData,
        yMin: dr.vpStart.yMin + dyData,
        yMax: dr.vpStart.yMax + dyData,
      });
    };

    const handleMouseUp = () => {
      dragRef.current = null;
      document.body.style.cursor = '';
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [vp]);

  // ──────── Button handlers ────────
  const handleZoomIn = useCallback(() => {
    const midX = (vp.xMin + vp.xMax) / 2;
    const midY = (vp.yMin + vp.yMax) / 2;
    const factor = 1 / ZOOM_FACTOR;
    setViewport({
      xMin: midX - (midX - vp.xMin) * factor,
      xMax: midX + (vp.xMax - midX) * factor,
      yMin: midY - (midY - vp.yMin) * factor,
      yMax: midY + (vp.yMax - midY) * factor,
    });
  }, [vp]);

  const handleZoomOut = useCallback(() => {
    const midX = (vp.xMin + vp.xMax) / 2;
    const midY = (vp.yMin + vp.yMax) / 2;
    const factor = ZOOM_FACTOR;
    setViewport({
      xMin: midX - (midX - vp.xMin) * factor,
      xMax: midX + (vp.xMax - midX) * factor,
      yMin: midY - (midY - vp.yMin) * factor,
      yMax: midY + (vp.yMax - midY) * factor,
    });
  }, [vp]);

  const handleReset = () => setViewport(null);

  const isReset = !viewport;

  return (
    <div className="bg-bg-primary border border-border rounded p-6 flex flex-col gap-4">
      <div className="flex items-center justify-between border-b border-border-subtle pb-2">
        <h4 className="font-mono text-xs uppercase tracking-wider text-text-secondary">Stabilization vs Druggability (Complex Pockets)</h4>
        <div className="flex items-center gap-1">
          <button
            onClick={handleZoomOut}
            disabled={zoomLevel <= MIN_ZOOM}
            className="w-7 h-7 flex items-center justify-center rounded border border-border bg-bg-secondary text-text-secondary hover:bg-bg-tertiary hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors font-mono text-sm"
            title="Zoom out"
          >
            −
          </button>
          <button
            onClick={handleReset}
            disabled={isReset}
            className="h-7 px-2 flex items-center justify-center rounded border border-border bg-bg-secondary text-text-muted hover:bg-bg-tertiary hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors font-mono text-[10px] uppercase tracking-wider"
            title="Reset zoom & pan"
          >
            {isReset ? '1.000×' : `${zoomLevel.toFixed(3)}×`}
          </button>
          <button
            onClick={handleZoomIn}
            disabled={zoomLevel >= MAX_ZOOM}
            className="w-7 h-7 flex items-center justify-center rounded border border-border bg-bg-secondary text-text-secondary hover:bg-bg-tertiary hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors font-mono text-sm"
            title="Zoom in"
          >
            +
          </button>
        </div>
      </div>
      <div
        ref={chartRef}
        className="h-64 w-full mt-4 relative select-none"
        style={{ cursor: 'grab' }}
        onMouseDown={handleMouseDown}
      >
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={CHART_MARGIN}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
            <XAxis
              type="number"
              dataKey="avg_delta"
              name="Δ pLDDT"
              domain={[vp.xMin, vp.xMax]}
              allowDataOverflow={true}
              stroke="#555"
              tick={{ fill: '#888', fontSize: 10, fontFamily: 'monospace' }}
              tickFormatter={(val) => val.toFixed(3)}
              label={{ value: 'Disorder Delta (Δ pLDDT)', position: 'bottom', fill: '#888', fontSize: 10, fontFamily: 'monospace' }}
            />
            <YAxis
              type="number"
              dataKey="druggability_score"
              name="Druggability"
              domain={[vp.yMin, vp.yMax]}
              allowDataOverflow={true}
              stroke="#555"
              tick={{ fill: '#888', fontSize: 10, fontFamily: 'monospace' }}
              tickFormatter={(val) => val.toFixed(3)}
              label={{ value: 'Druggability Score', angle: -90, position: 'left', fill: '#888', fontSize: 10, fontFamily: 'monospace' }}
            />
            <Tooltip
              cursor={{ strokeDasharray: '3 3' }}
              contentStyle={{ backgroundColor: '#1a1a1a', borderColor: '#333', fontSize: '11px', fontFamily: 'monospace' }}
              itemStyle={{ color: '#e5e7eb' }}
              labelStyle={{ display: 'none' }}
              formatter={(value, name) => [value.toFixed(3), name]}
            />
            <Scatter
              name="Pockets"
              data={[...data].sort((a, b) => a.avg_delta - b.avg_delta)}
              line={{ stroke: '#555', strokeWidth: 1.5, strokeDasharray: '4 4' }}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.avg_delta >= 5.0 ? '#10b981' : '#9ca3af'} />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
        {data.every(d => Math.abs(d.avg_delta) < 0.001) && (
          <div className="absolute inset-x-0 bottom-8 flex justify-center pointer-events-none">
            <span className="bg-bg-primary/80 border border-border px-3 py-1 rounded text-[10px] font-mono uppercase tracking-wider text-text-muted shadow-sm">
              Disorder Delta data not available
            </span>
          </div>
        )}
      </div>
      {!isReset && (
        <p className="font-mono text-[10px] text-text-muted text-center -mt-2">
          Scroll to zoom · Drag to pan · Click reset to restore
        </p>
      )}
    </div>
  );
}

export function ComparisonTab({ 
  comparison, 
  activePocketIdx, 
  handleHighlight, 
  proteinPdbId, 
  onConformationChange 
}) {
  if (!comparison) return (
    <div className="flex justify-center items-center py-12">
      <span className="font-mono text-sm text-text-muted">Comparison data not available.</span>
    </div>
  );

  const {
    summary_metrics,
    ddgi,
    pocket_mapping,
    interface_pockets,
    conserved_pockets,
    emergent_pockets,
    graph_datasets,
    property_changes,
    stabilization_stats,
    fragment_comparison
  } = comparison;

  const hasScatterData = graph_datasets?.stabilization_scatter && graph_datasets.stabilization_scatter.length > 0;

  return (
    <div className="flex flex-col gap-8 w-full mt-4">
      {/* 1. Summary Metrics & DDGI */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-bg-primary border border-border rounded p-4 flex flex-col items-center justify-center text-center gap-1">
          <span className="font-mono text-[10px] uppercase tracking-wider text-text-muted">Total Monomer Pockets</span>
          <span className="font-display font-bold text-2xl text-text-primary">{summary_metrics.total_monomer_pockets}</span>
        </div>
        <div className="bg-bg-primary border border-border rounded p-4 flex flex-col items-center justify-center text-center gap-1">
          <span className="font-mono text-[10px] uppercase tracking-wider text-text-muted">Total Complex Pockets</span>
          <span className="font-display font-bold text-2xl text-text-primary">{summary_metrics.total_dimer_pockets}</span>
        </div>
        <div className="bg-bg-primary border border-border rounded p-4 flex flex-col items-center justify-center text-center gap-1">
          <span className="font-mono text-[10px] uppercase tracking-wider text-text-muted">True Interface Pockets</span>
          <span className="font-display font-bold text-2xl text-success">{pocket_mapping.interface_count}</span>
        </div>
        <div className={`bg-bg-primary border rounded p-4 flex flex-col items-center justify-center text-center gap-1 ${ddgi > 0 ? 'border-success/50' : 'border-danger/50'}`}>
          <span className="font-mono text-[10px] uppercase tracking-wider text-text-muted flex items-center justify-center gap-1 hover:text-text-primary group relative">
            DDGI Score
            <div className="hidden group-hover:block absolute bottom-full mb-2 w-48 text-[9px] bg-bg-tertiary border border-border rounded p-2 text-left z-10 normal-case">
              Dimerization Druggability Gain Index: Avg Dimer Score - Avg Monomer Score
            </div>
          </span>
          <span className={`font-display font-bold text-3xl ${ddgi > 0 ? 'text-success' : 'text-danger'}`}>
            {ddgi > 0 ? '+' : ''}{ddgi.toFixed(3)}
          </span>
        </div>
      </div>

      {/* 2. Pocket Mapping & Property Changes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Pocket Mapping */}
        <div className="bg-bg-primary border border-border rounded p-6 flex flex-col gap-4">
          <h4 className="font-mono text-xs uppercase tracking-wider text-text-secondary border-b border-border-subtle pb-2">Pocket Transition Map</h4>
          <div className="flex flex-col gap-3 mt-2">
            <div className="flex justify-between items-center">
              <span className="font-mono text-sm text-text-muted">Conserved in both states</span>
              <span className="font-mono text-base font-bold text-text-primary">{pocket_mapping.conserved_count}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-mono text-sm text-text-muted">Disappeared upon dimerization</span>
              <span className="font-mono text-base font-bold text-warning">{pocket_mapping.monomer_only_count}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-mono text-sm text-text-muted">Newly emerged in dimer</span>
              <span className="font-mono text-base font-bold text-success">{pocket_mapping.emergent_count}</span>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-border-subtle">
            <h5 className="font-mono text-[10px] uppercase text-text-muted mb-2">Residue Stabilization Analysis</h5>
            <div className="flex justify-between items-center">
              <span className="font-mono text-xs text-text-muted">Interface Residue Enrichment</span>
              <span className="font-mono text-xs font-bold text-text-primary">{stabilization_stats.enrichment_score.toFixed(2)}x</span>
            </div>
          </div>
        </div>

        {/* Changes */}
        <div className="bg-bg-primary border border-border rounded p-6 flex flex-col gap-4">
          <h4 className="font-mono text-xs uppercase tracking-wider text-text-secondary border-b border-border-subtle pb-2">Average Property Shifts</h4>
          <div className="flex flex-col gap-4 mt-2">
            {/* Vol */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-text-muted">Avg Volume</span>
                <span>{property_changes.monomer_avg_volume.toFixed(0)} → {property_changes.dimer_avg_volume.toFixed(0)} Å³</span>
              </div>
            </div>
            {/* Hydrophobicity */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-text-muted">Avg Hydrophobicity</span>
                <span>{property_changes.monomer_avg_hydrophobicity.toFixed(2)} → {property_changes.dimer_avg_hydrophobicity.toFixed(2)}</span>
              </div>
            </div>
            {/* Polarity */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-text-muted">Avg Polarity</span>
                <span>{property_changes.monomer_avg_polarity.toFixed(2)} → {property_changes.dimer_avg_polarity.toFixed(2)}</span>
              </div>
            </div>
            {/* Score */}
            <div className="flex flex-col gap-1 mt-2 pt-2 border-t border-border-subtle">
              <div className="flex justify-between text-xs font-mono font-bold">
                <span className="text-text-primary">Avg Druggability</span>
                <span className={ddgi > 0 ? 'text-success' : 'text-danger'}>
                  {summary_metrics.avg_monomer_druggability.toFixed(3)} → {summary_metrics.avg_dimer_druggability.toFixed(3)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Charts */}
      {hasScatterData && (
        <ScatterChartWithZoom data={graph_datasets.stabilization_scatter} />
      )}

      {/* 4. True Interface Pockets */}
      <div className="flex flex-col gap-4">
        <h4 className="font-display font-bold text-lg text-text-primary flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
          True Interface Drug Targets
        </h4>
        <p className="font-mono text-xs text-text-muted">
          Pockets spanning multiple protein chains at the dimer interaction surface.
        </p>

        <div className="overflow-x-auto border border-border rounded mt-2">
          <table className="w-full text-left border-collapse">
            <thead className="bg-bg-tertiary border-b border-border">
              <tr>
                <th className="px-4 py-2 font-mono text-xs uppercase tracking-wider text-text-muted">ID</th>
                <th className="px-4 py-2 font-mono text-xs uppercase tracking-wider text-text-muted">Score</th>
                <th className="px-4 py-2 font-mono text-xs uppercase tracking-wider text-text-muted">Vol</th>
                <th className="px-4 py-2 font-mono text-xs uppercase tracking-wider text-text-muted">Hydro</th>
                <th className="px-4 py-2 font-mono text-xs uppercase tracking-wider text-text-muted">Polar</th>
                <th className="px-4 py-2 font-mono text-xs uppercase tracking-wider text-text-muted">Δ pLDDT</th>
                <th className="px-4 py-2 font-mono text-xs uppercase tracking-wider text-text-muted">Center</th>
                <th className="px-4 py-2 font-mono text-xs uppercase tracking-wider text-text-muted">Residues</th>
                <th className="px-4 py-2 font-mono text-xs uppercase tracking-wider text-text-muted items-center justify-center text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {interface_pockets && interface_pockets.length > 0 ? (
                interface_pockets.map((pocket, idx) => (
                  <PocketTableRow
                    key={pocket.pocket_id}
                    pocket={pocket}
                    activeTab="comparison"
                    isActive={activePocketIdx === `int-${idx}`}
                    onHighlight={(residueIndices) =>
                      handleHighlight(residueIndices, `int-${idx}`, comparisonHighlightTarget(pocket))
                    }
                    proteinPdbId={proteinPdbId}
                    onConformationChange={(confs, mode) =>
                      onConformationChange?.(confs, mode, comparisonHighlightTarget(pocket))
                    }
                  />
                ))
              ) : (
                <tr>
                  <td colSpan="9" className="px-4 py-8 text-center text-text-muted font-mono text-sm">
                    No true interface pockets found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5b. Conserved Pockets */}
      <div className="flex flex-col gap-4 mt-4">
        <h4 className="font-display font-bold text-lg text-text-primary flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-accent" />
          Conserved Pockets
        </h4>
        <p className="font-mono text-xs text-text-muted">
          Pockets retained from monomer to dimer — spatially overlapping in both structures.
        </p>

        <div className="overflow-x-auto border border-border rounded mt-2">
          <table className="w-full text-left border-collapse">
            <thead className="bg-bg-tertiary border-b border-border">
              <tr>
                <th className="px-4 py-2 font-mono text-xs uppercase tracking-wider text-text-muted">ID</th>
                <th className="px-4 py-2 font-mono text-xs uppercase tracking-wider text-text-muted">Score</th>
                <th className="px-4 py-2 font-mono text-xs uppercase tracking-wider text-text-muted">Vol</th>
                <th className="px-4 py-2 font-mono text-xs uppercase tracking-wider text-text-muted">Hydro</th>
                <th className="px-4 py-2 font-mono text-xs uppercase tracking-wider text-text-muted">Polar</th>
                <th className="px-4 py-2 font-mono text-xs uppercase tracking-wider text-text-muted">Δ pLDDT</th>
                <th className="px-4 py-2 font-mono text-xs uppercase tracking-wider text-text-muted">Center</th>
                <th className="px-4 py-2 font-mono text-xs uppercase tracking-wider text-text-muted">Residues</th>
                <th className="px-4 py-2 font-mono text-xs uppercase tracking-wider text-text-muted items-center justify-center text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {conserved_pockets && conserved_pockets.length > 0 ? (
                conserved_pockets.map((pocket, idx) => (
                  <PocketTableRow
                    key={pocket.pocket_id}
                    pocket={pocket}
                    activeTab="comparison"
                    isActive={activePocketIdx === `con-${idx}`}
                    onHighlight={(residueIndices) =>
                      handleHighlight(residueIndices, `con-${idx}`, comparisonHighlightTarget(pocket))
                    }
                    proteinPdbId={proteinPdbId}
                    onConformationChange={(confs, mode) =>
                      onConformationChange?.(confs, mode, comparisonHighlightTarget(pocket))
                    }
                  />
                ))
              ) : (
                <tr>
                  <td colSpan="9" className="px-4 py-8 text-center text-text-muted font-mono text-sm">
                    No conserved pockets found — all monomer pockets were restructured.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Emergent Monomer-Dimer Pockets */}
      <div className="flex flex-col gap-4 mt-4">
        <h4 className="font-display font-bold text-lg text-text-primary flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-warning" />
          Emergent Dimer-only Pockets
        </h4>
        <p className="font-mono text-xs text-text-muted">
          Pockets that physically appear in the dimer but belong to a single chain (structural rearrangement).
        </p>

        <div className="overflow-x-auto border border-border rounded mt-2">
          <table className="w-full text-left border-collapse">
            <thead className="bg-bg-tertiary border-b border-border">
              <tr>
                <th className="px-4 py-2 font-mono text-xs uppercase tracking-wider text-text-muted">ID</th>
                <th className="px-4 py-2 font-mono text-xs uppercase tracking-wider text-text-muted">Score</th>
                <th className="px-4 py-2 font-mono text-xs uppercase tracking-wider text-text-muted">Vol</th>
                <th className="px-4 py-2 font-mono text-xs uppercase tracking-wider text-text-muted">Hydro</th>
                <th className="px-4 py-2 font-mono text-xs uppercase tracking-wider text-text-muted">Polar</th>
                <th className="px-4 py-2 font-mono text-xs uppercase tracking-wider text-text-muted">Δ pLDDT</th>
                <th className="px-4 py-2 font-mono text-xs uppercase tracking-wider text-text-muted">Center</th>
                <th className="px-4 py-2 font-mono text-xs uppercase tracking-wider text-text-muted">Residues</th>
                <th className="px-4 py-2 font-mono text-xs uppercase tracking-wider text-text-muted items-center justify-center text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {emergent_pockets && emergent_pockets.length > 0 ? (
                emergent_pockets.map((pocket, idx) => (
                  <PocketTableRow
                    key={pocket.pocket_id}
                    pocket={pocket}
                    activeTab="comparison"
                    isActive={activePocketIdx === `emg-${idx}`}
                    onHighlight={(residueIndices) =>
                      handleHighlight(residueIndices, `emg-${idx}`, comparisonHighlightTarget(pocket))
                    }
                    proteinPdbId={proteinPdbId}
                    onConformationChange={(confs, mode) =>
                      onConformationChange?.(confs, mode, comparisonHighlightTarget(pocket))
                    }
                  />
                ))
              ) : (
                <tr>
                  <td colSpan="9" className="px-4 py-8 text-center text-text-muted font-mono text-sm">
                    No emergent structural pockets found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 6. Fragment Comparison — ChEMBL novel compounds */}
      {fragment_comparison && (
        (fragment_comparison.unique_interface_fragments?.length > 0 ||
         fragment_comparison.unique_dimer_fragments?.length > 0) && (
        <div className="flex flex-col gap-5 mt-6">
          <div>
            <h4 className="font-display font-bold text-xl text-text-primary flex items-center gap-2">
              <svg className="w-6 h-6 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
              Novel ChEMBL Fragment Suggestions
            </h4>
            <p className="font-mono text-sm text-text-muted mt-1">
              Compounds from the ChEMBL database unique to the dimerized state — not suggested for any monomer pocket.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Interface-specific fragments (highest value) */}
            <div className="bg-bg-primary border border-purple-500/30 rounded-lg p-6 flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-border-subtle pb-3">
                <h5 className="font-mono text-sm uppercase tracking-wider text-purple-400 font-bold">
                  Interface Pocket Fragments
                </h5>
                <span className="font-mono text-xs bg-purple-500/15 text-purple-400 border border-purple-500/30 px-2.5 py-1 rounded">
                  {fragment_comparison.unique_interface_fragments?.length || 0} compounds
                </span>
              </div>
              <p className="font-mono text-xs text-text-muted leading-relaxed">
                Fragments targeting pockets at the protein-protein interface — highest value for PPI inhibitor design.
              </p>
              <FragmentList fragments={fragment_comparison.unique_interface_fragments} />
            </div>

            {/* Dimer-unique fragments */}
            <div className="bg-bg-primary border border-border rounded-lg p-6 flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-border-subtle pb-3">
                <h5 className="font-mono text-sm uppercase tracking-wider text-text-secondary font-bold">
                  Dimer-only Fragments
                </h5>
                <span className="font-mono text-xs bg-bg-tertiary text-text-muted border border-border-subtle px-2.5 py-1 rounded">
                  {fragment_comparison.unique_dimer_fragments?.length || 0} compounds
                </span>
              </div>
              <p className="font-mono text-xs text-text-muted leading-relaxed">
                Fragments unique to any dimer pocket (including emergent and conserved) not found in monomer analysis.
              </p>
              <FragmentList fragments={fragment_comparison.unique_dimer_fragments} />
            </div>
          </div>
        </div>
        )
      )}

    </div>
  );
}
