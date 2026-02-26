import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AccountShell } from "@/components/account/account-shell";
import { LogoutButton } from "@/components/account/logout-button";
import { getCurrentAccount } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const cookieHeader = (await cookies()).toString();
  let customer: Awaited<ReturnType<typeof getCurrentAccount>>;
  try {
    customer = await getCurrentAccount({ cookieHeader });
  } catch {
    redirect("/account/login?next=/account");
  }

  return (
    <AccountShell title="Account" subtitle="Manage your profile, orders, and favorites." active="overview">
      <div className="rounded-2xl border border-surface-border bg-surface p-5">
        <p className="text-sm text-neutral-500">Signed in as</p>
        <p className="mt-1 text-lg font-semibold">{customer.email}</p>
        <p className="mt-1 text-xs text-neutral-500">Member since {new Date(customer.created_at).toLocaleDateString()}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <AccountLink href="/account/orders" title="Purchase history" subtitle="View your previous orders." />
        <AccountLink href="/account/favorites" title="Favorites" subtitle="Products you saved for later." />
        <AccountLink href="/account/settings" title="Security" subtitle="Change your account password." />
      </div>

      <div className="rounded-2xl border border-surface-border bg-surface p-5">
        <LogoutButton variant="outline" />
      </div>
    </AccountShell>
  );
}

function AccountLink({ href, title, subtitle }: { href: string; title: string; subtitle: string }) {
  return (
    <Link href={href} className="rounded-2xl border border-surface-border bg-surface p-4 transition hover:-translate-y-0.5 hover:border-neutral-400">
      <h2 className="font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{subtitle}</p>
    </Link>
  );
}
