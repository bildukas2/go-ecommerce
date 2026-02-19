"use client";

import { useState } from "react";

type ActionFn = (formData: FormData) => void | Promise<void>;

type Props = {
  deleteAction: ActionFn;
  productID: string;
  returnTo: string;
  productTitle: string;
};

export function ProductsDeleteButton({ deleteAction, productID, returnTo, productTitle }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        title="Delete product"
        aria-label="Delete product"
        onClick={() => setOpen(true)}
        className="inline-flex size-8 items-center justify-center rounded-lg border border-red-500/35 bg-red-500/10 text-red-700 hover:bg-red-500/15 dark:text-red-300"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4 fill-current">
          <path d="M9 3a1 1 0 0 0-1 1v1H4.5a1 1 0 1 0 0 2H5v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7h.5a1 1 0 1 0 0-2H16V4a1 1 0 0 0-1-1H9Zm1 2h4v1h-4V5Zm-3 2h10v12H7V7Zm2 2a1 1 0 0 0-1 1v6a1 1 0 1 0 2 0v-6a1 1 0 0 0-1-1Zm6 0a1 1 0 0 0-1 1v6a1 1 0 1 0 2 0v-6a1 1 0 0 0-1-1Z" />
        </svg>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-md rounded-2xl border border-surface-border bg-background p-4 shadow-2xl">
            <h3 className="text-base font-semibold">Confirm delete</h3>
            <p className="mt-2 text-sm text-foreground/75">
              Delete <span className="font-medium">{productTitle}</span>? This cannot be undone.
            </p>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg border border-surface-border px-3 py-1.5 text-sm hover:bg-foreground/[0.05]"
              >
                Cancel
              </button>
              <form action={deleteAction}>
                <input type="hidden" name="return_to" value={returnTo} />
                <input type="hidden" name="product_id" value={productID} />
                <button
                  type="submit"
                  className="rounded-lg border border-red-500/35 bg-red-500/12 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-500/18 dark:text-red-300"
                >
                  Yes, delete
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
