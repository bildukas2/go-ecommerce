import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminCustomOption } from "@/lib/api";
import { CustomOptionForm } from "@/components/admin/catalog/custom-option-form";
import { parseCustomOptionFormData } from "../form-utils";

export const dynamic = "force-dynamic";

type PageProps = { searchParams?: { [key: string]: string | string[] | undefined } };

function firstQueryValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return typeof value === "string" ? value : "";
}

function messageHref(basePath: string, key: "notice" | "error", message: string): string {
  const path = basePath.startsWith("/") ? basePath : "/admin/catalog/custom-options/new";
  const url = new URL(`http://localhost${path}`);
  url.searchParams.set(key, message);
  return `${url.pathname}?${url.searchParams.toString()}`;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Request failed";
}

export default function AdminCustomOptionCreatePage({ searchParams }: PageProps) {
  const notice = firstQueryValue(searchParams?.notice);
  const actionError = firstQueryValue(searchParams?.error);

  const createAction = async (formData: FormData) => {
    "use server";
    try {
      const payload = parseCustomOptionFormData(formData);
      await createAdminCustomOption(payload);
      revalidatePath("/admin/catalog/custom-options");
      redirect(messageHref("/admin/catalog/custom-options", "notice", "Custom option created"));
    } catch (error) {
      redirect(messageHref("/admin/catalog/custom-options/new", "error", errorMessage(error)));
    }
  };

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-4 md:p-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Create Customizable Option</h1>
        <p className="text-sm text-foreground/70">Define option type, requirement behavior, and pricing setup.</p>
      </div>

      {notice && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{notice}</div>}
      {actionError && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{actionError}</div>}

      <CustomOptionForm mode="create" submitAction={createAction} cancelHref="/admin/catalog/custom-options" />
    </div>
  );
}
