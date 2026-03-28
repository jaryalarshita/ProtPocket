package handlers

import (
	"sync"

	"github.com/ProtPocket/models"
)

// PocketStore holds pockets keyed by fpocket PocketID for follow-up API calls (e.g. ChEMBL fragment refetch).
// When both complex and monomer pockets share an ID, the dimer entry wins; monomer pockets are
// stored only for IDs not yet present.
type PocketStore struct {
	mu   sync.RWMutex
	byID map[int]models.Pocket
}

// DefaultPocketStore is the process-wide pocket registry populated by binding-sites responses.
var DefaultPocketStore = NewPocketStore()

// NewPocketStore creates an empty PocketStore.
func NewPocketStore() *PocketStore {
	return &PocketStore{byID: make(map[int]models.Pocket)}
}

// Put stores or replaces a pocket by PocketID.
func (s *PocketStore) Put(p models.Pocket) {
	s.mu.Lock()
	s.byID[p.PocketID] = p
	s.mu.Unlock()
}

// PutIfAbsent stores a pocket only when PocketID is not already registered.
func (s *PocketStore) PutIfAbsent(p models.Pocket) {
	s.mu.Lock()
	if _, exists := s.byID[p.PocketID]; !exists {
		s.byID[p.PocketID] = p
	}
	s.mu.Unlock()
}

// RegisterBindingSitesResult indexes all pockets from a binding-sites run (dimer first, then monomer).
func (s *PocketStore) RegisterBindingSitesResult(pockets, monomerPockets []models.Pocket) {
	for _, p := range pockets {
		s.Put(p)
	}
	for _, p := range monomerPockets {
		s.PutIfAbsent(p)
	}
}

// Get returns a pocket by fpocket numeric ID.
func (s *PocketStore) Get(id int) (models.Pocket, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	p, ok := s.byID[id]
	return p, ok
}
