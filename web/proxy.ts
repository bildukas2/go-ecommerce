import { NextRequest, NextResponse } from "next/server";

function apiBaseURL(): string {
  return process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8080";
}

async function hasAdminSession(request: NextRequest): Promise<boolean> {
  const cookie = request.headers.get("cookie") || "";
  const res = await fetch(new URL("/api/admin/auth/me", apiBaseURL()), {
    method: "GET",
    headers: cookie ? { Cookie: cookie } : {},
    cache: "no-store",
  });
  return res.ok;
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (!pathname.startsWith("/admin")) {
    return NextResponse.next();
  }

  const authenticated = await hasAdminSession(request);
  const loginPath = "/admin/login";

  if (pathname === loginPath) {
    if (authenticated) {
      return NextResponse.redirect(new URL("/admin", request.url));
    }
    return NextResponse.next();
  }

  if (!authenticated) {
    const loginURL = new URL(loginPath, request.url);
    const nextPath = `${pathname}${search}`;
    loginURL.searchParams.set("next", nextPath);
    return NextResponse.redirect(loginURL);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
