import { Suspense } from "react";
import { isGuestLoginEnabled } from "@/lib/guest-login";
import { isPasswordlessLoginConfigured } from "@/lib/passwordless-login";
import { RegisterContent } from "./register-content";

export default function Page() {
  const passwordless = isPasswordlessLoginConfigured();
  const guestLoginEnabled = isGuestLoginEnabled();
  return (
    <Suspense
      fallback={
        <>
          <h1 className="text-2xl font-semibold tracking-tight">
            Create account
          </h1>
          <p className="text-sm text-muted-foreground">Loading…</p>
        </>
      }
    >
      <RegisterContent
        guestLoginEnabled={guestLoginEnabled}
        passwordless={passwordless}
      />
    </Suspense>
  );
}
