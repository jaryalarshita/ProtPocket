package scoring

import "math"

// WHOPathogenOrganismIDs is the hardcoded list of NCBI taxonomy IDs for
// WHO priority pathogens (2024 list). DO NOT modify without checking the
// official WHO list: https://www.who.int/publications/i/item/9789240093461
var WHOPathogenOrganismIDs = map[int]bool{
    // CRITICAL PRIORITY
    83332:  true, // Mycobacterium tuberculosis
    573:    true, // Klebsiella pneumoniae
    470:    true, // Acinetobacter baumannii
    287:    true, // Pseudomonas aeruginosa
    1280:   true, // Staphylococcus aureus (MRSA)
    // HIGH PRIORITY
    1352:   true, // Enterococcus faecium
    85962:  true, // Helicobacter pylori
    90370:  true, // Salmonella typhi
    1613:   true, // Listeria monocytogenes
    1423:   true, // Bacillus cereus
    // MEDIUM PRIORITY
    1351:   true, // Enterococcus faecalis
    1282:   true, // Staphylococcus epidermidis
    216816: true, // Bifidobacterium longum (gut pathogen)
    1301:   true, // Streptococcus pyogenes
    1314:   true, // Streptococcus pneumoniae
}

// IsWHOPathogen returns true if the organism is on the WHO priority pathogen list.
func IsWHOPathogen(organismID int) bool {
    return WHOPathogenOrganismIDs[organismID]
}

// ComputeGapScore calculates the gap score for a complex.
// Formula: plddt_norm × undrugged_factor × who_multiplier + disorder_bonus
//
// Parameters:
//   dimerPLDDT    - average pLDDT of the complex (0-100). Use monomer if complex unavailable.
//   drugCount     - number of approved drugs. Use -1 if unknown.
//   maxDrugCount  - maximum drug_count in the current dataset (for normalization).
//   isWHOPathogen - whether organism is on WHO priority list.
//   disorderDelta - dimer_plddt_avg minus monomer_plddt_avg.
func ComputeGapScore(dimerPLDDT float64, drugCount int, maxDrugCount int, isWHOPathogen bool, disorderDelta float64) float64 {
    // pLDDT normalization
    plddtNorm := dimerPLDDT / 100.0

    // Undrugged factor
    var undruggedFactor float64
    switch {
    case drugCount == -1:
        undruggedFactor = 0.5 // unknown coverage
    case drugCount == 0:
        undruggedFactor = 1.0 // fully undrugged
    default:
        denominator := math.Max(float64(maxDrugCount), 1.0)
        undruggedFactor = 1.0 - (float64(drugCount) / denominator)
    }

    // WHO multiplier
    whoMultiplier := 1.0
    if isWHOPathogen {
        whoMultiplier = 2.0
    }

    // Disorder bonus (only positive delta contributes)
    disorderBonus := 0.0
    if disorderDelta > 0 {
        disorderBonus = disorderDelta / 100.0
    }

    rawScore := plddtNorm*undruggedFactor*whoMultiplier + disorderBonus

    // Round to 4 decimal places
    return math.Round(rawScore*10000) / 10000
}
