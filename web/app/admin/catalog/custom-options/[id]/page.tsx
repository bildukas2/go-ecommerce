import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminCustomOption, updateAdminCustomOption } from "@/lib/api";
import { CustomOptionForm } from "@/components/admin/catalog/custom-option-form";
import { parseCustomOptionFormData } from "../form-utils";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams?: { [key: string]: string | string[] | undefined };
};

function firstQueryValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return typeof value === "string" ? value : "";
}

function messageHref(basePath: string, key: "notice" | "error", message: string): string {
  const path = basePath.startsWith("/") ? basePath : "/admin/catalog/custom-options";
  const url = new URL(`http://localhost${path}`);
  url.searchParams.set(key, message);
  return `${url.pathname}?${url.searchParams.toString()}`;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Request failed";
}

export default async function AdminCustomOptionEditPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const resolvedSearchParams = await Promise.resolve(searchParams ?? {});
  const notice = firstQueryValue(resolvedSearchParams.notice);
  const actionError = firstQueryValue(resolvedSearchParams.error);

  let option: Awaited<ReturnType<typeof getAdminCustomOption>> | null = null;
  let fetchError: string | null = null;
  try {
    option = await getAdminCustomOption(id);
  } catch {
    fetchError = "Failed to load this custom option.";
  }

  const updateAction = async (formData: FormData) => {
    "use server";
    try {
      const payload = parseCustomOptionFormData(formData);
      await updateAdminCustomOption(id, payload);
      revalidatePath("/admin/catalog/custom-options");
      revalidatePath(`/admin/catalog/custom-options/${id}`);
      redirect(messageHref("/admin/catalog/custom-options", "notice", "Custom option updated"));
    } catch (error) {
      redirect(messageHref(`/admin/catalog/custom-options/${id}`, "error", errorMessage(error)));
    }
  };

  if (!option) {
    return (
      <div className="mx-auto flex max-w-5xl flex-col gap-6 p-4 md:p-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Edit Customizable Option</h1>
          <p className="text-sm text-foreground/70">Load an existing option and update its behavior.</p>
        </div>
        {fetchError && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{fetchError}</div>}
        <Link
          href="/admin/catalog/custom-options"
          className="inline-flex w-fit rounded-xl border border-surface-border bg-foreground/[0.02] px-4 py-2 text-sm font-medium transition-colors hover:bg-foreground/[0.05]"
        >
          Back to options
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-4 md:p-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Edit Customizable Option</h1>
        <p className="text-sm text-foreground/70">Update option type, values, and pricing behavior.</p>
      </div>

      {notice && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{notice}</div>}
      {actionError && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{actionError}</div>}

      <CustomOptionForm mode="edit" initial={option} submitAction={updateAction} cancelHref="/admin/catalog/custom-options" />
    </div>
  );
}
