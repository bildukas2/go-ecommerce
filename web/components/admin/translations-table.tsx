import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { Globe, Edit2 } from "lucide-react";

interface TranslationsTableProps {
  locales: string[];
}

export function TranslationsTable({ locales }: TranslationsTableProps) {
  return (
    <div className="glass overflow-hidden rounded-2xl border text-foreground shadow-[0_14px_30px_rgba(2,6,23,0.08)] dark:shadow-[0_20px_38px_rgba(2,6,23,0.38)]">
      <div className="relative w-full overflow-auto">
        <table className="w-full caption-bottom text-sm">
          <thead>
            <tr className="border-b border-surface-border transition-colors">
              <th className="h-12 px-4 text-left align-middle font-medium text-foreground/70">Locale</th>
              <th className="h-12 px-4 text-left align-middle font-medium text-foreground/70">File Name</th>
              <th className="h-12 px-4 text-right align-middle font-medium text-foreground/70">Actions</th>
            </tr>
          </thead>
          <tbody className="[&_tr:last-child]:border-0">
            {locales.length === 0 ? (
              <tr>
                <td colSpan={3} className="p-8 text-center text-foreground/60">
                  No translation files found.
                </td>
              </tr>
            ) : (
              locales.map((locale) => (
                <tr
                  key={locale}
                  className="border-b border-surface-border transition-colors hover:bg-foreground/[0.04]"
                >
                  <td className="p-4 align-middle font-medium">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                        <Globe size={16} />
                      </div>
                      <span className="uppercase">{locale}</span>
                    </div>
                  </td>
                  <td className="p-4 align-middle text-foreground/70">
                    {locale}.json
                  </td>
                  <td className="p-4 align-middle text-right">
                    <Button
                      asChild
                      variant="ghost"
                      size="sm"
                      className="font-medium text-blue-600 hover:bg-blue-500/10 dark:text-blue-400"
                    >
                      <Link href={`/admin/translations/${encodeURIComponent(locale)}`}>
                        <Edit2 size={14} className="mr-2" />
                        Edit
                      </Link>
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
