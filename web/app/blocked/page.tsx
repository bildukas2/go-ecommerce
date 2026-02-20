import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { AlertTriangle } from "lucide-react";
import { submitBlockedReport } from "@/lib/api";

export const dynamic = "force-dynamic";

type PageProps = { searchParams?: { [key: string]: string | string[] | undefined } };

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return typeof value === "string" ? value : "";
}

function blockedHref(kind: "notice" | "error", message: string): string {
  const url = new URL("http://localhost/blocked");
  url.searchParams.set(kind, message);
  return `${url.pathname}?${url.searchParams.toString()}`;
}

export default async function BlockedPage({ searchParams }: PageProps) {
  const resolvedSearchParams = await Promise.resolve(searchParams ?? {});
  const notice = firstParam(resolvedSearchParams.notice);
  const actionError = firstParam(resolvedSearchParams.error);

  const reportAction = async (formData: FormData) => {
    "use server";
    const email = String(formData.get("email") ?? "").trim();
    const message = String(formData.get("message") ?? "");

    try {
      await submitBlockedReport({ email, message });
      revalidatePath("/blocked");
      redirect(blockedHref("notice", "Report submitted. Admin will review your case."));
    } catch (error) {
      const messageText = error instanceof Error ? error.message : "Failed to submit report";
      redirect(blockedHref("error", messageText));
    }
  };

  return (
    <div className="hero-aurora min-h-screen bg-background px-4 py-10 text-foreground md:px-8">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
        <section className="glass rounded-2xl border p-6 md:p-8">
          <div className="mb-4 flex items-start gap-3">
            <div className="mt-0.5 rounded-xl border border-red-500/30 bg-red-500/12 p-2 text-red-600 dark:text-red-300">
              <AlertTriangle size={18} />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Your IP has been temporarily blocked</h1>
              <p className="mt-2 text-sm text-foreground/70">
                If this is unexpected, send a short report to the admin team.
              </p>
            </div>
          </div>

          {notice && <p className="mb-3 rounded-xl border border-emerald-300/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">{notice}</p>}
          {actionError && <p className="mb-3 rounded-xl border border-red-300/40 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">{actionError}</p>}

          <form action={reportAction} className="space-y-3">
            <label className="block space-y-1 text-sm">
              <span>Email</span>
              <input
                name="email"
                type="email"
                required
                maxLength={320}
                className="w-full rounded-xl border border-surface-border bg-background px-3 py-2"
                placeholder="you@example.com"
              />
            </label>
            <label className="block space-y-1 text-sm">
              <span>Message</span>
              <textarea
                name="message"
                required
                maxLength={1000}
                rows={6}
                className="w-full rounded-xl border border-surface-border bg-background px-3 py-2"
                placeholder="Describe what happened."
              />
            </label>
            <p className="text-sm font-bold text-red-600 dark:text-red-300">
              No special symbols or hidden characters are allowed.
            </p>
            <button
              type="submit"
              className="w-full rounded-xl border border-cyan-500/35 bg-cyan-500/12 px-4 py-2 text-sm font-semibold text-cyan-700 transition-colors hover:bg-cyan-500/18 dark:text-cyan-300"
            >
              Send Report
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
