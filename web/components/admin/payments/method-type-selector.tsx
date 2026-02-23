"use client";

import React, { useState } from "react";
import { X } from "lucide-react";
import { BankTransferForm } from "./bank-transfer-form";
import { CashOnDeliveryForm } from "./cash-on-delivery-form";
import type { PaymentMethod, ShippingMethod } from "@/lib/api";

type Props = {
  methods: PaymentMethod[];
  shippingMethods: ShippingMethod[];
  onClose: () => void;
  onSuccess: (methods: PaymentMethod[]) => void;
};

type FormStep = "select" | "bank_transfer" | "cash_on_delivery";

export function MethodTypeSelector({
  methods,
  shippingMethods,
  onClose,
  onSuccess,
}: Props) {
  const [step, setStep] = useState<FormStep>("select");

  const handleSelectType = (type: "bank_transfer" | "cash_on_delivery") => {
    setStep(type);
  };

  const handleBack = () => {
    setStep("select");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-surface-border bg-background shadow-2xl">
        <div className="flex items-center justify-between border-b border-surface-border px-4 py-3">
          <h2 className="text-lg font-semibold">
            {step === "select" && "Select Payment Method Type"}
            {step === "bank_transfer" && "Configure Bank Transfer"}
            {step === "cash_on_delivery" && "Configure Cash on Delivery"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-surface-border p-1 hover:bg-foreground/[0.05]"
          >
            <X size={20} />
          </button>
        </div>

        {step === "select" && (
          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            <div className="grid gap-3 md:grid-cols-2">
              <button
                onClick={() => handleSelectType("bank_transfer")}
                disabled={methods.some((m) => m.method_name === "bank_transfer")}
                className="rounded-lg border-2 border-surface-border p-4 text-left transition-all hover:border-blue-500/50 hover:bg-blue-500/5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <h3 className="font-semibold">Direct Bank Transfer</h3>
                <p className="mt-1 text-sm text-foreground/70">
                  Accept payments via bank transfer with account details
                </p>
              </button>

              <button
                onClick={() => handleSelectType("cash_on_delivery")}
                disabled={methods.some((m) => m.method_name === "cash_on_delivery")}
                className="rounded-lg border-2 border-surface-border p-4 text-left transition-all hover:border-blue-500/50 hover:bg-blue-500/5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <h3 className="font-semibold">Cash on Delivery</h3>
                <p className="mt-1 text-sm text-foreground/70">
                  Let customers pay upon delivery
                </p>
              </button>
            </div>
          </div>
        )}

        {step === "bank_transfer" && (
          <BankTransferForm
            currentMethods={methods}
            shippingMethods={shippingMethods}
            onBack={handleBack}
            onSuccess={onSuccess}
          />
        )}

        {step === "cash_on_delivery" && (
          <CashOnDeliveryForm
            currentMethods={methods}
            shippingMethods={shippingMethods}
            onBack={handleBack}
            onSuccess={onSuccess}
          />
        )}
      </div>
    </div>
  );
}
