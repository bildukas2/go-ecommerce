import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Button, Card, CardBody } from "@heroui/react";
import { ChevronRight } from "lucide-react";
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

type NoticeTone = "success" | "danger";

function NoticeCard({ tone, message }: { tone: NoticeTone; message: string }) {
  const className =
    tone === "success"
      ? "rounded-2xl border border-emerald-300/60 bg-emerald-50/80 text-emerald-800"
      : "rounded-2xl border border-danger-300/60 bg-danger-50/80 text-danger-800";

  return (
    <Card className={className}>
      <CardBody className="py-3 text-sm">{message}</CardBody>
    </Card>
  );
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
    let destination = messageHref("/admin/catalog/custom-options", "notice", "Custom option updated");
    try {
      const payload = parseCustomOptionFormData(formData);
      await updateAdminCustomOption(id, payload);
      revalidatePath("/admin/catalog/custom-options");
      revalidatePath(`/admin/catalog/custom-options/${id}`);
    } catch (error) {
      destination = messageHref(`/admin/catalog/custom-options/${id}`, "error", errorMessage(error));
    }
    redirect(destination);
  };

  if (!option) {
    return (
      <div className="mx-auto flex max-w-5xl flex-col gap-6 p-4 md:p-8">
        <div className="space-y-4">
          <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-xs text-foreground/70">
            <Link href="/admin" className="transition-colors hover:text-foreground">
              Admin
            </Link>
            <ChevronRight size={14} />
            <Link href="/admin/catalog" className="transition-colors hover:text-foreground">
              Catalog
            </Link>
            <ChevronRight size={14} />
            <Link href="/admin/catalog/custom-options" className="transition-colors hover:text-foreground">
              Customizable Options
            </Link>
            <ChevronRight size={14} />
            <span className="text-foreground">Edit</span>
          </nav>

          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Edit Customizable Option</h1>
              <p className="text-sm text-foreground/70">Load an existing option and update its behavior.</p>
            </div>
            <Button as={Link} href="/admin/catalog/custom-options" variant="bordered">
              Back to options
            </Button>
          </div>
        </div>
        {fetchError && <NoticeCard tone="danger" message={fetchError} />}
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-4 md:p-8">
      <div className="space-y-4">
        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-xs text-foreground/70">
          <Link href="/admin" className="transition-colors hover:text-foreground">
            Admin
          </Link>
          <ChevronRight size={14} />
          <Link href="/admin/catalog" className="transition-colors hover:text-foreground">
            Catalog
          </Link>
          <ChevronRight size={14} />
          <Link href="/admin/catalog/custom-options" className="transition-colors hover:text-foreground">
            Customizable Options
          </Link>
          <ChevronRight size={14} />
          <span className="text-foreground">Edit</span>
        </nav>

        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Edit Customizable Option</h1>
            <p className="text-sm text-foreground/70">Update option type, values, and pricing behavior.</p>
          </div>
          <Button as={Link} href="/admin/catalog/custom-options" variant="bordered">
            Back to options
          </Button>
        </div>
      </div>

      {notice && <NoticeCard tone="success" message={notice} />}
      {actionError && <NoticeCard tone="danger" message={actionError} />}

      <CustomOptionForm mode="edit" initial={option} submitAction={updateAction} cancelHref="/admin/catalog/custom-options" />
    </div>
  );
}
