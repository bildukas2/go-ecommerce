"use client";

import * as React from "react";
import { CheckoutAddress, CompanyInfo } from "@/lib/checkout-api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { MapPin, Building } from "lucide-react";
import { useTranslations } from "next-intl";

interface AddressSectionProps {
  shippingAddress: CheckoutAddress | null;
  billingAddress: CheckoutAddress | null;
  useSameAsBilling: boolean;
  company: CompanyInfo | null;
  onShippingAddressChange: (address: CheckoutAddress | null) => void;
  onBillingAddressChange: (address: CheckoutAddress | null) => void;
  onUseSameAsBillingChange: (value: boolean) => void;
  onCompanyChange: (company: CompanyInfo | null) => void;
  onContinue: () => void;
  loading?: boolean;
  error?: string | null;
}

const emptyAddress: CheckoutAddress = {
  full_name: "",
  phone: "",
  address1: "",
  address2: "",
  city: "",
  state: "",
  postcode: "",
  country: "EE",
};

const emptyCompany: CompanyInfo = {
  name: "",
  vat: "",
  invoice_email: "",
};

export function AddressSection({
  shippingAddress,
  billingAddress,
  useSameAsBilling,
  company,
  onShippingAddressChange,
  onBillingAddressChange,
  onUseSameAsBillingChange,
  onCompanyChange,
  onContinue,
  loading,
  error,
}: AddressSectionProps) {
  const t = useTranslations("checkout.address_section");
  const commonT = useTranslations("checkout");
  const [showCompany, setShowCompany] = React.useState(!!company?.name);
  const [localShipping, setLocalShipping] = React.useState<CheckoutAddress>(
    shippingAddress || emptyAddress
  );
  const [localBilling, setLocalBilling] = React.useState<CheckoutAddress>(
    billingAddress || emptyAddress
  );
  const [localCompany, setLocalCompany] = React.useState<CompanyInfo>(
    company || emptyCompany
  );

  // Sync local state with props
  React.useEffect(() => {
    if (shippingAddress) {
      setLocalShipping(shippingAddress);
    }
  }, [shippingAddress]);

  React.useEffect(() => {
    if (billingAddress) {
      setLocalBilling(billingAddress);
    }
  }, [billingAddress]);

  React.useEffect(() => {
    if (company) {
      setLocalCompany(company);
    }
  }, [company]);

  const handleShippingChange = (field: keyof CheckoutAddress, value: string) => {
    const updated = { ...localShipping, [field]: value };
    setLocalShipping(updated);
    onShippingAddressChange(updated);
  };

  const handleBillingChange = (field: keyof CheckoutAddress, value: string) => {
    const updated = { ...localBilling, [field]: value };
    setLocalBilling(updated);
    onBillingAddressChange(updated);
  };

  const handleCompanyChange = (field: keyof CompanyInfo, value: string) => {
    const updated = { ...localCompany, [field]: value };
    setLocalCompany(updated);
    if (showCompany) {
      onCompanyChange(updated);
    }
  };

  const handleShowCompanyChange = (show: boolean) => {
    setShowCompany(show);
    if (show) {
      onCompanyChange(localCompany);
    } else {
      onCompanyChange(null);
    }
  };

  const isValid = React.useMemo(() => {
    const required = ["full_name", "phone", "address1", "city", "postcode", "country"];
    const shippingValid = required.every((f) => localShipping[f as keyof CheckoutAddress]?.trim());
    if (!useSameAsBilling) {
      const billingValid = required.every((f) => localBilling[f as keyof CheckoutAddress]?.trim());
      return shippingValid && billingValid;
    }
    return shippingValid;
  }, [localShipping, localBilling, useSameAsBilling]);

  return (
    <div className="space-y-6">
      {/* Shipping Address */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-blue-500" />
          <h3 className="text-lg font-semibold">{commonT("shipping_address")}</h3>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="full_name">{t("full_name")} *</Label>
            <Input
              id="full_name"
              value={localShipping.full_name}
              onChange={(e) => handleShippingChange("full_name", e.target.value)}
              placeholder="John Doe"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">{t("phone")} *</Label>
            <Input
              id="phone"
              value={localShipping.phone}
              onChange={(e) => handleShippingChange("phone", e.target.value)}
              placeholder="+372 5555 5555"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="address1">{t("address")} *</Label>
          <Input
            id="address1"
            value={localShipping.address1}
            onChange={(e) => handleShippingChange("address1", e.target.value)}
            placeholder={t("address_placeholder")}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="address2">{t("apartment")}</Label>
          <Input
            id="address2"
            value={localShipping.address2 || ""}
            onChange={(e) => handleShippingChange("address2", e.target.value)}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="city">{t("city")} *</Label>
            <Input
              id="city"
              value={localShipping.city}
              onChange={(e) => handleShippingChange("city", e.target.value)}
              placeholder="Tallinn"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="postcode">{t("postcode")} *</Label>
            <Input
              id="postcode"
              value={localShipping.postcode}
              onChange={(e) => handleShippingChange("postcode", e.target.value)}
              placeholder="10111"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="country">{t("country")} *</Label>
            <select
              id="country"
              value={localShipping.country}
              onChange={(e) => handleShippingChange("country", e.target.value)}
              className="flex h-11 w-full rounded-2xl border border-surface-border bg-background/80 px-4 py-2 text-sm shadow-sm shadow-black/10 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-0"
            >
              <option value="EE">Estonia</option>
              <option value="LV">Latvia</option>
              <option value="LT">Lithuania</option>
              <option value="FI">Finland</option>
            </select>
          </div>
        </div>
      </div>

      {/* Same as billing toggle */}
      <div className="flex items-center space-x-2">
        <Checkbox
          id="same_billing"
          checked={useSameAsBilling}
          onCheckedChange={(checked) => onUseSameAsBillingChange(checked as boolean)}
        />
        <Label htmlFor="same_billing" className="cursor-pointer">
          {t("same_as_billing")}
        </Label>
      </div>

      {/* Billing Address (if different) */}
      {!useSameAsBilling && (
        <div className="space-y-4 border-t pt-6">
          <h3 className="text-lg font-semibold">{commonT("billing_address")}</h3>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="billing_full_name">{t("full_name")} *</Label>
              <Input
                id="billing_full_name"
                value={localBilling.full_name}
                onChange={(e) => handleBillingChange("full_name", e.target.value)}
                placeholder="John Doe"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="billing_phone">{t("phone")} *</Label>
              <Input
                id="billing_phone"
                value={localBilling.phone}
                onChange={(e) => handleBillingChange("phone", e.target.value)}
                placeholder="+372 5555 5555"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="billing_address1">{t("address")} *</Label>
            <Input
              id="billing_address1"
              value={localBilling.address1}
              onChange={(e) => handleBillingChange("address1", e.target.value)}
              placeholder={t("address_placeholder")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="billing_address2">{t("apartment")}</Label>
            <Input
              id="billing_address2"
              value={localBilling.address2 || ""}
              onChange={(e) => handleBillingChange("address2", e.target.value)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="billing_city">{t("city")} *</Label>
              <Input
                id="billing_city"
                value={localBilling.city}
                onChange={(e) => handleBillingChange("city", e.target.value)}
                placeholder="Tallinn"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="billing_postcode">{t("postcode")} *</Label>
              <Input
                id="billing_postcode"
                value={localBilling.postcode}
                onChange={(e) => handleBillingChange("postcode", e.target.value)}
                placeholder="10111"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="billing_country">{t("country")} *</Label>
              <select
                id="billing_country"
                value={localBilling.country}
                onChange={(e) => handleBillingChange("country", e.target.value)}
                className="flex h-11 w-full rounded-2xl border border-surface-border bg-background/80 px-4 py-2 text-sm shadow-sm shadow-black/10 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-0"
              >
                <option value="EE">Estonia</option>
                <option value="LV">Latvia</option>
                <option value="LT">Lithuania</option>
                <option value="FI">Finland</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Company info toggle */}
      <div className="border-t pt-6">
        <div className="flex items-center space-x-2 mb-4">
          <Checkbox
            id="show_company"
            checked={showCompany}
            onCheckedChange={(checked) => handleShowCompanyChange(checked as boolean)}
          />
          <Label htmlFor="show_company" className="cursor-pointer flex items-center gap-2">
            <Building className="h-4 w-4" />
            {t("invoice_company")}
          </Label>
        </div>

        {showCompany && (
          <div className="space-y-4 pl-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="company_name">{t("company_name")}</Label>
                <Input
                  id="company_name"
                  value={localCompany.name}
                  onChange={(e) => handleCompanyChange("name", e.target.value)}
                  placeholder="ACME Inc."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company_vat">{t("vat_number")}</Label>
                <Input
                  id="company_vat"
                  value={localCompany.vat || ""}
                  onChange={(e) => handleCompanyChange("vat", e.target.value)}
                  placeholder="EE123456789"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="invoice_email">{t("invoice_email")}</Label>
              <Input
                id="invoice_email"
                type="email"
                value={localCompany.invoice_email || ""}
                onChange={(e) => handleCompanyChange("invoice_email", e.target.value)}
                placeholder="invoices@company.com"
              />
            </div>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="text-sm text-red-600 bg-red-500/10 border border-red-500/30 rounded-lg p-3">
          {error}
        </div>
      )}

      {/* Continue button */}
      <Button
        onClick={onContinue}
        disabled={!isValid || loading}
        className="w-full sm:w-auto"
      >
        {loading ? commonT("saving") : commonT("continue_to_shipping")}
      </Button>
    </div>
  );
}