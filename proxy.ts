import { type NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import {
  AUTH_SECRET_SETUP_HINT,
  getAuthSecretResolved,
} from "./lib/auth-secret";
import { guestRegex, shouldUseSecureAuthCookie } from "./lib/constants";
import { postVirgilDebugIngest } from "./lib/debug-ingest";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const includesNextAuthPath = pathname.includes("/api/auth");
  // #region agent log
  postVirgilDebugIngest(
    {
      sessionId: "6a8d1d",
      runId: "pre-fix",
      hypothesisId: "H1",
      location: "proxy.ts:proxy_entry",
      message: "Proxy received request",
      data: {
        pathname,
        method: request.method,
        includesNextAuthPath,
      },
      timestamp: Date.now(),
    },
    { "X-Debug-Session-Id": "6a8d1d" }
  );
  // #endregion

  if (pathname.startsWith("/ping")) {
    return new Response("pong", { status: 200 });
  }

  if (pathname.startsWith("/api/auth")) {
    // #region debug auth proxy bypass
    postVirgilDebugIngest(
      {
        sessionId: "03b2e8",
        runId: "debug",
        hypothesisId: "H1",
        location: "proxy.ts:middleware_bypass_start",
        message: "NextAuth API request bypassed proxy",
        data: {
          pathname,
          startsWithApiAuth: pathname.startsWith("/api/auth"),
          nextPublicBasePath: base,
        },
        timestamp: Date.now(),
      },
      { "X-Debug-Session-Id": "03b2e8" }
    );
    // #endregion
    return NextResponse.next();
  }

  let secret: string;
  try {
    secret = getAuthSecretResolved();
  } catch {
    if (pathname.startsWith("/api")) {
      // #region debug auth missing secret
      postVirgilDebugIngest(
        {
          sessionId: "03b2e8",
          runId: "debug",
          hypothesisId: "H3",
          location: "proxy.ts:missing_auth_secret_api",
          message: "Auth secret resolution failed for API request",
          data: { pathname },
          timestamp: Date.now(),
        },
        { "X-Debug-Session-Id": "03b2e8" }
      );
      // #endregion
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

  const secureCookie = shouldUseSecureAuthCookie();
  const token = await getToken({
    req: request,
    secret,
    secureCookie,
  });

  if (includesNextAuthPath) {
    // #region debug auth token check
    postVirgilDebugIngest(
      {
        sessionId: "03b2e8",
        runId: "debug",
        hypothesisId: "H1",
        location: "proxy.ts:middleware_token_check",
        message: "Middleware inspected auth token for NextAuth-like path",
        data: {
          pathname,
          tokenFound: Boolean(token),
          secureCookie,
          nextPublicBasePath: base,
          startsWithApiAuth: pathname.startsWith("/api/auth"),
        },
        timestamp: Date.now(),
      },
      { "X-Debug-Session-Id": "03b2e8" }
    );
    // #endregion
  }

  if (!token) {
    const redirectUrl = encodeURIComponent(new URL(request.url).pathname);
    // #region agent log
    postVirgilDebugIngest(
      {
        sessionId: "6a8d1d",
        runId: "pre-fix",
        hypothesisId: "H2",
        location: "proxy.ts:missing_token_redirect",
        message: "Proxy redirecting due to missing token",
        data: {
          pathname,
          redirectTo: `${base}/api/auth/guest`,
          redirectUrlLength: redirectUrl.length,
        },
        timestamp: Date.now(),
      },
      { "X-Debug-Session-Id": "6a8d1d" }
    );
    // #endregion

    if (includesNextAuthPath) {
      // #region debug auth redirect when token missing
      postVirgilDebugIngest(
        {
          sessionId: "03b2e8",
          runId: "debug",
          hypothesisId: "H1",
          location: "proxy.ts:middleware_redirect_no_token",
          message:
            "Middleware redirecting due to missing token for auth-like path",
          data: {
            pathname,
            redirectToPath: `${base}/api/auth/guest`,
            hasRedirectUrl: redirectUrl.length > 0,
          },
          timestamp: Date.now(),
        },
        { "X-Debug-Session-Id": "03b2e8" }
      );
      // #endregion
    }

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
