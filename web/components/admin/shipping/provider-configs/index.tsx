"use client";

import { OmnivaConfig } from "./omniva-config";

type Props = {
  providerKey: string;
  configJson: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
  mode: "sandbox" | "live";
  onModeChange: (mode: "sandbox" | "live") => void;
};

// Registry of provider-specific configuration components
const providerConfigs: Record<
  string,
  React.ComponentType<{
    configJson: Record<string, unknown>;
    onChange: (config: Record<string, unknown>) => void;
    mode: "sandbox" | "live";
    onModeChange: (mode: "sandbox" | "live") => void;
    providerKey: string;
  }>
> = {
  omniva: OmnivaConfig,
  // Future providers:
  // dpd: DPDConfig,
  // venipak: VenipakConfig,
  // smartpost: SmartPostConfig,
};

// Generic JSON editor for unknown providers
function GenericConfig({
  configJson,
  onChange,
}: {
  configJson: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
  mode: "sandbox" | "live";
  onModeChange: (mode: "sandbox" | "live") => void;
  providerKey: string;
}) {
  const [jsonText, setJsonText] = React.useState(() => {
    try {
      return JSON.stringify(configJson, null, 2);
    } catch {
      return "{}";
    }
  });

  const handleChange = (text: string) => {
    setJsonText(text);
    try {
      const parsed = JSON.parse(text);
      onChange(parsed);
    } catch {
      // Invalid JSON, don't update parent
    }
  };

  return (
    <label className="space-y-1 text-sm">
      <span className="font-medium">Config JSON</span>
      <textarea
        value={jsonText}
        onChange={(e) => handleChange(e.target.value)}
        rows={6}
        className="w-full rounded-lg border border-surface-border bg-background px-3 py-2 font-mono text-xs"
        placeholder='{"api_key": "..."}'
      />
      <p className="text-xs text-foreground/50">
        Provider-specific configuration in JSON format
      </p>
    </label>
  );
}

import * as React from "react";

export function ProviderConfig({
  providerKey,
  configJson,
  onChange,
  mode,
  onModeChange,
}: Props) {
  const ConfigComponent = providerConfigs[providerKey];

  if (ConfigComponent) {
    return (
      <ConfigComponent
        configJson={configJson}
        onChange={onChange}
        mode={mode}
        onModeChange={onModeChange}
        providerKey={providerKey}
      />
    );
  }

  return (
    <GenericConfig
      configJson={configJson}
      onChange={onChange}
      mode={mode}
      onModeChange={onModeChange}
      providerKey={providerKey}
    />
  );
}

export { OmnivaConfig };
