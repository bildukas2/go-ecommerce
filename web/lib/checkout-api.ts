import { API_URL } from "./config";

function apiJoin(path: string): string {
  const base = new URL(API_URL);
  const clean = path.replace(/^\/+/, "");
  if (!base.pathname.endsWith("/")) base.pathname += "/";
  return new URL(clean, base).toString();
}

function getCSRFToken(): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : "";
}

function mutHeaders(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  const csrf = getCSRFToken();
  if (csrf) h["X-CSRF-Token"] = csrf;
  return h;
}

const DEFAULT_TIMEOUT_MS = 15_000;

function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...init, signal: controller.signal }).finally(() =>
    clearTimeout(timer),
  );
}

// Address types
export interface CheckoutAddress {
  full_name: string;
  phone: string;
  address1: string;
  address2?: string;
  city: string;
  state?: string;
  postcode: string;
  country: string;
}

export interface CompanyInfo {
  name: string;
  vat?: string;
  invoice_email?: string;
}

// Shipping method from quote
export interface CheckoutShippingMethod {
  id: string;
  zone_id: string;
  provider_key: string;
  service_code: string;
  title: string;
  enabled: boolean;
  sort_order: number;
  pricing_mode: string;
  price: number;
  currency: string;
  requires_terminal: boolean;
}

// Payment method
export interface CheckoutPaymentMethod {
  id: string;
  title: string;
  description?: string;
  instructions?: string;
  enabled: boolean;
  payment_type: string;
  method_name: string;
  config_json?: Record<string, unknown>;
  sort_order?: number;
}

// Get payment methods for checkout
export async function getPaymentMethods(): Promise<CheckoutPaymentMethod[]> {
  const url = new URL(apiJoin("payments/methods"));
  const res = await fetchWithTimeout(url.toString(), {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
  });
  if (!res.ok) {
    throw new Error(`Failed to get payment methods: ${res.status}`);
  }
  const data = await res.json();
  return (data.items || []).map((item: any) => ({
    id: item.id,
    title: item.title,
    description: item.description,
    instructions: item.instructions,
    enabled: item.enabled,
    payment_type: item.payment_type,
    method_name: item.method_name,
    config_json: item.config_json,
    sort_order: item.sort_order,
  }));
}

// Quote response
export interface CheckoutQuoteResponse {
  zone: { id: string; name: string; enabled: boolean } | null;
  methods: CheckoutShippingMethod[];
  totals: {
    subtotal: number;
    shipping: number;
    total: number;
  };
}

// Select shipping response
export interface CheckoutSelectShippingResponse {
  success: boolean;
  shipping_price: number;
  currency: string;
  totals: {
    subtotal: number;
    shipping: number;
    total: number;
  };
}

// Place order response
export interface CheckoutPlaceOrderResponse {
  order_id: string;
  order_number: string;
  checkout_url: string;
  status: string;
}

// Get shipping quote for a country
export async function getCheckoutQuote(country: string): Promise<CheckoutQuoteResponse> {
  const url = new URL(apiJoin("checkout/quote"));
  const res = await fetchWithTimeout(url.toString(), {
    method: "POST",
    headers: mutHeaders(),
    credentials: "include",
    body: JSON.stringify({ country }),
  });
  if (!res.ok) {
    throw new Error(`Failed to get quote: ${res.status}`);
  }
  return res.json();
}

// Submit address
export async function submitCheckoutAddress(data: {
  shipping: CheckoutAddress;
  billing?: CheckoutAddress;
  use_same_as_billing: boolean;
  company?: CompanyInfo;
}): Promise<{ valid: boolean }> {
  const url = new URL(apiJoin("checkout/address"));
  const res = await fetchWithTimeout(url.toString(), {
    method: "POST",
    headers: mutHeaders(),
    credentials: "include",
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    throw new Error(payload.error || `Failed to submit address: ${res.status}`);
  }
  return res.json();
}

// Select shipping method
export async function selectCheckoutShipping(
  methodId: string,
  terminalId?: string
): Promise<CheckoutSelectShippingResponse> {
  const url = new URL(apiJoin("checkout/select-shipping"));
  const res = await fetchWithTimeout(url.toString(), {
    method: "POST",
    headers: mutHeaders(),
    credentials: "include",
    body: JSON.stringify({ method_id: methodId, terminal_id: terminalId }),
  });
  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    throw new Error(payload.error || `Failed to select shipping: ${res.status}`);
  }
  return res.json();
}

// Select payment method
export async function selectCheckoutPayment(
  method: string,
  provider?: string
): Promise<{ success: boolean }> {
  const url = new URL(apiJoin("checkout/select-payment"));
  const res = await fetchWithTimeout(url.toString(), {
    method: "POST",
    headers: mutHeaders(),
    credentials: "include",
    body: JSON.stringify({ method, provider }),
  });
  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    throw new Error(payload.error || `Failed to select payment: ${res.status}`);
  }
  return res.json();
}

// Place order
export async function placeCheckoutOrder(data: {
  shipping_address: CheckoutAddress;
  billing_address?: CheckoutAddress;
  use_same_as_billing: boolean;
  company?: CompanyInfo;
  shipping_method_id: string;
  shipping_terminal_id?: string;
  shipping_price: number;
  payment_method: string;
  payment_provider?: string;
}): Promise<CheckoutPlaceOrderResponse> {
  const url = new URL(apiJoin("checkout/place-order"));
  const res = await fetchWithTimeout(url.toString(), {
    method: "POST",
    headers: mutHeaders(),
    credentials: "include",
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    throw new Error(payload.error || `Failed to place order: ${res.status}`);
  }
  return res.json();
}
