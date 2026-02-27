"use client";

import { useState, useMemo } from "react";
import { useRouter } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Save, Search, X, CheckCircle2, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { updateAdminTranslation } from "@/lib/api";

interface TranslationEditorProps {
  locale: string;
  initialData: Record<string, any>;
}

// Helper to flatten nested object
function flattenObject(obj: Record<string, any>, prefix = ""): Record<string, string> {
  return Object.keys(obj).reduce((acc: Record<string, string>, k: string) => {
    const pre = prefix.length ? prefix + "." : "";
    if (typeof obj[k] === "object" && obj[k] !== null && !Array.isArray(obj[k])) {
      Object.assign(acc, flattenObject(obj[k], pre + k));
    } else {
      acc[pre + k] = String(obj[k]);
    }
    return acc;
  }, {});
}

// Helper to unflatten object
function unflattenObject(data: Record<string, string>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const i in data) {
    const keys = i.split(".");
    keys.reduce((r, a, j) => {
      return r[a] || (r[a] = keys.length - 1 === j ? data[i] : {});
    }, result);
  }
  return result;
}

export function TranslationEditor({ locale, initialData }: TranslationEditorProps) {
  const router = useRouter();
  const [flatData, setFlatData] = useState<Record<string, string>>(() => flattenObject(initialData));
  const [search, setSearch] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const filteredKeys = useMemo(() => {
    const s = search.toLowerCase();
    return Object.keys(flatData)
      .filter((key) => key.toLowerCase().includes(s) || flatData[key].toLowerCase().includes(s))
      .sort();
  }, [flatData, search]);

  const handleChange = (key: string, value: string) => {
    setFlatData((prev) => ({ ...prev, [key]: value }));
    if (saveStatus !== "idle") setSaveStatus("idle");
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveStatus("idle");
    try {
      const nestedData = unflattenObject(flatData);
      await updateAdminTranslation(locale, nestedData);
      setSaveStatus("success");
      setTimeout(() => setSaveStatus("idle"), 3000);
    } catch (error) {
      console.error("Failed to save translations:", error);
      setSaveStatus("error");
      setErrorMessage(error instanceof Error ? error.message : "Unknown error occurred");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            onClick={() => router.back()}
            className="rounded-xl border-surface-border bg-background/50 backdrop-blur-sm"
          >
            <ArrowLeft size={18} />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Editing {locale.toUpperCase()}</h1>
            <p className="text-sm text-foreground/60">{locale}.json</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <AnimatePresence mode="wait">
            {saveStatus === "success" && (
              <motion.div
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="flex items-center gap-2 text-sm font-medium text-green-600 dark:text-green-400"
              >
                <CheckCircle2 size={16} />
                Saved successfully
              </motion.div>
            )}
            {saveStatus === "error" && (
              <motion.div
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="flex items-center gap-2 text-sm font-medium text-red-600 dark:text-red-400"
              >
                <AlertCircle size={16} />
                {errorMessage || "Failed to save"}
              </motion.div>
            )}
          </AnimatePresence>

          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="rounded-xl bg-blue-600 px-6 font-semibold text-white shadow-lg shadow-blue-500/20 transition-all hover:bg-blue-700 hover:shadow-blue-500/40 active:scale-95 disabled:opacity-50"
          >
            {isSaving ? (
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Saving...
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Save size={18} />
                Save Changes
              </div>
            )}
          </Button>
        </div>
      </div>

      <div className="glass relative flex items-center rounded-2xl border border-surface-border/50 bg-background/50 px-4 py-2 focus-within:ring-2 focus-within:ring-blue-500/50">
        <Search className="mr-2 text-foreground/40" size={18} />
        <input
          type="text"
          placeholder="Search keys or values..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-transparent py-2 text-sm outline-none placeholder:text-foreground/30"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="ml-2 text-foreground/40 hover:text-foreground"
          >
            <X size={16} />
          </button>
        )}
      </div>

      <div className="glass overflow-hidden rounded-2xl border border-surface-border/50 bg-background/30 shadow-xl backdrop-blur-md">
        <div className="max-h-[calc(100vh-320px)] overflow-y-auto p-1">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-background/80 backdrop-blur-md">
              <tr className="border-b border-surface-border/50 text-left">
                <th className="w-1/3 p-4 font-semibold text-foreground/70">Key</th>
                <th className="p-4 font-semibold text-foreground/70">Translation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border/30">
              {filteredKeys.length === 0 ? (
                <tr>
                  <td colSpan={2} className="p-12 text-center text-foreground/50">
                    No results found matching your search.
                  </td>
                </tr>
              ) : (
                filteredKeys.map((key) => (
                  <tr key={key} className="group transition-colors hover:bg-foreground/[0.02]">
                    <td className="p-4 align-top">
                      <div className="break-all font-mono text-xs text-foreground/60 group-hover:text-foreground/90">
                        {key}
                      </div>
                    </td>
                    <td className="p-2">
                      <textarea
                        value={flatData[key]}
                        onChange={(e) => handleChange(key, e.target.value)}
                        className="min-h-[40px] w-full rounded-xl border border-transparent bg-transparent p-2 transition-all focus:border-blue-500/30 focus:bg-background focus:outline-none focus:ring-4 focus:ring-blue-500/10"
                        rows={Math.max(1, flatData[key].split("\n").length)}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
