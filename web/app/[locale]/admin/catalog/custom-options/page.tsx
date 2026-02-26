import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { CustomOptionsPageClient } from "@/components/admin/catalog/custom-options-page-client";
import {
  createAdminCustomOption,
  deleteAdminCustomOption,
  getAdminCustomOption,
  getAdminCustomOptions,
  type AdminCustomOption,
} from "@/lib/api";

export const dynamic = "force-dynamic";

type PageProps = { searchParams?: { [key: string]: string | string[] | undefined } };

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

function safeReturnTo(value: FormDataEntryValue | null): string {
  if (typeof value !== "string") return "/admin/catalog/custom-options";
  const trimmed = value.trim();
  if (!trimmed.startsWith("/admin/catalog/custom-options")) return "/admin/catalog/custom-options";
  return trimmed;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Request failed";
}

function duplicatedCode(baseCode: string): string {
  const seed = Date.now().toString(36).slice(-4);
  return `${baseCode}-copy-${seed}`.slice(0, 64);
}

export default async function AdminCustomOptionsPage({ searchParams }: PageProps) {
  const resolvedSearchParams = await Promise.resolve(searchParams ?? {});
  const notice = firstQueryValue(resolvedSearchParams.notice);
  const actionError = firstQueryValue(resolvedSearchParams.error);
  const query = firstQueryValue(resolvedSearchParams.q).trim();
  const typeGroup = firstQueryValue(resolvedSearchParams.type_group).trim().toLowerCase();

  const currentQuery = new URLSearchParams();
  if (query) currentQuery.set("q", query);
  if (typeGroup) currentQuery.set("type_group", typeGroup);
  const currentHref = `/admin/catalog/custom-options${currentQuery.toString() ? `?${currentQuery.toString()}` : ""}`;

  const deleteAction = async (formData: FormData) => {
    "use server";
    const returnTo = safeReturnTo(formData.get("return_to"));
    const optionID = String(formData.get("option_id") ?? "").trim();
    if (!optionID) redirect(messageHref(returnTo, "error", "Missing option id"));
    let destination = messageHref(returnTo, "notice", "Custom option deleted");
    try {
      await deleteAdminCustomOption(optionID);
      revalidatePath("/admin/catalog/custom-options");
    } catch (error) {
      destination = messageHref(returnTo, "error", errorMessage(error));
    }
    redirect(destination);
  };

  const duplicateAction = async (formData: FormData) => {
    "use server";
    const returnTo = safeReturnTo(formData.get("return_to"));
    const optionID = String(formData.get("option_id") ?? "").trim();
    if (!optionID) redirect(messageHref(returnTo, "error", "Missing option id"));
    let destination = messageHref(returnTo, "notice", "Custom option duplicated");
    try {
      const original = await getAdminCustomOption(optionID);
      await createAdminCustomOption({
        store_id: original.store_id,
        code: duplicatedCode(original.code),
        title: `${original.title} Copy`,
        type_group: original.type_group,
        type: original.type,
        required: original.required,
        sort_order: original.sort_order,
        price_type: original.price_type ?? null,
        price_value: original.price_value ?? null,
        is_active: original.is_active,
        values: original.values.map((value) => ({
          title: value.title,
          sku: value.sku ?? null,
          sort_order: value.sort_order,
          price_type: value.price_type,
          price_value: value.price_value,
          is_default: value.is_default,
        })),
      });
      revalidatePath("/admin/catalog/custom-options");
    } catch (error) {
      destination = messageHref(returnTo, "error", errorMessage(error));
    }
    redirect(destination);
  };

  let items: AdminCustomOption[] = [];
  let fetchError: string | null = null;
  try {
    const response = await getAdminCustomOptions({
      q: query || undefined,
      type_group: typeGroup || undefined,
    });
    items = response.items;
  } catch (error) {
    if (error instanceof Error && error.message.includes("401")) {
      fetchError = "Unauthorized. Please check your admin credentials.";
    } else {
      fetchError = "Failed to load customizable options. Please retry.";
    }
  }

  return (
    <CustomOptionsPageClient
      notice={notice}
      actionError={actionError}
      query={query}
      typeGroup={typeGroup}
      currentHref={currentHref}
      items={items}
      fetchError={fetchError}
      deleteAction={deleteAction}
      duplicateAction={duplicateAction}
    />
  );
}
