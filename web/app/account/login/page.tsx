import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AccountAuthForm } from "@/components/account/account-auth-form";
import { getCurrentAccount } from "@/lib/api";

type LoginPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const rawNext = Array.isArray(params.next) ? params.next[0] : params.next;
  const nextPath = typeof rawNext === "string" && rawNext.startsWith("/") ? rawNext : "/account";

  try {
    const cookieHeader = (await cookies()).toString();
    await getCurrentAccount({ cookieHeader });
    redirect(nextPath);
  } catch {}

  return (
    <div className="hero-aurora mx-auto max-w-md px-6 py-12">
      <div className="rounded-2xl border border-surface-border bg-surface p-6">
        <h1 className="text-2xl font-semibold">Welcome back</h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">Login to access your account and saved favorites.</p>
        <div className="mt-5">
          <AccountAuthForm mode="login" nextPath={nextPath} />
        </div>
        <p className="mt-4 text-sm text-neutral-600 dark:text-neutral-400">
          No account yet?{" "}
          <Link href={`/account/register?next=${encodeURIComponent(nextPath)}`} className="font-medium underline">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
