package handlers

import (
	"fmt"
	"strconv"
	"strings"

	"gofr.dev/pkg/gofr"
	gofrHTTP "gofr.dev/pkg/gofr/http"

	"github.com/ProtPocket/models"
	"github.com/ProtPocket/services"
)

// ChemblHandler handles GET /chembl?pocket_id=<int> and optional volume, hydrophobicity, polarity query params
// (from the binding-site table row) to drive ChEMBL fragment selection.
func ChemblHandler(ctx *gofr.Context) (interface{}, error) {
	idStr := ctx.Param("pocket_id")
	if idStr == "" {
		return nil, gofrHTTP.ErrorMissingParam{Params: []string{"pocket_id"}}
	}
	pid, err := strconv.Atoi(idStr)
	if err != nil {
		return nil, gofrHTTP.ErrorInvalidParam{Params: []string{"pocket_id"}}
	}

	pocket, ok := DefaultPocketStore.Get(pid)
	if !ok {
		return nil, gofrHTTP.ErrorEntityNotFound{Name: "pocket", Value: fmt.Sprintf("%d", pid)}
	}

	pocket = applyPocketQueryOverrides(pocket, ctx.Param("volume"), ctx.Param("hydrophobicity"), ctx.Param("polarity"))
	return services.FetchFragments(pocket), nil
}

func applyPocketQueryOverrides(p models.Pocket, volStr, hydroStr, polStr string) models.Pocket {
	if v, ok := parseQueryFloat(volStr); ok {
		p.Volume = v
	}
	if h, ok := parseQueryFloat(hydroStr); ok {
		p.Hydrophobicity = h
	}
	if pol, ok := parseQueryFloat(polStr); ok {
		p.Polarity = pol
	}
	return p
}

func parseQueryFloat(s string) (float64, bool) {
	s = strings.TrimSpace(s)
	if s == "" {
		return 0, false
	}
	v, err := strconv.ParseFloat(s, 64)
	if err != nil {
		return 0, false
	}
	return v, true
}
