"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { BusinessProfile } from "@/lib/db/schema";
import { type OnboardingFormState, saveOnboarding } from "./actions";

export function OnboardingForm({
  profile,
}: {
  profile: BusinessProfile | null;
}) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState<
    OnboardingFormState,
    FormData
  >(saveOnboarding, { success: false });

  useEffect(() => {
    if (state.success) {
      toast.success("Business profile saved!");
      router.push("/");
    }
    if (state.error) {
      toast.error(state.error);
    }
  }, [state, router]);

  return (
    <form action={formAction} className="space-y-6">
      <section className="space-y-4 rounded-xl border border-border/50 bg-card p-5">
        <h2 className="text-base font-medium">Business basics</h2>

        <div className="space-y-2">
          <Label htmlFor="businessName">Business name *</Label>
          <Input
            defaultValue={profile?.businessName ?? ""}
            id="businessName"
            name="businessName"
            placeholder="Acme Plumbing"
            required
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="industry">Industry / vertical</Label>
            <Input
              defaultValue={profile?.industry ?? ""}
              id="industry"
              name="industry"
              placeholder="e.g. HVAC, Salon, Law"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="hoursOfOperation">Hours of operation</Label>
            <Input
              defaultValue={profile?.hoursOfOperation ?? ""}
              id="hoursOfOperation"
              name="hoursOfOperation"
              placeholder="Mon-Fri 9am-5pm"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="services">
            Services offered{" "}
            <span className="text-muted-foreground font-normal">
              (comma-separated)
            </span>
          </Label>
          <Input
            defaultValue={
              Array.isArray(profile?.services)
                ? (profile.services as string[]).join(", ")
                : ""
            }
            id="services"
            name="services"
            placeholder="Drain cleaning, Water heater install, Emergency repair"
          />
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-border/50 bg-card p-5">
        <h2 className="text-base font-medium">Assistant behavior</h2>

        <div className="flex items-start gap-3 rounded-lg border border-border/60 bg-muted/30 p-4">
          <input
            className="mt-1 size-4 rounded border border-input accent-primary"
            defaultChecked={profile?.businessModeEnabled !== false}
            id="businessModeEnabled"
            name="businessModeEnabled"
            type="checkbox"
            value="on"
          />
          <div className="space-y-1">
            <Label
              className="cursor-pointer font-medium leading-none"
              htmlFor="businessModeEnabled"
            >
              Use business / front-desk mode
            </Label>
            <p className="text-muted-foreground text-sm">
              When on, Virgil can use your profile, intake tools, and front-desk
              prompts for customer-facing chats. Turn off to keep a personal
              assistant only while retaining your saved business details.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="tonePreference">Tone</Label>
          <Select
            defaultValue={profile?.tonePreference ?? "professional"}
            name="tonePreference"
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select tone" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="friendly">Friendly</SelectItem>
              <SelectItem value="professional">Professional</SelectItem>
              <SelectItem value="casual">Casual</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="neverPromise">
            Never promise{" "}
            <span className="text-muted-foreground font-normal">
              (comma-separated)
            </span>
          </Label>
          <Input
            defaultValue={
              Array.isArray(profile?.neverPromise)
                ? (profile.neverPromise as string[]).join(", ")
                : ""
            }
            id="neverPromise"
            name="neverPromise"
            placeholder="Refunds, Exact pricing, Same-day service"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="priorityNotes">
            Priority notes for the assistant
          </Label>
          <Textarea
            id="priorityNotes"
            name="priorityNotes"
            placeholder="e.g. Always ask for the customer's address first. Emergencies should be flagged immediately."
            rows={3}
          />
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-border/50 bg-card p-5">
        <h2 className="text-base font-medium">Escalation</h2>
        <p className="text-sm text-muted-foreground">
          When the assistant can't answer, it will collect the customer's info
          and hand off. Who should be notified?
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="escalationContactName">Contact name</Label>
            <Input
              defaultValue={profile?.escalationContactName ?? ""}
              id="escalationContactName"
              name="escalationContactName"
              placeholder="Jane Doe"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="escalationContactEmail">Contact email</Label>
            <Input
              defaultValue={profile?.escalationContactEmail ?? ""}
              id="escalationContactEmail"
              name="escalationContactEmail"
              placeholder="jane@acme.com"
              type="email"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="escalationRules">Escalation rules</Label>
          <Textarea
            defaultValue={profile?.escalationRules ?? ""}
            id="escalationRules"
            name="escalationRules"
            placeholder="e.g. Escalate if customer mentions legal action. Always escalate billing disputes."
            rows={3}
          />
        </div>
      </section>

      <Button className="w-full" disabled={isPending} size="lg" type="submit">
        {isPending
          ? "Saving..."
          : profile
            ? "Update profile"
            : "Save & start chatting"}
      </Button>
    </form>
  );
}
