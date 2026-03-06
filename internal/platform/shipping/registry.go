package shipping

import (
	"fmt"
	"sort"
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

// GetCapabilities returns the capabilities for a registered provider.
// It creates a provider instance with nil config, which should work for capability discovery.
func GetCapabilities(key string) (Capabilities, error) {
	providersMu.RLock()
	defer providersMu.RUnlock()
	factory, exists := providers[key]
	if !exists {
		return Capabilities{}, fmt.Errorf("provider '%s' not registered", key)
	}
	// Create a temporary instance with empty config to get capabilities
	p, err := factory(nil)
	if err != nil {
		return Capabilities{}, err
	}
	return p.Capabilities(), nil
}

// ListKeys returns registered provider keys sorted alphabetically.
func ListKeys() []string {
	providersMu.RLock()
	defer providersMu.RUnlock()

	keys := make([]string, 0, len(providers))
	for key := range providers {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	return keys
}
