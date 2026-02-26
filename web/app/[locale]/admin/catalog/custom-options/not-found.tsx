"use client";

import Link from "next/link";
import { SearchX } from "lucide-react";
import { Button, Card, CardBody } from "@heroui/react";

export default function AdminCustomOptionsNotFound() {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 p-4 md:p-8">
      <Card className="glass rounded-2xl border border-surface-border/80 shadow-[0_16px_36px_rgba(2,6,23,0.12)] dark:shadow-[0_20px_44px_rgba(2,6,23,0.42)]">
        <CardBody className="space-y-5 p-6 md:p-8">
          <div className="flex items-start gap-4">
            <div className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full border border-cyan-400/45 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300">
              <SearchX size={18} />
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-semibold tracking-tight">Custom option not found</h2>
              <p className="text-sm text-foreground/75">This option may have been removed or the URL is invalid.</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button as={Link} href="/admin/catalog/custom-options" color="primary" variant="flat">
              Back to options
            </Button>
            <Button as={Link} href="/admin/catalog/custom-options/new" variant="bordered">
              Create option
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
