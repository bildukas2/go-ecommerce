import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AccountAuthForm } from "@/components/account/account-auth-form";
import { getCurrentAccount } from "@/lib/api";

type RegisterPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const params = await searchParams;
  const rawNext = Array.isArray(params.next) ? params.next[0] : params.next;
  const nextPath = typeof rawNext === "string" && rawNext.startsWith("/") ? rawNext : "/account";

  try {
    const cookieHeader = (await cookies()).toString();
    await getCurrentAccount({ cookieHeader });
    redirect(nextPath);
  } catch {}

  return (
    <div className="hero-aurora mx-auto max-w-md px-6 py-10">
      <div className="rounded-2xl border border-surface-border bg-surface/95 p-8 shadow-[0_18px_48px_rgba(2,6,23,0.14)]">
        <h1 className="text-[46px] font-semibold leading-none tracking-tight text-foreground">Create Account <span aria-hidden>👋</span></h1>
        <p className="mt-4 text-[30px] font-medium text-foreground">Welcome</p>
        <div className="mt-6">
          <AccountAuthForm mode="register" nextPath={nextPath} uiVariant="hero" />
        </div>
        <p className="mt-5 text-center text-base text-foreground/80">
          Already have an account?{" "}
          <Link href={`/account/login?next=${encodeURIComponent(nextPath)}`} className="font-medium text-blue-600 hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
