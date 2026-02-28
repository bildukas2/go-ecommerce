/**
 * enabled.ts — list your active plugins here.
 *
 * To enable a plugin:
 *   1. Import it below
 *   2. Add it to the `enabledPlugins` array
 *
 * Example:
 *   import { examplePlugin } from "./_examples/example-plugin";
 *   export const enabledPlugins = [examplePlugin];
 */

import { registerPlugin } from "./registry";
import type { Plugin } from "./registry";

const enabledPlugins: Plugin[] = [
  // Add plugins here
  // example: examplePlugin
];

// Self-registers all enabled plugins when this module is imported.
enabledPlugins.forEach(registerPlugin);
