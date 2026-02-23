import * as React from "react";
import { motion } from "framer-motion";
import { Cart, CartItem, CartItemCustomOption } from "@/lib/api";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Package, Truck, Tag, Minus, Plus } from "lucide-react";

interface OrderSummaryProps {
  cart: Cart | null;
  shippingPrice?: number;
  loading?: boolean;
  onUpdateQuantity?: (itemId: string, quantity: number) => Promise<void>;
  onRemoveItem?: (itemId: string) => Promise<void>;
}

function formatPrice(cents: number): string {
  return `€${(cents / 100).toFixed(2)}`;
}

function customOptionLabel(option: CartItemCustomOption): string {
  if (option.ValueTitle) return option.ValueTitle;
  if (Array.isArray(option.ValueTitles) && option.ValueTitles.length > 0) {
    return option.ValueTitles.join(", ");
  }
  if (option.ValueText) return option.ValueText;
  return "Selected";
}

function CartItemRow({
  item,
  onUpdateQuantity,
  onRemoveItem,
  isMutating = false,
  loading = false,
}: {
  item: CartItem;
  onUpdateQuantity?: (itemId: string, quantity: number) => Promise<void>;
  onRemoveItem?: (itemId: string) => Promise<void>;
  isMutating?: boolean;
  loading?: boolean;
}) {
  const productName = item.ProductTitle || "Product";
  const price = item.UnitPriceCents || 0;
  const image = item.ImageURL;
  const hasControls = onUpdateQuantity || onRemoveItem;

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
          {hasControls ? (
            <div className="flex items-center gap-2">
              <button
                className="rounded-full border border-surface-border bg-surface p-1.5 text-sm disabled:opacity-60"
                onClick={() => onUpdateQuantity?.(item.ID, Math.max(1, item.Quantity - 1))}
                disabled={isMutating || loading}
                aria-label="Decrease quantity"
              >
                <Minus size={12} />
              </button>
              <motion.span
                key={`${item.ID}-${item.Quantity}`}
                className="w-4 text-center text-xs"
                initial={{ scale: 0.92, opacity: 0.8 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.16 }}
              >
                {item.Quantity}
              </motion.span>
              <button
                className="rounded-full border border-surface-border bg-surface p-1.5 text-sm disabled:opacity-60"
                onClick={() => onUpdateQuantity?.(item.ID, item.Quantity + 1)}
                disabled={isMutating || loading}
                aria-label="Increase quantity"
              >
                <Plus size={12} />
              </button>
            </div>
          ) : (
            `Qty: ${item.Quantity}`
          )}
        </div>
        {Array.isArray(item.CustomOptions) && item.CustomOptions.length > 0 ? (
          <div className="space-y-1 text-xs text-muted-foreground">
            {item.CustomOptions.map((option) => (
              <div key={option.OptionID}>
                {option.Title}: {customOptionLabel(option)}
              </div>
            ))}
          </div>
        ) : null}
      </div>
      <div className="flex items-center gap-3">
        <div className="text-sm font-semibold text-foreground whitespace-nowrap">
          {formatPrice(price * item.Quantity)}
        </div>
        {hasControls && onRemoveItem && (
          <button
            className="text-xs text-red-600 hover:underline disabled:opacity-60"
            onClick={() => onRemoveItem(item.ID)}
            disabled={isMutating || loading}
          >
            Remove
          </button>
        )}
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

export function OrderSummary({
  cart,
  shippingPrice = 0,
  loading,
  onUpdateQuantity,
  onRemoveItem,
}: OrderSummaryProps) {
  const [mutatingItemIds, setMutatingItemIds] = React.useState<string[]>([]);

  const handleUpdateQuantity = React.useCallback(
    async (itemId: string, quantity: number) => {
      if (!onUpdateQuantity) return;
      setMutatingItemIds((prev) =>
        prev.includes(itemId) ? prev : [...prev, itemId]
      );
      try {
        await onUpdateQuantity(itemId, quantity);
      } finally {
        setMutatingItemIds((prev) => prev.filter((id) => id !== itemId));
      }
    },
    [onUpdateQuantity]
  );

  const handleRemoveItem = React.useCallback(
    async (itemId: string) => {
      if (!onRemoveItem) return;
      setMutatingItemIds((prev) =>
        prev.includes(itemId) ? prev : [...prev, itemId]
      );
      try {
        await onRemoveItem(itemId);
      } finally {
        setMutatingItemIds((prev) => prev.filter((id) => id !== itemId));
      }
    },
    [onRemoveItem]
  );

  const subtotal = cart?.Totals?.SubtotalCents || 0;
  const total = subtotal + shippingPrice;

  return (
    <div className="glass rounded-[28px] border border-surface-border bg-surface/80 p-6 space-y-5 shadow-[0_30px_80px_rgba(2,6,23,0.25)]">
      <div className="flex items-center gap-2">
        <Tag className="h-5 w-5 text-blue-500" />
        <h3 className="text-lg font-semibold">Order Summary</h3>
      </div>

      <div className="space-y-3 max-h-100 overflow-y-auto pr-1">
        {loading ? (
          <CartSkeleton />
        ) : cart?.Items && cart.Items.length > 0 ? (
          <div className="space-y-3">
            {cart.Items.map((item) => (
              <CartItemRow
                key={item.ID}
                item={item}
                onUpdateQuantity={onUpdateQuantity ? handleUpdateQuantity : undefined}
                onRemoveItem={onRemoveItem ? handleRemoveItem : undefined}
                isMutating={mutatingItemIds.includes(item.ID)}
                loading={loading || false}
              />
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
