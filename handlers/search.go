package handlers

import (
	"fmt"
	"sort"
	"sync"

	"gofr.dev/pkg/gofr"

	"github.com/ProtPocket/data"
	"github.com/ProtPocket/models"
	"github.com/ProtPocket/scoring"
	"github.com/ProtPocket/services"
)

// SearchHandler handles GET /search?q={query}
// Query can be: protein name, gene name, disease name, or organism name.
//
// Behavior:
// 1. Try to find matches in hero_complexes.json first (instant, no API calls)
// 2. If no hero matches, attempt live AlphaFold + ChEMBL + UniProt pipeline
// 3. If live pipeline fails, return hero matches with source="fallback"
// 4. Always return source field: "live" or "fallback"
func SearchHandler(ctx *gofr.Context) (interface{}, error) {
	query := ctx.Param("q")
	if query == "" {
		return nil, fmt.Errorf("query parameter 'q' is required")
	}

	// Load hero complexes (always available — embedded in binary)
	heroComplexes, err := data.LoadHeroComplexes()
	if err != nil {
		// This should never happen unless hero_complexes.json is malformed
		return nil, fmt.Errorf("critical: failed to load hero complexes: %w", err)
	}

	// Search hero complexes first
	heroMatches := data.FindHeroByGeneOrProtein(query, heroComplexes)

	// Attempt live search via UniProt
	liveResults, liveErr := performLiveSearch(query)

	if liveErr != nil {
		// Live search API failed — use hero fallback
		source := "fallback"
		if len(heroMatches) == 0 {
			source = "no_results"
		}
		sortByGapScore(heroMatches)
		return models.SearchResult{
			Query:   query,
			Count:   len(heroMatches),
			Source:  source,
			Results: heroMatches,
		}, nil
	}

	// Live search succeeded (even if results are empty). Merge with any hero matches (deduplicated by uniprot_id)

	// Live search succeeded (even if results are empty). Merge with any hero matches (deduplicated by uniprot_id)
	merged := mergeResults(liveResults, heroMatches)
	sortByGapScore(merged)

	return models.SearchResult{
		Query:   query,
		Count:   len(merged),
		Source:  "live",
		Results: merged,
	}, nil
}

// performLiveSearch queries UniProt for matching protein IDs, then enriches
// each with AlphaFold and ChEMBL data concurrently.
func performLiveSearch(query string) ([]models.Complex, error) {
	// Get UniProt IDs matching the query (max 10 results)
	uniprotIDs, err := services.SearchUniProt(query, 10)
	if err != nil || len(uniprotIDs) == 0 {
		return nil, err
	}

	// Enrich each UniProt ID concurrently
	var mu sync.Mutex
	var wg sync.WaitGroup
	var results []models.Complex
	maxDrugCount := 0

	for _, uid := range uniprotIDs {
		wg.Add(1)
		go func(uniprotID string) {
			defer wg.Done()

			c, err := buildComplexFromUniProt(uniprotID)
			if err != nil {
				// Log but don't fail — one bad protein shouldn't kill the search
				return
			}

			mu.Lock()
			if c.DrugCount > maxDrugCount {
				maxDrugCount = c.DrugCount
			}
			results = append(results, *c)
			mu.Unlock()
		}(uid)
	}
	wg.Wait()

	// Now compute gap scores (requires knowing maxDrugCount across the dataset)
	for i := range results {
		results[i].GapScore = scoring.ComputeGapScore(
			results[i].DimerPLDDTAvg,
			results[i].DrugCount,
			maxDrugCount,
			results[i].IsWHOPathogen,
			results[i].DisorderDelta,
		)
	}

	return results, nil
}

// buildComplexFromUniProt fetches all data for one UniProt ID from external APIs.
// Returns nil + error if AlphaFold has no prediction for this protein.
func buildComplexFromUniProt(uniprotID string) (*models.Complex, error) {
	// Fetch UniProt metadata
	uniEntry, err := services.FetchUniProtEntry(uniprotID)
	if err != nil {
		return nil, err
	}

	// Fetch AlphaFold complex array data
	afData, err := services.FetchComplexData(uniprotID)
	if err != nil {
		return nil, err
	}

	// Fetch drug coverage from ChEMBL (non-fatal if fails)
	drugCount, drugNames, _ := services.FetchDrugCoverage(uniprotID)

	// Determine WHO pathogen status
	isWHO := scoring.IsWHOPathogen(uniEntry.Organism.TaxonID)

	// Extract disease associations from UniProt comments
	var diseases []string
	for _, comment := range uniEntry.Comments {
		if comment.CommentType == "DISEASE" {
			if comment.Disease.DiseaseID != "" {
				diseases = append(diseases, comment.Disease.DiseaseID)
			}
		}
	}

	// Extract gene name safely
	geneName := ""
	if len(uniEntry.Genes) > 0 {
		geneName = uniEntry.Genes[0].GeneName.Value
	}

	// Determine review status from UniProt entry type
	reviewStatus := "unreviewed"
	if uniEntry.EntryType == "Swiss-Prot" {
		reviewStatus = "reviewed"
	}

	c := &models.Complex{
		UniprotID:        uniprotID,
		ProteinName:      uniEntry.ProteinDescription.RecommendedName.FullName.Value,
		GeneName:         geneName,
		Organism:         uniEntry.Organism.ScientificName,
		OrganismID:       uniEntry.Organism.TaxonID,
		IsWHOPathogen:    isWHO,
		DiseaseAssoc:     diseases,
		MonomerPLDDTAvg:  afData.MonomerPLDDT,
		DimerPLDDTAvg:    afData.DimerPLDDT,
		DisorderDelta:    afData.DisorderDelta,
		DrugCount:        drugCount,
		KnownDrugNames:   drugNames,
		MonomerStructURL: afData.MonomerCifURL,
		ComplexStructURL: afData.ComplexCifURL,
		Category:         inferCategory(isWHO, diseases),
		DemoHighlight:    false,
		AlphafoldID:      afData.MonomerEntryID,
		ReviewStatus:     reviewStatus,
		GapScore:         0.0, // Computed after all results gathered
	}

	return c, nil
}

// inferCategory determines the category of a complex based on its properties.
func inferCategory(isWHO bool, diseases []string) string {
	if isWHO {
		return "who_pathogen"
	}
	if len(diseases) > 0 {
		return "human_disease"
	}
	return "high_disorder_delta"
}

// sortByGapScore sorts a slice of Complex in descending order of GapScore.
func sortByGapScore(complexes []models.Complex) {
	sort.Slice(complexes, func(i, j int) bool {
		return complexes[i].GapScore > complexes[j].GapScore
	})
}

// mergeResults combines live results and hero matches, deduplicating by UniprotID.
// Live results take precedence over hero data for the same protein.
func mergeResults(live, hero []models.Complex) []models.Complex {
	seen := map[string]bool{}
	var merged []models.Complex
	for _, c := range live {
		seen[c.UniprotID] = true
		merged = append(merged, c)
	}
	for _, c := range hero {
		if !seen[c.UniprotID] {
			merged = append(merged, c)
		}
	}
	return merged
}
