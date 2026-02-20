"use client";

type CustomOptionDeleteButtonProps = {
  action: (formData: FormData) => Promise<void>;
  optionID: string;
  returnTo: string;
  optionTitle: string;
};

export function CustomOptionDeleteButton({ action, optionID, returnTo, optionTitle }: CustomOptionDeleteButtonProps) {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm(`Delete "${optionTitle}"? This action cannot be undone.`)) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="option_id" value={optionID} />
      <input type="hidden" name="return_to" value={returnTo} />
      <button
        type="submit"
        className="rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-100"
      >
        Delete
      </button>
    </form>
  );
}
