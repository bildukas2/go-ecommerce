import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AccountShell } from "@/components/account/account-shell";
import { PasswordChangeForm } from "@/components/account/password-change-form";
import { getCurrentAccount } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function AccountSettingsPage() {
  const cookieHeader = (await cookies()).toString();
  try {
    await getCurrentAccount({ cookieHeader });
  } catch {
    redirect("/account/login?next=/account/settings");
  }

  return (
    <AccountShell title="Account settings" subtitle="Update your password and keep your account secure." active="settings">
      <PasswordChangeForm />
    </AccountShell>
  );
}
