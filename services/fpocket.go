package services

import (
	"bufio"
	"context"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/ProtPocket/models"
)

var fpocketClient = &http.Client{Timeout: 30 * time.Second}

// RunFpocket downloads a structure file from the given URL, runs fpocket on it,
// parses the output, and returns a list of identified pockets sorted by
// druggability score descending.
//
// fpocket requires PDB format. If the URL points to a .cif file, we first
// try downloading the .pdb variant (same base URL, different extension).
// This works because AlphaFold serves both formats for most entries.
func RunFpocket(structureURL string) ([]models.Pocket, error) {
	if structureURL == "" {
		return nil, fmt.Errorf("fpocket: empty structure URL")
	}

	// Create a local tmp directory because snap-installed fpocket cannot access /tmp
	localTmpParent := "./tmp"
	if err := os.MkdirAll(localTmpParent, 0755); err != nil {
		return nil, fmt.Errorf("fpocket: failed to create local tmp dir: %w", err)
	}

	// Create isolated temp directory for this run inside our local tmp
	tmpDir, err := os.MkdirTemp(localTmpParent, "fpocket-*")
	if err != nil {
		return nil, fmt.Errorf("fpocket: failed to create run dir: %w", err)
	}
	defer os.RemoveAll(tmpDir)

	// Determine URLs to try — always prefer PDB (fpocket's native format)
	isCif := strings.HasSuffix(strings.ToLower(structureURL), ".cif")
	var pdbURL string
	if isCif {
		// Replace .cif (case-insensitive) with .pdb
		pdbURL = structureURL[:len(structureURL)-4] + ".pdb"
	} else {
		pdbURL = structureURL
	}

	// Attempt 1: Download PDB
	structurePath := filepath.Join(tmpDir, "structure.pdb")
	fmt.Printf("[fpocket] Trying PDB download: %s\n", pdbURL)
	err = downloadAndVerify(pdbURL, structurePath)

	// Attempt 2: Fall back to CIF if PDB failed
	if err != nil && isCif {
		fmt.Printf("[fpocket] PDB failed (%v), trying CIF: %s\n", err, structureURL)
		structurePath = filepath.Join(tmpDir, "structure.cif")
		err = downloadAndVerify(structureURL, structurePath)
	}

	if err != nil {
		return nil, fmt.Errorf("fpocket: download failed: %w", err)
	}

	// Verify file exists on disk before running fpocket
	info, statErr := os.Stat(structurePath)
	if statErr != nil || info.Size() == 0 {
		return nil, fmt.Errorf("fpocket: downloaded file missing or empty at %s", structurePath)
	}
	fmt.Printf("[fpocket] File ready: %s (%d bytes)\n", structurePath, info.Size())

	// Run fpocket with 30-second timeout
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	cmd := exec.CommandContext(ctx, "fpocket", "-f", filepath.Base(structurePath))
	cmd.Dir = tmpDir
	output, err := cmd.CombinedOutput()
	if err != nil {
		return nil, fmt.Errorf("fpocket: execution failed: %w. Output: %s", err, string(output))
	}

	// fpocket creates a directory named "structure_out" alongside the input
	outDir := filepath.Join(tmpDir, "structure_out")
	if _, err := os.Stat(outDir); os.IsNotExist(err) {
		return nil, fmt.Errorf("fpocket: output directory not found, fpocket may have found no pockets")
	}

	// Parse the info file for pocket metadata
	infoPath := filepath.Join(outDir, "structure_info.txt")
	pockets, err := parseFpocketInfo(infoPath)
	if err != nil {
		return nil, fmt.Errorf("fpocket: failed to parse info: %w", err)
	}

	// Extract original pLDDTs from the input structure to bypass fpocket's B-factor mutation
	var originalPLDDT map[string]float64
	if strings.HasSuffix(structurePath, ".pdb") {
		originalPLDDT, _ = parseOriginalPDBConfidences(structurePath)
	}
	if originalPLDDT == nil {
		originalPLDDT = make(map[string]float64)
	}

		// Parse individual pocket atom files for residue details
	for i := range pockets {
		pocketAtmPath := filepath.Join(outDir, "pockets", fmt.Sprintf("pocket%d_atm.pdb", pockets[i].PocketID))
		residueIndices, residueNames, chains, resChains, center, _, err := parsePocketAtoms(pocketAtmPath)
		if err != nil {
			// Non-fatal: some pocket files may not exist
			continue
		}
		
		// Use original PLDDT values
		localPLDDT := make(map[string]float64)
		for j, idx := range residueIndices {
			key := fmt.Sprintf("%s:%d", resChains[j], idx)
			localPLDDT[key] = originalPLDDT[key]
		}

		pockets[i].ResidueIndices = residueIndices
		pockets[i].ResidueNames = residueNames
		pockets[i].ResidueChains = resChains
		pockets[i].Chains = chains
		pockets[i].Center = center
		pockets[i].LocalPLDDT = localPLDDT
		pockets[i].IsInterfacePocket = len(chains) > 1

		// Compute raw average pLDDT for this pocket
		var plddtSum float64
		var plddtCount int
		pockets[i].ResidueConfidences = make([]models.ResidueConfidence, 0, len(residueIndices))
		for j, idx := range residueIndices {
			key := fmt.Sprintf("%s:%d", resChains[j], idx)
			val := localPLDDT[key]
			if val > 0 {
				plddtSum += val
				plddtCount++
			}
			pockets[i].ResidueConfidences = append(pockets[i].ResidueConfidences, models.ResidueConfidence{
				ResidueIndex: idx,
				Chain:        resChains[j],
				MonomerPLDDT: val,
				DimerPLDDT:   val,
				Delta:        0.0,
			})
		}
		if plddtCount > 0 {
			pockets[i].AvgPLDDT = plddtSum / float64(plddtCount)
		}
	}

	// Sort by druggability score descending
	sort.Slice(pockets, func(i, j int) bool {
		return pockets[i].Score > pockets[j].Score
	})

	return pockets, nil
}

// downloadAndVerify downloads a URL to a local file path and verifies the
// download produced a non-empty file.
func downloadAndVerify(url, destPath string) error {
	resp, err := fpocketClient.Get(url)
	if err != nil {
		return fmt.Errorf("HTTP request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return fmt.Errorf("HTTP %d for %s", resp.StatusCode, url)
	}

	f, err := os.Create(destPath)
	if err != nil {
		return fmt.Errorf("file create failed: %w", err)
	}

	n, err := io.Copy(f, resp.Body)
	f.Close() // Close immediately so data is flushed to disk
	if err != nil {
		os.Remove(destPath) // Clean up partial file
		return fmt.Errorf("write failed: %w", err)
	}

	if n == 0 {
		os.Remove(destPath)
		return fmt.Errorf("downloaded 0 bytes from %s", url)
	}

	fmt.Printf("[fpocket] Downloaded %d bytes to %s\n", n, destPath)
	return nil
}

// parseFpocketInfo parses fpocket's _info.txt file to extract pocket metadata.
// The info file contains blocks like:
//
//	Pocket 1 :
//	    Score :          0.4523
//	    Druggability Score :   0.312
//	    Number of Alpha Spheres :    35
//	    Total SASA :      234.56
//	    Polar SASA :       89.12
//	    Apolar SASA :     145.44
//	    Volume :          456.78
//	    ...
func parseFpocketInfo(infoPath string) ([]models.Pocket, error) {
	f, err := os.Open(infoPath)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	var pockets []models.Pocket
	var current *models.Pocket
	scanner := bufio.NewScanner(f)

	pocketHeaderRe := regexp.MustCompile(`^Pocket\s+(\d+)\s*:`)
	kvRe := regexp.MustCompile(`^\s+(.+?)\s*:\s+(.+)$`)

	for scanner.Scan() {
		line := scanner.Text()

		// Check for pocket header
		if m := pocketHeaderRe.FindStringSubmatch(line); m != nil {
			id, _ := strconv.Atoi(m[1])
			if current != nil {
				pockets = append(pockets, *current)
			}
			current = &models.Pocket{PocketID: id}
			continue
		}

		if current == nil {
			continue
		}

		// Parse key-value lines
		if m := kvRe.FindStringSubmatch(line); m != nil {
			key := strings.TrimSpace(m[1])
			valStr := strings.TrimSpace(m[2])

			switch key {
			case "Druggability Score":
				current.Score, _ = strconv.ParseFloat(valStr, 64)
			case "Score":
				// Only use if Druggability Score hasn't been set yet
				if current.Score == 0 {
					current.Score, _ = strconv.ParseFloat(valStr, 64)
				}
			case "Volume":
				current.Volume, _ = strconv.ParseFloat(valStr, 64)
			case "Hydrophobicity score":
				current.Hydrophobicity, _ = strconv.ParseFloat(valStr, 64)
			case "Polarity score":
				current.Polarity, _ = strconv.ParseFloat(valStr, 64)
			}
		}
	}

	// Don't forget the last pocket
	if current != nil {
		pockets = append(pockets, *current)
	}

	return pockets, scanner.Err()
}

// parsePocketAtoms parses a pocket{N}_atm.pdb file to extract the unique
// residue indices, residue names, chains, center of mass, and per-residue B-factors.
func parsePocketAtoms(pdbPath string) ([]int, []string, []string, []string, [3]float64, map[string]float64, error) {
	f, err := os.Open(pdbPath)
	if err != nil {
		return nil, nil, nil, nil, [3]float64{}, nil, err
	}
	defer f.Close()

	type ResKey struct {
		Seq int
		Chain string
		Name string
	}
	seenResidues := make(map[string]ResKey)
	seenChains := make(map[string]bool)
	resBfactors := make(map[string][]float64)
	var sumX, sumY, sumZ float64
	atomCount := 0
	scanner := bufio.NewScanner(f)

	for scanner.Scan() {
		line := scanner.Text()
		if len(line) < 54 {
			continue
		}
		recType := strings.TrimSpace(line[:6])
		if recType != "ATOM" && recType != "HETATM" {
			continue
		}

		// PDB format: columns are fixed-width
		// Residue name: columns 17-19, Residue seq number: columns 22-25
		// X: 30-37, Y: 38-45, Z: 46-53
		resName := strings.TrimSpace(line[17:20])
		chainID := strings.TrimSpace(line[21:22])
		resSeqStr := strings.TrimSpace(line[22:26])
		resSeq, err := strconv.Atoi(resSeqStr)
		if err != nil {
			continue
		}
		
		key := fmt.Sprintf("%s:%d", chainID, resSeq)

		seenResidues[key] = ResKey{Seq: resSeq, Chain: chainID, Name: resName}
		if chainID != "" {
			seenChains[chainID] = true
		}

		if len(line) >= 66 {
			bfactor, _ := strconv.ParseFloat(strings.TrimSpace(line[60:66]), 64)
			resBfactors[key] = append(resBfactors[key], bfactor)
		}

		x, _ := strconv.ParseFloat(strings.TrimSpace(line[30:38]), 64)
		y, _ := strconv.ParseFloat(strings.TrimSpace(line[38:46]), 64)
		z, _ := strconv.ParseFloat(strings.TrimSpace(line[46:54]), 64)
		sumX += x
		sumY += y
		sumZ += z
		atomCount++
	}

	if atomCount == 0 {
		return nil, nil, nil, nil, [3]float64{}, nil, fmt.Errorf("no atoms found in %s", pdbPath)
	}

	// Collect unique residues sorted alphabetically by key
	var keys []string
	for k := range seenResidues {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	var indices []int
	var names []string
	var resChains []string
	for _, k := range keys {
		rk := seenResidues[k]
		indices = append(indices, rk.Seq)
		names = append(names, rk.Name)
		resChains = append(resChains, rk.Chain)
	}

	var chains []string
	for ch := range seenChains {
		chains = append(chains, ch)
	}
	sort.Strings(chains)

	localPLDDT := make(map[string]float64)
	for key, bfs := range resBfactors {
		var sum float64
		for _, b := range bfs {
			sum += b
		}
		localPLDDT[key] = sum / float64(len(bfs))
	}

	center := [3]float64{
		sumX / float64(atomCount),
		sumY / float64(atomCount),
		sumZ / float64(atomCount),
	}

	return indices, names, chains, resChains, center, localPLDDT, scanner.Err()
}

// parseOriginalPDBConfidences extracts the true B-factor / pLDDT from the original downloaded PDB.
func parseOriginalPDBConfidences(pdbPath string) (map[string]float64, error) {
	f, err := os.Open(pdbPath)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	resBfactors := make(map[string][]float64)
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := scanner.Text()
		if len(line) < 66 {
			continue
		}
		recType := strings.TrimSpace(line[:6])
		if recType != "ATOM" && recType != "HETATM" {
			continue
		}
		resSeqStr := strings.TrimSpace(line[22:26])
		resSeq, err := strconv.Atoi(resSeqStr)
		if err != nil {
			continue
		}
		chainID := strings.TrimSpace(line[21:22])
		key := fmt.Sprintf("%s:%d", chainID, resSeq)
		
		bfactor, _ := strconv.ParseFloat(strings.TrimSpace(line[60:66]), 64)
		resBfactors[key] = append(resBfactors[key], bfactor)
	}

	plddtMap := make(map[string]float64)
	for key, bfs := range resBfactors {
		var sum float64
		for _, b := range bfs {
			sum += b
		}
		plddtMap[key] = sum / float64(len(bfs))
	}
	return plddtMap, scanner.Err()
}
