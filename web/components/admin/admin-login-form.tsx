"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, CardBody, CardHeader, Checkbox, Input } from "@heroui/react";
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
    <Card className="w-full max-w-md border border-default-200/70 bg-content1/95 shadow-[0_20px_60px_rgba(0,0,0,0.18)] backdrop-blur-xl dark:border-default-100/10 dark:shadow-[0_24px_70px_rgba(0,0,0,0.5)]">
      <CardHeader className="flex-col items-start gap-1 p-8 pb-2">
        <h1 className="text-4xl font-semibold tracking-tight text-foreground">Log In</h1>
        <p className="text-base text-foreground-500">Sign in to continue to admin.</p>
      </CardHeader>
      <CardBody className="space-y-5 p-8 pt-4">
        <form onSubmit={onSubmit} className="space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="admin-login-email">
              Email <span className="text-danger">*</span>
            </label>
            <Input
              id="admin-login-email"
              type="email"
              autoComplete="email"
              placeholder="Enter your email"
              variant="bordered"
              radius="lg"
              size="lg"
              isRequired
              value={email}
              onValueChange={setEmail}
              classNames={{
                inputWrapper: "border-default-300/80 bg-transparent",
              }}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="admin-login-password">
              Password <span className="text-danger">*</span>
            </label>
            <Input
              id="admin-login-password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Enter your password"
              variant="bordered"
              radius="lg"
              size="lg"
              isRequired
              value={password}
              onValueChange={setPassword}
              classNames={{
                inputWrapper: "border-default-300/80 bg-transparent",
              }}
              endContent={
                <button
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="text-foreground-400 transition-colors hover:text-foreground-600"
                  onClick={() => setShowPassword((value) => !value)}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M2 12C3.73 8.11 7.52 5.5 12 5.5C16.48 5.5 20.27 8.11 22 12C20.27 15.89 16.48 18.5 12 18.5C7.52 18.5 3.73 15.89 2 12Z" stroke="currentColor" strokeWidth="1.8" />
                    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
                  </svg>
                </button>
              }
            />
          </div>
          <div className="flex items-center justify-between text-sm">
            <Checkbox size="sm">Remember me</Checkbox>
            <button type="button" className="text-foreground-500 hover:text-primary">
              Forgot password?
            </button>
          </div>
          {turnstileSiteKey ? (
            <div className="rounded-xl border border-default-200 bg-default-50/40 p-3 dark:bg-default-100/5">
              <div ref={captchaRef} />
            </div>
          ) : null}
          {errorCode ? <p className="text-sm text-danger">{errorMessage(errorCode)}</p> : null}
          <Button type="submit" color="primary" radius="lg" size="lg" className="h-12 w-full text-base font-medium" isLoading={submitting} isDisabled={disabled}>
            Sign In
          </Button>
          <div className="text-center text-sm">
            <a href="/" className="text-primary hover:underline">
              Back to store
            </a>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
