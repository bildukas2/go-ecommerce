"use client";

import { UserX2 } from "lucide-react";

type CustomerStatusConfirmButtonProps = {
  action: (formData: FormData) => Promise<void>;
  customerID: string;
  nextStatus: "active" | "disabled";
  returnTo: string;
};

export function CustomerStatusConfirmButton({
  action,
  customerID,
  nextStatus,
  returnTo,
}: CustomerStatusConfirmButtonProps) {
  const isDisabling = nextStatus === "disabled";
  const confirmText = isDisabling
    ? "Disable this customer? They will no longer be able to login until re-enabled."
    : "Enable this customer?";

  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm(confirmText)) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="return_to" value={returnTo} />
      <input type="hidden" name="customer_id" value={customerID} />
      <input type="hidden" name="next_status" value={nextStatus} />
      <button
        type="submit"
        className="inline-flex items-center gap-1 rounded-lg border border-surface-border bg-foreground/[0.03] px-3 py-1.5 text-xs font-medium text-foreground/80 hover:bg-foreground/[0.07]"
      >
        <UserX2 size={14} />
        {isDisabling ? "Disable" : "Enable"}
      </button>
    </form>
  );
}
