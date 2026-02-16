package app

import (
	"fmt"
	"net/http"
	"os"
	"strings"
)

type Module interface {
	Name() string
	RegisterRoutes(mux *http.ServeMux)
}

var modulesRegistry = map[string]Module{}

func normalizeName(s string) string {
	return strings.ToLower(strings.TrimSpace(s))
}

func RegisterModule(m Module) {
	if m == nil {
		return
	}
	name := normalizeName(m.Name())
	if name == "" {
		panic("RegisterModule: empty module name")
	}
	if _, exists := modulesRegistry[name]; exists {
		panic(fmt.Sprintf("RegisterModule: duplicate module name '%s'", name))
	}
	modulesRegistry[name] = m
}

func parseEnabledModules(envVal string) map[string]bool {
	envVal = strings.TrimSpace(envVal)
	if envVal == "" {
		return nil
	}
	parts := strings.Split(envVal, ",")
	enabled := make(map[string]bool, len(parts))
	for _, p := range parts {
		n := normalizeName(p)
		if n == "" {
			continue
		}
		enabled[n] = true
	}
	return enabled
}

func moduleEnabled(name string, enabled map[string]bool) bool {
	if enabled == nil {
		return true
	}
	name = normalizeName(name)
	if enabled["all"] || enabled["*"] {
		return true
	}
	return enabled[name]
}

func enabledModulesFromEnv() map[string]bool {
	return parseEnabledModules(os.Getenv("ENABLED_MODULES"))
}

func registerEnabledModules(mux *http.ServeMux) {
	enabled := enabledModulesFromEnv()
	for name, m := range modulesRegistry {
		if moduleEnabled(name, enabled) {
			m.RegisterRoutes(mux)
		}
	}
}
