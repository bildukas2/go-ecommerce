"use client";

import { useState, useEffect } from "react";
import { Save, ArrowLeft, Globe, FileText, Code, CheckCircle2, Languages, Copy } from "lucide-react";
import Link from "next/link";
import { AdminPage, checkAdminPageSlug } from "@/lib/api";
import dynamic from "next/dynamic";

const RichTextEditor = dynamic(
  () => import("./rich-text-editor").then((m) => m.RichTextEditor),
  { ssr: false, loading: () => <div className="min-h-[400px] rounded-xl border border-surface-border bg-background/50 animate-pulse" /> }
);

type Props = {
  initialData?: AdminPage;
  onSubmit: (formData: FormData) => Promise<void>;
  isSubmitting?: boolean;
};

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "lt", label: "Lithuanian" },
];

const RESERVED_SLUGS = [
  "/",
  "/admin",
  "/api",
  "/checkout",
  "/cart",
  "/products",
  "/categories",
  "/success",
  "/account",
  "/blocked",
];

export function PageForm({ initialData, onSubmit, isSubmitting: externalSubmitting }: Props) {
  const [currentLang, setCurrentLang] = useState("en");
  const [titleI18n, setTitleI18n] = useState<Record<string, string>>(initialData?.title_i18n || { en: initialData?.title || "", lt: "" });
  const [contentHtmlI18n, setContentHtmlI18n] = useState<Record<string, string>>(initialData?.content_html_i18n || { en: initialData?.content_html || "", lt: "" });

  const [slug, setSlug] = useState(initialData?.slug || "/");
  const [slugError, setSlugError] = useState<string | null>(null);
  const [isCheckingSlug, setIsCheckingSlug] = useState(false);
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [editorMode, setEditorMode] = useState<"html" | "visual">(initialData?.editor_mode || "html");
  const [internalSubmitting, setInternalSubmitting] = useState(false);

  const isSubmitting = externalSubmitting || internalSubmitting;

  const currentContentHtml = contentHtmlI18n[currentLang] || "";

  useEffect(() => {
    if (initialData) {
      setTitleI18n(initialData.title_i18n || { en: initialData.title || "", lt: "" });
      setContentHtmlI18n(initialData.content_html_i18n || { en: initialData.content_html || "", lt: "" });
    }
  }, [initialData]);

  useEffect(() => {
    if (!slug) {
      setSlugError("Slug is required");
      setSlugAvailable(null);
      return;
    }

    if (!slug.startsWith("/")) {
      setSlugError("Slug must start with /");
      setSlugAvailable(null);
      return;
    }

    if (RESERVED_SLUGS.includes(slug.toLowerCase())) {
      setSlugError(`"${slug}" is a reserved slug`);
      setSlugAvailable(null);
      return;
    }

    const slugRegex = /^\/[a-z0-9]+(?:-[a-z0-9]+)*$/;
    if (slug !== "/" && !slugRegex.test(slug)) {
      setSlugError("Slug can only contain lowercase letters, numbers, and hyphens");
      setSlugAvailable(null);
      return;
    }

    setSlugError(null);

    // Skip uniqueness check if it hasn't changed from initial
    if (initialData?.slug === slug) {
      setSlugAvailable(true);
      return;
    }

    const timer = setTimeout(async () => {
      setIsCheckingSlug(true);
      try {
        const { available } = await checkAdminPageSlug(slug, initialData?.id);
        setSlugAvailable(available);
        if (!available) {
          setSlugError("This slug is already in use");
        }
      } catch (err) {
        console.error("Error checking slug:", err);
      } finally {
        setIsCheckingSlug(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [slug, initialData]);

  // Auto-generate slug from title if it's a new page
  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setTitleI18n(prev => ({ ...prev, [currentLang]: value }));

    if (!initialData && currentLang === "en") {
      const generatedSlug = "/" + value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      setSlug(generatedSlug === "/" ? "/" : generatedSlug);
    }
  };

  const copyEnToLt = () => {
    setTitleI18n(prev => ({ ...prev, lt: prev.en }));
    setContentHtmlI18n(prev => ({ ...prev, lt: prev.en }));
  };

  const isInvalid = !!slugError;

  const handleSubmit = async (formData: FormData) => {
    if (isInvalid || isSubmitting) return;
    
    // Ensure the main fields are set to EN values for backend compatibility if needed
    formData.set("title", titleI18n.en || "");
    formData.set("content_html", contentHtmlI18n.en || "");
    
    // Add i18n fields
    formData.set("title_i18n", JSON.stringify(titleI18n));
    formData.set("content_html_i18n", JSON.stringify(contentHtmlI18n));

    setInternalSubmitting(true);
    try {
      await onSubmit(formData);
    } finally {
      setInternalSubmitting(false);
    }
  };

  return (
    <form 
      action={handleSubmit} 
      className="flex flex-col gap-6"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/admin/cms/pages"
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-surface-border bg-background/50 text-foreground/70 transition-colors hover:bg-background hover:text-foreground"
          >
            <ArrowLeft size={18} />
          </Link>
          <h1 className="text-2xl font-bold">
            {initialData ? "Edit Page" : "Create Page"}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex rounded-xl border border-surface-border bg-background/50 p-1">
            {LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                type="button"
                onClick={() => setCurrentLang(lang.code)}
                className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  currentLang === lang.code
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-foreground/60 hover:text-foreground"
                }`}
              >
                <Languages size={14} />
                {lang.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={copyEnToLt}
            className="flex items-center gap-2 rounded-xl border border-surface-border bg-background/50 px-3 py-2 text-sm font-medium text-foreground/70 transition-colors hover:bg-background hover:text-foreground"
            title="Copy English content to Lithuanian"
          >
            <Copy size={16} />
            Copy EN → LT
          </button>
          <button
            type="submit"
            disabled={isInvalid || isCheckingSlug || isSubmitting}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Saving...
              </span>
            ) : (
              <>
                <Save size={18} />
                {initialData ? "Save Changes" : "Create Page"}
              </>
            )}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 flex flex-col gap-6">
          <div className="glass rounded-2xl p-6">
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-foreground/70">
                  Title ({currentLang.toUpperCase()})
                </label>
                <input
                  name="title_input"
                  type="text"
                  placeholder={`e.g. About Us (${currentLang})`}
                  value={titleI18n[currentLang] || ""}
                  onChange={handleTitleChange}
                  required
                  className="w-full rounded-xl border border-surface-border bg-background/50 px-3 py-2 outline-none focus:border-blue-500/50"
                />
              </div>
              
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-foreground/70">Slug (URL)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40 text-sm">/page/</span>
                  <input
                    name="slug"
                    type="text"
                    placeholder="about-us"
                    value={slug.startsWith("/") ? slug.slice(1) : slug}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSlug(val.startsWith("/") ? val : "/" + val);
                    }}
                    required
                    className={`w-full rounded-xl border bg-background/50 py-2 pl-14 pr-3 outline-none focus:border-blue-500/50 ${
                      isInvalid ? "border-red-500/50" : "border-surface-border"
                    }`}
                  />
                </div>
                {slugError && <p className="text-xs text-red-500">{slugError}</p>}
                {slugAvailable === true && !isInvalid && !isCheckingSlug && (
                  <p className="flex items-center gap-1 text-xs text-emerald-500">
                    <CheckCircle2 size={12} />
                    Slug is available
                  </p>
                )}
                {isCheckingSlug && <p className="text-xs text-foreground/40">Checking availability...</p>}
              </div>
            </div>
          </div>

          <div className="glass flex flex-1 flex-col overflow-hidden rounded-2xl">
            <div className="flex border-b border-surface-border px-2">
              <button
                type="button"
                onClick={() => setEditorMode("html")}
                className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                  editorMode === "html" ? "border-blue-600 text-blue-600" : "border-transparent text-foreground/60 hover:text-foreground"
                }`}
              >
                <Code size={16} />
                HTML Editor
              </button>
              <button
                type="button"
                onClick={() => setEditorMode("visual")}
                className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                  editorMode === "visual" ? "border-blue-600 text-blue-600" : "border-transparent text-foreground/60 hover:text-foreground"
                }`}
              >
                <FileText size={16} />
                Visual Editor
              </button>
            </div>
            
            <div className="flex-1 p-4">
              {editorMode === "html" ? (
                <textarea
                  name="content_html_input"
                  placeholder={`Write your ${currentLang.toUpperCase()} HTML content here...`}
                  value={currentContentHtml}
                  onChange={(e) => setContentHtmlI18n(prev => ({ ...prev, [currentLang]: e.target.value }))}
                  className="min-h-[400px] w-full resize-none rounded-xl border border-surface-border bg-background/50 p-4 font-mono text-sm outline-none focus:border-blue-500/50"
                />
              ) : (
                <>
                  <RichTextEditor 
                    key={`${currentLang}-${editorMode}`}
                    value={currentContentHtml} 
                    onChange={(val) => setContentHtmlI18n(prev => ({ ...prev, [currentLang]: val }))} 
                  />
                </>
              )}
            </div>
            <input type="hidden" name="editor_mode" value={editorMode} />
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <div className="glass rounded-2xl p-6">
            <div className="flex flex-col gap-4">
              <h3 className="flex items-center gap-2 font-semibold">
                <Globe size={18} className="text-blue-500" />
                Publishing
              </h3>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-foreground/70">Status</label>
                <select
                  name="status"
                  defaultValue={initialData?.status || "draft"}
                  className="w-full rounded-xl border border-surface-border bg-background/50 px-3 py-2 outline-none focus:border-blue-500/50"
                >
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                </select>
              </div>
              {initialData?.published_at && (
                <p className="text-xs text-foreground/50">
                  Published on {new Date(initialData.published_at).toLocaleString()}
                </p>
              )}
            </div>
          </div>

          <div className="glass rounded-2xl p-6">
            <div className="flex flex-col gap-4">
              <h3 className="font-semibold">Search Engine Optimization</h3>
              <p className="text-xs text-foreground/50">
                Customize how this page appears in search results.
              </p>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-foreground/70">Meta Title</label>
                <input
                  name="meta_title"
                  type="text"
                  placeholder="SEO Title"
                  defaultValue={initialData?.meta_title || ""}
                  className="w-full rounded-xl border border-surface-border bg-background/50 px-3 py-2 outline-none focus:border-blue-500/50"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-foreground/70">Meta Description</label>
                <textarea
                  name="meta_description"
                  placeholder="Search engine description..."
                  defaultValue={initialData?.meta_description || ""}
                  rows={4}
                  className="w-full resize-none rounded-xl border border-surface-border bg-background/50 px-3 py-2 outline-none focus:border-blue-500/50"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
