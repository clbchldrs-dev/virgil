import { Suspense } from "react";
import { isPasswordlessLoginConfigured } from "@/lib/passwordless-login";
import { LoginContent } from "./login-content";

export default function Page() {
  const passwordless = isPasswordlessLoginConfigured();
  return (
    <Suspense
      fallback={
        <>
          <h1 className="text-2xl font-semibold tracking-tight">
            Welcome back
          </h1>
          <p className="text-sm text-muted-foreground">Loading…</p>
        </>
      }
    >
      <LoginContent passwordless={passwordless} />
    </Suspense>
  );
}
