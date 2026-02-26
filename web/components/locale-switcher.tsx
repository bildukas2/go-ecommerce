"use client";

import { useLocale } from "next-intl";
import { routing, usePathname, useRouter } from "@/i18n/routing";
import { Button } from "@heroui/react";
import { useParams } from "next/navigation";

export function LocaleSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();

  function onSelectChange(nextLocale: string) {
    if (nextLocale === locale) return;
    
    router.replace(
      // @ts-expect-error -- pathname is correct
      { pathname, params },
      { locale: nextLocale }
    );
  }

  return (
    <div className="flex items-center gap-1 border border-neutral-200 dark:border-neutral-800 rounded-md p-0.5">
      {routing.locales.map((cur) => (
        <Button
          key={cur}
          size="sm"
          variant={locale === cur ? "flat" : "light"}
          className={`h-7 min-w-8 px-1 text-[10px] font-bold ${
            locale === cur ? "bg-neutral-100 dark:bg-neutral-800" : ""
          }`}
          onClick={() => onSelectChange(cur)}
        >
          {cur.toUpperCase()}
        </Button>
      ))}
    </div>
  );
}
