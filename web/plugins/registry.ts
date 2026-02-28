import type { SlotName } from "./slots";

export interface Plugin {
  id: string;
  slots: Partial<Record<SlotName, React.ComponentType[]>>;
}

const registry: Plugin[] = [];

export function registerPlugin(plugin: Plugin): void {
  if (registry.some((p) => p.id === plugin.id)) return;
  registry.push(plugin);
}

export function getSlotComponents(slotName: SlotName): React.ComponentType[] {
  return registry.flatMap((plugin) => plugin.slots[slotName] ?? []);
}
