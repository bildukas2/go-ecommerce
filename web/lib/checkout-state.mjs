export function parseCheckoutResponse(input) {
  if (!input || typeof input !== "object") {
    throw new Error("Invalid checkout response payload");
  }

  const obj = input;
  const orderId = typeof obj.order_id === "string" ? obj.order_id : "";
  const checkoutUrl = typeof obj.checkout_url === "string" ? obj.checkout_url : "";
  const status = typeof obj.status === "string" ? obj.status : "";

  if (!orderId || !checkoutUrl || !status) {
    throw new Error("Invalid checkout response payload");
  }

  return {
    order_id: orderId,
    checkout_url: checkoutUrl,
    status,
  };
}

export function firstSearchParam(value) {
  if (Array.isArray(value)) return value[0];
  return typeof value === "string" ? value : undefined;
}
