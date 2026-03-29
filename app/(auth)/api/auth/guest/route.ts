import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { signIn } from "@/app/(auth)/auth";
import {
  AUTH_SECRET_SETUP_HINT,
  getAuthSecretResolved,
} from "@/lib/auth-secret";
import { shouldUseSecureAuthCookie } from "@/lib/constants";

const GUEST_SIGNIN_DB_HINT =
  "Guest sign-in failed. Ensure PostgreSQL is running, POSTGRES_URL is set in .env.local, and migrations are applied (pnpm db:migrate). See AGENTS.md.";

export async function GET(request: Request) {
  let secret: string;
  try {
    secret = getAuthSecretResolved();
  } catch {
    return new NextResponse(AUTH_SECRET_SETUP_HINT, {
      status: 500,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  const { searchParams } = new URL(request.url);
  const rawRedirect = searchParams.get("redirectUrl") || "/";
  const redirectUrl =
    rawRedirect.startsWith("/") && !rawRedirect.startsWith("//")
      ? rawRedirect
      : "/";

  const token = await getToken({
    req: request,
    secret,
    secureCookie: shouldUseSecureAuthCookie(),
  });

  if (token) {
    const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
    return NextResponse.redirect(new URL(`${base}/`, request.url));
  }

  try {
    return await signIn("guest", {
      redirect: true,
      redirectTo: redirectUrl,
    });
  } catch (err) {
    if (String(err).includes("CallbackRouteError")) {
      return new NextResponse(GUEST_SIGNIN_DB_HINT, {
        status: 503,
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }
    throw err;
  }
}
