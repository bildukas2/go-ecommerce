"use client";

import { useState } from "react";
import { checkVersion, type VersionCheckResponse } from "@/lib/api";

type Props = {
  backendVersion: string;
  webVersion: string;
};

export function VersionChecker({ backendVersion, webVersion }: Props) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VersionCheckResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleCheck() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await checkVersion();
      setResult(data);
    } catch {
      setError("Could not reach GitHub. Check your network or repo config.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="border-t border-surface-border pt-3 text-xs text-foreground/65">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span>Backend Version: {backendVersion}</span>
        <span>Web Version: {webVersion}</span>
        <button
          onClick={handleCheck}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-md border border-surface-border px-2.5 py-1 text-xs font-medium transition-colors hover:bg-foreground/5 disabled:opacity-50"
        >
          {loading ? (
            <>
              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-foreground/30 border-t-foreground/80" />
              Checking…
            </>
          ) : (
            "Check for updates"
          )}
        </button>
        {result && (
          <span
            className={
              result.up_to_date
                ? "rounded-full border border-green-500/30 bg-green-500/10 px-2.5 py-0.5 font-medium text-green-700 dark:text-green-400"
                : "rounded-full border border-yellow-500/30 bg-yellow-500/10 px-2.5 py-0.5 font-medium text-yellow-700 dark:text-yellow-400"
            }
          >
            {result.up_to_date
              ? "Server is up to date"
              : `New version available: v${result.latest_version}`}
          </span>
        )}
        {error && (
          <span className="rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-0.5 font-medium text-red-700 dark:text-red-400">
            {error}
          </span>
        )}
      </div>
    </div>
  );
}
