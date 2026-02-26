"use client";

import * as React from "react";
import type { Terminal } from "@/hooks/use-terminals";
import { useCheckoutState, type CheckoutStep } from "@/hooks/use-checkout-state";
import type { CheckoutShippingMethod, CheckoutPaymentMethod } from "@/lib/checkout-api";
import type { BankTransferConfig } from "@/lib/api";
import { getPaymentMethods } from "@/lib/checkout-api";
import { useCart } from "@/components/cart-context";
import { Button } from "@/components/ui/button";
import { AddressSection } from "@/components/checkout/address-section";
import { ShippingMethodSelector } from "@/components/checkout/shipping-method-selector";
import { TerminalPicker } from "@/components/checkout/terminal-picker";
import { PaymentMethodSelector } from "@/components/checkout/payment-method-selector";
import { OrderSummary } from "@/components/checkout/order-summary";
import { UpsellSection } from "@/components/checkout/upsell-section";
import { Check, MapPin, Truck, CreditCard, Loader2, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

function StepIndicator({
  steps,
  currentStep,
  completedSteps,
}: {
  steps: { id: CheckoutStep; label: string; icon: React.ReactNode }[];
  currentStep: CheckoutStep;
  completedSteps: Set<CheckoutStep>;
}) {
  const currentIndex = steps.findIndex((s) => s.id === currentStep);

  return (
    <div className="flex items-center justify-between mb-8">
      {steps.map((step, index) => {
        const isCompleted = completedSteps.has(step.id);
        const isCurrent = step.id === currentStep;
        const isPast = index < currentIndex;

        return (
          <React.Fragment key={step.id}>
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full border-2 transition-colors",
                  isCompleted || isPast
                    ? "border-green-500 bg-green-500 text-white"
                    : isCurrent
                    ? "border-blue-500 bg-blue-500 text-white"
                    : "border-muted-foreground/30 text-muted-foreground/50"
                )}
              >
                {isCompleted || isPast ? (
                  <Check className="h-4 w-4" />
                ) : (
                  step.icon
                )}
              </div>
              <span
                className={cn(
                  "text-sm font-medium hidden sm:block",
                  isCurrent ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {step.label}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div
                className={cn(
                  "flex-1 h-0.5 mx-2",
                  index < currentIndex ? "bg-green-500" : "bg-muted-foreground/20"
                )}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

const CHECKOUT_STEPS = [
  { id: "address" as const, label: "Address", icon: <MapPin className="h-4 w-4" /> },
  { id: "shipping" as const, label: "Shipping", icon: <Truck className="h-4 w-4" /> },
  { id: "payment" as const, label: "Payment", icon: <CreditCard className="h-4 w-4" /> },
  { id: "review" as const, label: "Review", icon: <CheckCircle2 className="h-4 w-4" /> },
];

export default function CheckoutPage() {
  const {
    state,
    setCart,
    setCartLoading,
    setShippingAddress,
    setBillingAddress,
    setUseSameAsBilling,
    setCompany,
    setShippingCountry,
    setSelectedShippingMethod,
    setSelectedTerminal,
    setSelectedPaymentMethod,
    setCurrentStep,
    fetchQuote,
    submitAddress,
    selectShipping,
    selectPayment,
    placeOrder,
    canProceedToShipping,
    canProceedToPayment,
    canPlaceOrder,
  } = useCheckoutState();

  const { update: updateCart, remove: removeCart, cart: contextCart } = useCart();

  const [paymentMethods, setPaymentMethods] = React.useState<CheckoutPaymentMethod[]>([]);
  const [paymentMethodsLoading, setPaymentMethodsLoading] = React.useState(true);

  // Fetch payment methods on mount
  React.useEffect(() => {
    const fetchPaymentMethods = async () => {
      try {
        setPaymentMethodsLoading(true);
        const methods = await getPaymentMethods();
        setPaymentMethods(methods);
      } catch (err) {
        console.error("Failed to fetch payment methods:", err);
        setPaymentMethods([]);
      } finally {
        setPaymentMethodsLoading(false);
      }
    };
    fetchPaymentMethods();
  }, []);

  // Sync cart from context into checkout state when it changes
  React.useEffect(() => {
    if (contextCart) {
      setCart(contextCart);
    }
  }, [contextCart, setCart]);

  const handleUpdateQuantity = React.useCallback(
    async (itemId: string, quantity: number) => {
      await updateCart(itemId, quantity);
    },
    [updateCart]
  );

  const handleRemoveItem = React.useCallback(
    async (itemId: string) => {
      await removeCart(itemId);
    },
    [removeCart]
  );

  const completedSteps = React.useMemo(() => {
    const completed = new Set<CheckoutStep>();
    if (state.addressValid) completed.add("address");
    if (state.selectedShippingMethod && (!state.selectedShippingMethod.requires_terminal || state.selectedTerminal)) {
      completed.add("shipping");
    }
    if (state.selectedPaymentMethod) completed.add("payment");
    return completed;
  }, [state.addressValid, state.selectedShippingMethod, state.selectedTerminal, state.selectedPaymentMethod]);

  const sectionPanel = "glass rounded-[28px] border border-surface-border bg-surface/80 p-6 shadow-[0_30px_60px_rgba(2,6,23,0.35)] backdrop-blur-xl transition-colors";

  // Cart is loaded by CartProvider and synced via contextCart effect above.
  // Just clear loading once context cart is available.
  React.useEffect(() => {
    if (contextCart !== undefined) {
      setCartLoading(false);
    }
  }, [contextCart, setCartLoading]);

  React.useEffect(() => {
    if (!state.shippingCountry) return;
    const timer = setTimeout(() => fetchQuote(), 400);
    return () => clearTimeout(timer);
  }, [state.shippingCountry, state.currentStep, fetchQuote]);

  const handleAddressContinue = async () => {
    const success = await submitAddress();
    if (success) {
      setCurrentStep("shipping");
    }
  };

  const handleShippingMethodSelect = (method: CheckoutShippingMethod) => {
    setSelectedShippingMethod({
      id: method.id,
      title: method.title,
      price: method.price,
      requires_terminal: method.requires_terminal,
      provider_key: method.provider_key,
    });
    if (!method.requires_terminal) {
      setSelectedTerminal(null);
    }
  };

  const handleShippingContinue = async () => {
    const success = await selectShipping();
    if (success) {
      setCurrentStep("payment");
    }
  };

  const handlePaymentContinue = async () => {
    const success = await selectPayment();
    if (success) {
      setCurrentStep("review");
    }
  };

  const handlePlaceOrder = async () => {
    const success = await placeOrder();
    if (success && state.checkoutUrl) {
      window.location.href = state.checkoutUrl;
    }
  };

  React.useEffect(() => {
    if (state.error?.includes("blocked")) {
      try {
        const errorData = JSON.parse(state.error);
        if (errorData.blocked) {
          window.location.href = "/blocked";
        }
      } catch {
        // ignore
      }
    }
  }, [state.error]);

  if (state.orderPlaced) {
    const selectedPaymentMethod = paymentMethods.find(m => m.method_name === state.selectedPaymentMethod);
    const isBankTransfer = selectedPaymentMethod?.method_name === "bank_transfer";

    return (
      <div className="mx-auto max-w-2xl px-6 py-16">
        <div className="text-center mb-8">
          <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-6" />
          <h1 className="text-2xl font-semibold mb-2">Order Placed!</h1>
          <p className="text-muted-foreground mb-4">
            Your order #{state.orderNumber} has been placed successfully.
          </p>
        </div>

        {isBankTransfer ? (
          <div className="rounded-[28px] border border-surface-border bg-surface/80 p-8 shadow-[0_30px_60px_rgba(2,6,23,0.35)] backdrop-blur-xl">
            <div className="mb-6">
              <h2 className="text-xl font-semibold mb-2">Bank Transfer Instructions</h2>
              <p className="text-muted-foreground text-sm">
                Please complete your payment using the information below:
              </p>
            </div>

            {selectedPaymentMethod?.description && (
              <p className="text-sm text-foreground/80 mb-4 italic">
                {selectedPaymentMethod.description}
              </p>
            )}

            <div className="bg-surface/60 rounded-xl p-6 border border-surface-border mb-6 space-y-4">
              {selectedPaymentMethod?.config_json && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground block text-xs uppercase tracking-wider mb-1">Account Holder Name</span>
                    <span className="font-medium">{(selectedPaymentMethod.config_json as any as BankTransferConfig).account_name}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-xs uppercase tracking-wider mb-1">Account Number / IBAN</span>
                    <span className="font-mono font-medium">
                      {(selectedPaymentMethod.config_json as any as BankTransferConfig).iban || (selectedPaymentMethod.config_json as any as BankTransferConfig).account_number}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-xs uppercase tracking-wider mb-1">Bank Name</span>
                    <span className="font-medium">{(selectedPaymentMethod.config_json as any as BankTransferConfig).bank_name}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-xs uppercase tracking-wider mb-1">Transfer Purpose / Reference</span>
                    <span className="font-mono font-bold text-blue-600 dark:text-blue-400">#{state.orderNumber}</span>
                  </div>
                  {(selectedPaymentMethod.config_json as any as BankTransferConfig).bic_swift && (
                    <div>
                      <span className="text-muted-foreground block text-xs uppercase tracking-wider mb-1">BIC / SWIFT</span>
                      <span className="font-mono font-medium">{(selectedPaymentMethod.config_json as any as BankTransferConfig).bic_swift}</span>
                    </div>
                  )}
                  {(selectedPaymentMethod.config_json as any as BankTransferConfig).sort_code && (
                    <div>
                      <span className="text-muted-foreground block text-xs uppercase tracking-wider mb-1">Sort Code</span>
                      <span className="font-mono font-medium">{(selectedPaymentMethod.config_json as any as BankTransferConfig).sort_code}</span>
                    </div>
                  )}
                </div>
              )}

              {selectedPaymentMethod?.instructions && (
                <div className="pt-4 border-t border-surface-border mt-4 text-sm text-foreground/80 whitespace-pre-wrap">
                  <span className="text-muted-foreground block text-xs uppercase tracking-wider mb-2">Instructions</span>
                  {selectedPaymentMethod.instructions}
                </div>
              )}
            </div>

            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Once you have completed the bank transfer, we will verify the payment and process your order.
              </p>
              <Button
                onClick={() => window.location.href = "/"}
                className="w-full"
              >
                Continue Shopping
              </Button>
            </div>
          </div>
        ) : (
          <>
            {state.checkoutUrl && (
              <div className="text-center">
                <p className="text-muted-foreground mb-6">
                  Click the button below to complete your payment securely.
                </p>
                <Button onClick={() => { if (state.checkoutUrl) window.location.href = state.checkoutUrl; }}>
                  Complete Payment
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  if (!state.cartLoading && (!state.cart?.Items || state.cart.Items.length === 0)) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <h1 className="text-2xl font-semibold mb-2">Your cart is empty</h1>
        <p className="text-muted-foreground mb-6">
          Add some items to your cart to proceed with checkout.
        </p>
        <Button onClick={() => window.location.href = "/"}>
          Continue Shopping
        </Button>
      </div>
    );
  }

  return (
    <div className="hero-aurora min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="rounded-[36px] border border-surface-border bg-surface/90 p-6 shadow-[0_40px_120px_rgba(2,6,23,0.45)] backdrop-blur-3xl">
          <div className="flex flex-col gap-2">
            <span className="text-xs uppercase tracking-[0.4em] text-foreground/50">Checkout</span>
            <h1 className="text-3xl font-semibold text-foreground">Shopping Cart</h1>
            <p className="text-sm text-foreground/70">Complete your order in a few intentional steps.</p>
          </div>

          <div className="mt-6">
            <div className="glass rounded-2xl border border-surface-border bg-surface/70 p-4">
              <StepIndicator
                steps={CHECKOUT_STEPS}
                currentStep={state.currentStep}
                completedSteps={completedSteps}
              />
            </div>
          </div>

          <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <div className="space-y-6">
              {state.currentStep === "address" && (
                <div className={`${sectionPanel} space-y-6`}>
                  <AddressSection
                    shippingAddress={state.shippingAddress}
                    billingAddress={state.billingAddress}
                    useSameAsBilling={state.useSameAsBilling}
                    company={state.company}
                    onShippingAddressChange={setShippingAddress}
                    onBillingAddressChange={setBillingAddress}
                    onUseSameAsBillingChange={setUseSameAsBilling}
                    onCompanyChange={setCompany}
                    onContinue={handleAddressContinue}
                    loading={state.loading}
                    error={state.error}
                  />
                </div>
              )}

              {state.currentStep === "shipping" && (
                <div className={`${sectionPanel} space-y-6`}>
                  <div className="flex items-center gap-2">
                    <Truck className="h-5 w-5 text-blue-500" />
                    <h3 className="text-lg font-semibold">Shipping Method</h3>
                  </div>

                  {state.quoteLoading ? (
                    <div className="flex items-center justify-center rounded-2xl border border-surface-border bg-surface/70 p-8 text-foreground/60">
                      <Loader2 className="h-6 w-6 animate-spin text-foreground/60" />
                      <span className="ml-2 text-foreground/60">Loading shipping options...</span>
                    </div>
                  ) : (
                    <>
                      <ShippingMethodSelector
                        country={state.shippingCountry}
                        methods={state.shippingMethods}
                        isLoading={state.quoteLoading}
                        error={state.error}
                        selectedMethodId={state.selectedShippingMethod?.id}
                        onSelect={handleShippingMethodSelect}
                      />

                      {state.selectedShippingMethod?.requires_terminal && (
                        <div className="space-y-4 pt-4 border-t border-surface-border">
                          <div className="flex items-center gap-2">
                            <MapPin className="h-5 w-5 text-blue-500" />
                            <h4 className="font-semibold">Select Pickup Terminal</h4>
                          </div>
                          <TerminalPicker
                            provider={state.selectedShippingMethod.provider_key}
                            country={state.shippingCountry}
                            selectedTerminalId={state.selectedTerminal?.id}
                            onSelect={setSelectedTerminal}
                          />
                          {state.selectedTerminal && (
                            <div className="flex items-center gap-2 rounded-lg bg-green-500/10 border border-green-500/30 p-3 text-sm text-green-700 dark:text-green-300">
                              <Check className="h-4 w-4" />
                              <span>
                                Selected: <strong>{state.selectedTerminal.name}</strong> - {state.selectedTerminal.address}
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      {state.error && (
                        <div className="text-sm text-red-600 bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                          {state.error}
                        </div>
                      )}

                      <div className="flex gap-3 pt-4 border-t border-surface-border">
                        <Button
                          variant="outline"
                          onClick={() => setCurrentStep("address")}
                        >
                          Back
                        </Button>
                        <Button
                          onClick={handleShippingContinue}
                          disabled={!canProceedToPayment || state.loading}
                        >
                          {state.loading ? "Saving..." : "Continue to Payment"}
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {state.currentStep === "payment" && (
                <div className={`${sectionPanel} space-y-6`}>
                  <PaymentMethodSelector
                    methods={paymentMethods}
                    selectedMethod={state.selectedPaymentMethod}
                    onSelect={setSelectedPaymentMethod}
                    onContinue={handlePaymentContinue}
                    loading={state.loading}
                    methodsLoading={paymentMethodsLoading}
                    error={state.error}
                  />
                  <div className="flex gap-3 pt-4 border-t border-surface-border mt-6">
                    <Button
                      variant="outline"
                      onClick={() => setCurrentStep("shipping")}
                    >
                      Back
                    </Button>
                  </div>
                </div>
              )}

              {state.currentStep === "review" && (
                <div className={`${sectionPanel} space-y-6`}>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-blue-500" />
                    <h3 className="text-lg font-semibold">Review Your Order</h3>
                  </div>

                  {state.shippingAddress && (
                    <div className="rounded-2xl border border-surface-border bg-surface/60 p-4">
                      <h4 className="font-medium text-sm mb-2">Shipping Address</h4>
                      <p className="text-sm text-foreground/70">
                        {state.shippingAddress.full_name}<br />
                        {state.shippingAddress.address1}<br />
                        {state.shippingAddress.address2 && <>{state.shippingAddress.address2}<br /></>}
                        {state.shippingAddress.city}, {state.shippingAddress.postcode}<br />
                        {state.shippingAddress.country}
                      </p>
                    </div>
                  )}

                  {state.selectedShippingMethod && (
                    <div className="rounded-2xl border border-surface-border bg-surface/60 p-4">
                      <h4 className="font-medium text-sm mb-2">Shipping Method</h4>
                      <p className="text-sm text-foreground/70">
                        {state.selectedShippingMethod.title} - €{(state.selectedShippingMethod.price / 100).toFixed(2)}
                        {state.selectedTerminal && (
                          <><br />Terminal: {state.selectedTerminal.name}</>
                        )}
                      </p>
                    </div>
                  )}

                  {state.selectedPaymentMethod && (
                    <div className="rounded-2xl border border-surface-border bg-surface/60 p-4">
                      <h4 className="font-medium text-sm mb-2">Payment Method</h4>
                      <p className="text-sm text-foreground/70">
                        {paymentMethods.find(m => m.method_name === state.selectedPaymentMethod)?.title || state.selectedPaymentMethod}
                      </p>
                    </div>
                  )}

                  {state.error && (
                    <div className="text-sm text-red-600 bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                      {state.error}
                    </div>
                  )}

                  <div className="flex gap-3 pt-4 border-t border-surface-border">
                    <Button
                      variant="outline"
                      onClick={() => setCurrentStep("payment")}
                    >
                      Back
                    </Button>
                    <Button
                      onClick={handlePlaceOrder}
                      disabled={!canPlaceOrder || state.loading}
                      className="flex-1"
                    >
                      {state.loading ? "Placing Order..." : "Place Order"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
            <div className="space-y-6">
              <OrderSummary
                cart={state.cart}
                shippingPrice={state.shippingPrice}
                loading={state.cartLoading}
                onUpdateQuantity={handleUpdateQuantity}
                onRemoveItem={handleRemoveItem}
              />
              <UpsellSection />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
