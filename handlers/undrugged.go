package handlers

import (
	"fmt"
	"strconv"

	"gofr.dev/pkg/gofr"

	"github.com/ProtPocket/models"
	"github.com/ProtPocket/services"
)

// UndruggedHandler handles GET /undrugged?limit={n}&filter={category}
//
// Query params:
//
//	limit  - number of results to return (default: 25, max: 50)
//	filter - one of: "all", "who_pathogen", "human_disease" (default: "all")
//
// Fetches live data from ChEMBL, UniProt, and AlphaFold APIs. Results are
// cached server-side for 1 hour to keep latency manageable.
func UndruggedHandler(ctx *gofr.Context) (interface{}, error) {
	limitStr := ctx.Param("limit")
	filter := ctx.Param("filter")

	limit := 25
	if limitStr != "" {
		parsed, err := strconv.Atoi(limitStr)
		if err == nil && parsed > 0 && parsed <= 50 {
			limit = parsed
		}
	}
	if filter == "" {
		filter = "all"
	}

	allTargets, err := services.FetchUndrugged()
	if err != nil {
		return nil, fmt.Errorf("failed to fetch undrugged targets: %w", err)
	}

	// Filter by category
	var filtered []models.Complex
	for _, c := range allTargets {
		if filter == "all" || c.Category == filter {
			filtered = append(filtered, c)
		}
	}

	// Already sorted by gap score descending from the service layer.
	// Cap at limit.
	if len(filtered) > limit {
		filtered = filtered[:limit]
	}

	return map[string]interface{}{
		"filter":  filter,
		"count":   len(filtered),
		"results": filtered,
	}, nil
}
