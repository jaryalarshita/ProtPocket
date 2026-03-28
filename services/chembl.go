package services

import (
	"compress/gzip"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

var chemblClient = &http.Client{Timeout: 10 * time.Second}

const chemblBaseURL = "https://www.ebi.ac.uk/chembl/api/data"

// ChEMBLTargetSearchResponse matches /target/search.json response shape.
type ChEMBLTargetSearchResponse struct {
	Targets []struct {
		TargetChEMBLID string `json:"target_chembl_id"`
		PreferredName  string `json:"pref_name"`
	} `json:"targets"`
	PageMeta struct {
		TotalCount int `json:"total_count"`
	} `json:"page_meta"`
}

// ChEMBLDrugIndicationResponse matches /drug_indication.json response shape.
type ChEMBLDrugIndicationResponse struct {
	DrugIndications []struct {
		MoleculePrefName string `json:"molecule_pref_name"`
	} `json:"drug_indications"`
	PageMeta struct {
		TotalCount int `json:"total_count"`
	} `json:"page_meta"`
}

// FetchDrugCoverage queries ChEMBL for approved drugs targeting a UniProt protein.
// Returns (drugCount, drugNames, error).
// drugCount = -1 means ChEMBL is unreachable (unknown coverage).
// drugCount = 0 means no approved drugs found (confirmed undrugged).
func FetchDrugCoverage(uniprotID string) (int, []string, error) {
	// Step 1: Resolve UniProt ID → ChEMBL target ID
	targetURL := fmt.Sprintf("%s/target/search.json?q=%s", chemblBaseURL, uniprotID)
	resp, err := chemblClient.Get(targetURL)
	if err != nil {
		// ChEMBL is unreachable — return unknown, not error (do not fail the whole request)
		return -1, []string{}, nil
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return -1, []string{}, nil
	}

	// Handle gzip-compressed responses
	var reader io.Reader = resp.Body
	if resp.Header.Get("Content-Encoding") == "gzip" {
		gr, err := gzip.NewReader(resp.Body)
		if err != nil {
			return -1, []string{}, nil
		}
		defer gr.Close()
		reader = gr
	}

	body, err := io.ReadAll(reader)
	if err != nil {
		return -1, []string{}, nil
	}

	var targetResp ChEMBLTargetSearchResponse
	if err := json.Unmarshal(body, &targetResp); err != nil {
		return -1, []string{}, nil
	}

	if len(targetResp.Targets) == 0 {
		// No ChEMBL entry for this protein — it's undrugged as far as ChEMBL knows
		return 0, []string{}, nil
	}

	chemblID := targetResp.Targets[0].TargetChEMBLID

	// Step 2: Fetch approved drugs (max_phase=4) for this target
	drugURL := fmt.Sprintf("%s/drug_indication.json?target_chembl_id=%s&max_phase=4&limit=10", chemblBaseURL, chemblID)
	resp2, err := chemblClient.Get(drugURL)
	if err != nil {
		return -1, []string{}, nil
	}
	defer resp2.Body.Close()

	if resp2.StatusCode != 200 {
		return -1, []string{}, nil
	}

	// Handle gzip-compressed responses
	var reader2 io.Reader = resp2.Body
	if resp2.Header.Get("Content-Encoding") == "gzip" {
		gr, err := gzip.NewReader(resp2.Body)
		if err != nil {
			return -1, []string{}, nil
		}
		defer gr.Close()
		reader2 = gr
	}

	body2, err := io.ReadAll(reader2)
	if err != nil {
		return -1, []string{}, nil
	}

	var drugResp ChEMBLDrugIndicationResponse
	if err := json.Unmarshal(body2, &drugResp); err != nil {
		return -1, []string{}, nil
	}

	// Deduplicate drug names and cap at 5
	seen := map[string]bool{}
	var drugNames []string
	for _, d := range drugResp.DrugIndications {
		if d.MoleculePrefName != "" && !seen[d.MoleculePrefName] {
			seen[d.MoleculePrefName] = true
			drugNames = append(drugNames, d.MoleculePrefName)
			if len(drugNames) >= 5 {
				break
			}
		}
	}

	return drugResp.PageMeta.TotalCount, drugNames, nil
}
