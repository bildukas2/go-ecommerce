import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const BULK_TOOLS_PATH = new URL("../components/admin/catalog/products-bulk-tools.tsx", import.meta.url);
const MORE_MODAL_PATH = new URL("../components/admin/catalog/products-more-modal.tsx", import.meta.url);
const PICKER_COMPONENT_PATH = new URL("../components/admin/catalog/custom-option-assignment-picker.tsx", import.meta.url);

async function read(path) {
  return readFile(path, "utf8");
}

test("ProductsBulkTools uses add/remove list UX for customizable options", async () => {
  const source = await read(BULK_TOOLS_PATH);
  assert.match(source, /CustomOptionAssignmentPicker/);
  assert.doesNotMatch(source, /<select\s+multiple\s+name="option_ids"/);
});

test("ProductsMoreModal uses add/remove list UX for customizable options", async () => {
  const source = await read(MORE_MODAL_PATH);
  assert.match(source, /CustomOptionAssignmentPicker/);
  assert.match(source, /name="option_ids"/);
  assert.match(source, /name="option_pick"/);
  assert.doesNotMatch(source, /<select\s+multiple\s+name="option_ids"/);
});

test("shared custom option picker renders add and manage actions", async () => {
  const source = await read(PICKER_COMPONENT_PATH);
  assert.match(source, /Add option/);
  assert.match(source, /Customize option/);
  assert.match(source, /Remove from product/);
});
