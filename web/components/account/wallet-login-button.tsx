"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { getWalletNonce, verifyWalletLogin } from "@/lib/api";
import {
  buildSiweMessage,
  connectWallet,
  getChainId,
  isWalletAvailable,
  signSiweMessage,
} from "@/lib/siwe";

type WalletLoginButtonProps = {
  nextPath?: string;
  className?: string;
};

type Step = "idle" | "connecting" | "signing" | "verifying" | "done";

export function WalletLoginButton({ nextPath = "/account", className }: WalletLoginButtonProps) {
  const router = useRouter();
  const [step, setStep] = React.useState<Step>("idle");
  const [error, setError] = React.useState<string | null>(null);
  const [noWallet, setNoWallet] = React.useState(false);

  // Detect wallet availability after mount (SSR-safe)
  React.useEffect(() => {
    setNoWallet(!isWalletAvailable());
  }, []);

  async function handleConnect() {
    if (step !== "idle") return;
    setError(null);

    try {
      setStep("connecting");
      const address = await connectWallet();
      const chainId = await getChainId();

      const nonce = await getWalletNonce();

      const domain = window.location.host;
      const uri = window.location.origin;
      const message = buildSiweMessage({ domain, address, nonce, chainId, uri });

      setStep("signing");
      const signature = await signSiweMessage(address, message);

      setStep("verifying");
      await verifyWalletLogin(address, message, signature);

      setStep("done");
      router.push(nextPath);
      router.refresh();
    } catch (err) {
      setStep("idle");
      const msg = err instanceof Error ? err.message : "Wallet login failed";
      // User rejected the signature request — don't show an error for that
      if (msg.toLowerCase().includes("user rejected") || msg.toLowerCase().includes("user denied")) {
        return;
      }
      setError(msg);
    }
  }

  const label: Record<Step, string> = {
    idle: "Connect Wallet",
    connecting: "Connecting...",
    signing: "Sign in wallet...",
    verifying: "Verifying...",
    done: "Redirecting...",
  };

  if (noWallet) {
    return (
      <a
        href="https://metamask.io"
        target="_blank"
        rel="noopener noreferrer"
        className={
          className ??
          "flex w-full items-center justify-center gap-2 rounded-xl border border-surface-border bg-background/60 px-4 py-2.5 text-sm text-foreground/60 hover:bg-background/80"
        }
      >
        <WalletIcon />
        Install MetaMask to use wallet login
      </a>
    );
  }

  return (
    <div className="space-y-1.5">
      <button
        type="button"
        onClick={handleConnect}
        disabled={step !== "idle"}
        className={
          className ??
          "flex w-full items-center justify-center gap-2 rounded-xl border border-surface-border bg-background/60 px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-background/80 disabled:opacity-50"
        }
      >
        <WalletIcon />
        {label[step]}
      </button>
      {error ? <p className="text-center text-xs text-red-500">{error}</p> : null}
    </div>
  );
}

function WalletIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="shrink-0"
    >
      <rect x="2" y="6" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M2 10h20" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="17" cy="15" r="1.5" fill="currentColor" />
    </svg>
  );
}
