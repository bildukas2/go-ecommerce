"use client";

import { useEffect, useState } from "react";
import {
  checkVersion,
  getSystemUpdateJob,
  runSystemUpdate,
  type SystemUpdateJob,
  type VersionCheckResponse,
} from "@/lib/api";

type Channel = "dev" | "prod";

type Props = {
  backendVersion: string;
  webVersion: string;
};

export function VersionChecker({ backendVersion, webVersion }: Props) {
  const [channel, setChannel] = useState<Channel>("prod");
  const [loading, setLoading] = useState(false);
  const [runLoading, setRunLoading] = useState(false);
  const [result, setResult] = useState<VersionCheckResponse | null>(null);
  const [job, setJob] = useState<SystemUpdateJob | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!job) return;
    if (job.status !== "pending" && job.status !== "running") return;

    const timer = setInterval(async () => {
      try {
        const next = await getSystemUpdateJob(job.id);
        setJob(next);
      } catch {}
    }, 2500);

    return () => clearInterval(timer);
  }, [job]);

  async function handleCheck() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await checkVersion(channel);
      setResult(data);
    } catch {
      setError("Could not reach GitHub. Check your network or repo config.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRunUpdate() {
    if (!result || result.up_to_date) return;
    const confirmText = window.prompt("Type UPDATE to confirm deployment.");
    if (confirmText === null) return;

    setRunLoading(true);
    setError(null);
    try {
      const started = await runSystemUpdate(channel, confirmText.trim());
      setJob(started);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to start update";
      setError(message);
    } finally {
      setRunLoading(false);
    }
  }

  return (
    <div className="border-t border-surface-border pt-3 text-xs text-foreground/65">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span>Backend Version: {backendVersion}</span>
        <span>Web Version: {webVersion}</span>

        <select
          value={channel}
          onChange={(e) => {
            setChannel(e.target.value as Channel);
            setResult(null);
            setError(null);
          }}
          disabled={loading || runLoading}
          className="rounded-md border border-surface-border bg-background px-2 py-1 text-xs font-medium text-foreground/80 transition-colors hover:bg-foreground/5 disabled:opacity-50"
        >
          <option value="prod">prod</option>
          <option value="dev">dev</option>
        </select>

        <button
          onClick={handleCheck}
          disabled={loading || runLoading}
          className="inline-flex items-center gap-1.5 rounded-md border border-surface-border px-2.5 py-1 text-xs font-medium transition-colors hover:bg-foreground/5 disabled:opacity-50"
        >
          {loading ? (
            <>
              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-foreground/30 border-t-foreground/80" />
              Checking...
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

        {result && !result.up_to_date && (
          <button
            onClick={handleRunUpdate}
            disabled={runLoading}
            className="inline-flex items-center gap-1.5 rounded-md border border-blue-500/35 bg-blue-500/12 px-2.5 py-1 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-500/18 disabled:opacity-50 dark:text-blue-300"
          >
            {runLoading ? "Starting..." : "Update now"}
          </button>
        )}

        {error && (
          <span className="rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-0.5 font-medium text-red-700 dark:text-red-400">
            {error}
          </span>
        )}
      </div>

      {job && (
        <div className="mt-3 rounded-xl border border-surface-border bg-foreground/[0.02] p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">Update job:</span>
            <span className="font-mono">{job.id}</span>
            <span className="rounded-full border border-surface-border px-2 py-0.5 uppercase tracking-wide">
              {job.status}
            </span>
          </div>
          {job.error && (
            <p className="mt-2 text-red-600 dark:text-red-400">{job.error}</p>
          )}
          {job.log && (
            <pre className="mt-2 max-h-44 overflow-auto rounded-lg border border-surface-border bg-background p-2 text-[11px] leading-relaxed">
              {job.log}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
