export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8080";

// Server-side only: bypasses the public reverse proxy (Apache/Nginx) so SSR
// fetches go directly to the Go API over TCP instead of looping back through
// the proxy. Set API_INTERNAL_URL in production (e.g. http://127.0.0.1:8080).
export const SERVER_API_URL =
  process.env.API_INTERNAL_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://127.0.0.1:8080";
