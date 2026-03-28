package services

import (
	"reflect"
	"testing"

	"github.com/ProtPocket/models"
)

func TestFilterInterfacePockets(t *testing.T) {
	// Mock Monomer pLDDT (JSON)
	monomerPLDDT := map[int]float64{
		1: 80.0,
		2: 70.0,
		3: 85.0, // Used by pocket 2
		4: 90.0,
		5: 90.0,
		6: 90.0, // Used by pocket 1
		7: 95.0,
		8: 95.0,
		9: 95.0, // Used by pocket 3
	}

	// All residues on chain "A" (target chain)
	targetChains := map[string]bool{"A": true}

	pockets := []models.Pocket{
		{PocketID: 1, Score: 0.9, ResidueIndices: []int{4, 5, 6}, ResidueChains: []string{"A", "A", "A"}, LocalPLDDT: map[string]float64{"A:4": 90.0, "A:5": 90.0, "A:6": 90.0}},
		{PocketID: 2, Score: 0.5, ResidueIndices: []int{1, 2, 3}, ResidueChains: []string{"A", "A", "A"}, LocalPLDDT: map[string]float64{"A:1": 90.0, "A:2": 85.0, "A:3": 90.0}},
		{PocketID: 3, Score: 0.8, ResidueIndices: []int{7, 8, 9}, ResidueChains: []string{"A", "A", "A"}, LocalPLDDT: map[string]float64{"A:7": 85.0, "A:8": 85.0, "A:9": 85.0}},
		{PocketID: 4, Score: 0.3, ResidueIndices: []int{1, 4, 7}, ResidueChains: []string{"A", "A", "A"}, IsInterfacePocket: true, LocalPLDDT: map[string]float64{"A:1": 85.0, "A:4": 90.0, "A:7": 90.0}},
	}

	filtered := FilterInterfacePockets(pockets, monomerPLDDT, targetChains, MaxPockets)

	if len(filtered) != 4 {
		t.Fatalf("expected 4 pockets back, got %d", len(filtered))
	}

	if filtered[0].PocketID != 4 {
		t.Errorf("expected pocket 4 to be ranked first, got pocket %d", filtered[0].PocketID)
	}

	if filtered[3].AvgDelta != 10.0 {
		t.Errorf("expected pocket 2 avg delta 10.0, got %f", filtered[3].AvgDelta)
	}

	expectedOrder := []int{4, 1, 3, 2}
	var actualOrder []int
	for _, p := range filtered {
		actualOrder = append(actualOrder, p.PocketID)
	}

	if !reflect.DeepEqual(actualOrder, expectedOrder) {
		t.Errorf("expected sort order %v, got %v", expectedOrder, actualOrder)
	}
}
