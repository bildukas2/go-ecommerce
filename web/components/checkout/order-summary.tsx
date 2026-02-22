import * as React from "react";
import { Cart, CartItem } from "@/lib/api";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Package, Truck, Tag } from "lucide-react";

interface OrderSummaryProps {
  cart: Cart | null;
  shippingPrice?: number;
  loading?: boolean;
}

function formatPrice(cents: number): string {
  return `€${(cents / 100).toFixed(2)}`;
}

function CartItemRow({ item }: { item: CartItem }) {
  const productName = item.ProductTitle || "Product";
  const price = item.UnitPriceCents || 0;
  const image = item.ImageURL;

  return (
    <div className="flex items-center gap-4 rounded-[18px] border border-surface-border bg-background/50 px-3 py-3">
      <div className="h-16 w-16 flex-shrink-0 rounded-lg bg-muted overflow-hidden">
        {image ? (
          <img
            src={image}
            alt={productName}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center">
            <Package className="h-6 w-6 text-muted-foreground" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0 space-y-1">
        <div className="font-medium text-sm truncate text-foreground">{productName}</div>
        <div className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
          Qty: {item.Quantity}
        </div>
      </div>
      <div className="text-sm font-semibold text-foreground">
        {formatPrice(price * item.Quantity)}
      </div>
    </div>
  );
}

function CartSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2].map((i) => (
        <div key={i} className="flex gap-3 py-3">
          <Skeleton className="h-16 w-16 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </div>
  );
}

export function OrderSummary({ cart, shippingPrice = 0, loading }: OrderSummaryProps) {
  const subtotal = cart?.Totals?.SubtotalCents || 0;
  const total = subtotal + shippingPrice;

  return (
    <div className="glass rounded-[28px] border border-surface-border bg-surface/80 p-6 space-y-5 shadow-[0_30px_80px_rgba(2,6,23,0.25)]">
      <div className="flex items-center gap-2">
        <Tag className="h-5 w-5 text-blue-500" />
        <h3 className="text-lg font-semibold">Order Summary</h3>
      </div>

      <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
        {loading ? (
          <CartSkeleton />
        ) : cart?.Items && cart.Items.length > 0 ? (
          <div className="space-y-3">
            {cart.Items.map((item) => (
              <CartItemRow key={item.ID} item={item} />
            ))}
          </div>
        ) : (
          <div className="py-8 text-center text-muted-foreground">
            <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Your cart is empty</p>
          </div>
        )}
      </div>

      <Separator />

      <div className="space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Subtotal</span>
          <span>{formatPrice(subtotal)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground flex items-center gap-1">
            <Truck className="h-4 w-4" />
            Shipping
          </span>
          <span>{shippingPrice > 0 ? formatPrice(shippingPrice) : "—"}</span>
        </div>
      </div>

      <Separator />

      <div className="flex justify-between font-semibold text-lg">
        <span>Total</span>
        <span>{formatPrice(total)}</span>
      </div>

      <p className="text-xs text-muted-foreground">
        Prices include VAT. Shipping calculated at checkout.
      </p>
    </div>
  );
}
