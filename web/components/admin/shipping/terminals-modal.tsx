"use client";

import { useState, useMemo } from "react";
import { Search, Download, X, MapPin, Clock } from "lucide-react";

export type Terminal = {
  id: string;
  name: string;
  city: string;
  address: string;
  postcode?: string;
  country: string;
  lat?: number;
  lon?: number;
  hours?: string;
  type?: string;
};

type Props = {
  terminals: Terminal[];
  provider: string;
  country: string;
  fetchedAt: string;
  onClose: () => void;
};

export function TerminalsModal({ terminals, provider, country, fetchedAt, onClose }: Props) {
  const [searchQuery, setSearchQuery] = useState("");
  const [cityFilter, setCityFilter] = useState("");

  // Extract unique cities
  const cities = useMemo(() => {
    const uniqueCities = new Set(terminals.map((t) => t.city).filter(Boolean));
    return Array.from(uniqueCities).sort();
  }, [terminals]);

  // Filter terminals
  const filteredTerminals = useMemo(() => {
    let result = terminals;

    if (cityFilter) {
      result = result.filter((t) => t.city === cityFilter);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (t) =>
          t.name.toLowerCase().includes(query) ||
          t.address.toLowerCase().includes(query) ||
          (t.postcode && t.postcode.includes(query)) ||
          t.id.toLowerCase().includes(query)
      );
    }

    return result;
  }, [terminals, cityFilter, searchQuery]);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "Unknown";
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const exportToCSV = () => {
    const headers = ["ID", "Name", "City", "Address", "Postcode", "Country", "Hours", "Type"];
    const rows = filteredTerminals.map((t) => [
      t.id,
      t.name,
      t.city,
      t.address,
      t.postcode || "",
      t.country,
      t.hours || "",
      t.type || "",
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${provider}_${country}_terminals_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
      <div className="flex h-[80vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-surface-border bg-background shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-surface-border px-4 py-3">
          <div>
            <h2 className="text-lg font-semibold">
              Terminals: {provider.toUpperCase()} / {country}
            </h2>
            <p className="text-xs text-foreground/60">
              {terminals.length} terminals • Fetched: {formatDate(fetchedAt)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-surface-border px-3 py-1.5 text-sm hover:bg-foreground/[0.05]"
          >
            Close
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 border-b border-surface-border px-4 py-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/50"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, address, postcode..."
              className="w-full rounded-lg border border-surface-border bg-background py-2 pl-9 pr-3 text-sm"
            />
          </div>

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

          <button
            type="button"
            onClick={exportToCSV}
            className="inline-flex items-center gap-1.5 rounded-lg border border-surface-border bg-background px-3 py-2 text-sm hover:bg-foreground/[0.05]"
          >
            <Download size={16} />
            Export CSV
          </button>
        </div>

        {/* Results count */}
        <div className="px-4 py-2 text-sm text-foreground/60">
          Showing {filteredTerminals.length} of {terminals.length} terminals
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {filteredTerminals.length === 0 ? (
            <div className="flex h-full items-center justify-center text-foreground/60">
              No terminals match your search
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 border-b border-surface-border bg-background">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">ID</th>
                  <th className="px-4 py-2 text-left font-medium">Name</th>
                  <th className="px-4 py-2 text-left font-medium">City</th>
                  <th className="px-4 py-2 text-left font-medium">Address</th>
                  <th className="px-4 py-2 text-left font-medium">Hours</th>
                </tr>
              </thead>
              <tbody>
                {filteredTerminals.map((terminal) => (
                  <tr
                    key={terminal.id}
                    className="border-b border-surface-border/50 hover:bg-foreground/[0.02]"
                  >
                    <td className="px-4 py-2 font-mono text-xs text-foreground/70">
                      {terminal.id}
                    </td>
                    <td className="px-4 py-2 font-medium">{terminal.name}</td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-1">
                        <MapPin size={14} className="text-foreground/50" />
                        {terminal.city}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-foreground/70">{terminal.address}</td>
                    <td className="px-4 py-2">
                      {terminal.hours && (
                        <div className="flex items-center gap-1 text-foreground/70">
                          <Clock size={14} />
                          <span className="text-xs">{terminal.hours}</span>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
