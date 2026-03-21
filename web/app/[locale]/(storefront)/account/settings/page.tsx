import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AccountShell } from "@/components/account/account-shell";
import { PasswordChangeForm } from "@/components/account/password-change-form";
import { getCurrentAccount } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function AccountSettingsPage() {
  const cookieHeader = (await cookies()).toString();
  const t = await getTranslations("account.settings");
  try {
    await getCurrentAccount({ cookieHeader });
  } catch {
    redirect("/account/login?next=/account/settings");
  }

  return (
    <AccountShell title={t("title")} subtitle={t("subtitle")} active="settings">
      <PasswordChangeForm />
    </AccountShell>
  );
}
