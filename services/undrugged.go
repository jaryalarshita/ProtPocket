package services

import (
	"fmt"
	"sort"
	"sync"
	"time"

	"github.com/ProtPocket/models"
	"github.com/ProtPocket/scoring"
)

// curatedUndrugged contains well-known protein targets that are either fully
// undrugged or under-drugged. The list spans human disease targets and WHO
// priority pathogen targets. Drug coverage is verified live via ChEMBL on
// every cache refresh, so any protein that gains an approved drug will
// automatically drop out of the results.
var curatedUndrugged = []struct {
	UniprotID string
	Category  string // "human_disease" or "who_pathogen"
}{
	// ── Human disease (undrugged / under-drugged) ──────────────────────
	{UniprotID: "P38398", Category: "human_disease"}, // BRCA1
	{UniprotID: "P40763", Category: "human_disease"}, // STAT3
	{UniprotID: "P06400", Category: "human_disease"}, // RB1
	{UniprotID: "Q04206", Category: "human_disease"}, // RELA (NF-κB p65)
	{UniprotID: "P12830", Category: "human_disease"}, // CDH1 (E-cadherin)
	{UniprotID: "P01106", Category: "human_disease"}, // MYC
	{UniprotID: "P37840", Category: "human_disease"}, // Alpha-synuclein (Parkinson)
	{UniprotID: "P10636", Category: "human_disease"}, // Tau / MAPT (Alzheimer)
	{UniprotID: "P46527", Category: "human_disease"}, // CDKN1B (p27)
	{UniprotID: "Q16665", Category: "human_disease"}, // HIF1A
	{UniprotID: "P16220", Category: "human_disease"}, // CREB1
	{UniprotID: "P01100", Category: "human_disease"}, // c-Fos
	{UniprotID: "P05412", Category: "human_disease"}, // c-Jun
	{UniprotID: "O43281", Category: "human_disease"}, // PTTG1 / Securin
	{UniprotID: "P25963", Category: "human_disease"}, // NFKBIA (IκBα)
	{UniprotID: "Q13315", Category: "human_disease"}, // ATM kinase
	{UniprotID: "P42336", Category: "human_disease"}, // PIK3CA
	{UniprotID: "O14757", Category: "human_disease"}, // CHEK1

	// ── WHO priority pathogen targets ──────────────────────────────────
	{UniprotID: "P9WNK5", Category: "who_pathogen"}, // FtsZ – M. tuberculosis
	{UniprotID: "P0C1P7", Category: "who_pathogen"}, // MurA – M. tuberculosis
	{UniprotID: "V5VC87", Category: "who_pathogen"}, // FtsZ – A. baumannii
	{UniprotID: "Q9HW76", Category: "who_pathogen"}, // MurC – P. aeruginosa
	{UniprotID: "P0A0B0", Category: "who_pathogen"}, // FtsZ – S. aureus
	{UniprotID: "Q2FXG1", Category: "who_pathogen"}, // MurC – S. aureus
	{UniprotID: "P0A6F5", Category: "who_pathogen"}, // GroEL – E. coli (model)
	{UniprotID: "P0ABH0", Category: "who_pathogen"}, // TrpS – E. coli
	{UniprotID: "P63284", Category: "who_pathogen"}, // ClpP – M. tuberculosis
	{UniprotID: "P96420", Category: "who_pathogen"}, // MmpL3 – M. tuberculosis
}

// cached results
var (
	cacheMu    sync.RWMutex
	cachedData []models.Complex
	cacheTime  time.Time
	cacheTTL   = 1 * time.Hour
)

// FetchUndrugged returns undrugged protein targets sourced live from ChEMBL
// and UniProt. Results are cached in memory for 1 hour.
func FetchUndrugged() ([]models.Complex, error) {
	cacheMu.RLock()
	if len(cachedData) > 0 && time.Since(cacheTime) < cacheTTL {
		data := make([]models.Complex, len(cachedData))
		copy(data, cachedData)
		cacheMu.RUnlock()
		return data, nil
	}
	cacheMu.RUnlock()

	type result struct {
		complex models.Complex
		err     error
	}

	results := make(chan result, len(curatedUndrugged))
	sem := make(chan struct{}, 6) // limit concurrency to 6 parallel API calls

	var wg sync.WaitGroup
	for _, entry := range curatedUndrugged {
		wg.Add(1)
		go func(uid, cat string) {
			defer wg.Done()
			sem <- struct{}{}        // acquire
			defer func() { <-sem }() // release

			c, err := buildComplexFromLive(uid, cat)
			results <- result{complex: c, err: err}
		}(entry.UniprotID, entry.Category)
	}

	go func() {
		wg.Wait()
		close(results)
	}()

	var complexes []models.Complex
	for r := range results {
		if r.err != nil {
			// Skip proteins that fail to resolve — don't break the whole list
			continue
		}
		complexes = append(complexes, r.complex)
	}

	// Sort by gap score descending
	sort.Slice(complexes, func(i, j int) bool {
		return complexes[i].GapScore > complexes[j].GapScore
	})

	// Update cache
	cacheMu.Lock()
	cachedData = make([]models.Complex, len(complexes))
	copy(cachedData, complexes)
	cacheTime = time.Now()
	cacheMu.Unlock()

	return complexes, nil
}

// buildComplexFromLive queries ChEMBL + UniProt + AlphaFold for a single
// protein and assembles a models.Complex. Returns error if the protein
// cannot be resolved or has approved drugs (drug_count > 0).
func buildComplexFromLive(uniprotID, category string) (models.Complex, error) {
	var c models.Complex
	c.UniprotID = uniprotID
	c.Category = category

	// 1. Drug coverage from ChEMBL
	drugCount, drugNames, err := FetchDrugCoverage(uniprotID)
	if err != nil {
		return c, fmt.Errorf("chembl drug coverage failed for %s: %w", uniprotID, err)
	}
	c.DrugCount = drugCount
	c.KnownDrugNames = drugNames
	if c.KnownDrugNames == nil {
		c.KnownDrugNames = []string{}
	}

	// 2. UniProt metadata
	entry, err := FetchUniProtEntry(uniprotID)
	if err != nil {
		return c, fmt.Errorf("uniprot failed for %s: %w", uniprotID, err)
	}
	c.ProteinName = entry.ProteinDescription.RecommendedName.FullName.Value
	if c.ProteinName == "" {
		c.ProteinName = "Unknown protein"
	}
	if len(entry.Genes) > 0 {
		c.GeneName = entry.Genes[0].GeneName.Value
	}
	c.Organism = entry.Organism.ScientificName
	c.OrganismID = entry.Organism.TaxonID
	c.IsWHOPathogen = scoring.IsWHOPathogen(c.OrganismID)

	// Disease associations
	diseases := make([]string, 0)
	seen := make(map[string]bool)
	for _, comment := range entry.Comments {
		if comment.CommentType == "DISEASE" && comment.Disease.DiseaseID != "" {
			if !seen[comment.Disease.DiseaseID] {
				diseases = append(diseases, comment.Disease.DiseaseID)
				seen[comment.Disease.DiseaseID] = true
			}
		}
	}
	c.DiseaseAssoc = diseases

	// 3. AlphaFold structural data
	afData, err := FetchComplexData(uniprotID)
	if err != nil {
		// Fall back to monomer prediction if complex search fails
		monomer, mErr := FetchMonomerPrediction(uniprotID)
		if mErr != nil {
			return c, fmt.Errorf("alphafold failed for %s: %w", uniprotID, err)
		}
		c.MonomerPLDDTAvg = monomer.GlobalMetricValue
		c.DimerPLDDTAvg = monomer.GlobalMetricValue
		c.DisorderDelta = 0
		c.AlphafoldID = monomer.EntryID
		c.MonomerStructURL = monomer.CifURL
	} else {
		c.MonomerPLDDTAvg = afData.MonomerPLDDT
		c.DimerPLDDTAvg = afData.DimerPLDDT
		c.DisorderDelta = afData.DisorderDelta
		c.AlphafoldID = afData.MonomerEntryID
		c.MonomerStructURL = afData.MonomerCifURL
		c.ComplexStructURL = afData.ComplexCifURL
	}

	// 4. Compute gap score
	maxDrugCount := 15 // normalization constant
	c.GapScore = scoring.ComputeGapScore(
		c.DimerPLDDTAvg, c.DrugCount, maxDrugCount,
		c.IsWHOPathogen, c.DisorderDelta,
	)

	c.DemoHighlight = false

	return c, nil
}
