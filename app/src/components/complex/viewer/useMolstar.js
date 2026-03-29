import { useRef, useEffect, useState, useCallback } from 'react';
import { PluginUIContext } from 'molstar/lib/mol-plugin-ui/context';
import { DefaultPluginUISpec } from 'molstar/lib/mol-plugin-ui/spec';
import { createPluginUI } from 'molstar/lib/mol-plugin-ui';
import { PluginConfig } from 'molstar/lib/mol-plugin/config';
import { Color } from 'molstar/lib/mol-util/color';
import { createRoot } from 'react-dom/client';
import { StructureSelection, StructureQuery, StructureProperties } from 'molstar/lib/mol-model/structure';
import { Script } from 'molstar/lib/mol-script/script';
import { MolScriptBuilder as MS } from 'molstar/lib/mol-script/language/builder';
import { Bundle } from 'molstar/lib/mol-model/structure/structure/element/bundle';
import { Overpaint } from 'molstar/lib/mol-theme/overpaint';

import 'molstar/lib/mol-plugin-ui/skin/dark.scss';

/**
 * useMolstar — React hook that encapsulates the Mol* viewer lifecycle.
 *
 * Handles initialization, structure loading from .cif URL, pLDDT coloring,
 * and cleanup on unmount. No Mol* code should exist outside this hook.
 *
 * @param {Object} options
 * @param {string} options.structureUrl — URL to the .cif file
 * @param {string} options.label — label for the structure
 * @param {boolean} options.autoLoad — whether to load immediately (default true)
 * @returns {{ containerRef, isLoading, error, resetCamera }}
 */
export function useMolstar({
  structureUrl,
  label = '',
  autoLoad = true,
  highlightIndices = null,
  theme = 'light',
  representation = 'cartoon',
  conformations = null,
  activeMode = null,
  hideControls = false,
}) {
  const containerRef = useRef(null);
  const pluginRef = useRef(null);
  const initRef = useRef(false);
  const pocketActiveRef = useRef(false); // Track if a pocket highlight is active
  const poseStructureRefs = useRef(new Map());
  const activeModeRef = useRef(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Initialize Mol* plugin
  useEffect(() => {
    if (!containerRef.current || initRef.current) return;
    initRef.current = true;

    let disposed = false;

    const init = async () => {
      try {
        const spec = DefaultPluginUISpec();

        // Hide bulky sidebars but keep the tooltips/sequence overlays active
        spec.layout = {
          initial: {
            isExpanded: false,
            showControls: !hideControls,
            regionState: {
              bottom: 'hidden',
              left: 'hidden',
              right: 'hidden',
              top: 'hidden',
            }
          },
        };

        // Set background matching site theme
        spec.canvas3d = {
          renderer: {
            backgroundColor: theme === 'dark' ? Color(0x0a0a0a) : Color(0xffffff),
            selectColor: theme === 'dark' ? Color(0x4ade80) : Color(0x2563eb),
            highlightColor: theme === 'dark' ? Color(0x4ade80) : Color(0x2563eb),
          },
        };

        // Disable unnecessary features for minimal viewer
        spec.config = spec.config || [];
        spec.config.push(
          [PluginConfig.Viewport.ShowExpand, false],
          [PluginConfig.Viewport.ShowSettings, false],
          [PluginConfig.Viewport.ShowAnimation, false],
          [PluginConfig.Viewport.ShowTrajectoryControls, false],
        );

        const plugin = await createPluginUI({
          target: containerRef.current,
          spec,
          render: (component, target) => {
            let root = target.__reactRoot;
            if (!root) {
              root = createRoot(target);
              target.__reactRoot = root;
            }
            root.render(component);
          },
        });

        if (disposed) {
          if (containerRef.current?.__reactRoot) {
            containerRef.current.__reactRoot.unmount();
            delete containerRef.current.__reactRoot;
          }
          plugin.dispose();
          return;
        }

        pluginRef.current = plugin;

        // Prevent click-selection from suppressing hover labels,
        // but skip deselection when a pocket is actively highlighted
        plugin.behaviors.interaction.click.subscribe(() => {
          if (plugin.managers.interactivity && !pocketActiveRef.current) {
            plugin.managers.interactivity.lociSelects.deselectAll();
          }
        });

        // Load structure if URL available
        if (autoLoad && structureUrl) {
          await loadStructure(plugin, structureUrl);
        }
      } catch (err) {
        console.error('[useMolstar] init failed:', err);
        if (!disposed) {
          setError(`Viewer init failed: ${err.message}`);
        }
      }
    };

    init();

    return () => {
      disposed = true;
      if (pluginRef.current) {
        pluginRef.current.dispose();
        pluginRef.current = null;
      }
      if (containerRef.current?.__reactRoot) {
        containerRef.current.__reactRoot.unmount();
        delete containerRef.current.__reactRoot;
      }
      initRef.current = false;
    };
  }, []);

  // Reload structure when URL changes (after init)
  useEffect(() => {
    if (!pluginRef.current || !structureUrl || !autoLoad) return;
    // Only reload if plugin is already initialized
    if (!pluginRef.current.isInitialized) return;

    loadStructure(pluginRef.current, structureUrl);
  }, [structureUrl]);

  // Update background when theme changes
  useEffect(() => {
    if (!pluginRef.current || !pluginRef.current.isInitialized) return;

    const bgColor = theme === 'dark' ? Color(0x0a0a0a) : Color(0xffffff);
    const accentColor = theme === 'dark' ? Color(0x4ade80) : Color(0x2563eb);

    pluginRef.current.canvas3d?.setProps({
      renderer: {
        backgroundColor: bgColor,
        selectColor: accentColor,
        highlightColor: accentColor,
      }
    });
  }, [theme]);

  // Update representation when it changes
  useEffect(() => {
    if (!pluginRef.current || !pluginRef.current.isInitialized || isLoading) return;
    updateRepresentationStyle(pluginRef.current, representation);
  }, [representation, isLoading]);

  /**
   * Update the representation type for all structures.
   * Uses Mol*'s component manager to remove existing representations
   * and add new ones with the desired type.
   * Supported types: 'cartoon', 'ball-and-stick', 'gaussian-surface', 'spacefill', etc.
   */
  const updateRepresentationStyle = async (plugin, type) => {
    try {
      const { structures } = plugin.managers.structure.hierarchy.current;
      if (!structures || structures.length === 0) return;

      const mgr = plugin.managers.structure.component;

      for (const s of structures) {
        if (!s.components) continue;

        for (const comp of s.components) {
          if (!comp.representations || comp.representations.length === 0) continue;

          // Remove all existing representations from this component
          await mgr.removeRepresentations([comp]);

          // Add new representation with the desired type
          await mgr.addRepresentation([comp], type);
        }
      }

      // Re-apply pLDDT coloring after swapping representation type
      await applyPlddtColoring(plugin);
    } catch (err) {
      console.warn('[useMolstar] updateRepresentationStyle failed:', err);
    }
  };

  /**
   * Load a .cif file and apply pLDDT confidence coloring.
   */
  const loadStructure = async (plugin, url) => {
    setIsLoading(true);
    setError(null);

    try {
      // Clear any existing structures
      await plugin.clear();
      try {
        poseStructureRefs.current.clear();
        activeModeRef.current = null;
      } catch (err) {
        console.warn('[useMolstar] clear failed:', err);
      }

      // Download the CIF file
      let data;
      try {
        data = await plugin.builders.data.download(
          { url, isBinary: false, label },
          { state: { isGhost: true } }
        );
      } catch (dlErr) {
        throw new Error(`Download failed for ${url}: ${dlErr.message}`);
      }

      // Detect format from URL
      const isPdb = url.toLowerCase().endsWith('.pdb');
      const format = isPdb ? 'pdb' : 'mmcif';

      // Parse structure data and build trajectory
      let trajectory;
      try {
        trajectory = await plugin.builders.structure.parseTrajectory(data, format);
      } catch (parseErr) {
        console.error('Parse error details:', parseErr);
        throw new Error(`Failed to parse structure data. The URL might be returning an error page or JSON instead of a valid structure file. (format: ${format}, URL: ${url})`);
      }

      // Apply default preset to get structure + representation
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

      // Apply pLDDT confidence coloring (uncertainty theme)
      // AlphaFold stores pLDDT in the B-factor column.
      // Mol* 'uncertainty' theme maps B-factor → standard 4-color pLDDT scale
      await applyPlddtColoring(plugin);

      // Apply initial representation if not default (cartoon)
      if (representation !== 'cartoon') {
        await updateRepresentationStyle(plugin, representation);
      }

      // Frame the camera
      plugin.managers.camera.reset();

    } catch (err) {
      console.error(`[useMolstar] Load failed for ${url}:`, err);
      setError(`Failed to load: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Remove all preloaded pose structures. Receptor unaffected.
   */
  async function clearAllPoses() {
    const plugin = pluginRef.current;
    if (!plugin) return;
    for (const structRef of poseStructureRefs.current.values()) {
      await plugin.managers.structure.hierarchy.remove([structRef]);
    }
    poseStructureRefs.current.clear();
    activeModeRef.current = null;
  }

  /**
   * Preload all conformations as hidden Mol* structures.
   * Show only the one matching initialMode. Receptor always stays visible.
   */
  async function preloadConformations(confs, initialMode) {
    const plugin = pluginRef.current;
    if (!plugin?.isInitialized) return;
    await clearAllPoses();

    for (const conf of confs) {
      const blob = new Blob([conf.pose_pdb], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      try {
        const data = await plugin.builders.data.download(
          { url, isBinary: false, label: `pose_${conf.mode}` },
          { state: { isGhost: false } }
        );
        const trajectory = await plugin.builders.structure.parseTrajectory(data, 'pdb');
        await plugin.builders.structure.hierarchy.applyPreset(
          trajectory,
          'default',
          {
            structure: { name: 'model', params: {} },
            showUnitcell: false,
            representationPreset: 'auto',
          }
        );

        plugin.managers.structure.hierarchy.sync(true);
        const structures = plugin.managers.structure.hierarchy.current.structures;
        const structRef = structures[structures.length - 1];
        if (!structRef) continue;

        const modeColors = {
          1: Color(0xf97316),
          2: Color(0x8b5cf6),
          3: Color(0x06b6d4),
        };
        const color = modeColors[conf.mode] ?? Color(0x6b7280);

        const mgr = plugin.managers.structure.component;
        if (structRef.components?.length) {
          for (const comp of structRef.components) {
            await mgr.removeRepresentations([comp]);
            await mgr.addRepresentation([comp], 'ball-and-stick');
            await mgr.updateRepresentationsTheme([comp], {
              color: 'uniform',
              colorParams: { value: color },
            });
          }
        }
        poseStructureRefs.current.set(conf.mode, structRef);
      } finally {
        URL.revokeObjectURL(url);
      }
    }

    const mode0 = initialMode ?? confs[0]?.mode;
    const hierarchy = plugin.managers.structure.hierarchy;
    for (const [mode, structRef] of poseStructureRefs.current) {
      const shouldShow = mode === mode0;
      if (structRef) {
        hierarchy.toggleVisibility([structRef], shouldShow ? 'show' : 'hide');
      }
    }
    activeModeRef.current = mode0;
  }

  /**
   * Switch visible pose to `mode`. Hide previous. Does not reset camera.
   */
  async function showConformation(mode) {
    const plugin = pluginRef.current;
    if (!plugin) return;
    const hierarchy = plugin.managers.structure.hierarchy;
    for (const [m, structRef] of poseStructureRefs.current) {
      const shouldShow = m === mode;
      if (structRef) {
        hierarchy.toggleVisibility([structRef], shouldShow ? 'show' : 'hide');
      }
    }
    activeModeRef.current = mode;
  }

  const resetCamera = useCallback(() => {
    if (pluginRef.current?.managers?.camera) {
      pluginRef.current.managers.camera.reset();
    }
  }, []);

  /**
   * Highlight specific residues in the 3D viewer (pocket visualization).
   * Uses Mol*'s native selection manager to highlight and focus the pocket.
   */
  const highlightPocket = useCallback(async (residueIndices) => {
    const plugin = pluginRef.current;
    if (!plugin || !residueIndices || residueIndices.length === 0) return;

    try {
      const structures = plugin.managers.structure.hierarchy.current.structures;
      if (!structures || structures.length === 0) return;

      // Mark pocket as active so clicks don't clear it
      pocketActiveRef.current = true;

      // Clear previous selections
      plugin.managers.interactivity.lociSelects.deselectAll();

      let targetLoci = null;

      for (const s of structures) {
        if (!s.cell?.obj?.data) continue;
        const structure = s.cell.obj.data;

        // Create a selection matching either label_seq_id (CIF) or auth_seq_id (PDB)
        const sel = Script.getStructureSelection(
          Q => Q.struct.generator.atomGroups({
            'residue-test': Q.core.logic.or(
              residueIndices.flatMap(idx => [
                Q.core.rel.eq([Q.struct.atomProperty.macromolecular.label_seq_id(), idx]),
                Q.core.rel.eq([Q.struct.atomProperty.macromolecular.auth_seq_id(), idx])
              ])
            ),
          }),
          structure
        );

        const loci = StructureSelection.toLociWithSourceUnits(sel);

        // Apply selection to highlight it in the viewer
        plugin.managers.interactivity.lociSelects.select({ loci });

        if (loci.elements && loci.elements.length > 0) {
          targetLoci = loci;
        }
      }

      // Focus camera on the highlighted pocket if found
      if (targetLoci) {
        plugin.managers.camera.focusLoci(targetLoci);
      }
    } catch (err) {
      console.warn('[useMolstar] highlightPocket failed:', err);
    }
  }, []);

  /**
   * Clear pocket highlights and restore the camera.
   */
  const clearPocketHighlight = useCallback(async () => {
    const plugin = pluginRef.current;
    if (!plugin) return;

    try {
      pocketActiveRef.current = false;
      plugin.managers.interactivity.lociSelects.deselectAll();
      plugin.managers.camera.reset();
    } catch (err) {
      console.warn('[useMolstar] clearPocketHighlight failed:', err);
    }
  }, []);

  // Synchronize highlights when indices change or structure finished loading
  useEffect(() => {
    if (!pluginRef.current || isLoading) return;

    if (highlightIndices && highlightIndices.length > 0) {
      highlightPocket(highlightIndices);
    } else if (pocketActiveRef.current) {
      clearPocketHighlight();
    }
  }, [highlightIndices, isLoading, highlightPocket, clearPocketHighlight, conformations, activeMode]);

  // When conformations array is newly populated: preload all
  useEffect(() => {
    const plugin = pluginRef.current;
    if (!plugin || isLoading) return;
    if (conformations?.length) {
      const initial = activeMode ?? conformations[0]?.mode;
      preloadConformations(conformations, initial).catch((e) =>
        console.warn('[useMolstar] preloadConformations failed:', e)
      );
    } else {
      clearAllPoses().catch((e) => console.warn('[useMolstar] clearAllPoses failed:', e));
    }
  }, [conformations, isLoading]);

  // When activeMode changes and poses are already loaded: just switch visibility
  useEffect(() => {
    const plugin = pluginRef.current;
    if (!plugin || activeMode == null || !poseStructureRefs.current.size) return;
    if (activeMode === activeModeRef.current) return;
    showConformation(activeMode).catch((e) => console.warn('[useMolstar] showConformation failed:', e));
  }, [activeMode]);

  return {
    containerRef,
    isLoading,
    error,
    resetCamera,
    highlightPocket,
    clearPocketHighlight,
    preloadConformations,
    showConformation,
    clearAllPoses,
  };
}

/**
 * Apply pLDDT confidence coloring to all representations.
 *
 * AlphaFold stores pLDDT (confidence, 0-100) in the B-factor column.
 * Mol*'s built-in 'uncertainty' theme uses a 'red-white-blue' scale with
 * reverse=true, which maps HIGH B-factor → RED. That's correct for actual
 * uncertainty, but WRONG for pLDDT where HIGH = HIGH confidence = should be BLUE.
 *
 * Strategy:
 *  1. Apply uncertainty theme via the normal API (sets up proper B-factor reading).
 *  2. Do a direct state-tree update to replace colorTheme.params.list with the
 *     reversed color array, so the theme factory sees blue→white→red and its
 *     built-in `reverse:true` flips it to red→white→blue mapping (0→red, 100→blue).
 */
async function applyPlddtColoring(plugin) {
  const themeNames = ['uncertainty', 'plddt-confidence', 'b-factor'];

  const registry = plugin.representation.structure.themes.colorThemeRegistry;
  let themeName = null;
  const availableThemes = registry._list || [];

  for (const name of themeNames) {
    if (availableThemes.some(t => t.name === name)) {
      themeName = name;
      break;
    }
  }

  if (!themeName) {
    console.warn('[useMolstar] No pLDDT color theme found. Available:', availableThemes.map(t => t.name));
    return;
  }

  const structures = plugin.managers.structure.hierarchy.current.structures;
  if (!structures) return;

  // Step 1: Apply the uncertainty theme via normal API
  for (const s of structures) {
    if (!s.components) continue;
    const validComponents = s.components.filter(c => c && c.representations);
    if (validComponents.length > 0) {
      try {
        await plugin.managers.structure.component.updateRepresentationsTheme(
          validComponents,
          { color: themeName }
        );
      } catch (e) {
        console.warn('[useMolstar] Failed to apply theme:', e);
      }
    }
  }

  // Step 2: Directly patch representation state cells to flip the color list.
  // The uncertainty theme default list is 'red-white-blue' with reverse=true,
  // meaning domain_min(0)→blue, domain_max(100)→red.
  // We swap the list to 'blue-white-red' so that with reverse=true:
  // domain_min(0)→red, domain_max(100)→blue. Exactly what we want for pLDDT.
  try {
    const update = plugin.state.data.build();
    let patched = false;

    for (const s of structures) {
      if (!s.components) continue;
      for (const comp of s.components) {
        if (!comp.representations) continue;
        for (const repr of comp.representations) {
          const cell = repr.cell;
          if (!cell?.transform?.params?.colorTheme) continue;
          const ct = cell.transform.params.colorTheme;
          if (ct.name !== 'uncertainty') continue;

          update.to(cell).update(old => {
            // Reverse the color list array in-place so the theme factory's
            // built-in reverse:true flips it back to the correct pLDDT mapping.
            if (old.colorTheme?.params?.list?.colors) {
              old.colorTheme.params.list.colors = [...old.colorTheme.params.list.colors].reverse();
            }
          });
          patched = true;
        }
      }
    }

    if (patched) {
      await update.commit();
    }
  } catch (e) {
    console.warn('[useMolstar] Failed to patch color list for pLDDT:', e);
  }
}

