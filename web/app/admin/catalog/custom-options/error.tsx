"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button, Card, CardBody } from "@heroui/react";

export default function AdminCustomOptionsError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 p-4 md:p-8">
      <Card className="glass rounded-2xl border border-danger-300/40 shadow-[0_16px_36px_rgba(2,6,23,0.12)] dark:shadow-[0_20px_44px_rgba(2,6,23,0.42)]">
        <CardBody className="space-y-5 p-6 md:p-8">
          <div className="flex items-start gap-4">
            <div className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full border border-danger-300/50 bg-danger-500/10 text-danger-600 dark:text-danger-300">
              <AlertTriangle size={18} />
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-semibold tracking-tight">Unable to load custom options</h2>
              <p className="text-sm text-foreground/75">Something failed while loading this admin section. Please retry.</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button color="primary" variant="flat" onPress={reset}>
              Try again
            </Button>
            <Button as={Link} href="/admin/catalog/custom-options" variant="bordered">
              Back to options
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
