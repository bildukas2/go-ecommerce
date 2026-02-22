"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { Search, MapPin, Clock, Navigation, Loader2, List, Map } from "lucide-react";
import { useTerminals, type Terminal } from "@/hooks/use-terminals";
import { useCustomerLocation } from "@/hooks/use-customer-location";
import { formatDistance, withDistance } from "@/lib/geo";
import { cn } from "@/lib/utils";

// Dynamic import to avoid SSR issues with Leaflet
const TerminalMap = dynamic(
  () => import("./terminal-map").then((mod) => mod.TerminalMap),
  { ssr: false }
);

type Props = {
  provider: string;
  country: string;
  selectedTerminalId?: string;
  onSelect: (terminal: Terminal) => void;
  className?: string;
};

type SortBy = "name" | "distance";
type ViewMode = "list" | "map";

export function TerminalPicker({
  provider,
  country,
  selectedTerminalId,
  onSelect,
  className,
}: Props) {
  const [cityFilter, setCityFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortBy, setSortBy] = useState<SortBy>("distance");
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  const { terminals, cities, isLoading, error } = useTerminals(provider, country);
  const { location: customerLocation, loading: locationLoading, requestLocation } = useCustomerLocation();

  // Filter and sort terminals
  const filteredTerminals = useMemo(() => {
    if (!terminals || terminals.length === 0) return [];

    let result = terminals;

    // City filter
    if (cityFilter) {
      result = result.filter((t) => t.city === cityFilter);
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (t) =>
          t.name.toLowerCase().includes(query) ||
          t.address.toLowerCase().includes(query) ||
          (t.postcode && t.postcode.includes(query))
      );
    }

    // Sort
    if (sortBy === "distance" && customerLocation) {
      result = withDistance(result, customerLocation);
      result.sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));
    } else {
      result = [...result].sort((a, b) => a.name.localeCompare(b.name));
    }

    return result;
  }, [terminals, cityFilter, searchQuery, sortBy, customerLocation]);

  const handleTerminalSelect = (terminal: Terminal) => {
    onSelect(terminal);
  };

  if (!provider || !country) {
    return (
      <div className={cn("rounded-lg border border-surface-border p-4 text-center text-foreground/60", className)}>
        Select a shipping method to choose a terminal
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={cn("flex items-center justify-center p-8", className)}>
        <Loader2 className="h-6 w-6 animate-spin text-foreground/50" />
        <span className="ml-2 text-foreground/60">Loading terminals...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-red-700 dark:text-red-300", className)}>
        Failed to load terminals: {error}
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Select Pickup Terminal</h3>
        <div className="flex items-center gap-3">
          {customerLocation && (
            <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
              <Navigation className="h-3 w-3" />
              Location detected
            </span>
          )}
          {/* View mode toggle */}
          <div className="flex rounded-lg border border-surface-border overflow-hidden">
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={cn(
                "px-2 py-1.5 transition-colors",
                viewMode === "list"
                  ? "bg-blue-500/20 text-blue-700 dark:text-blue-300"
                  : "bg-background hover:bg-foreground/5"
              )}
              title="List view"
            >
              <List className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("map")}
              className={cn(
                "px-2 py-1.5 transition-colors",
                viewMode === "map"
                  ? "bg-blue-500/20 text-blue-700 dark:text-blue-300"
                  : "bg-background hover:bg-foreground/5"
              )}
              title="Map view"
            >
              <Map className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {/* City filter */}
        <select
          value={cityFilter}
          onChange={(e) => setCityFilter(e.target.value)}
          className="rounded-lg border border-surface-border bg-background px-3 py-2 text-sm"
        >
          <option value="">All cities</option>
          {cities.map((city) => (
            <option key={city} value={city}>
              {city}
            </option>
          ))}
        </select>

        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/50" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name or address..."
            className="w-full rounded-lg border border-surface-border bg-background py-2 pl-9 pr-3 text-sm"
          />
        </div>

        {/* Sort toggle */}
        <div className="flex rounded-lg border border-surface-border overflow-hidden">
          <button
            type="button"
            onClick={() => setSortBy("distance")}
            disabled={!customerLocation}
            className={cn(
              "px-3 py-2 text-sm transition-colors",
              sortBy === "distance"
                ? "bg-blue-500/20 text-blue-700 dark:text-blue-300"
                : "bg-background hover:bg-foreground/5",
              !customerLocation && "opacity-50 cursor-not-allowed"
            )}
          >
            Nearest
          </button>
          <button
            type="button"
            onClick={() => setSortBy("name")}
            className={cn(
              "px-3 py-2 text-sm transition-colors",
              sortBy === "name"
                ? "bg-blue-500/20 text-blue-700 dark:text-blue-300"
                : "bg-background hover:bg-foreground/5"
            )}
          >
            Name
          </button>
        </div>

        {/* Get location button */}
        {!customerLocation && (
          <button
            type="button"
            onClick={requestLocation}
            disabled={locationLoading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-surface-border bg-background px-3 py-2 text-sm hover:bg-foreground/5 disabled:opacity-50"
          >
            {locationLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Navigation className="h-4 w-4" />
            )}
            Use my location
          </button>
        )}
      </div>

      {/* Results count */}
      <div className="text-sm text-foreground/60">
        {filteredTerminals.length} terminals found
      </div>

      {/* Terminal list or map */}
      {viewMode === "list" ? (
        <div className="max-h-96 space-y-2 overflow-y-auto">
          {filteredTerminals.length === 0 ? (
            <div className="rounded-lg border border-surface-border p-4 text-center text-foreground/60">
              No terminals match your search
            </div>
          ) : (
            filteredTerminals.map((terminal) => (
              <TerminalListItem
                key={terminal.id}
                terminal={terminal}
                isSelected={terminal.id === selectedTerminalId}
                distance={terminal.distance}
                onSelect={() => handleTerminalSelect(terminal)}
              />
            ))
          )}
        </div>
      ) : (
        <TerminalMap
          terminals={filteredTerminals}
          selectedTerminalId={selectedTerminalId}
          onSelect={handleTerminalSelect}
          customerLocation={customerLocation}
          className="h-96"
        />
      )}
    </div>
  );
}

type TerminalListItemProps = {
  terminal: Terminal;
  isSelected: boolean;
  distance?: number;
  onSelect: () => void;
};

function TerminalListItem({
  terminal,
  isSelected,
  distance,
  onSelect,
}: TerminalListItemProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full rounded-lg border p-4 text-left transition-all",
        isSelected
          ? "border-blue-500 bg-blue-500/10 ring-1 ring-blue-500"
          : "border-surface-border bg-background hover:bg-foreground/[0.02] hover:border-foreground/20"
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-medium truncate">{terminal.name}</h4>
            {isSelected && (
              <span className="shrink-0 rounded-full bg-blue-500 px-2 py-0.5 text-xs text-white">
                Selected
              </span>
            )}
          </div>
          <div className="mt-1 flex items-center gap-1 text-sm text-foreground/70">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{terminal.address}</span>
          </div>
          {terminal.hours && (
            <div className="mt-1 flex items-center gap-1 text-xs text-foreground/50">
              <Clock className="h-3 w-3 shrink-0" />
              <span>{terminal.hours}</span>
            </div>
          )}
        </div>
        {distance !== undefined && (
          <div className="shrink-0 text-right">
            <span className="text-sm font-medium text-foreground/70">
              {formatDistance(distance)}
            </span>
          </div>
        )}
      </div>
    </button>
  );
}
