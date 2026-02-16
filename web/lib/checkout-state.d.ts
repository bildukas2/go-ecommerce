export type CheckoutResult = {
  order_id: string;
  checkout_url: string;
  status: string;
};

export function parseCheckoutResponse(input: unknown): CheckoutResult;
export function firstSearchParam(value: string | string[] | undefined): string | undefined;
