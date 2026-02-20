import test from "node:test";
import assert from "node:assert/strict";
import { buildCustomOptionPayload, typeGroupFromType, validateSelectValues } from "./admin-custom-options-state.mjs";

test("typeGroupFromType maps supported types", () => {
  assert.equal(typeGroupFromType("field"), "text");
  assert.equal(typeGroupFromType("file"), "file");
  assert.equal(typeGroupFromType("dropdown"), "select");
  assert.equal(typeGroupFromType("date"), "date");
});

test("buildCustomOptionPayload keeps select pricing on values", () => {
  const payload = buildCustomOptionPayload({
    code: "gift-wrap",
    title: "Gift Wrap",
    type: "dropdown",
    required: "true",
    is_active: "true",
    values_json: JSON.stringify([{ title: "Classic", price_type: "fixed", price_value: 5 }]),
  });

  assert.equal(payload.type_group, "select");
  assert.equal(payload.price_type, null);
  assert.equal(payload.price_value, null);
  assert.equal(payload.values.length, 1);
  assert.equal(payload.values[0].title, "Classic");
});

test("buildCustomOptionPayload sets default swatch color for color_buttons values", () => {
  const payload = buildCustomOptionPayload({
    code: "color",
    title: "Color",
    type: "dropdown",
    display_mode: "color_buttons",
    values_json: JSON.stringify([{ title: "Blue", price_type: "fixed", price_value: 0, swatch_hex: null }]),
  });

  assert.equal(payload.display_mode, "color_buttons");
  assert.equal(payload.values.length, 1);
  assert.equal(payload.values[0].swatch_hex, "#0072F5");
});

test("validateSelectValues enforces title and non-negative price", () => {
  assert.equal(validateSelectValues([]), false);
  assert.equal(validateSelectValues([{ title: " ", price_value: 1 }]), false);
  assert.equal(validateSelectValues([{ title: "Red", price_value: -1 }]), false);
  assert.equal(validateSelectValues([{ title: "Red", price_value: 0 }]), true);
});
