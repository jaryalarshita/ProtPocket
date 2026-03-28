package services

import (
	"bytes"
	"fmt"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/ProtPocket/models"
)

const (
    dockTimeout = 10 * 60 // seconds
)

// DockResult holds docked ligand conformations
type DockResult struct {
    JobID           string
    PocketID        int
    BindingAffinity float64
    DockedPDBQT     string
    DockedPDB       string
    Status          string
    Error           string
}

// SMILESTo3D generates 3D coordinates from SMILES using OpenBabel
func SMILESTo3D(smiles string, outDir string) (string, error) {
    outPath := filepath.Join(outDir, "ligand_3D.pdb")
    cmd := exec.Command("obabel", "-:"+smiles, "-O", outPath, "--gen3d")
    var stderr bytes.Buffer
    cmd.Stderr = &stderr
    if err := cmd.Run(); err != nil {
        return "", fmt.Errorf("SMILESTo3D: %w (stderr: %s)", err, stderr.String())
    }
    return outPath, nil
}

// PrepareReceptor converts receptor PDB to PDBQT using OpenBabel
func PrepareReceptor(pdbPath, outDir string) (string, error) {
    outPath := filepath.Join(outDir, "receptor.pdbqt")
    // Use -xr (rigid) to prevent ROOT/ENDROOT tags which Vina rejects for receptors
    cmd := exec.Command("obabel", pdbPath, "-O", outPath, "-xr")
    var stderr bytes.Buffer
    cmd.Stderr = &stderr
    if err := cmd.Run(); err != nil {
        return "", fmt.Errorf("PrepareReceptor: %w (stderr: %s)", err, stderr.String())
    }
    return outPath, nil
}

// PrepareLigand converts ligand 3D PDB → PDBQT
func PrepareLigand(pdbPath, outDir string) (string, error) {
    outPath := filepath.Join(outDir, "ligand.pdbqt")
    // Use -ph 7.4 to protonate and -xh to add hydrogens for the ligand
    cmd := exec.Command("obabel", pdbPath, "-O", outPath, "-ph", "7.4", "-xh")
    var stderr bytes.Buffer
    cmd.Stderr = &stderr
    if err := cmd.Run(); err != nil {
        return "", fmt.Errorf("PrepareLigand: %w (stderr: %s)", err, stderr.String())
    }
    return outPath, nil
}

// RunVinaDock docks ligand into receptor using Vina and returns best pose
func RunVinaDock(receptorPDBQT, ligandPDBQT string, pocket models.Pocket, outDir string) (DockResult, error) {
    outPDBQT := filepath.Join(outDir, "docked.pdbqt")
    outPDB := filepath.Join(outDir, "docked.pdb")

    size := 25.0 // Increased size to 25.0 to handle larger interface pockets
    cmd := exec.Command(
        "vina",
        "--receptor", receptorPDBQT,
        "--ligand", ligandPDBQT,
        "--center_x", fmt.Sprintf("%.3f", pocket.Center[0]),
        "--center_y", fmt.Sprintf("%.3f", pocket.Center[1]),
        "--center_z", fmt.Sprintf("%.3f", pocket.Center[2]),
        "--size_x", fmt.Sprintf("%.3f", size),
        "--size_y", fmt.Sprintf("%.3f", size),
        "--size_z", fmt.Sprintf("%.3f", size),
        "--exhaustiveness", "16",
        "--cpu", "4",
        "--out", outPDBQT,
    )
    var stdout, stderr bytes.Buffer
    cmd.Stdout = &stdout
    cmd.Stderr = &stderr

    if err := cmd.Run(); err != nil {
        return DockResult{}, fmt.Errorf("RunVinaDock: %w (stderr: %s)", err, stderr.String())
    }

    // Convert docked PDBQT to PDB for visualization
    cmd2 := exec.Command("obabel", outPDBQT, "-O", outPDB)
    var stderr2 bytes.Buffer
    cmd2.Stderr = &stderr2
    if err := cmd2.Run(); err != nil {
        return DockResult{}, fmt.Errorf("PDBQT to PDB: %w (stderr: %s)", err, stderr2.String())
    }

    // Parse binding affinity from Vina output
    affinity := parseVinaAffinity(stdout.String())

    return DockResult{
        PocketID:        pocket.PocketID,
        DockedPDBQT:     outPDBQT,
        DockedPDB:       outPDB,
        BindingAffinity: affinity,
        Status:          "done",
    }, nil
}

// parseVinaAffinity extracts first docking pose affinity
func parseVinaAffinity(out string) float64 {
    lines := strings.Split(out, "\n")
    for _, l := range lines {
        l = strings.TrimSpace(l)
        if strings.HasPrefix(l, "1") { // first mode
            fields := strings.Fields(l)
            if len(fields) >= 2 {
                if aff, err := strconv.ParseFloat(fields[1], 64); err == nil {
                    return aff
                }
            }
        }
    }
    return 0
}