package services

import (
	"bytes"
	"compress/gzip"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"
)

var uniprotClient = &http.Client{Timeout: 10 * time.Second}

const uniprotBaseURL = "https://rest.uniprot.org/uniprotkb"

// UniProtEntry matches the fields we need from the UniProt REST API.
type UniProtEntry struct {
	EntryType          string `json:"entryType"` // "Swiss-Prot" (reviewed) or "TrEMBL" (unreviewed)
	ProteinDescription struct {
		RecommendedName struct {
			FullName struct {
				Value string `json:"value"`
			} `json:"fullName"`
		} `json:"recommendedName"`
	} `json:"proteinDescription"`
	Genes []struct {
		GeneName struct {
			Value string `json:"value"`
		} `json:"geneName"`
	} `json:"genes"`
	Organism struct {
		ScientificName string `json:"scientificName"`
		TaxonID        int    `json:"taxonId"`
	} `json:"organism"`
	Comments []struct {
		CommentType string `json:"commentType"`
		Disease     struct {
			DiseaseID   string `json:"diseaseId"`
			Description string `json:"description"`
		} `json:"disease"`
	} `json:"comments"`
}

// FetchUniProtEntry fetches protein metadata from UniProt by accession ID.
func FetchUniProtEntry(uniprotID string) (*UniProtEntry, error) {
	fetchURL := fmt.Sprintf("%s/%s?format=json", uniprotBaseURL, uniprotID)
	resp, err := uniprotClient.Get(fetchURL)
	if err != nil {
		return nil, fmt.Errorf("uniprot GET failed for %s: %w", uniprotID, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == 404 {
		return nil, fmt.Errorf("uniprot: accession %s not found", uniprotID)
	}
	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("uniprot: status %d for %s", resp.StatusCode, uniprotID)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("uniprot: read failed for %s: %w", uniprotID, err)
	}

	// Check if response is gzip-compressed (starts with magic bytes 0x1f 0x8b)
	if len(body) >= 2 && body[0] == 0x1f && body[1] == 0x8b {
		gr, err := gzip.NewReader(bytes.NewReader(body))
		if err != nil {
			return nil, fmt.Errorf("uniprot: gzip decompress failed: %w", err)
		}
		defer gr.Close()
		decompressed, err := io.ReadAll(gr)
		if err != nil {
			return nil, fmt.Errorf("uniprot: gzip read failed: %w", err)
		}
		body = decompressed
	}

	var entry UniProtEntry
	if err := json.Unmarshal(body, &entry); err != nil {
		return nil, fmt.Errorf("uniprot: parse failed for %s: %w", uniprotID, err)
	}

	return &entry, nil
}

// SearchUniProt searches UniProt by query string and returns the top UniProt IDs.
// Used for the search-by-disease or search-by-protein-name feature.
func SearchUniProt(query string, limit int) ([]string, error) {
	encodedQuery := url.QueryEscape(query)
	searchURL := fmt.Sprintf("%s/search?query=%s&format=json&size=%d&fields=accession,id", uniprotBaseURL, encodedQuery, limit)

	resp, err := uniprotClient.Get(searchURL)
	if err != nil {
		return nil, fmt.Errorf("uniprot search failed for '%s': %w", query, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("uniprot search: status %d for '%s'", resp.StatusCode, query)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("uniprot search: read failed: %w", err)
	}

	// Check if response is gzip-compressed (starts with magic bytes 0x1f 0x8b)
	if len(body) >= 2 && body[0] == 0x1f && body[1] == 0x8b {
		gr, err := gzip.NewReader(bytes.NewReader(body))
		if err != nil {
			return nil, fmt.Errorf("uniprot search: gzip decompress failed: %w", err)
		}
		defer gr.Close()
		decompressed, err := io.ReadAll(gr)
		if err != nil {
			return nil, fmt.Errorf("uniprot search: gzip read failed: %w", err)
		}
		body = decompressed
	}

	var result struct {
		Results []struct {
			PrimaryAccession string `json:"primaryAccession"`
		} `json:"results"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("uniprot search: parse failed: %w. Raw: %s", err, string(body[:min(200, len(body))]))
	}

	var ids []string
	for _, r := range result.Results {
		ids = append(ids, r.PrimaryAccession)
	}
	return ids, nil
}
