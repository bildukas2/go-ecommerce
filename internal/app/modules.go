package app

import (
	"net/http"
	"os"
	"strings"
)

type Module interface {
	Name() string
	RegisterRoutes(mux *http.ServeMux)
}

var modulesRegistry = map[string]Module{}

func RegisterModule(m Module) {
	if m == nil {
		return
	}
	modulesRegistry[m.Name()] = m
}

func parseEnabledModules(envVal string) map[string]bool {
	envVal = strings.TrimSpace(envVal)
	if envVal == "" {
		return nil
	}
	parts := strings.Split(envVal, ",")
	enabled := make(map[string]bool, len(parts))
	for _, p := range parts {
		n := strings.ToLower(strings.TrimSpace(p))
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
	name = strings.ToLower(name)
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
