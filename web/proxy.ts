import { NextRequest, NextResponse } from "next/server";
import createMiddleware from 'next-intl/middleware';
import {routing} from './i18n/routing';

const intlMiddleware = createMiddleware(routing);

function apiBaseURL(): string {
  return process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8080";
}

async function hasAdminSession(request: NextRequest): Promise<boolean> {
  const cookie = request.headers.get("cookie") || "";
  try {
    const res = await fetch(new URL("/api/admin/auth/me", apiBaseURL()), {
      method: "GET",
      headers: cookie ? { Cookie: cookie } : {},
      cache: "no-store",
    });
    return res.ok;
  } catch (error) {
    console.error("Admin session check failed:", error);
    return false;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // Admin routes logic
  if (pathname.startsWith("/admin")) {
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

  // Internationalization middleware for other routes
  return intlMiddleware(request);
}

export const config = {
  // Match both internationalized pathnames and admin routes
  matcher: ['/', '/(en|lt)/:path*', '/admin/:path*']
};
