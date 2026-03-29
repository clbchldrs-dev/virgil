"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef } from "react";
import { toast } from "@/components/chat/toast";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { BusinessProfile } from "@/lib/db/schema";
import { type PreferencesState, toggleBusinessModeAction } from "./actions";

const initialState: PreferencesState = { success: false };

type Props = {
  profile: BusinessProfile | null;
};

export function PreferencesClient({ profile }: Props) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(
    toggleBusinessModeAction,
    initialState
  );
  const prevStateRef = useRef<PreferencesState>(initialState);

  useEffect(() => {
    if (state.success && !prevStateRef.current.success) {
      toast({ type: "success", description: "Preference saved." });
      router.refresh();
    }
    if (state.error && state.error !== prevStateRef.current.error) {
      toast({ type: "error", description: state.error });
    }
    prevStateRef.current = state;
  }, [state, router]);

  if (!profile) {
    return (
      <p className="text-muted-foreground text-sm">
        You don&apos;t have a business profile yet.{" "}
        <Link className="text-foreground underline" href="/onboarding">
          Set up business mode
        </Link>{" "}
        to use the front desk, then you can toggle it here anytime.
      </p>
    );
  }

  const defaultOn = profile.businessModeEnabled !== false;

  return (
    <form action={formAction} className="space-y-6">
      <div className="flex items-start gap-3 rounded-xl border border-border/50 bg-card p-4 shadow-[var(--shadow-float)]">
        <input
          className="mt-1 size-4 rounded border border-input accent-primary"
          defaultChecked={defaultOn}
          disabled={isPending}
          id="businessModeEnabled"
          name="businessModeEnabled"
          type="checkbox"
          value="on"
        />
        <div className="min-w-0 space-y-1">
          <Label
            className="cursor-pointer font-medium leading-none"
            htmlFor="businessModeEnabled"
          >
            Business / front-desk mode
          </Label>
          <p className="text-muted-foreground text-sm">
            When on, Virgil uses your business profile and front-desk tools for
            customer-facing chats. When off, Virgil stays a personal assistant
            even if a profile exists.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button disabled={isPending} type="submit">
          Save
        </Button>
        <Button asChild type="button" variant="outline">
          <Link href="/onboarding">Edit full business profile</Link>
        </Button>
      </div>
    </form>
  );
}
