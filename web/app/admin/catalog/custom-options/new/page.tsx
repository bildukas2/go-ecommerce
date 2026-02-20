import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button, Card, CardBody } from "@heroui/react";
import { ChevronRight } from "lucide-react";
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

export default async function AdminCustomOptionCreatePage({ searchParams }: PageProps) {
  const resolvedSearchParams = await Promise.resolve(searchParams ?? {});
  const notice = firstQueryValue(resolvedSearchParams.notice);
  const actionError = firstQueryValue(resolvedSearchParams.error);

  const createAction = async (formData: FormData) => {
    "use server";
    let destination = messageHref("/admin/catalog/custom-options", "notice", "Custom option created");
    try {
      const payload = parseCustomOptionFormData(formData);
      await createAdminCustomOption(payload);
      revalidatePath("/admin/catalog/custom-options");
    } catch (error) {
      destination = messageHref("/admin/catalog/custom-options/new", "error", errorMessage(error));
    }
    redirect(destination);
  };

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
          <span className="text-foreground">Create</span>
        </nav>

        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Create Customizable Option</h1>
            <p className="text-sm text-foreground/70">Define option type, requirement behavior, and pricing setup.</p>
          </div>
          <Button as={Link} href="/admin/catalog/custom-options" variant="bordered">
            Back to options
          </Button>
        </div>
      </div>

      {notice && <NoticeCard tone="success" message={notice} />}
      {actionError && <NoticeCard tone="danger" message={actionError} />}

      <CustomOptionForm mode="create" submitAction={createAction} cancelHref="/admin/catalog/custom-options" />
    </div>
  );
}
