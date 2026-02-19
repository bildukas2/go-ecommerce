"use client";

import { useState } from "react";
import { updateStatus } from "@/app/admin/orders/[id]/actions";
import { Check, ChevronDown } from "lucide-react";

const statuses = [
  { id: "pending_payment", label: "Pending Payment" },
  { id: "paid", label: "Paid" },
  { id: "processing", label: "In Progress" },
  { id: "completed", label: "Completed" },
  { id: "cancelled", label: "Cancelled" },
];

export function OrderStatusSelect({ 
  orderId, 
  currentStatus 
}: { 
  orderId: string; 
  currentStatus: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [status, setStatus] = useState(currentStatus);
  const [isUpdating, setIsUpdating] = useState(false);

  const handleUpdate = async (newStatus: string) => {
    if (newStatus === status) {
      setIsOpen(false);
      return;
    }

    setIsUpdating(true);
    setIsOpen(false);
    
    const result = await updateStatus(orderId, newStatus);
    if (result.success) {
      setStatus(newStatus);
    } else {
      alert("Failed to update status: " + result.error);
    }
    setIsUpdating(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isUpdating}
        className="flex items-center gap-2 rounded-xl border border-surface-border bg-foreground/[0.03] px-4 py-2 text-sm font-medium transition-all hover:bg-foreground/[0.06] focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
      >
        <span>Change Status</span>
        <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setIsOpen(false)} 
          />
          <div className="glass absolute right-0 top-full z-20 mt-2 w-56 overflow-hidden rounded-2xl border border-surface-border p-1 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            {statuses.map((s) => (
              <button
                key={s.id}
                onClick={() => handleUpdate(s.id)}
                className="flex w-full items-center justify-between rounded-xl px-4 py-2.5 text-left text-sm transition-colors hover:bg-foreground/[0.05]"
              >
                <span className={s.id === status ? "font-bold text-primary" : "text-foreground/80"}>
                  {s.label}
                </span>
                {s.id === status && <Check className="h-4 w-4 text-primary" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
