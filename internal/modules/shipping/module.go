package shipping

import (
	"context"
	"encoding/json"
	"log"
	"net/http"

	"goecommerce/internal/app"
	"goecommerce/internal/platform/shipping"
	_ "goecommerce/internal/platform/shipping/providers/omniva"
	storshiping "goecommerce/internal/storage/shipping"
)

type module struct {
	store     *storshiping.Store
	providers map[string]shipping.Provider
}

func NewModule(deps app.Deps) app.Module {
	var store *storshiping.Store
	if deps.DB != nil {
		if s, err := storshiping.NewStore(context.Background(), deps.DB); err == nil {
			store = s
		}
	}

	providers := make(map[string]shipping.Provider)
	if store != nil {
		initializeProviders(context.Background(), store, providers)
	}

	return &module{
		store:     store,
		providers: providers,
	}
}

func initializeProviders(ctx context.Context, store *storshiping.Store, providers map[string]shipping.Provider) {
	dbProviders, err := store.ListProviders(ctx)
	if err != nil {
		log.Printf("shipping: error loading providers from db: %v", err)
		return
	}

	for _, dbProv := range dbProviders {
		if !dbProv.Enabled {
			continue
		}

		factory, err := shipping.Get(dbProv.Key)
		if err != nil {
			log.Printf("shipping: provider '%s' not registered: %v", dbProv.Key, err)
			continue
		}

		var config map[string]any
		if len(dbProv.ConfigJSON) > 0 {
			if err := json.Unmarshal(dbProv.ConfigJSON, &config); err != nil {
				log.Printf("shipping: error parsing config for provider '%s': %v", dbProv.Key, err)
				continue
			}
		} else {
			config = make(map[string]any)
		}

		prov, err := factory(config)
		if err != nil {
			log.Printf("shipping: error initializing provider '%s': %v", dbProv.Key, err)
			continue
		}

		providers[dbProv.Key] = prov
		log.Printf("shipping: initialized provider '%s'", dbProv.Key)
	}
}

func (m *module) Name() string {
	return "shipping"
}

func (m *module) RegisterRoutes(mux *http.ServeMux) {
}
