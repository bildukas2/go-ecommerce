package cart

import (
	"encoding/json"
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

func TestAddItemCustomOptionInputUnmarshalSnakeCaseJSON(t *testing.T) {
	var options []AddItemCustomOptionInput
	payload := []byte(`[
		{
			"option_id": "opt-size",
			"type": "dropdown",
			"value_id": "v-m"
		},
		{
			"option_id": "opt-toppings",
			"type": "multiple",
			"value_ids": ["v-cheese", "v-bacon"]
		},
		{
			"option_id": "opt-note",
			"type": "field",
			"value_text": "No onions"
		}
	]`)

	if err := json.Unmarshal(payload, &options); err != nil {
		t.Fatalf("json.Unmarshal returned error: %v", err)
	}
	if len(options) != 3 {
		t.Fatalf("expected 3 options, got %d", len(options))
	}
	if options[0].OptionID != "opt-size" || options[0].ValueID != "v-m" {
		t.Fatalf("expected first option to decode option_id/value_id, got %+v", options[0])
	}
	if options[1].OptionID != "opt-toppings" || len(options[1].ValueIDs) != 2 {
		t.Fatalf("expected second option value_ids decoded, got %+v", options[1])
	}
	if options[1].ValueIDs[0] != "v-cheese" || options[1].ValueIDs[1] != "v-bacon" {
		t.Fatalf("unexpected value_ids order/content: %+v", options[1].ValueIDs)
	}
	if options[2].OptionID != "opt-note" || options[2].ValueText != "No onions" {
		t.Fatalf("expected text option decoded, got %+v", options[2])
	}
}
