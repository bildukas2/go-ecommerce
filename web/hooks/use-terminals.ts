"use client";

import { useState, useEffect, useMemo } from "react";
import { API_URL } from "@/lib/config";

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
  distance?: number;
};

type TerminalsResponse = {
  provider: string;
  country: string;
  terminals: Terminal[];
  fetched_at: string;
};

export function useTerminals(provider: string, country: string) {
  const [terminals, setTerminals] = useState<Terminal[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);

  useEffect(() => {
    if (!provider || !country) {
      setTerminals([]);
      return;
    }

    const fetchTerminals = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const url = new URL(`${API_URL}/shipping/terminals`);
        url.searchParams.set("provider", provider);
        url.searchParams.set("country", country);

        const res = await fetch(url.toString(), {
          cache: "no-store",
        });

        if (!res.ok) {
          throw new Error(`Failed to fetch terminals: ${res.status}`);
        }

        const data: TerminalsResponse = await res.json();
        setTerminals(data.terminals);
        setFetchedAt(data.fetched_at);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch terminals");
        setTerminals([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTerminals();
  }, [provider, country]);

  // Extract unique cities from terminals
  const cities = useMemo(() => {
    const uniqueCities = new Set(terminals.map((t) => t.city).filter(Boolean));
    return Array.from(uniqueCities).sort();
  }, [terminals]);

  return {
    terminals,
    cities,
    isLoading,
    error,
    fetchedAt,
  };
}
