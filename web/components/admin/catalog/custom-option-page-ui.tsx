"use client";

import Link from "next/link";
import { Button, Card, CardBody } from "@heroui/react";

type NoticeTone = "success" | "danger";

export function NoticeCard({ tone, message }: { tone: NoticeTone; message: string }) {
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

export function BackToOptionsButton() {
  return (
    <Button as={Link} href="/admin/catalog/custom-options" variant="bordered">
      Back to options
    </Button>
  );
}
