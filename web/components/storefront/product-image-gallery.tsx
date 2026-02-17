"use client";

import type { ProductImage } from "@/lib/api";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Image from "next/image";
import { useMemo, useState } from "react";

const THUMBNAILS_PER_VIEW = 4;

type ProductImageGalleryProps = {
  images: ProductImage[];
  productTitle: string;
};

export function ProductImageGallery({ images, productTitle }: ProductImageGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [windowStart, setWindowStart] = useState(0);

  const mainImage = images[selectedIndex];
  const hasThumbnails = images.length > 1;
  const showArrows = images.length > THUMBNAILS_PER_VIEW;
  const canScrollLeft = windowStart > 0;
  const canScrollRight = windowStart + THUMBNAILS_PER_VIEW < images.length;

  const visibleThumbnails = useMemo(
    () => images.slice(windowStart, windowStart + THUMBNAILS_PER_VIEW),
    [images, windowStart],
  );

  function selectImage(index: number) {
    setSelectedIndex(index);
    if (index < windowStart) {
      setWindowStart(index);
      return;
    }
    if (index >= windowStart + THUMBNAILS_PER_VIEW) {
      setWindowStart(index - (THUMBNAILS_PER_VIEW - 1));
    }
  }

  if (!mainImage) {
    return (
      <div className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-neutral-100 text-sm text-neutral-500 dark:bg-neutral-900 dark:text-neutral-400">
        <div className="absolute -inset-10 bg-[radial-gradient(circle_at_20%_20%,rgba(0,114,245,.15),transparent_55%)]" />
        <span className="relative">No image available</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="image-default-bg overflow-hidden rounded-2xl border border-white/10">
        <Image
          src={mainImage.url}
          alt={mainImage.alt || productTitle}
          width={800}
          height={800}
          className="aspect-square w-full object-cover"
        />
      </div>

      {hasThumbnails && (
        <div className="flex items-center gap-2">
          {showArrows && (
            <button
              type="button"
              aria-label="Show previous images"
              onClick={() => setWindowStart((start) => Math.max(0, start - 1))}
              disabled={!canScrollLeft}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-background/60 text-neutral-700 transition hover:bg-background disabled:cursor-not-allowed disabled:opacity-40 dark:text-neutral-200"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          )}

          <div className="grid flex-1 grid-cols-4 gap-2">
            {visibleThumbnails.map((image, i) => {
              const absoluteIndex = windowStart + i;
              const isActive = absoluteIndex === selectedIndex;

              return (
                <button
                  key={image.id}
                  type="button"
                  onClick={() => selectImage(absoluteIndex)}
                  className={`image-default-bg overflow-hidden rounded-xl border transition ${
                    isActive ? "border-primary ring-1 ring-primary/60" : "border-white/10 hover:border-white/25"
                  }`}
                  aria-label={`Show image ${absoluteIndex + 1}`}
                  aria-current={isActive}
                >
                  <Image
                    src={image.url}
                    alt={image.alt || productTitle}
                    width={240}
                    height={240}
                    className="aspect-square w-full object-cover"
                  />
                </button>
              );
            })}
          </div>

          {showArrows && (
            <button
              type="button"
              aria-label="Show next images"
              onClick={() => setWindowStart((start) => Math.min(images.length - THUMBNAILS_PER_VIEW, start + 1))}
              disabled={!canScrollRight}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-background/60 text-neutral-700 transition hover:bg-background disabled:cursor-not-allowed disabled:opacity-40 dark:text-neutral-200"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
