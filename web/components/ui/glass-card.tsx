import * as React from "react";

import { cn } from "@/lib/utils";

type GlassCardProps = React.HTMLAttributes<HTMLDivElement>;

export function GlassCard({ className, ...props }: GlassCardProps) {
  return (
    <div
      className={cn("glass glass-lift rounded-2xl", className)}
      {...props}
    />
  );
}
