"use client";

import { useState } from "react";
import { Eye, EyeOff, Loader2, CheckCircle, XCircle } from "lucide-react";
import { testShippingProvider } from "@/lib/api";

type Props = {
  configJson: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
  mode: "sandbox" | "live";
  onModeChange: (mode: "sandbox" | "live") => void;
  providerKey: string;
};

type TestResult = {
  success: boolean;
  message: string;
  terminalsFound?: number;
} | null;

export function LPExpressConfig({
  configJson,
  onChange,
  mode,
  onModeChange,
  providerKey,
}: Props) {
  const [showPassword, setShowPassword] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult>(null);

  const username = (configJson.username as string) || "";
  const password = (configJson.password as string) || "";
  const baseUrl = (configJson.base_url as string) || "";

  const updateConfig = (key: string, value: string) => {
    onChange({ ...configJson, [key]: value });
    setTestResult(null);
  };

  const handleTestConnection = async () => {
    if (!username || !password) {
      setTestResult({
        success: false,
        message: "Username and password are required",
      });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const result = await testShippingProvider(providerKey, configJson, mode);
      setTestResult({
        success: result.success,
        message: result.success ? result.message : (result.error || result.message),
        terminalsFound: result.terminals_found,
      });
    } catch (error) {
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : "Connection failed",
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-3">
        <h4 className="text-sm font-medium text-blue-700 dark:text-blue-300">
          LP EXPRESS Configuration
        </h4>
        <p className="mt-1 text-xs text-foreground/60">
          Enter your LP EXPRESS API credentials. These are stored securely in the database.
        </p>
      </div>

      <label className="space-y-1 text-sm">
        <span className="font-medium">Username</span>
        <input
          type="text"
          value={username}
          onChange={(e) => updateConfig("username", e.target.value)}
          placeholder="Your LP EXPRESS API username"
          className="w-full rounded-lg border border-surface-border bg-background px-3 py-2 text-sm"
          autoComplete="off"
        />
      </label>

      <label className="space-y-1 text-sm">
        <span className="font-medium">Password</span>
        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => updateConfig("password", e.target.value)}
            placeholder="Your LP EXPRESS API password"
            className="w-full rounded-lg border border-surface-border bg-background px-3 py-2 pr-10 text-sm"
            autoComplete="off"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-foreground/50 hover:text-foreground"
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </label>

      <label className="space-y-1 text-sm">
        <span className="font-medium">Base URL (optional)</span>
        <input
          type="text"
          value={baseUrl}
          onChange={(e) => updateConfig("base_url", e.target.value)}
          placeholder={
            mode === "sandbox"
              ? "https://api-manosiuntostst.post.lt"
              : "https://api-manosiuntos.post.lt"
          }
          className="w-full rounded-lg border border-surface-border bg-background px-3 py-2 text-sm font-mono text-xs"
        />
        <p className="text-xs text-foreground/50">
          Leave empty to use default URL based on mode
        </p>
      </label>

      <label className="space-y-1 text-sm">
        <span className="font-medium">Mode</span>
        <select
          value={mode}
          onChange={(e) => onModeChange(e.target.value as "sandbox" | "live")}
          className="w-full rounded-lg border border-surface-border bg-background px-3 py-2 text-sm"
        >
          <option value="sandbox">Sandbox (Testing)</option>
          <option value="live">Live (Production)</option>
        </select>
        <p className="text-xs text-foreground/50">
          {mode === "sandbox"
            ? "Uses test environment. No real shipments will be created."
            : "Uses production environment. Real shipments and charges apply."}
        </p>
      </label>

      <div className="border-t border-surface-border pt-4">
        <button
          type="button"
          onClick={handleTestConnection}
          disabled={isTesting || !username || !password}
          className="inline-flex items-center gap-2 rounded-lg border border-surface-border bg-background px-4 py-2 text-sm font-medium hover:bg-foreground/5 disabled:opacity-50"
        >
          {isTesting ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Testing...
            </>
          ) : (
            <>
              <CheckCircle size={16} />
              Test Connection
            </>
          )}
        </button>

        {testResult && (
          <div
            className={`mt-3 rounded-lg border p-3 text-sm ${
              testResult.success
                ? "border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-300"
                : "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300"
            }`}
          >
            <div className="flex items-start gap-2">
              {testResult.success ? (
                <CheckCircle size={16} className="mt-0.5 shrink-0" />
              ) : (
                <XCircle size={16} className="mt-0.5 shrink-0" />
              )}
              <div>
                <p className="font-medium">{testResult.message}</p>
                {testResult.terminalsFound !== undefined && (
                  <p className="mt-1 text-xs opacity-75">
                    Found {testResult.terminalsFound} terminals
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
