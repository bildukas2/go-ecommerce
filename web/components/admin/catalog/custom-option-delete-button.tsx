"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Trash2, AlertTriangle } from "lucide-react";

type CustomOptionDeleteButtonProps = {
  action: (formData: FormData) => Promise<void>;
  optionID: string;
  returnTo: string;
  optionTitle: string;
};

type PopoverPos = { top: number; left: number; openUpward: boolean };

export function CustomOptionDeleteButton({ action, optionID, returnTo, optionTitle }: CustomOptionDeleteButtonProps) {
  const [pos, setPos] = useState<PopoverPos | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function handleOpen() {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const popoverHeight = 160;
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUpward = spaceBelow < popoverHeight + 8;
    setPos({
      top: openUpward ? rect.top : rect.bottom + 6,
      left: rect.right - 256, // 256 = w-64
      openUpward,
    });
  }

  useEffect(() => {
    if (!pos) return;
    function handleClickOutside(e: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setPos(null);
      }
    }
    function handleScroll() { setPos(null); }
    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [pos]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={handleOpen}
        className="rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-100 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20"
      >
        Delete
      </button>

      {pos && createPortal(
        <div
          ref={popoverRef}
          style={{
            position: "fixed",
            top: pos.openUpward ? undefined : pos.top,
            bottom: pos.openUpward ? window.innerHeight - pos.top : undefined,
            left: pos.left,
            zIndex: 9999,
          }}
          className="w-64 rounded-xl border border-surface-border bg-background shadow-xl"
        >
          <div className="p-3">
            <div className="flex items-start gap-2.5">
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-red-50 dark:bg-red-500/10">
                <AlertTriangle size={14} className="text-red-600 dark:text-red-400" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">Delete option?</p>
                <p className="mt-0.5 truncate text-xs text-foreground/60" title={optionTitle}>
                  "{optionTitle}"
                </p>
                <p className="mt-1 text-xs text-foreground/50">This cannot be undone.</p>
              </div>
            </div>

            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => setPos(null)}
                className="flex-1 rounded-lg border border-surface-border bg-foreground/[0.03] px-3 py-1.5 text-xs font-medium transition-colors hover:bg-foreground/[0.07]"
              >
                Cancel
              </button>
              <form ref={formRef} action={action} className="flex-1">
                <input type="hidden" name="option_id" value={optionID} />
                <input type="hidden" name="return_to" value={returnTo} />
                <button
                  type="submit"
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-700"
                >
                  <Trash2 size={12} />
                  Delete
                </button>
              </form>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
