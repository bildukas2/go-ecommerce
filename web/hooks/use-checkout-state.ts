"use client";

import * as React from "react";
import { useLocale } from "next-intl";
import {
  CheckoutAddress,
  CompanyInfo,
  CheckoutShippingMethod,
  getCheckoutQuote,
  submitCheckoutAddress,
  selectCheckoutShipping,
  selectCheckoutPayment,
  placeCheckoutOrder,
} from "@/lib/checkout-api";
import type { Terminal } from "@/hooks/use-terminals";
import type { Cart, CartItem } from "@/lib/api";
import { useTranslations } from "next-intl";

// Default country
const DEFAULT_COUNTRY = "LT";

// Checkout step enum
export type CheckoutStep = "address" | "shipping" | "payment" | "review";

// Simplified selected shipping method for UI state
export interface SelectedShippingMethod {
  id: string;
  title: string;
  price: number;
  requires_terminal: boolean;
  provider_key: string;
}

// State shape
export interface CheckoutState {
  // Cart
  cart: Cart | null;
  cartLoading: boolean;

  // Address
  email: string;
  shippingAddress: CheckoutAddress | null;
  billingAddress: CheckoutAddress | null;
  useSameAsBilling: boolean;
  company: CompanyInfo | null;
  addressValid: boolean;

  // Shipping
  shippingCountry: string;
  shippingMethods: CheckoutShippingMethod[];
  selectedShippingMethod: SelectedShippingMethod | null;
  selectedTerminal: Terminal | null;
  shippingPrice: number;
  quoteLoading: boolean;

  // Payment
  selectedPaymentMethod: string | null;

  // Totals
  subtotal: number;
  total: number;

  // UI state
  currentStep: CheckoutStep;
  loading: boolean;
  error: string | null;
  orderPlaced: boolean;
  orderNumber: string | null;
  checkoutUrl: string | null;
}

// Initial state
const initialState: CheckoutState = {
  cart: null,
  cartLoading: true,
  email: "",
  shippingAddress: null,
  billingAddress: null,
  useSameAsBilling: true,
  company: null,
  addressValid: false,
  shippingCountry: DEFAULT_COUNTRY,
  shippingMethods: [],
  selectedShippingMethod: null,
  selectedTerminal: null,
  shippingPrice: 0,
  quoteLoading: false,
  selectedPaymentMethod: null,
  subtotal: 0,
  total: 0,
  currentStep: "address",
  loading: false,
  error: null,
  orderPlaced: false,
  orderNumber: null,
  checkoutUrl: null,
};

// Action types
type Action =
  | { type: "SET_CART"; payload: Cart | null }
  | { type: "SET_CART_LOADING"; payload: boolean }
  | { type: "SET_EMAIL"; payload: string }
  | { type: "SET_SHIPPING_ADDRESS"; payload: CheckoutAddress | null }
  | { type: "SET_BILLING_ADDRESS"; payload: CheckoutAddress | null }
  | { type: "SET_USE_SAME_AS_BILLING"; payload: boolean }
  | { type: "SET_COMPANY"; payload: CompanyInfo | null }
  | { type: "SET_ADDRESS_VALID"; payload: boolean }
  | { type: "SET_SHIPPING_COUNTRY"; payload: string }
  | { type: "SET_SHIPPING_METHODS"; payload: CheckoutShippingMethod[] }
  | { type: "SET_SELECTED_SHIPPING_METHOD"; payload: SelectedShippingMethod | null }
  | { type: "SET_SELECTED_TERMINAL"; payload: Terminal | null }
  | { type: "SET_SHIPPING_PRICE"; payload: number }
  | { type: "SET_QUOTE_LOADING"; payload: boolean }
  | { type: "SET_SELECTED_PAYMENT_METHOD"; payload: string | null }
  | { type: "SET_TOTALS"; payload: { subtotal: number } }
  | { type: "SET_CURRENT_STEP"; payload: CheckoutStep }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_ERROR"; payload: string | null }
  | { type: "SET_ORDER_PLACED"; payload: { orderNumber: string; checkoutUrl: string } }
  | { type: "RESET" };

// Reducer
function checkoutReducer(state: CheckoutState, action: Action): CheckoutState {
  switch (action.type) {
    case "SET_CART":
      // Don't update cart after order is placed (prevents total from resetting)
      if (state.orderPlaced) return state;
      return { ...state, cart: action.payload };
    case "SET_CART_LOADING":
      return { ...state, cartLoading: action.payload };
    case "SET_EMAIL":
      return { ...state, email: action.payload };
    case "SET_SHIPPING_ADDRESS":
      return { ...state, shippingAddress: action.payload };
    case "SET_BILLING_ADDRESS":
      return { ...state, billingAddress: action.payload };
    case "SET_USE_SAME_AS_BILLING":
      return { ...state, useSameAsBilling: action.payload };
    case "SET_COMPANY":
      return { ...state, company: action.payload };
    case "SET_ADDRESS_VALID":
      return { ...state, addressValid: action.payload };
    case "SET_SHIPPING_COUNTRY":
      return { ...state, shippingCountry: action.payload };
    case "SET_SHIPPING_METHODS":
      return { ...state, shippingMethods: action.payload };
    case "SET_SELECTED_SHIPPING_METHOD":
      return { ...state, selectedShippingMethod: action.payload };
    case "SET_SELECTED_TERMINAL":
      return { ...state, selectedTerminal: action.payload };
    case "SET_SHIPPING_PRICE":
      return { ...state, shippingPrice: action.payload, total: state.subtotal + action.payload };
    case "SET_QUOTE_LOADING":
      return { ...state, quoteLoading: action.payload };
    case "SET_SELECTED_PAYMENT_METHOD":
      return { ...state, selectedPaymentMethod: action.payload };
    case "SET_TOTALS":
      if (state.orderPlaced) return state;
      return { ...state, subtotal: action.payload.subtotal, total: action.payload.subtotal + state.shippingPrice };
    case "SET_CURRENT_STEP":
      return { ...state, currentStep: action.payload };
    case "SET_LOADING":
      return { ...state, loading: action.payload };
    case "SET_ERROR":
      return { ...state, error: action.payload };
    case "SET_ORDER_PLACED":
      return {
        ...state,
        orderPlaced: true,
        orderNumber: action.payload.orderNumber,
        checkoutUrl: action.payload.checkoutUrl,
        loading: false,
      };
    case "RESET":
      return initialState;
    default:
      return state;
  }
}

// Hook return type
export interface UseCheckoutStateReturn {
  state: CheckoutState;
  // Actions
  setCart: (cart: Cart | null) => void;
  setCartLoading: (loading: boolean) => void;
  setEmail: (email: string) => void;
  setShippingAddress: (address: CheckoutAddress | null) => void;
  setBillingAddress: (address: CheckoutAddress | null) => void;
  setUseSameAsBilling: (value: boolean) => void;
  setCompany: (company: CompanyInfo | null) => void;
  setShippingCountry: (country: string) => void;
  setSelectedShippingMethod: (method: SelectedShippingMethod | null) => void;
  setSelectedTerminal: (terminal: Terminal | null) => void;
  setSelectedPaymentMethod: (method: string | null) => void;
  setCurrentStep: (step: CheckoutStep) => void;
  // Async actions
  fetchQuote: () => Promise<void>;
  submitAddress: () => Promise<boolean>;
  selectShipping: () => Promise<boolean>;
  selectPayment: () => Promise<boolean>;
  placeOrder: () => Promise<boolean>;
  // Computed
  canProceedToShipping: boolean;
  canProceedToPayment: boolean;
  canPlaceOrder: boolean;
}

export function useCheckoutState(): UseCheckoutStateReturn {
  const t = useTranslations("checkout.errors");
  const locale = useLocale();
  const [state, dispatch] = React.useReducer(checkoutReducer, initialState);

  // Set cart
  const setCart = React.useCallback((cart: Cart | null) => {
    dispatch({ type: "SET_CART", payload: cart });
    if (cart) {
      dispatch({ type: "SET_TOTALS", payload: { subtotal: cart.Totals.SubtotalCents } });
    }
  }, []);

  const setCartLoading = React.useCallback((loading: boolean) => {
    dispatch({ type: "SET_CART_LOADING", payload: loading });
  }, []);

  const setEmail = React.useCallback((email: string) => {
    dispatch({ type: "SET_EMAIL", payload: email });
  }, []);

  const setShippingAddress = React.useCallback((address: CheckoutAddress | null) => {
    dispatch({ type: "SET_SHIPPING_ADDRESS", payload: address });
  }, []);

  const setBillingAddress = React.useCallback((address: CheckoutAddress | null) => {
    dispatch({ type: "SET_BILLING_ADDRESS", payload: address });
  }, []);

  const setUseSameAsBilling = React.useCallback((value: boolean) => {
    dispatch({ type: "SET_USE_SAME_AS_BILLING", payload: value });
  }, []);

  const setCompany = React.useCallback((company: CompanyInfo | null) => {
    dispatch({ type: "SET_COMPANY", payload: company });
  }, []);

  const setShippingCountry = React.useCallback((country: string) => {
    dispatch({ type: "SET_SHIPPING_COUNTRY", payload: country });
    // Reset shipping selection when country changes
    dispatch({ type: "SET_SELECTED_SHIPPING_METHOD", payload: null });
    dispatch({ type: "SET_SELECTED_TERMINAL", payload: null });
    dispatch({ type: "SET_SHIPPING_PRICE", payload: 0 });
  }, []);

  const setSelectedShippingMethod = React.useCallback((method: SelectedShippingMethod | null) => {
    dispatch({ type: "SET_SELECTED_SHIPPING_METHOD", payload: method });
    dispatch({ type: "SET_SHIPPING_PRICE", payload: method?.price ?? 0 });
    if (!method?.requires_terminal) {
      dispatch({ type: "SET_SELECTED_TERMINAL", payload: null });
    }
  }, []);

  const setSelectedTerminal = React.useCallback((terminal: Terminal | null) => {
    dispatch({ type: "SET_SELECTED_TERMINAL", payload: terminal });
  }, []);

  const setSelectedPaymentMethod = React.useCallback((method: string | null) => {
    dispatch({ type: "SET_SELECTED_PAYMENT_METHOD", payload: method });
  }, []);

  const setCurrentStep = React.useCallback((step: CheckoutStep) => {
    dispatch({ type: "SET_CURRENT_STEP", payload: step });
  }, []);

  // Fetch quote
  const fetchQuote = React.useCallback(async () => {
    dispatch({ type: "SET_QUOTE_LOADING", payload: true });
    dispatch({ type: "SET_ERROR", payload: null });
    try {
      const response = await getCheckoutQuote(state.shippingCountry);
      dispatch({ type: "SET_SHIPPING_METHODS", payload: response.methods || [] });
      if (response.totals) {
        dispatch({ type: "SET_TOTALS", payload: { subtotal: response.totals.subtotal } });
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      const msg = e instanceof Error ? e.message : t("quote_failed");
      dispatch({ type: "SET_ERROR", payload: msg });
    } finally {
      dispatch({ type: "SET_QUOTE_LOADING", payload: false });
    }
  }, [state.shippingCountry]);

  // Submit address
  const submitAddress = React.useCallback(async (): Promise<boolean> => {
    if (!state.shippingAddress) {
      dispatch({ type: "SET_ERROR", payload: t("address_required") });
      return false;
    }

    dispatch({ type: "SET_LOADING", payload: true });
    dispatch({ type: "SET_ERROR", payload: null });
    try {
      await submitCheckoutAddress({
        shipping: state.shippingAddress,
        billing: state.billingAddress || undefined,
        use_same_as_billing: state.useSameAsBilling,
        company: state.company || undefined,
      });
      dispatch({ type: "SET_ADDRESS_VALID", payload: true });
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : t("address_submit_failed");
      dispatch({ type: "SET_ERROR", payload: msg });
      return false;
    } finally {
      dispatch({ type: "SET_LOADING", payload: false });
    }
  }, [state.shippingAddress, state.billingAddress, state.useSameAsBilling, state.company, t]);

  // Select shipping
  const selectShipping = React.useCallback(async (): Promise<boolean> => {
    if (!state.selectedShippingMethod) {
      dispatch({ type: "SET_ERROR", payload: t("shipping_required") });
      return false;
    }

    if (state.selectedShippingMethod.requires_terminal && !state.selectedTerminal) {
      dispatch({ type: "SET_ERROR", payload: t("terminal_required") });
      return false;
    }

    dispatch({ type: "SET_LOADING", payload: true });
    dispatch({ type: "SET_ERROR", payload: null });
    try {
      const response = await selectCheckoutShipping(
        state.selectedShippingMethod.id,
        state.selectedTerminal?.id
      );
      dispatch({ type: "SET_SHIPPING_PRICE", payload: response.shipping_price });
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : t("shipping_select_failed");
      dispatch({ type: "SET_ERROR", payload: msg });
      return false;
    } finally {
      dispatch({ type: "SET_LOADING", payload: false });
    }
  }, [state.selectedShippingMethod, state.selectedTerminal, t]);

  // Select payment
  const selectPayment = React.useCallback(async (): Promise<boolean> => {
    if (!state.selectedPaymentMethod) {
      dispatch({ type: "SET_ERROR", payload: t("payment_required") });
      return false;
    }

    dispatch({ type: "SET_LOADING", payload: true });
    dispatch({ type: "SET_ERROR", payload: null });
    try {
      await selectCheckoutPayment(state.selectedPaymentMethod);
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : t("payment_select_failed");
      dispatch({ type: "SET_ERROR", payload: msg });
      return false;
    } finally {
      dispatch({ type: "SET_LOADING", payload: false });
    }
  }, [state.selectedPaymentMethod, t]);

  // Place order
  const placeOrder = React.useCallback(async (): Promise<boolean> => {
    if (!state.shippingAddress || !state.selectedShippingMethod || !state.selectedPaymentMethod) {
      dispatch({ type: "SET_ERROR", payload: t("complete_steps") });
      return false;
    }

    if (state.selectedShippingMethod.requires_terminal && !state.selectedTerminal) {
      dispatch({ type: "SET_ERROR", payload: t("terminal_required") });
      return false;
    }

    dispatch({ type: "SET_LOADING", payload: true });
    dispatch({ type: "SET_ERROR", payload: null });
    try {
      const response = await placeCheckoutOrder({
        email: state.email || undefined,
        lang: locale,
        shipping_address: state.shippingAddress,
        billing_address: state.billingAddress || undefined,
        use_same_as_billing: state.useSameAsBilling,
        company: state.company || undefined,
        shipping_method_id: state.selectedShippingMethod.id,
        shipping_terminal_id: state.selectedTerminal?.id,
        shipping_price: state.shippingPrice,
        payment_method: state.selectedPaymentMethod,
      });
      dispatch({
        type: "SET_ORDER_PLACED",
        payload: { orderNumber: response.order_number, checkoutUrl: response.checkout_url },
      });
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : t("place_order_failed");
      dispatch({ type: "SET_ERROR", payload: msg });
      return false;
    } finally {
      dispatch({ type: "SET_LOADING", payload: false });
    }
  }, [
    state.email,
    state.shippingAddress,
    state.billingAddress,
    state.useSameAsBilling,
    state.company,
    state.selectedShippingMethod,
    state.selectedTerminal,
    state.shippingPrice,
    state.selectedPaymentMethod,
    t
  ]);

  // Computed values
  const canProceedToShipping = React.useMemo(() => {
    return !!state.shippingAddress && state.addressValid;
  }, [state.shippingAddress, state.addressValid]);

  const canProceedToPayment = React.useMemo(() => {
    if (!state.selectedShippingMethod) return false;
    if (state.selectedShippingMethod.requires_terminal && !state.selectedTerminal) return false;
    return true;
  }, [state.selectedShippingMethod, state.selectedTerminal]);

  const canPlaceOrder = React.useMemo(() => {
    return canProceedToShipping && canProceedToPayment && !!state.selectedPaymentMethod;
  }, [canProceedToShipping, canProceedToPayment, state.selectedPaymentMethod]);

  return {
    state,
    setCart,
    setCartLoading,
    setEmail,
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
  };
}
