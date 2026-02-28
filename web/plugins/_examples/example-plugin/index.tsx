/**
 * Example Plugin
 *
 * This shows how to create a plugin that injects UI into named slots.
 *
 * To enable this plugin, add it to web/plugins/enabled.ts:
 *
 *   import { examplePlugin } from "./_examples/example-plugin";
 *   export const enabledPlugins = [examplePlugin];
 */

import React from "react";
import type { Plugin } from "@/plugins/registry";
import { SLOTS } from "@/plugins/slots";

function ExampleHeaderBadge() {
  return (
    <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
      Example
    </span>
  );
}

export const examplePlugin: Plugin = {
  id: "example-plugin",
  slots: {
    [SLOTS.LAYOUT_HEADER_ACTIONS]: [ExampleHeaderBadge],
  },
};
