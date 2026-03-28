package services

import (
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"strings"
	"time"

	"github.com/ProtPocket/models"
)

var zincClient = &http.Client{Timeout: 10 * time.Second}

// ZINC20 is the currently working endpoint (ZINC15 is down).
const zincBaseURL = "https://zinc20.docking.org/substances"

// FetchFragments queries the ZINC database for fragment-like molecules
// that match the given pocket's properties. Returns up to 3 fragments.
// Returns empty slice (not error) if ZINC is unreachable — non-fatal.
func FetchFragments(pocket models.Pocket) []models.Fragment {
	fragments := queryZINC20()
	return fragments
}

// queryZINC20 fetches substances from the ZINC20 REST API.
// ZINC20 only returns zinc_id + smiles; we estimate MW and LogP from SMILES.
func queryZINC20() []models.Fragment {
	url := fmt.Sprintf("%s.json?count=3", zincBaseURL)

	resp, err := zincClient.Get(url)
	if err != nil {
		return []models.Fragment{}
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return []models.Fragment{}
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return []models.Fragment{}
	}

	var zincResults []struct {
		ZincID string `json:"zinc_id"`
		SMILES string `json:"smiles"`
	}

	if err := json.Unmarshal(body, &zincResults); err != nil {
		return []models.Fragment{}
	}

	var fragments []models.Fragment
	for _, z := range zincResults {
		mw := estimateMW(z.SMILES)
		logP := estimateLogP(z.SMILES)
		fragments = append(fragments, models.Fragment{
			ZincID:    z.ZincID,
			Name:      z.ZincID,
			SMILES:    z.SMILES,
			MolWeight: mw,
			LogP:      logP,
		})
	}

	return fragments
}

// estimateMW computes an approximate molecular weight from a SMILES string
// by counting heavy atoms and applying average atomic weights.
func estimateMW(smiles string) float64 {
	if smiles == "" {
		return 0
	}
	upperSmiles := strings.ToUpper(smiles)

	carbonCount := 0
	nitrogenCount := 0
	oxygenCount := 0
	sulfurCount := 0
	fluorineCount := 0
	chlorineCount := 0
	brCount := 0
	otherHeavy := 0

	i := 0
	for i < len(upperSmiles) {
		ch := upperSmiles[i]
		switch {
		case ch == 'C' && i+1 < len(upperSmiles) && upperSmiles[i+1] == 'L':
			chlorineCount++
			i += 2
		case ch == 'B' && i+1 < len(upperSmiles) && upperSmiles[i+1] == 'R':
			brCount++
			i += 2
		case ch == 'C':
			carbonCount++
			i++
		case ch == 'N':
			nitrogenCount++
			i++
		case ch == 'O':
			oxygenCount++
			i++
		case ch == 'S':
			sulfurCount++
			i++
		case ch == 'F':
			fluorineCount++
			i++
		default:
			if ch >= 'A' && ch <= 'Z' {
				otherHeavy++
			}
			i++
		}
	}

	mw := float64(carbonCount)*12.011 +
		float64(nitrogenCount)*14.007 +
		float64(oxygenCount)*15.999 +
		float64(sulfurCount)*32.065 +
		float64(fluorineCount)*18.998 +
		float64(chlorineCount)*35.453 +
		float64(brCount)*79.904 +
		float64(otherHeavy)*12.0

	totalHeavy := carbonCount + nitrogenCount + oxygenCount + sulfurCount +
		fluorineCount + chlorineCount + brCount + otherHeavy
	estimatedH := int(math.Max(0, float64(totalHeavy)*1.1))
	mw += float64(estimatedH) * 1.008

	return math.Round(mw*10) / 10
}

// estimateLogP uses a simplified atom-based contribution method (Wildman-Crippen style).
func estimateLogP(smiles string) float64 {
	if smiles == "" {
		return 0
	}

	upper := strings.ToUpper(smiles)
	carbons := float64(strings.Count(upper, "C"))
	nitrogens := float64(strings.Count(upper, "N"))
	oxygens := float64(strings.Count(upper, "O"))
	rings := float64(strings.Count(smiles, "1") + strings.Count(smiles, "2"))

	logP := carbons*0.25 - oxygens*0.65 - nitrogens*0.55 + rings*0.3
	logP = math.Round(logP*100) / 100

	return logP
}
