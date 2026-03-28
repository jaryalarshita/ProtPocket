import { useState, useEffect, useCallback, useRef } from 'react';

function normalizeConformations(statusBody) {
  if (Array.isArray(statusBody.conformations) && statusBody.conformations.length > 0) {
    return statusBody.conformations;
  }
  if (statusBody.status === 'done' && statusBody.pose_pdb) {
    return [
      {
        mode: 1,
        binding_affinity: statusBody.binding_affinity ?? 0,
        rmsd_lb: 0,
        rmsd_ub: 0,
        pose_pdb: statusBody.pose_pdb,
      },
    ];
  }
  return [];
}

/**
 * Orchestrates docking submission and status polling.
 */
export function useDockingJob(apiBase = '/api') {
  const [step, setStep] = useState('idle');
  const [selectedFragment, setSelectedFragment] = useState(null);
  const [conformations, setConformations] = useState([]);
  const [activeConformation, setActiveConformation] = useState(null);
  const [jobError, setJobError] = useState(null);
  const [jobId, setJobId] = useState(null);

  const abortRef = useRef(null);
  const pollTimerRef = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }
      if (pollTimerRef.current != null) {
        clearTimeout(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, []);

  const clearPoll = useCallback(() => {
    if (pollTimerRef.current != null) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    clearPoll();
    setStep('idle');
    setSelectedFragment(null);
    setConformations([]);
    setActiveConformation(null);
    setJobError(null);
    setJobId(null);
  }, [clearPoll]);

  const selectFragment = useCallback((f) => {
    setSelectedFragment(f);
  }, []);

  const setActiveConformationCb = useCallback((c) => {
    setActiveConformation(c);
  }, []);

  const submitDocking = useCallback(
    async (pocketId, proteinPdbId) => {
      if (!selectedFragment?.smiles || !proteinPdbId) return;

      clearPoll();
      if (abortRef.current) {
        abortRef.current.abort();
      }
      abortRef.current = new AbortController();
      const { signal } = abortRef.current;

      setStep('running');
      setJobError(null);

      const submitTimeoutMs = 60000;
      const submitTimeout = setTimeout(() => abortRef.current?.abort(), submitTimeoutMs);

      try {
        const res = await fetch(`${apiBase}/dock`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal,
          body: JSON.stringify({
            pocket_id: pocketId,
            ligand_smiles: selectedFragment.smiles,
            protein_pdb_id: proteinPdbId,
          }),
        });
        clearTimeout(submitTimeout);

        if (!mountedRef.current) return;

        if (res.status !== 202) {
          const text = await res.text();
          setJobError(text || `HTTP ${res.status}`);
          setStep('error');
          return;
        }

        const body = await res.json();
        const id = body.job_id;
        if (!id) {
          setJobError('Missing job_id from server');
          setStep('error');
          return;
        }
        setJobId(id);

        let delay = 2000;
        const maxDelay = 15000;

        const poll = async () => {
          if (!mountedRef.current) return;
          try {
            const st = await fetch(`${apiBase}/dock/status?id=${encodeURIComponent(id)}`, { signal });
            if (!st.ok) {
              const text = await st.text();
              setJobError(text || `HTTP ${st.status}`);
              setStep('error');
              return;
            }
            const result = await st.json();
            const status = result.status;

            if (status === 'done') {
              const confs = normalizeConformations(result);
              if (!confs.length) {
                setJobError('Docking finished but no poses were returned');
                setStep('error');
                return;
              }
              setConformations(confs);
              setActiveConformation(confs[0]);
              setStep('results');
              return;
            }

            if (status === 'error') {
              setJobError(result.error || 'Docking failed');
              setStep('error');
              return;
            }

            delay = Math.min(maxDelay, Math.round(delay * 1.5));
            pollTimerRef.current = setTimeout(poll, delay);
          } catch (e) {
            if (!mountedRef.current || e.name === 'AbortError') return;
            setJobError(e.message || String(e));
            setStep('error');
          }
        };

        pollTimerRef.current = setTimeout(poll, delay);
      } catch (e) {
        clearTimeout(submitTimeout);
        if (!mountedRef.current || e.name === 'AbortError') return;
        setJobError(e.message || String(e));
        setStep('error');
      }
    },
    [apiBase, clearPoll, selectedFragment]
  );

  return {
    step,
    selectedFragment,
    conformations,
    activeConformation,
    jobError,
    jobId,
    selectFragment,
    submitDocking,
    setActiveConformation: setActiveConformationCb,
    reset,
  };
}
