"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, CardBody, CardHeader, Input } from "@heroui/react";
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
  const [csrfToken, setCSRFToken] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loadingCSRF, setLoadingCSRF] = useState(true);
  const [errorCode, setErrorCode] = useState<LoginErrorCode | null>(null);
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() || "";

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
    if (submitting || loadingCSRF) return;
    if (!csrfToken) {
      setErrorCode("captcha_failed");
      return;
    }
    if (turnstileSiteKey && !captchaToken) {
      setErrorCode("captcha_failed");
      return;
    }
    setSubmitting(true);
    setErrorCode(null);
    try {
      await loginAdmin({
        email,
        password,
        captchaToken: turnstileSiteKey ? captchaToken : "captcha-disabled",
        csrfToken,
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

  const disabled = submitting || loadingCSRF || !csrfToken;

  return (
    <Card className="w-full max-w-md border border-white/20 bg-background/90 shadow-[0_24px_80px_rgba(2,6,23,0.24)] backdrop-blur-xl">
      <CardHeader className="flex-col items-start gap-2 p-6 pb-1">
        <h1 className="text-3xl font-semibold tracking-tight">Admin login</h1>
        <p className="text-sm text-foreground/70">Sign in to continue to the admin panel.</p>
      </CardHeader>
      <CardBody className="p-6 pt-4">
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground/80" htmlFor="admin-login-email">
              Email
            </label>
            <Input
              id="admin-login-email"
              type="email"
              autoComplete="email"
              placeholder="admin@example.com"
              variant="bordered"
              radius="lg"
              size="lg"
              isRequired
              value={email}
              onValueChange={setEmail}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground/80" htmlFor="admin-login-password">
              Password
            </label>
            <Input
              id="admin-login-password"
              type="password"
              autoComplete="current-password"
              placeholder="Enter your password"
              variant="bordered"
              radius="lg"
              size="lg"
              isRequired
              value={password}
              onValueChange={setPassword}
            />
          </div>
          <div className="rounded-xl border border-surface-border bg-background/50 p-3">
            {turnstileSiteKey ? (
              <div ref={captchaRef} />
            ) : (
              <p className="text-sm text-warning">Captcha is not configured.</p>
            )}
          </div>
          {errorCode ? <p className="text-sm text-danger">{errorMessage(errorCode)}</p> : null}
          <Button type="submit" color="primary" radius="lg" className="mt-1 h-12 w-full font-medium" isLoading={submitting} isDisabled={disabled}>
            Sign in
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
