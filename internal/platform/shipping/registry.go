package shipping

import (
	"fmt"
	"sync"
)

var (
	providersMu sync.RWMutex
	providers   = make(map[string]ProviderFactory)
)

func Register(key string, factory ProviderFactory) {
	providersMu.Lock()
	defer providersMu.Unlock()
	if key == "" {
		panic("shipping.Register: empty key")
	}
	if factory == nil {
		panic("shipping.Register: nil factory")
	}
	if _, exists := providers[key]; exists {
		panic(fmt.Sprintf("shipping.Register: provider '%s' already registered", key))
	}
	providers[key] = factory
}

func Get(key string) (ProviderFactory, error) {
	providersMu.RLock()
	defer providersMu.RUnlock()
	factory, exists := providers[key]
	if !exists {
		return nil, fmt.Errorf("provider '%s' not registered", key)
	}
	return factory, nil
}
