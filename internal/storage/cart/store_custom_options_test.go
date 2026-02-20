package cart

import (
	"errors"
	"testing"
)

func TestResolveSingleSelectOptionUsesDefaultValue(t *testing.T) {
	option := catalogCustomOption{
		ID:       "opt-1",
		Title:    "Size",
		Type:     "dropdown",
		Required: true,
		Values: []catalogCustomOptionValue{
			{ID: "v-1", Title: "S", PriceType: "fixed", PriceValue: 2, IsDefault: true},
			{ID: "v-2", Title: "M", PriceType: "fixed", PriceValue: 3},
		},
	}

	item, delta, ok, err := resolveSingleSelectOption(option, AddItemCustomOptionInput{}, false, 1000)
	if err != nil {
		t.Fatalf("resolveSingleSelectOption returned error: %v", err)
	}
	if !ok {
		t.Fatalf("expected selected item")
	}
	if item.ValueID != "v-1" {
		t.Fatalf("expected default value id v-1, got %q", item.ValueID)
	}
	if delta != 200 {
		t.Fatalf("expected fixed price delta 200, got %d", delta)
	}
}

func TestResolveTextLikeOptionValidatesRequired(t *testing.T) {
	option := catalogCustomOption{
		ID:         "opt-2",
		Title:      "Custom text",
		Type:       "field",
		Required:   true,
		PriceType:  "percent",
		PriceValue: 10,
	}

	_, _, _, err := resolveTextLikeOption(option, AddItemCustomOptionInput{}, false, 1000)
	if !errors.Is(err, ErrInvalidCustomOptions) {
		t.Fatalf("expected ErrInvalidCustomOptions, got %v", err)
	}
}

func TestHashCustomOptionsDeterministic(t *testing.T) {
	optionsA := []CartItemCustomOption{
		{
			OptionID:    "opt-1",
			ValueIDs:    []string{"b", "a"},
			ValueTitles: []string{"B", "A"},
		},
	}
	optionsB := []CartItemCustomOption{
		{
			OptionID:    "opt-1",
			ValueIDs:    []string{"b", "a"},
			ValueTitles: []string{"B", "A"},
		},
	}
	hashA := hashCustomOptions(optionsA)
	hashB := hashCustomOptions(optionsB)
	if hashA == "" {
		t.Fatalf("expected non-empty hash")
	}
	if hashA != hashB {
		t.Fatalf("expected deterministic hash; %q != %q", hashA, hashB)
	}
}
