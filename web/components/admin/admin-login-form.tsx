"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminAuthError, getAdminCSRFToken, loginAdmin } from "@/lib/admin-auth";

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: () => void;
        },
      ) => string;
      reset: (widgetID?: string) => void;
    };
  }
}

type LoginErrorCode = "invalid_credentials" | "too_many_attempts" | "captcha_failed" | "unknown";

function toLoginError(code: string): LoginErrorCode {
  if (code === "invalid_credentials") return "invalid_credentials";
  if (code === "too_many_attempts") return "too_many_attempts";
  if (code === "captcha_failed") return "captcha_failed";
  return "unknown";
}

function errorMessage(code: LoginErrorCode): string {
  if (code === "invalid_credentials") return "Invalid email or password";
  if (code === "too_many_attempts") return "Too many attempts";
  if (code === "captcha_failed") return "Captcha failed";
  return "Login failed";
}

const TURNSTILE_SCRIPT_ID = "cf-turnstile-script";

function ensureTurnstileScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.turnstile) return Promise.resolve();

  const existing = document.getElementById(TURNSTILE_SCRIPT_ID) as HTMLScriptElement | null;
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("captcha failed")), { once: true });
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.id = TURNSTILE_SCRIPT_ID;
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("captcha failed"));
    document.head.appendChild(script);
  });
}

export function AdminLoginForm() {
  const router = useRouter();
  const captchaRef = useRef<HTMLDivElement | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [csrfToken, setCSRFToken] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loadingCSRF, setLoadingCSRF] = useState(false);
  const [errorCode, setErrorCode] = useState<LoginErrorCode | null>(null);
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() || "";

  async function ensureCsrfToken(): Promise<string> {
    if (csrfToken) return csrfToken;
    const token = await getAdminCSRFToken();
    setCSRFToken(token);
    return token;
  }

  useEffect(() => {
    let mounted = true;
    setLoadingCSRF(true);
    getAdminCSRFToken()
      .then((token) => {
        if (!mounted) return;
        setCSRFToken(token);
      })
      .catch(() => {
        if (!mounted) return;
        setErrorCode("unknown");
      })
      .finally(() => {
        if (!mounted) return;
        setLoadingCSRF(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!turnstileSiteKey || !captchaRef.current) return;
    let mounted = true;
    ensureTurnstileScript()
      .then(() => {
        if (!mounted || !captchaRef.current || !window.turnstile) return;
        captchaRef.current.innerHTML = "";
        window.turnstile.render(captchaRef.current, {
          sitekey: turnstileSiteKey,
          callback: (token: string) => setCaptchaToken(token),
          "expired-callback": () => setCaptchaToken(""),
          "error-callback": () => setCaptchaToken(""),
        });
      })
      .catch(() => {
        if (!mounted) return;
        setErrorCode("captcha_failed");
      });
    return () => {
      mounted = false;
    };
  }, [turnstileSiteKey]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    if (turnstileSiteKey && !captchaToken) {
      setErrorCode("captcha_failed");
      return;
    }
    setSubmitting(true);
    setErrorCode(null);
    try {
      const token = await ensureCsrfToken();
      await loginAdmin({
        email,
        password,
        captchaToken: turnstileSiteKey ? captchaToken : "captcha-disabled",
        csrfToken: token,
      });
      router.push("/admin");
      router.refresh();
    } catch (error) {
      if (error instanceof AdminAuthError) {
        setErrorCode(toLoginError(error.code));
      } else {
        setErrorCode("unknown");
      }
      if (window.turnstile) {
        window.turnstile.reset();
      }
      setCaptchaToken("");
    } finally {
      setSubmitting(false);
    }
  }

  const disabled = submitting || loadingCSRF;

  return (
    <div className="w-full max-w-md rounded-2xl border border-surface-border bg-surface/95 p-8 shadow-[0_18px_48px_rgba(2,6,23,0.14)]">
      <h1 className="text-[46px] font-semibold leading-none tracking-tight text-foreground">Log In <span aria-hidden>👋</span></h1>
      <p className="mt-4 text-[30px] font-medium text-foreground">Welcome back</p>
      <form onSubmit={onSubmit} className="mt-6 space-y-5">
        <div className="space-y-2">
          <label className="block text-base font-medium text-foreground" htmlFor="admin-login-email">
            Email<span className="text-danger">*</span>
          </label>
          <input
            id="admin-login-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Enter your email"
            className="h-12 w-full rounded-xl border border-surface-border bg-background/80 px-4 text-[22px] text-foreground outline-none transition focus:border-blue-500"
          />
        </div>
        <div className="space-y-2">
          <label className="block text-base font-medium text-foreground" htmlFor="admin-login-password">
            Password<span className="text-danger">*</span>
          </label>
          <div className="relative">
            <input
              id="admin-login-password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
              className="h-12 w-full rounded-xl border border-surface-border bg-background/80 px-4 pr-11 text-[22px] text-foreground outline-none transition focus:border-blue-500"
            />
            <button
              type="button"
              aria-label={showPassword ? "Hide password" : "Show password"}
              onClick={() => setShowPassword((value) => !value)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground/50 hover:text-foreground/70"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M2 12C3.73 8.11 7.52 5.5 12 5.5C16.48 5.5 20.27 8.11 22 12C20.27 15.89 16.48 18.5 12 18.5C7.52 18.5 3.73 15.89 2 12Z" stroke="currentColor" strokeWidth="1.8" />
                <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
              </svg>
            </button>
          </div>
        </div>
        <div className="flex items-center justify-between pt-1 text-sm">
          <label className="inline-flex cursor-pointer items-center gap-2 text-foreground/90">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(event) => setRememberMe(event.target.checked)}
              className="size-4 rounded border-surface-border accent-blue-600"
            />
            Remember me
          </label>
          <button type="button" className="text-foreground/60 hover:text-foreground/90">
            Forgot password?
          </button>
        </div>
        {turnstileSiteKey ? (
          <div className="rounded-xl border border-surface-border bg-background/50 p-3">
            <div ref={captchaRef} />
          </div>
        ) : null}
        {errorCode ? <p className="text-sm text-danger">{errorMessage(errorCode)}</p> : null}
        <button
          type="submit"
          disabled={disabled}
          className="h-12 w-full rounded-xl bg-blue-600 text-base font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Signing in..." : "Log In"}
        </button>
        <div className="pt-1 text-center">
          <a href="/account/register" className="text-base text-blue-600 hover:underline">
            Create an account
          </a>
        </div>
      </form>
    </div>
  );
}
