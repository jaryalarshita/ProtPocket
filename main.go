package main

import (
    "gofr.dev/pkg/gofr"
    "github.com/ProtPocket/handlers"
)

func main() {
    app := gofr.New()
    app.UseMiddleware(handlers.DockHTTPMiddleware)

    // Search proteins/diseases — returns ranked list by gap score
    // Example: GET /search?q=TP53
    // Example: GET /search?q=tuberculosis
    app.GET("/search", handlers.SearchHandler)

    // Get full detail for one complex
    // Example: GET /complex/P04637
    // Example: GET /complex/AF-P04637-F1
    app.GET("/complex/{id}", handlers.ComplexDetailHandler)

	// Binding site prediction + fragment suggestion for a complex
	// Example: GET /complex/P04637/binding-sites
	app.GET("/complex/{id}/binding-sites", handlers.BindingSiteHandler)

	// Get pre-ranked undrugged targets dashboard
    // Example: GET /undrugged
    // Example: GET /undrugged?filter=who_pathogen&limit=10
    app.GET("/undrugged", handlers.UndruggedHandler)

	// Pocket-aware ChEMBL fragments (requires prior binding-sites run in-process). Optional: volume, hydrophobicity, polarity.
	// Example: GET /chembl?pocket_id=1&volume=600&hydrophobicity=0.5&polarity=0.2
	app.GET("/chembl", handlers.ChemblHandler)

    app.Run()
}
