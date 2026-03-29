import { type NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import {
  AUTH_SECRET_SETUP_HINT,
  getAuthSecretResolved,
} from "./lib/auth-secret";
import { guestRegex, shouldUseSecureAuthCookie } from "./lib/constants";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/ping")) {
    return new Response("pong", { status: 200 });
  }

  if (pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  let secret: string;
  try {
    secret = getAuthSecretResolved();
  } catch {
    if (pathname.startsWith("/api")) {
      return NextResponse.json(
        {
          error: "Missing AUTH_SECRET",
          hint: AUTH_SECRET_SETUP_HINT,
        },
        { status: 500 }
      );
    }
    return new NextResponse(
      `Missing AUTH_SECRET\n\n${AUTH_SECRET_SETUP_HINT}`,
      {
        status: 500,
        headers: { "content-type": "text/plain; charset=utf-8" },
      }
    );
  }

  const token = await getToken({
    req: request,
    secret,
    secureCookie: shouldUseSecureAuthCookie(),
  });

  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

  if (!token) {
    const redirectUrl = encodeURIComponent(new URL(request.url).pathname);

    return NextResponse.redirect(
      new URL(`${base}/api/auth/guest?redirectUrl=${redirectUrl}`, request.url)
    );
  }

  const isGuest = guestRegex.test(token?.email ?? "");

  if (token && !isGuest && ["/login", "/register"].includes(pathname)) {
    return NextResponse.redirect(new URL(`${base}/`, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/chat/:id",
    "/api/:path*",
    "/login",
    "/register",

    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
