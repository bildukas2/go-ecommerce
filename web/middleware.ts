import { NextRequest, NextResponse } from "next/server";
import createMiddleware from 'next-intl/middleware';
import {routing} from './i18n/routing';

const intlMiddleware = createMiddleware(routing);

function apiBaseURL(): string {
  return process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8080";
}

function apiJoin(path: string): string {
  const base = new URL(apiBaseURL());
  const clean = path.replace(/^\/+/, "");
  if (!base.pathname.endsWith("/")) base.pathname += "/";
  return new URL(clean, base).toString();
}

async function hasAdminSession(request: NextRequest): Promise<boolean> {
  const cookie = request.headers.get("cookie") || "";
  try {
    const res = await fetch(apiJoin("admin/auth/me"), {
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

export default async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // Detect if it's an admin route (with or without locale prefix)
  const isAdminPath = pathname.match(/^\/(?:en|lt)?\/?admin/);

  if (isAdminPath) {
    const authenticated = await hasAdminSession(request);
    
    // Determine the correct login path based on current locale
    const segments = pathname.split("/");
    const hasLocale = routing.locales.includes(segments[1] as any);
    const locale = hasLocale ? segments[1] : routing.defaultLocale;
    const loginPath = hasLocale ? `/${locale}/admin/login` : "/admin/login";
    const adminRoot = hasLocale ? `/${locale}/admin` : "/admin";

    if (pathname === loginPath || pathname === "/admin/login") {
      if (authenticated) {
        return NextResponse.redirect(new URL(adminRoot, request.url));
      }
      return intlMiddleware(request);
    }

    if (!authenticated) {
      const loginURL = new URL(loginPath, request.url);
      const nextPath = `${pathname}${search}`;
      loginURL.searchParams.set("next", nextPath);
      return NextResponse.redirect(loginURL);
    }
  }

  // Internationalization middleware for all routes
  return intlMiddleware(request);
}

export const config = {
  // Match both internationalized pathnames, admin routes, and other app routes
  matcher: ['/', '/(en|lt)/:path*', '/((?!api|_next|_vercel|.*\\..*).*)']
};
