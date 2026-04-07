/**
 * SIWE (Sign-In with Ethereum) utilities.
 *
 * Uses window.ethereum (MetaMask / any injected EIP-1193 provider).
 * No external wallet library needed for Phase 1.
 */

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      isMetaMask?: boolean;
    };
  }
}

export function isWalletAvailable(): boolean {
  return typeof window !== "undefined" && typeof window.ethereum !== "undefined";
}

/** Request the user's wallet accounts and return the first address (lowercase). */
export async function connectWallet(): Promise<string> {
  if (!isWalletAvailable()) throw new Error("No wallet detected. Install MetaMask.");
  const accounts = (await window.ethereum!.request({
    method: "eth_requestAccounts",
  })) as string[];
  if (!accounts || accounts.length === 0) throw new Error("No accounts returned from wallet.");
  return accounts[0].toLowerCase();
}

/** Get the connected chain ID as a number. */
export async function getChainId(): Promise<number> {
  if (!isWalletAvailable()) throw new Error("No wallet detected.");
  const hex = (await window.ethereum!.request({ method: "eth_chainId" })) as string;
  return parseInt(hex, 16);
}

/** Build an EIP-4361 (SIWE) message. */
export function buildSiweMessage({
  domain,
  address,
  nonce,
  chainId,
  uri,
  statement = "Sign in to the shop",
}: {
  domain: string;
  address: string;
  nonce: string;
  chainId: number;
  uri: string;
  statement?: string;
}): string {
  const now = new Date();
  const issuedAt = now.toISOString();
  const expirationTime = new Date(now.getTime() + 5 * 60 * 1000).toISOString(); // 5 min

  return [
    `${domain} wants you to sign in with your Ethereum account:`,
    address,
    "",
    statement,
    "",
    `URI: ${uri}`,
    `Version: 1`,
    `Chain ID: ${chainId}`,
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt}`,
    `Expiration Time: ${expirationTime}`,
  ].join("\n");
}

/** Ask the wallet to sign the SIWE message using personal_sign. */
export async function signSiweMessage(address: string, message: string): Promise<string> {
  if (!isWalletAvailable()) throw new Error("No wallet detected.");
  const hexMessage = "0x" + Buffer.from(message, "utf8").toString("hex");
  const signature = (await window.ethereum!.request({
    method: "personal_sign",
    params: [hexMessage, address],
  })) as string;
  return signature;
}
