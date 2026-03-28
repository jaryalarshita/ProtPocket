package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/ProtPocket/models"
	"github.com/ProtPocket/services"
)

var dockingJobs = services.NewJobStore()

type dockPOSTBody struct {
	PocketID       int    `json:"pocket_id"`
	LigandSMILES   string `json:"ligand_smiles"`
	ProteinPDBPath string `json:"protein_pdb_path"`
	ProteinPDBID   string `json:"protein_pdb_id"`
}

// DockHTTPMiddleware intercepts /dock and /dock/status so POST /dock can return HTTP 202 with a top-level job_id JSON body.
func DockHTTPMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.URL.Path == "/dock" && r.Method == http.MethodPost:
			serveDockSubmit(w, r)
		case r.URL.Path == "/dock/status" && r.Method == http.MethodGet:
			serveDockStatus(w, r)
		default:
			next.ServeHTTP(w, r)
		}
	})
}

// serveDockSubmit validates the dock request body, enqueues a job, and responds with HTTP 202.
func serveDockSubmit(w http.ResponseWriter, r *http.Request) {
	if ct := r.Header.Get("Content-Type"); !strings.Contains(strings.ToLower(ct), "application/json") {
		http.Error(w, `{"error":"Content-Type must be application/json"}`, http.StatusBadRequest)
		return
	}

	var body dockPOSTBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"invalid JSON: %v"}`, err), http.StatusBadRequest)
		return
	}

	proteinPath := strings.TrimSpace(body.ProteinPDBPath)
	if proteinPath == "" {
		proteinPath = strings.TrimSpace(body.ProteinPDBID)
	}
	if body.PocketID <= 0 || strings.TrimSpace(body.LigandSMILES) == "" || proteinPath == "" {
		http.Error(w, `{"error":"pocket_id, ligand_smiles, and protein_pdb_path (or protein_pdb_id) are required"}`, http.StatusBadRequest)
		return
	}

	pocket, ok := DefaultPocketStore.Get(body.PocketID)
	if !ok {
		http.Error(w, fmt.Sprintf(`{"error":"pocket %d not found"}`, body.PocketID), http.StatusNotFound)
		return
	}

	lig := models.Fragment{SMILES: strings.TrimSpace(body.LigandSMILES)}
	jobID := dockingJobs.Submit(pocket, lig, proteinPath)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusAccepted)
	_ = json.NewEncoder(w).Encode(map[string]string{"job_id": jobID})
}

// serveDockStatus returns the current DockingResult for a job id query parameter.
func serveDockStatus(w http.ResponseWriter, r *http.Request) {
	id := r.URL.Query().Get("id")
	if id == "" {
		http.Error(w, `{"error":"query parameter id is required"}`, http.StatusBadRequest)
		return
	}

	res, ok := dockingJobs.Get(id)
	if !ok {
		http.Error(w, `{"error":"job not found"}`, http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(res)
}
