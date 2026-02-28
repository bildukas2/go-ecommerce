"use client";

import React from "react";
import { getSlotComponents } from "./registry";
// Side-effect: registers all enabled plugins before any Slot renders.
import "./enabled";

export const SLOTS = {
  LAYOUT_HEADER_ACTIONS: "layout.header.actions",
  PRODUCT_PAGE_SIDEBAR: "product.page.sidebar",
  CHECKOUT_STEPS: "checkout.steps",
} as const;

export type SlotName = (typeof SLOTS)[keyof typeof SLOTS];

interface SlotProps {
  name: SlotName;
  [key: string]: unknown;
}

export function Slot({ name, ...props }: SlotProps) {
  const components = getSlotComponents(name);
  if (components.length === 0) return null;
  return (
    <>
      {components.map((Component, i) => (
        <Component key={i} {...props} />
      ))}
    </>
  );
}
