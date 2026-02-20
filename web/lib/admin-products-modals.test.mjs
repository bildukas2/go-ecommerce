import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const CREATE_MODAL_PATH = new URL("../components/admin/catalog/products-create-modal.tsx", import.meta.url);
const EDIT_MODAL_PATH = new URL("../components/admin/catalog/products-edit-modal.tsx", import.meta.url);
const PICKER_COMPONENT_PATH = new URL("../components/admin/catalog/custom-option-assignment-picker.tsx", import.meta.url);

async function read(path) {
  return readFile(path, "utf8");
}

function expectCustomOptionFields(source) {
  assert.match(source, /name="option_pick"/);
  assert.match(source, /name="option_ids"/);
  assert.match(source, /name="sort_order"/);
  assert.match(source, /CustomOptionAssignmentPicker/);
}

test("ProductsCreateModal includes custom-option fields for form submission", async () => {
  const source = await read(CREATE_MODAL_PATH);
  expectCustomOptionFields(source);
  assert.match(source, /customOptions/);
});

test("ProductsEditModal includes custom-option fields for form submission", async () => {
  const source = await read(EDIT_MODAL_PATH);
  expectCustomOptionFields(source);
  assert.match(source, /customOptions/);
});

test("Custom option picker includes add, customize, and remove actions", async () => {
  const source = await read(PICKER_COMPONENT_PATH);
  assert.match(source, /Add option/);
  assert.match(source, /Customize option/);
  assert.match(source, /Remove from product/);
});
