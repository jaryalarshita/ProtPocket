import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Normalizes fragment data from the API to ensure required fields.
 */
function normalizeFragment(f) {
  if (!f || typeof f !== 'object') return f;
  return {
    ...f,
    // Ensure mw (Molecular Weight) is present for sorting/filtering
    mw: f.mw != null ? f.mw : f.mol_weight,
    id: f.chembl_id || f.zinc_id,
  };
}

/**
 * useChemblFragments — Standalone hook to fetch and cache ChEMBL fragment suggestions for a pocket.
 */
export function useChemblFragments(pocketId, options = {}, apiBase = '/api') {
  const [fragments, setFragments] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const cacheRef = useRef({}); // { [pocket_id]: float64[] }

  const fetchFragments = useCallback(async () => {
    if (pocketId == null || pocketId === '') return;

    setIsLoading(true);
    setError(null);

    const qs = new URLSearchParams();
    qs.set('pocket_id', String(pocketId));
    if (options.volume != null) qs.set('volume', String(options.volume));
    if (options.hydrophobicity != null) qs.set('hydrophobicity', String(options.hydrophobicity));
    if (options.polarity != null) qs.set('polarity', String(options.polarity));

    try {
      const res = await fetch(`${apiBase}/chembl?${qs.toString()}`);
      if (!res.ok) {
        throw new Error(`Failed to fetch fragments: HTTP ${res.status}`);
      }
      const json_data = await res.json();
      const data = json_data["data"];
      console.log(data);
      const list = (Array.isArray(data) ? data : []).map(normalizeFragment);

      cacheRef.current[pocketId] = list;
      setFragments(list);
    } catch (e) {
      setError(e.message || 'Unknown fragments error');
      setFragments([]);
    } finally {
      setIsLoading(false);
    }
  }, [pocketId, apiBase, options.volume, options.hydrophobicity, options.polarity, options.forceFetch]);

  useEffect(() => {
    fetchFragments();
  }, [fetchFragments]);

  return {
    fragments,
    isLoading,
    error,
    refetch: fetchFragments,
  };
}
