"use client";

import { useState, useEffect } from "react";
import { Input, Button, Select, SelectItem, Textarea, Tabs, Tab, Card, CardBody } from "@heroui/react";
import { Save, ArrowLeft, Globe, Settings, FileText, Code, AlertCircle, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { AdminPage, checkAdminPageSlug } from "@/lib/api";

type Props = {
  initialData?: AdminPage;
  onSubmit: (formData: FormData) => Promise<void>;
  isSubmitting?: boolean;
};

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

export function PageForm({ initialData, onSubmit, isSubmitting }: Props) {
  const [slug, setSlug] = useState(initialData?.slug || "/");
  const [slugError, setSlugError] = useState<string | null>(null);
  const [isCheckingSlug, setIsCheckingSlug] = useState(false);
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [editorMode, setEditorMode] = useState<"html" | "visual">(initialData?.editor_mode || "html");

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
    if (!initialData) {
      const title = e.target.value;
      const generatedSlug = "/" + title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      setSlug(generatedSlug === "/" ? "/" : generatedSlug);
    }
  };

  const isInvalid = !!slugError;

  return (
    <form 
      action={(formData) => {
        if (isInvalid) return;
        onSubmit(formData);
      }} 
      className="flex flex-col gap-6"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            as={Link}
            href="/admin/cms/pages"
            isIconOnly
            variant="light"
            size="sm"
          >
            <ArrowLeft size={18} />
          </Button>
          <h1 className="text-2xl font-bold">
            {initialData ? "Edit Page" : "Create Page"}
          </h1>
        </div>
        <Button
          type="submit"
          color="primary"
          isLoading={isSubmitting}
          isDisabled={isInvalid || isCheckingSlug}
          startContent={!isSubmitting && <Save size={18} />}
        >
          {initialData ? "Save Changes" : "Create Page"}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 flex flex-col gap-6">
          <Card shadow="sm">
            <CardBody className="p-6 gap-4">
              <div className="flex flex-col gap-4">
                <Input
                  name="title"
                  label="Title"
                  placeholder="e.g. About Us"
                  defaultValue={initialData?.title}
                  onChange={handleTitleChange}
                  required
                />
                <Input
                  name="slug"
                  label="Slug (URL)"
                  placeholder="/about-us"
                  value={slug}
                  onValueChange={setSlug}
                  required
                  isInvalid={isInvalid}
                  errorMessage={slugError}
                  description={
                    slugAvailable === true && !isInvalid && !isCheckingSlug ? (
                      <span className="flex items-center gap-1 text-success">
                        <CheckCircle2 size={12} />
                        Slug is available
                      </span>
                    ) : isCheckingSlug ? (
                      "Checking availability..."
                    ) : null
                  }
                  startContent={<div className="text-default-400 text-small">/</div>}
                  classNames={{
                    input: slug === "/" ? "" : "pl-0",
                  }}
                />
              </div>
            </CardBody>
          </Card>

          <Card shadow="sm" className="flex-1">
            <CardBody className="p-0">
              <Tabs 
                aria-label="Editor modes" 
                selectedKey={editorMode}
                onSelectionChange={(key) => setEditorMode(key as "html" | "visual")}
                variant="underlined"
                classNames={{
                  tabList: "px-4 pt-2",
                  cursor: "bg-primary",
                  tab: "max-w-fit px-4 h-12",
                }}
              >
                <Tab
                  key="html"
                  title={
                    <div className="flex items-center gap-2">
                      <Code size={16} />
                      <span>HTML Editor</span>
                    </div>
                  }
                >
                  <div className="p-4">
                    <Textarea
                      name="content_html"
                      placeholder="Write your HTML content here..."
                      defaultValue={initialData?.content_html}
                      minRows={15}
                      classNames={{
                        input: "font-mono text-sm",
                      }}
                    />
                  </div>
                </Tab>
                <Tab
                  key="visual"
                  title={
                    <div className="flex items-center gap-2">
                      <FileText size={16} />
                      <span>Visual Editor</span>
                    </div>
                  }
                >
                  <div className="flex h-[400px] flex-col items-center justify-center gap-2 p-4 text-center">
                    <div className="rounded-full bg-default-100 p-4">
                      <Settings size={32} className="text-default-400" />
                    </div>
                    <p className="font-medium">Visual Editor Coming Soon</p>
                    <p className="text-sm text-default-500 max-w-xs">
                      The visual editor is currently under development. Please use the HTML editor for now.
                    </p>
                  </div>
                </Tab>
              </Tabs>
              <input type="hidden" name="editor_mode" value={editorMode} />
            </CardBody>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card shadow="sm">
            <CardBody className="p-6 gap-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Globe size={18} className="text-primary" />
                Publishing
              </h3>
              <Select
                name="status"
                label="Status"
                defaultSelectedKeys={[initialData?.status || "draft"]}
              >
                <SelectItem key="draft" value="draft">Draft</SelectItem>
                <SelectItem key="published" value="published">Published</SelectItem>
              </Select>
              {initialData?.published_at && (
                <p className="text-xs text-default-500">
                  Published on {new Date(initialData.published_at).toLocaleString()}
                </p>
              )}
            </CardBody>
          </Card>

          <Card shadow="sm">
            <CardBody className="p-6 gap-4">
              <h3 className="font-semibold">Search Engine Optimization</h3>
              <p className="text-xs text-default-500">
                Customize how this page appears in search results.
              </p>
              <Input
                name="meta_title"
                label="Meta Title"
                placeholder="SEO Title"
                defaultValue={initialData?.meta_title || ""}
              />
              <Textarea
                name="meta_description"
                label="Meta Description"
                placeholder="Search engine description..."
                defaultValue={initialData?.meta_description || ""}
                minRows={3}
              />
            </CardBody>
          </Card>
        </div>
      </div>
    </form>
  );
}
