import { compare } from "bcrypt-ts";
import NextAuth, { type DefaultSession } from "next-auth";
import type { DefaultJWT } from "next-auth/jwt";
import Credentials from "next-auth/providers/credentials";
import { getAuthSecretResolved } from "@/lib/auth-secret";
import { DUMMY_PASSWORD, shouldUseSecureAuthCookie } from "@/lib/constants";
import { createGuestUser, getUser } from "@/lib/db/queries";
import { postVirgilDebugIngest } from "@/lib/debug-ingest";
import {
  isEmailAllowedForPasswordlessLogin,
  isPasswordlessLoginConfigured,
} from "@/lib/passwordless-login";
import { authConfig } from "./auth.config";

export type UserType = "guest" | "regular";

declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      id: string;
      type: UserType;
    } & DefaultSession["user"];
  }

  interface User {
    id?: string;
    email?: string | null;
    type: UserType;
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    id: string;
    type: UserType;
  }
}

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  ...authConfig,
  secret: getAuthSecretResolved(),
  useSecureCookies: shouldUseSecureAuthCookie(),
  providers: [
    ...(isPasswordlessLoginConfigured()
      ? [
          Credentials({
            id: "passwordless",
            credentials: {
              email: { label: "Email", type: "email" },
            },
            async authorize(credentials) {
              if (!isPasswordlessLoginConfigured()) {
                return null;
              }
              const email = String(credentials?.email ?? "");
              if (!isEmailAllowedForPasswordlessLogin(email)) {
                return null;
              }
              const users = await getUser(email);
              if (users.length === 0) {
                return null;
              }
              const [found] = users;
              return {
                id: found.id,
                email: found.email,
                name: found.name,
                image: found.image,
                type: "regular" as const,
              };
            },
          }),
        ]
      : [
          Credentials({
            credentials: {
              email: { label: "Email", type: "email" },
              password: { label: "Password", type: "password" },
            },
            async authorize(credentials) {
              const email = String(credentials.email ?? "");
              const password = String(credentials.password ?? "");
              const users = await getUser(email);

              if (users.length === 0) {
                await compare(password, DUMMY_PASSWORD);
                return null;
              }

              const [user] = users;

              if (!user.password) {
                await compare(password, DUMMY_PASSWORD);
                return null;
              }

              const passwordsMatch = await compare(password, user.password);

              if (!passwordsMatch) {
                return null;
              }

              return { ...user, type: "regular" };
            },
          }),
        ]),
    Credentials({
      id: "guest",
      credentials: {},
      async authorize() {
        const [guestUser] = await createGuestUser();
        return { ...guestUser, type: "guest" };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      try {
        // #region debug nextauth jwt callback
        postVirgilDebugIngest(
          {
            sessionId: "03b2e8",
            runId: "debug",
            hypothesisId: "H4",
            location: "app/(auth)/auth.ts:nextauth_jwt_callback",
            message: "NextAuth jwt callback executed",
            data: { hasUser: Boolean(user), tokenType: token.type },
            timestamp: Date.now(),
          },
          { "X-Debug-Session-Id": "03b2e8" }
        );
        // #endregion

        if (user) {
          token.id = user.id as string;
          token.type = user.type;
        }

        return token;
      } catch (error) {
        // #region debug nextauth jwt callback error
        postVirgilDebugIngest(
          {
            sessionId: "03b2e8",
            runId: "debug",
            hypothesisId: "H4",
            location: "app/(auth)/auth.ts:nextauth_jwt_callback_error",
            message: "NextAuth jwt callback threw",
            data: {
              error: error instanceof Error ? error.message : String(error),
            },
            timestamp: Date.now(),
          },
          { "X-Debug-Session-Id": "03b2e8" }
        );
        // #endregion
        throw error;
      }
    },
    session({ session, token }) {
      try {
        // #region debug nextauth session callback
        postVirgilDebugIngest(
          {
            sessionId: "03b2e8",
            runId: "debug",
            hypothesisId: "H4",
            location: "app/(auth)/auth.ts:nextauth_session_callback",
            message: "NextAuth session callback executed",
            data: {
              hasSessionUser: Boolean(session.user),
              tokenType: token.type,
            },
            timestamp: Date.now(),
          },
          { "X-Debug-Session-Id": "03b2e8" }
        );
        // #endregion

        if (session.user) {
          session.user.id = token.id;
          session.user.type = token.type;
        }

        return session;
      } catch (error) {
        // #region debug nextauth session callback error
        postVirgilDebugIngest(
          {
            sessionId: "03b2e8",
            runId: "debug",
            hypothesisId: "H4",
            location: "app/(auth)/auth.ts:nextauth_session_callback_error",
            message: "NextAuth session callback threw",
            data: {
              error: error instanceof Error ? error.message : String(error),
            },
            timestamp: Date.now(),
          },
          { "X-Debug-Session-Id": "03b2e8" }
        );
        // #endregion
        throw error;
      }
    },
  },
});
