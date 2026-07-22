package services

import (
	"sync"

	"github.com/JagtapAvadhut/smartca-backend/internal/domain/models"
	"github.com/JagtapAvadhut/smartca-backend/internal/repository"
)

// parallelGetAll loads multiple collections concurrently. Results match sequential
// GetAll semantics; order of completion does not affect returned data.
func parallelGetAll(store repository.Store, includeArchived bool, collections ...string) [][]models.Record {
	out := make([][]models.Record, len(collections))
	if len(collections) == 0 {
		return out
	}
	if len(collections) == 1 {
		out[0] = store.GetAll(collections[0], includeArchived)
		return out
	}
	var wg sync.WaitGroup
	wg.Add(len(collections))
	for i, c := range collections {
		i, c := i, c
		go func() {
			defer wg.Done()
			out[i] = store.GetAll(c, includeArchived)
		}()
	}
	wg.Wait()
	return out
}
