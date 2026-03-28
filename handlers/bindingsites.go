package handlers

import (
	"fmt"
	"sync"
	"time"

	"gofr.dev/pkg/gofr"

	"github.com/ProtPocket/models"
	"github.com/ProtPocket/services"
)

// bindingSiteCache stores computed binding site results to avoid re-running
// fpocket for the same protein. TTL: 1 hour.
var (
	bsCache    = make(map[string]bsCacheEntry)
	bsCacheMu  sync.RWMutex
	bsCacheTTL = 1 * time.Hour
)

type bsCacheEntry struct {
	result    *models.BindingSiteResult
	timestamp time.Time
}

// BindingSiteHandler handles GET /complex/{id}/binding-sites
// Runs the full pipeline: fpocket → pLDDT cross-reference → fragment suggestion
func BindingSiteHandler(ctx *gofr.Context) (interface{}, error) {
	id := ctx.PathParam("id")
	if id == "" {
		return nil, fmt.Errorf("path parameter 'id' is required")
	}

	uniprotID := normalizeToUniProtID(id)
	
	// Adjust cache key
	cacheKey := uniprotID

	// Check cache first (Bypassed temporarily for testing fixes)
	/*
	bsCacheMu.RLock()
	if entry, ok := bsCache[cacheKey]; ok && time.Since(entry.timestamp) < bsCacheTTL {
		bsCacheMu.RUnlock()
		return entry.result, nil
	}
	bsCacheMu.RUnlock()
	*/

	// Step 1: Get complex data (CIF/PDB URLs, entry IDs)
	afData, err := services.FetchComplexData(uniprotID)
	if err != nil {
		return nil, fmt.Errorf("binding sites: failed to fetch complex data: %w", err)
	}



	// Step 2: Run fpocket concurrently on both structures
	var wg sync.WaitGroup
	var pockets, monomerPockets []models.Pocket
	var complexErr, monomerErr error

	if afData.ComplexCifURL != "" {
		wg.Add(1)
		go func() {
			defer wg.Done()
			pockets, complexErr = services.RunFpocket(afData.ComplexCifURL)
		}()
	}
	
	if afData.MonomerCifURL != "" {
		wg.Add(1)
		go func() {
			defer wg.Done()
			monomerPockets, monomerErr = services.RunFpocket(afData.MonomerCifURL)
		}()
	}
	wg.Wait()

	if complexErr != nil {
		return nil, fmt.Errorf("binding sites: complex fpocket failed: %w", complexErr)
	}
	if monomerErr != nil {
		return nil, fmt.Errorf("binding sites: monomer fpocket failed: %w", monomerErr)
	}

	if len(pockets) == 0 && len(monomerPockets) == 0 {
		result := &models.BindingSiteResult{
			UniprotID:           uniprotID,
			ComplexEntryID:      afData.ComplexEntryID,
			TotalPockets:        0,
			InterfaceCount:      0,
			Pockets:             []models.Pocket{},
			MonomerTotalPockets: 0,
			MonomerPockets:      []models.Pocket{},
		}
		cacheResult(cacheKey, result)
		return result, nil
	}

	// Step 3: Fetch monomer JSON pLDDT data
	monomerPLDDT, err := services.FetchMonomerPLDDT(afData.MonomerEntryID)
	if err != nil {
		// Non-fatal: proceed without pLDDT delta calculations
		monomerPLDDT = nil
	}

	// Step 3b: Determine which chains in the complex correspond to the monomer
	// by comparing residue counts. The monomer chain has ≤ monomerPLDDT residues.
	targetChains := make(map[string]bool)
	if monomerPLDDT != nil && len(pockets) > 0 {
		// Collect all unique chains from dimer pockets and pick ones where
		// residue indices overlap with the monomer pLDDT map
		chainHits := make(map[string]int)
		chainTotal := make(map[string]int)
		for _, p := range pockets {
			for j, idx := range p.ResidueIndices {
				if j < len(p.ResidueChains) {
					ch := p.ResidueChains[j]
					chainTotal[ch]++
					if _, ok := monomerPLDDT[idx]; ok {
						chainHits[ch]++
					}
				}
			}
		}
		// A chain is a target if >50% of its residues map to monomer indices
		for ch, total := range chainTotal {
			if total > 0 && float64(chainHits[ch])/float64(total) > 0.5 {
				targetChains[ch] = true
			}
		}
		// Fallback: if no chains matched, mark all as targets
		if len(targetChains) == 0 {
			for ch := range chainTotal {
				targetChains[ch] = true
			}
		}
	}

	// Step 4: Compute pLDDT Delta for complex pockets using their native PDB B-factors
	if monomerPLDDT != nil {
		pockets = services.FilterInterfacePockets(pockets, monomerPLDDT, targetChains, -1)
	}
	totalPockets := len(pockets)

	// Step 4b: No interface logic for monomer
	monomerTotalPockets := len(monomerPockets)
	if monomerPLDDT != nil {
		for i := range monomerPockets {
			monomerPockets[i].ResidueConfidences = make([]models.ResidueConfidence, 0, len(monomerPockets[i].ResidueIndices))
			var sum float64
			var count int
			for j, idx := range monomerPockets[i].ResidueIndices {
				chain := ""
				if j < len(monomerPockets[i].ResidueChains) {
					chain = monomerPockets[i].ResidueChains[j]
				}
				plddt := 0.0
				if val, ok := monomerPLDDT[idx]; ok {
					plddt = val
					sum += val
					count++
				}
				monomerPockets[i].ResidueConfidences = append(monomerPockets[i].ResidueConfidences, models.ResidueConfidence{
					ResidueIndex: idx,
					Chain:        chain,
					MonomerPLDDT: plddt,
					DimerPLDDT:   plddt,
					Delta:        0.0,
				})
			}
			if count > 0 {
				monomerPockets[i].AvgPLDDT = sum / float64(count)
			}
		}
	}

	// Step 5: Fetch fragment suggestions concurrently
	var fragWg sync.WaitGroup
	
	for i := range pockets {
		fragWg.Add(1)
		go func(idx int) {
			defer fragWg.Done()
			pockets[idx].Fragments = services.FetchFragments(pockets[idx])
		}(i)
	}

	for i := range monomerPockets {
		fragWg.Add(1)
		go func(idx int) {
			defer fragWg.Done()
			monomerPockets[idx].Fragments = services.FetchFragments(monomerPockets[idx])
		}(i)
	}
	fragWg.Wait()

	DefaultPocketStore.RegisterBindingSitesResult(pockets, monomerPockets)

	// Count interface pockets
	interfaceCount := 0
	for _, p := range pockets {
		if p.IsInterfacePocket {
			interfaceCount++
		}
	}

	result := &models.BindingSiteResult{
		UniprotID:           uniprotID,
		ComplexEntryID:      afData.ComplexEntryID,
		TotalPockets:        totalPockets,
		InterfaceCount:      interfaceCount,
		Pockets:             pockets,
		MonomerTotalPockets: monomerTotalPockets,
		MonomerPockets:      monomerPockets,
	}

	result.Comparison = services.ComparePockets(monomerPockets, pockets, monomerPLDDT, targetChains)

	cacheResult(cacheKey, result)
	return result, nil
}

func cacheResult(uniprotID string, result *models.BindingSiteResult) {
	bsCacheMu.Lock()
	bsCache[uniprotID] = bsCacheEntry{result: result, timestamp: time.Now()}
	bsCacheMu.Unlock()
}
