import Link from "next/link";

type NoticeTone = "success" | "danger";

export function NoticeCard({ tone, message }: { tone: NoticeTone; message: string }) {
  const className =
    tone === "success"
      ? "rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700"
      : "rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700";

  return <div className={className}>{message}</div>;
}

export function BackToOptionsButton() {
  return (
    <Link
      href="/admin/catalog/custom-options"
      className="rounded-xl border border-surface-border bg-foreground/[0.02] px-4 py-2 text-sm font-medium transition-colors hover:bg-foreground/[0.05]"
    >
      Back to options
    </Link>
  );
}
