"use client";

import { useLocale, useTranslations } from "next-intl";
import { routing, usePathname, useRouter } from "@/i18n/routing";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Languages } from "lucide-react";
import { useParams } from "next/navigation";

export function LocaleSwitcher() {
  const t = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();

  function onSelectChange(nextLocale: string) {
    router.replace(
      // @ts-expect-error -- pathname is correct
      { pathname, params },
      { locale: nextLocale }
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Languages className="h-4 w-4" />
          <span className="sr-only">Switch language</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {routing.locales.map((cur) => (
          <DropdownMenuItem
            key={cur}
            onClick={() => onSelectChange(cur)}
            className={locale === cur ? "bg-neutral-100 dark:bg-neutral-800" : ""}
          >
            {cur.toUpperCase()}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
