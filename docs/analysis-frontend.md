# Frontend Deep Analysis

> Analysis date: 2026-02-23

## Stack & Configuration

- **Framework**: Next.js 16.1.6 (App Router)
- **React**: 19.2.3 (server components support)
- **TypeScript**: 5.9.3 with `strict: true`
- **Styling**: Tailwind CSS 4 + PostCSS
- **UI Libraries**: HeroUI 2.8.9, Radix UI primitives, shadcn/ui pattern
- **Animation**: Framer Motion 12.34.0
- **Maps**: Leaflet 1.9.4 + React Leaflet 5.0.0
- **Icons**: Lucide React 0.564.0

---

## Page Structure

### Storefront Routes
| Route | File | Purpose |
|-------|------|---------|
| `/` | `app/page.tsx` | Homepage |
| `/products` | `app/products/page.tsx` | Product listing |
| `/products/[slug]` | `app/products/[slug]/page.tsx` | Product detail |
| `/checkout` | `app/checkout/page.tsx` | Checkout flow |
| `/checkout/success` | `app/checkout/success/page.tsx` | Order confirmation |
| `/checkout/cancel` | `app/checkout/cancel/page.tsx` | Payment canceled |

### Account Routes
| Route | File | Purpose |
|-------|------|---------|
| `/account` | `app/account/page.tsx` | Dashboard |
| `/account/login` | `app/account/login/page.tsx` | Login |
| `/account/register` | `app/account/register/page.tsx` | Registration |
| `/account/settings` | `app/account/settings/page.tsx` | User settings |
| `/account/favorites` | `app/account/favorites/page.tsx` | Saved products |
| `/account/orders` | `app/account/orders/page.tsx` | Order history |

### Admin Routes
| Route | File | Purpose |
|-------|------|---------|
| `/admin` | `app/admin/page.tsx` | Dashboard |
| `/admin/catalog/products` | | Product management |
| `/admin/catalog/categories` | | Category management |
| `/admin/catalog/custom-options` | | Custom options editor |
| `/admin/customers` | | Customer list |
| `/admin/customers/groups` | | Customer groups |
| `/admin/customers/logs` | | Activity logs |
| `/admin/orders` | | Order management |
| `/admin/orders/[id]` | | Order details |
| `/admin/security/blocked-ips` | | IP blocking |
| `/admin/settings/shipping` | | Shipping config |

---

## State Management

### Cart State (`web/components/cart-context.tsx`)
- React Context + useState
- Optimistic updates with rollback
- Cart operations: `add`, `update`, `remove`, `refresh`
- 147 lines, clean implementation

### Checkout State (`web/hooks/use-checkout-state.ts`)
- `useReducer` with discriminated union actions
- Manages: steps, addresses, shipping methods, payment, totals
- ~500 lines - largest state management piece
- **Bug**: `setCart` sets total = subtotal, ignoring shipping price (line 208)

### Admin State (Multiple `.mjs` files in `web/lib/`)
- `admin-catalog-state.mjs` - Catalog admin
- `admin-custom-options-state.mjs` - Option builder
- `admin-orders-state.mjs` - Order admin
- `cart-state.mjs` - Cart operations
- `checkout-state.mjs` - Checkout flow

---

## API Client Architecture

### Main API Client (`web/lib/api.ts` - 2400+ lines)
- Comprehensive TypeScript interfaces for all entities
- Normalization functions (`normalizeProduct`, `normalizeVariant`, etc.)
- Typed error classes (e.g., `BlockedIPError`)
- `credentials: "include"` for cookie-based auth
- Good separation of concerns

### Checkout API (`web/lib/checkout-api.ts`)
- 5 functions: `getCheckoutQuote`, `submitCheckoutAddress`, `selectCheckoutShipping`, `selectCheckoutPayment`, `placeCheckoutOrder`
- Proper error handling with typed responses

---

## Component Analysis

### Checkout Components (`web/components/checkout/`)

**OrderSummary** - Recently modified (uncommitted):
- Added quantity controls (+/- buttons)
- Added remove item button
- Framer Motion animation on quantity change
- Tracks per-item mutation state
- **Issue**: Rapid clicks can cause duplicate requests (no debounce)

**ShippingMethodSelector** - Recently refactored (uncommitted):
- Changed from fetching internally to receiving `methods` as props
- Now a pure presentational component
- Custom SVG spinner for loading state
- **Issue**: No keyboard navigation for option selection

**AddressSection**:
- Complex local state syncing with 3 separate `useEffect` hooks
- **Issue**: Props-to-state sync causes unnecessary re-renders

**TerminalPicker**:
- Uses Leaflet map for terminal selection
- Dynamically imported (good for bundle size)
- **Issue**: `cache: "no-store"` on terminal fetch

**PaymentMethodSelector**:
- Clean implementation
- Loading and error states handled

---

## Uncommitted Changes Detail

### `web/app/checkout/page.tsx`
1. Import changes: `StorefrontShippingMethod` -> `CheckoutShippingMethod`
2. Added `useCart` context integration
3. New `handleUpdateQuantity` and `handleRemoveItem` callbacks
4. **Bug**: Double fetch - calls `updateCart()` then `getCart()` separately
5. ShippingMethodSelector now receives methods as props instead of fetching

### `web/components/checkout/order-summary.tsx`
1. New props: `onUpdateQuantity`, `onRemoveItem`
2. New `CartItemRow` component with quantity controls
3. Framer Motion animation on quantity change
4. Per-item mutation tracking (`mutatingItemIds` state)
5. Added Minus, Plus icons from lucide-react

### `web/components/checkout/shipping-method-selector.tsx`
1. Complete prop signature refactor
2. Removed internal state and useEffect fetching
3. Now purely presentational
4. Loading spinner changed from Loader2 to inline SVG

---

## Performance Analysis

### Good
- Dynamic imports for Leaflet (code splitting)
- `useCallback` for handler memoization
- Optimistic updates in cart context
- Tailwind CSS (utility-first, small bundle)

### Issues
- No debounce on country input (triggers immediate API call)
- Terminal fetch uses `cache: "no-store"` (no browser caching)
- Framer Motion loaded globally (acceptable but could be dynamic)
- AddressSection: 3 useEffects cause cascading re-renders
- No `React.memo` on list item components

---

## Accessibility Issues

### Missing
- Cart items use `<div>` instead of semantic `<li>` or `<article>`
- No focus-visible styles on shipping method buttons
- Missing `role="region"` for dynamic content
- Some color contrast issues with transparency (`text-foreground/60`)

### Good
- `aria-label` on quantity controls
- `type="button"` explicitly set
- `disabled` attribute with visual feedback
- `<Label>` components used in forms

---

## Test Coverage

**Existing**: 1 file (`web/lib/color-swatches.test.ts`)

**Missing**:
- Component tests for all checkout components
- Hook tests for `useCheckoutState`, `useTerminals`, `useCustomerLocation`
- Integration tests for checkout flow
- API client mock tests
- Admin component tests

**E2E** (root level, Playwright):
- `test-admin-final.js`
- `test-admin-options.js`
- `test-admin-ui.js`
- `test-custom-options-e2e.js`

---

## CSS/Styling Patterns

### Design System
- Custom CSS variables: `foreground`, `surface`, `border`
- Glass morphism: `glass bg-surface/80 backdrop-blur-xl`
- Consistent spacing: `space-y-6`, `gap-4`, `p-4`

### Issues
- Hardcoded border radius: `rounded-[18px]`, `rounded-[28px]`, `rounded-[36px]`
- Inline CSS class strings in JS (`const sectionPanel = "glass ..."`)
- Multiple opacity variants not standardized (`/50`, `/60`, `/70`)
