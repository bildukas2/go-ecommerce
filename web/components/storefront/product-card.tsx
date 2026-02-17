"use client";

import Link from "next/link";
import { Button, Card, CardBody, CardFooter, Chip } from "@heroui/react";
import { motion } from "framer-motion";
import { ShoppingCart } from "lucide-react";

type ProductCardProps = {
  slug: string;
  title: string;
  subtitle?: string | null;
  imageUrl?: string | null;
  priceLabel?: string | null;
  badge?: string | null;
  onQuickAdd?: (() => void) | null;
};

export function ProductCard({
  slug,
  title,
  subtitle,
  imageUrl,
  priceLabel,
  badge,
  onQuickAdd,
}: ProductCardProps) {
  return (
    <motion.div whileHover={{ y: -4 }} transition={{ duration: 0.18 }} className="h-full">
      <Card className="glass glass-lift h-full rounded-2xl">
        <CardBody className="p-3">
          <Link href={`/products/${encodeURIComponent(slug)}`} className="block">
            <div className="image-default-bg relative aspect-[4/3] overflow-hidden rounded-2xl border border-surface-border">
              {badge ? (
                <Chip size="sm" className="glass absolute left-3 top-3 z-10" variant="flat" color="primary">
                  {badge}
                </Chip>
              ) : null}

              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl || "/images/noImage.png"}
                alt={title}
                className="h-full w-full object-cover transition-transform duration-300 hover:scale-[1.03]"
                loading="lazy"
              />

              <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 hover:opacity-100">
                <div className="absolute -inset-10 bg-[radial-gradient(circle_at_30%_20%,rgba(0,114,245,.25),transparent_55%)]" />
              </div>
            </div>

            <div className="mt-3 space-y-1">
              <div className="line-clamp-2 font-semibold leading-tight">{title}</div>
              {subtitle ? <div className="line-clamp-2 text-sm opacity-75">{subtitle}</div> : null}
            </div>
          </Link>
        </CardBody>

        <CardFooter className="flex items-center gap-2 px-3 pb-3 pt-0">
          <div className="flex-1">
            <div className="text-sm font-medium">{priceLabel ?? <span className="opacity-60">No active price</span>}</div>
          </div>

          <Button
            size="sm"
            color="primary"
            variant={onQuickAdd ? "solid" : "flat"}
            isIconOnly
            className={onQuickAdd ? "" : "glass"}
            onPress={onQuickAdd ?? (() => {})}
            isDisabled={!onQuickAdd}
            aria-label="Quick add"
          >
            <ShoppingCart size={16} />
          </Button>
        </CardFooter>
      </Card>
    </motion.div>
  );
}
