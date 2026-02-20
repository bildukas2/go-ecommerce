import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const CREATE_MODAL_PATH = new URL("../components/admin/catalog/products-create-modal.tsx", import.meta.url);
const EDIT_MODAL_PATH = new URL("../components/admin/catalog/products-edit-modal.tsx", import.meta.url);

async function read(path) {
  return readFile(path, "utf8");
}

function expectCustomOptionFields(source) {
  assert.match(source, /name="option_pick"/);
  assert.match(source, /list=(?:"[^"]*custom-options-list[^"]*"|\{`[^`]*custom-options-list[^`]*`\})/);
  assert.match(source, /<select multiple name="option_ids"/);
  assert.match(source, /name="sort_order"/);
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
