import { Suspense } from "react";
import { LoginContent } from "./login-content";

export default function Page() {
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
      <LoginContent />
    </Suspense>
  );
}
