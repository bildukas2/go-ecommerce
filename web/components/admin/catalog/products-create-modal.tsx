"use client";

import { useState } from "react";

type ActionFn = (formData: FormData) => void | Promise<void>;

type Props = {
  createAction: ActionFn;
  returnTo: string;
};

export function ProductsCreateModal({ createAction, returnTo }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-xl border border-blue-500/35 bg-blue-500/12 px-4 py-2 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-500/18 dark:text-blue-300"
      >
        Create product
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-surface-border bg-background shadow-2xl">
            <div className="flex items-center justify-between border-b border-surface-border px-4 py-3">
              <h2 className="text-lg font-semibold">Create product</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg border border-surface-border px-3 py-1.5 text-sm"
              >
                Close
              </button>
            </div>

            <form action={createAction} className="grid gap-3 p-4 md:grid-cols-2">
              <input type="hidden" name="return_to" value={returnTo} />
              <label className="space-y-1 text-sm">
                <span>Title</span>
                <input name="title" required className="w-full rounded-xl border border-surface-border bg-background px-3 py-2" />
              </label>
              <label className="space-y-1 text-sm">
                <span>Slug</span>
                <input name="slug" required placeholder="everyday-hoodie" className="w-full rounded-xl border border-surface-border bg-background px-3 py-2" />
              </label>
              <label className="space-y-1 text-sm md:col-span-2">
                <span>Description</span>
                <textarea name="description" rows={3} className="w-full rounded-xl border border-surface-border bg-background px-3 py-2" />
              </label>
              <label className="space-y-1 text-sm">
                <span>SEO title</span>
                <input name="seo_title" maxLength={120} className="w-full rounded-xl border border-surface-border bg-background px-3 py-2" />
              </label>
              <label className="space-y-1 text-sm">
                <span>SEO description</span>
                <input name="seo_description" maxLength={320} className="w-full rounded-xl border border-surface-border bg-background px-3 py-2" />
              </label>
              <button
                type="submit"
                className="md:col-span-2 rounded-xl border border-blue-500/35 bg-blue-500/12 px-4 py-2 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-500/18 dark:text-blue-300"
              >
                Create product
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
