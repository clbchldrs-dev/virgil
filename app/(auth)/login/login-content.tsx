"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useActionState, useEffect, useState } from "react";
import { AuthForm } from "@/components/chat/auth-form";
import { SubmitButton } from "@/components/chat/submit-button";
import { toast } from "@/components/chat/toast";
import { sanitizeAppCallbackUrl } from "@/lib/sanitize-callback-url";
import { type LoginActionState, login } from "../actions";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function LoginContent({
  guestLoginEnabled = false,
  passwordless = false,
}: {
  guestLoginEnabled?: boolean;
  passwordless?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { update: updateSession } = useSession();
  const [email, setEmail] = useState("");
  const [isSuccessful, setIsSuccessful] = useState(false);
  const callbackUrlParam = searchParams.get("callbackUrl");

  const [state, formAction] = useActionState<LoginActionState, FormData>(
    login,
    { status: "idle" }
  );

  useEffect(() => {
    if (state.status === "failed") {
      toast({
        type: "error",
        description: passwordless
          ? "Could not sign in. Check the email is on your allowlist and the account exists."
          : "Invalid credentials!",
      });
    } else if (state.status === "invalid_data") {
      toast({
        type: "error",
        description: "Failed validating your submission!",
      });
    } else if (state.status === "success") {
      setIsSuccessful(true);
      const next = sanitizeAppCallbackUrl(callbackUrlParam);
      updateSession().then(
        () => {
          router.push(next);
          router.refresh();
        },
        () => {
          router.push(next);
          router.refresh();
        }
      );
    }
  }, [state.status, callbackUrlParam, router, updateSession, passwordless]);

  const handleSubmit = (formData: FormData) => {
    setEmail(formData.get("email") as string);
    formAction(formData);
  };

  const guestHref = `${basePath}/api/auth/guest?redirectUrl=${encodeURIComponent("/")}`;
  const registerHref =
    callbackUrlParam === null
      ? "/register"
      : `/register?callbackUrl=${encodeURIComponent(sanitizeAppCallbackUrl(callbackUrlParam))}`;

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
      <p className="text-sm text-muted-foreground">
        {passwordless
          ? "Sign in with the email allowed in your server configuration."
          : "Sign in to your account to continue"}
      </p>
      <AuthForm
        action={handleSubmit}
        defaultEmail={email}
        passwordless={passwordless}
      >
        <SubmitButton isSuccessful={isSuccessful}>Sign in</SubmitButton>
        <p className="text-center text-[13px] text-muted-foreground">
          {"No account? "}
          <Link
            className="text-foreground underline-offset-4 hover:underline"
            href={registerHref}
          >
            Sign up
          </Link>
        </p>
      </AuthForm>
      {guestLoginEnabled ? (
        <p className="mt-8 text-center text-[11px] leading-relaxed text-muted-foreground/55">
          <Link
            className="underline-offset-2 hover:text-muted-foreground hover:underline"
            href={guestHref}
          >
            Temporary session (no account)
          </Link>
          <span className="mt-1 block text-[10px] text-muted-foreground/45">
            For development or quick tries only — not a supported product path.
          </span>
        </p>
      ) : null}
    </>
  );
}
