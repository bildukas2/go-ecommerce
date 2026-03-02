import { API_URL } from "./config";

function apiJoin(path: string): string {
  const base = new URL(API_URL);
  const clean = path.replace(/^\/+/, "");
  if (!base.pathname.endsWith("/")) base.pathname += "/";
  return new URL(clean, base).toString();
}

export type AdminAuthUser = {
  id: string;
  email: string;
  display_name: string;
  roles: string[];
};

type AdminAuthErrorPayload = {
  error?: string;
  code?: string;
};

export class AdminAuthError extends Error {
  code: string;
  status: number;

  constructor(message: string, code: string, status: number) {
    super(message);
    this.name = "AdminAuthError";
    this.code = code;
    this.status = status;
  }
}

async function parseAuthError(res: Response, fallback: string): Promise<AdminAuthError> {
  let message = fallback;
  let code = "unknown_error";
  try {
    const payload = (await res.json()) as AdminAuthErrorPayload;
    if (typeof payload.error === "string" && payload.error.trim()) {
      message = payload.error.trim();
    }
    if (typeof payload.code === "string" && payload.code.trim()) {
      code = payload.code.trim();
    }
  } catch {}
  return new AdminAuthError(message, code, res.status);
}

export async function getAdminCSRFToken(): Promise<string> {
  const res = await fetch(apiJoin("admin/auth/csrf"), {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) {
    throw await parseAuthError(res, "failed to initialize login");
  }
  const payload = (await res.json()) as { csrf_token?: string };
  const token = typeof payload.csrf_token === "string" ? payload.csrf_token.trim() : "";
  if (!token) {
    throw new AdminAuthError("failed to initialize login", "csrf_missing", 500);
  }
  return token;
}

export async function loginAdmin(input: {
  email: string;
  password: string;
  captchaToken: string;
  csrfToken: string;
}): Promise<AdminAuthUser> {
  const res = await fetch(apiJoin("admin/auth/login"), {
    method: "POST",
    credentials: "include",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": input.csrfToken,
    },
    body: JSON.stringify({
      email: input.email,
      password: input.password,
      captchaToken: input.captchaToken,
    }),
  });
  if (!res.ok) {
    throw await parseAuthError(res, "login failed");
  }
  const payload = (await res.json()) as { user?: AdminAuthUser };
  if (!payload.user) {
    throw new AdminAuthError("login failed", "invalid_response", 500);
  }
  return payload.user;
}

export async function logoutAdmin(csrfToken: string): Promise<void> {
  const res = await fetch(apiJoin("admin/auth/logout"), {
    method: "POST",
    credentials: "include",
    cache: "no-store",
    headers: {
      "X-CSRF-Token": csrfToken,
    },
  });
  if (!res.ok && res.status !== 401) {
    throw await parseAuthError(res, "logout failed");
  }
}

export async function getAdminMe(): Promise<AdminAuthUser> {
  const res = await fetch(apiJoin("admin/auth/me"), {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) {
    throw await parseAuthError(res, "unauthorized");
  }
  const payload = (await res.json()) as { user?: AdminAuthUser };
  if (!payload.user) {
    throw new AdminAuthError("unauthorized", "unauthorized", res.status);
  }
  return payload.user;
}
