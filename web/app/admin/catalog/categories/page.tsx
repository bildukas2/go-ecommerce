import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createAdminCategory,
  deleteAdminCategory,
  getAdminMedia,
  getAdminCategories,
  importAdminMediaURL,
  updateAdminCategory,
  uploadAdminMedia,
} from "@/lib/api";
import { CategoryMediaPicker } from "@/components/admin/catalog/category-media-picker";

export const dynamic = "force-dynamic";

type PageProps = { searchParams?: { [key: string]: string | string[] | undefined } };

function firstQueryValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return typeof value === "string" ? value : "";
}

function cleanOptional(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized ? normalized : null;
}

function resolveCategoryImageURL(formData: FormData): string | null {
  const selected = cleanOptional(formData.get("media_selected_url"));
  if (selected) return selected;
  return cleanOptional(formData.get("default_image_url"));
}

function messageHref(basePath: string, key: "notice" | "error", message: string): string {
  const path = basePath.startsWith("/") ? basePath : "/admin/catalog/categories";
  const url = new URL(`http://localhost${path}`);
  url.searchParams.set(key, message);
  return `${url.pathname}?${url.searchParams.toString()}`;
}

function safeReturnTo(value: FormDataEntryValue | null): string {
  if (typeof value !== "string") return "/admin/catalog/categories";
  const trimmed = value.trim();
  if (!trimmed.startsWith("/admin/catalog/categories")) return "/admin/catalog/categories";
  return trimmed;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Request failed";
}

export default async function AdminCategoriesPage({ searchParams }: PageProps) {
  let categories: Awaited<ReturnType<typeof getAdminCategories>>["items"] = [];
  let mediaAssets: Awaited<ReturnType<typeof getAdminMedia>>["items"] = [];
  let fetchError: string | null = null;
  let mediaLoadError: string | null = null;

  const notice = firstQueryValue(searchParams?.notice);
  const actionError = firstQueryValue(searchParams?.error);

  const createCategoryAction = async (formData: FormData) => {
    "use server";

    const returnTo = safeReturnTo(formData.get("return_to"));
    try {
      await createAdminCategory({
        slug: String(formData.get("slug") ?? "").trim(),
        name: String(formData.get("name") ?? "").trim(),
        description: String(formData.get("description") ?? "").trim(),
        parent_id: cleanOptional(formData.get("parent_id")),
        default_image_url: resolveCategoryImageURL(formData),
        seo_title: cleanOptional(formData.get("seo_title")),
        seo_description: cleanOptional(formData.get("seo_description")),
      });
      revalidatePath("/admin/catalog/categories");
      redirect(messageHref(returnTo, "notice", "Category created"));
    } catch (error) {
      redirect(messageHref(returnTo, "error", errorMessage(error)));
    }
  };

  const updateCategoryAction = async (formData: FormData) => {
    "use server";

    const returnTo = safeReturnTo(formData.get("return_to"));
    const categoryID = String(formData.get("category_id") ?? "").trim();
    if (!categoryID) {
      redirect(messageHref(returnTo, "error", "Missing category id"));
    }

    try {
      await updateAdminCategory(categoryID, {
        slug: String(formData.get("slug") ?? "").trim(),
        name: String(formData.get("name") ?? "").trim(),
        description: String(formData.get("description") ?? "").trim(),
        parent_id: cleanOptional(formData.get("parent_id")),
        default_image_url: resolveCategoryImageURL(formData),
        seo_title: cleanOptional(formData.get("seo_title")),
        seo_description: cleanOptional(formData.get("seo_description")),
      });
      revalidatePath("/admin/catalog/categories");
      redirect(messageHref(returnTo, "notice", "Category updated"));
    } catch (error) {
      redirect(messageHref(returnTo, "error", errorMessage(error)));
    }
  };

  const uploadMediaAction = async (formData: FormData) => {
    "use server";

    const returnTo = safeReturnTo(formData.get("return_to"));
    const file = formData.get("media_upload_file");
    if (!(file instanceof File) || file.size <= 0) {
      redirect(messageHref(returnTo, "error", "Choose an image file to upload"));
    }

    try {
      await uploadAdminMedia(file, String(formData.get("media_upload_alt") ?? ""));
      revalidatePath("/admin/catalog/categories");
      redirect(messageHref(returnTo, "notice", "Image uploaded to media library"));
    } catch (error) {
      redirect(messageHref(returnTo, "error", errorMessage(error)));
    }
  };

  const importMediaAction = async (formData: FormData) => {
    "use server";

    const returnTo = safeReturnTo(formData.get("return_to"));
    const importURL = String(formData.get("media_import_url") ?? "").trim();
    const consentConfirmed = String(formData.get("media_import_consent") ?? "").trim().toLowerCase() === "yes";
    if (!importURL) {
      redirect(messageHref(returnTo, "error", "Import URL is required"));
    }
    if (!consentConfirmed) {
      redirect(messageHref(returnTo, "error", "Consent is required before URL import"));
    }

    try {
      await importAdminMediaURL({
        url: importURL,
        alt: String(formData.get("media_import_alt") ?? ""),
        consent_confirmed: true,
      });
      revalidatePath("/admin/catalog/categories");
      redirect(messageHref(returnTo, "notice", "Image imported to media library"));
    } catch (error) {
      redirect(messageHref(returnTo, "error", errorMessage(error)));
    }
  };

  const deleteCategoryAction = async (formData: FormData) => {
    "use server";

    const returnTo = safeReturnTo(formData.get("return_to"));
    const categoryID = String(formData.get("category_id") ?? "").trim();
    const expectedSlug = String(formData.get("category_slug") ?? "").trim();
    const affectedProducts = Number(String(formData.get("affected_products") ?? "0"));
    const confirmDelete = String(formData.get("confirm_delete") ?? "").trim().toLowerCase() === "yes";

    if (!categoryID) {
      redirect(messageHref(returnTo, "error", "Missing category id"));
    }
    if (!confirmDelete) {
      redirect(messageHref(returnTo, "error", "Confirm category deletion before continuing"));
    }

    try {
      const result = await deleteAdminCategory(categoryID);
      revalidatePath("/admin/catalog/categories");
      const fallbackNotice = result.reassigned_products > 0
        ? `; ${result.reassigned_products} moved to ${result.fallback_category || "fallback category"}`
        : "";
      redirect(messageHref(
        returnTo,
        "notice",
        `Category deleted (${result.deleted_category_slug || expectedSlug}, affected ${result.affected_products || affectedProducts}${fallbackNotice})`,
      ));
    } catch (error) {
      redirect(messageHref(returnTo, "error", errorMessage(error)));
    }
  };

  try {
    const [categoriesResponse, mediaResponse] = await Promise.all([
      getAdminCategories(),
      getAdminMedia({ limit: 100, offset: 0 }),
    ]);
    categories = categoriesResponse.items;
    mediaAssets = mediaResponse.items;
  } catch {
    try {
      const response = await getAdminCategories();
      categories = response.items;
      mediaLoadError = "Media library unavailable. You can still use manual image URL.";
    } catch {
      fetchError = "Failed to load categories. Please retry.";
    }
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 p-4 md:p-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Categories</h1>
          <p className="text-sm text-foreground/70">Create and maintain category content, images, and SEO metadata.</p>
        </div>
        <Link
          href="/admin/catalog/products"
          className="rounded-xl border border-surface-border bg-foreground/[0.02] px-4 py-2 text-sm font-medium transition-colors hover:bg-foreground/[0.05]"
        >
          Manage products
        </Link>
      </div>

      {notice && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{notice}</div>}
      {actionError && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{actionError}</div>}
      {fetchError && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{fetchError}</div>}

      <section className="glass rounded-2xl border p-4 md:p-5">
        <details className="group">
          <summary className="cursor-pointer list-none text-lg font-semibold">
            <div className="flex items-center justify-between gap-3">
              <span>Create category</span>
              <span className="text-xs text-foreground/65 group-open:hidden">Open</span>
              <span className="hidden text-xs text-foreground/65 group-open:inline">Hide</span>
            </div>
          </summary>
          <form action={createCategoryAction} className="mt-4 grid gap-3 md:grid-cols-2">
            <input type="hidden" name="return_to" value="/admin/catalog/categories" />
            <label className="space-y-1 text-sm">
              <span>Name</span>
              <input name="name" required className="w-full rounded-xl border border-surface-border bg-background px-3 py-2" />
            </label>
            <label className="space-y-1 text-sm">
              <span>Slug</span>
              <input name="slug" required placeholder="home-accessories" className="w-full rounded-xl border border-surface-border bg-background px-3 py-2" />
            </label>
            <label className="space-y-1 text-sm md:col-span-2">
              <span>Description</span>
              <textarea name="description" rows={3} className="w-full rounded-xl border border-surface-border bg-background px-3 py-2" />
            </label>
            <label className="space-y-1 text-sm">
              <span>Parent category ID (optional)</span>
              <input name="parent_id" className="w-full rounded-xl border border-surface-border bg-background px-3 py-2" />
            </label>
            <div className="space-y-1 text-sm md:col-span-2">
              <span>Category image</span>
              <CategoryMediaPicker
                mediaAssets={mediaAssets}
                mediaLoadError={mediaLoadError}
                defaultImageURL=""
                uploadAction={uploadMediaAction}
                importAction={importMediaAction}
              />
            </div>
            <label className="space-y-1 text-sm">
              <span>SEO title</span>
              <input name="seo_title" maxLength={120} className="w-full rounded-xl border border-surface-border bg-background px-3 py-2" />
            </label>
            <label className="space-y-1 text-sm">
              <span>SEO description</span>
              <input name="seo_description" maxLength={320} className="w-full rounded-xl border border-surface-border bg-background px-3 py-2" />
            </label>
            <button
              type="submit"
              className="md:col-span-2 rounded-xl border border-blue-500/35 bg-blue-500/12 px-4 py-2 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-500/18 dark:text-blue-300"
            >
              Create category
            </button>
          </form>
        </details>
      </section>

      {!fetchError && categories.length === 0 && (
        <div className="glass rounded-2xl border p-10 text-center">
          <h2 className="text-lg font-semibold">No categories yet</h2>
          <p className="mt-2 text-sm text-foreground/65">Add your first category using the form above.</p>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {categories.map((category) => (
          <article
            key={category.id}
            className="glass overflow-hidden rounded-2xl border shadow-[0_14px_30px_rgba(2,6,23,0.08)] dark:shadow-[0_20px_38px_rgba(2,6,23,0.35)]"
          >
            <div className="image-default-bg relative h-36 border-b border-surface-border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={category.defaultImageUrl || "/images/noImage.png"}
                alt={category.name}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            </div>
            <div className="space-y-3 p-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="line-clamp-2 text-lg font-semibold">{category.name}</h2>
                <p className="font-mono text-xs text-foreground/60">/{category.slug}</p>
              </div>
              <p className="text-sm text-foreground/75">{category.description || "No description"}</p>
              <details className="rounded-xl border border-surface-border bg-foreground/[0.02] p-3">
                <summary className="cursor-pointer text-sm font-medium">Edit category</summary>
                <form action={updateCategoryAction} className="mt-3 grid gap-3 text-sm">
                  <input type="hidden" name="return_to" value="/admin/catalog/categories" />
                  <input type="hidden" name="category_id" value={category.id} />
                  <label className="space-y-1">
                    <span>Name</span>
                    <input defaultValue={category.name} name="name" required className="w-full rounded-lg border border-surface-border bg-background px-3 py-2" />
                  </label>
                  <label className="space-y-1">
                    <span>Slug</span>
                    <input defaultValue={category.slug} name="slug" required className="w-full rounded-lg border border-surface-border bg-background px-3 py-2" />
                  </label>
                  <label className="space-y-1">
                    <span>Description</span>
                    <textarea defaultValue={category.description} name="description" rows={3} className="w-full rounded-lg border border-surface-border bg-background px-3 py-2" />
                  </label>
                  <label className="space-y-1">
                    <span>Parent category ID (optional)</span>
                    <input defaultValue={category.parentId ?? ""} name="parent_id" className="w-full rounded-lg border border-surface-border bg-background px-3 py-2" />
                  </label>
                  <div className="space-y-1">
                    <span>Category image</span>
                    <CategoryMediaPicker
                      mediaAssets={mediaAssets}
                      mediaLoadError={mediaLoadError}
                      defaultImageURL={category.defaultImageUrl ?? ""}
                      uploadAction={uploadMediaAction}
                      importAction={importMediaAction}
                    />
                  </div>
                  <label className="space-y-1">
                    <span>SEO title</span>
                    <input defaultValue={category.seoTitle ?? ""} name="seo_title" maxLength={120} className="w-full rounded-lg border border-surface-border bg-background px-3 py-2" />
                  </label>
                  <label className="space-y-1">
                    <span>SEO description</span>
                    <input defaultValue={category.seoDescription ?? ""} name="seo_description" maxLength={320} className="w-full rounded-lg border border-surface-border bg-background px-3 py-2" />
                  </label>
                  <button
                    type="submit"
                    className="rounded-lg border border-blue-500/35 bg-blue-500/12 px-3 py-2 font-medium text-blue-700 transition-colors hover:bg-blue-500/18 dark:text-blue-300"
                  >
                    Save changes
                  </button>
                </form>

                <form action={deleteCategoryAction} className="mt-3 space-y-2 rounded-lg border border-red-300/40 bg-red-500/[0.05] p-3">
                  <input type="hidden" name="return_to" value="/admin/catalog/categories" />
                  <input type="hidden" name="category_id" value={category.id} />
                  <input type="hidden" name="category_slug" value={category.slug} />
                  <input type="hidden" name="affected_products" value={category.product_count} />
                  <p className="text-xs text-red-700 dark:text-red-300">
                    Delete this category? It currently affects {category.product_count} product{category.product_count === 1 ? "" : "s"}.
                    Products that would have no categories left are reassigned to <span className="font-medium">uncategorized</span>.
                  </p>
                  <label className="flex items-start gap-2 text-xs text-red-700 dark:text-red-300">
                    <input name="confirm_delete" type="checkbox" value="yes" className="mt-0.5 h-4 w-4 rounded border-red-400/50" />
                    <span>I understand this action and want to delete this category.</span>
                  </label>
                  <button
                    type="submit"
                    className="w-full rounded-lg border border-red-500/45 bg-red-500/14 px-3 py-2 font-medium text-red-700 transition-colors hover:bg-red-500/20 dark:text-red-300"
                  >
                    Delete category
                  </button>
                </form>
              </details>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
