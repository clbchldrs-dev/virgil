"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { BusinessProfile } from "@/lib/db/schema";
import { saveOnboarding, type OnboardingFormState } from "./actions";

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
            id="businessName"
            name="businessName"
            required
            defaultValue={profile?.businessName ?? ""}
            placeholder="Acme Plumbing"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="industry">Industry / vertical</Label>
            <Input
              id="industry"
              name="industry"
              defaultValue={profile?.industry ?? ""}
              placeholder="e.g. HVAC, Salon, Law"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="hoursOfOperation">Hours of operation</Label>
            <Input
              id="hoursOfOperation"
              name="hoursOfOperation"
              defaultValue={profile?.hoursOfOperation ?? ""}
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
            id="services"
            name="services"
            defaultValue={
              Array.isArray(profile?.services)
                ? (profile.services as string[]).join(", ")
                : ""
            }
            placeholder="Drain cleaning, Water heater install, Emergency repair"
          />
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-border/50 bg-card p-5">
        <h2 className="text-base font-medium">Assistant behavior</h2>

        <div className="space-y-2">
          <Label htmlFor="tonePreference">Tone</Label>
          <Select
            name="tonePreference"
            defaultValue={profile?.tonePreference ?? "professional"}
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
            id="neverPromise"
            name="neverPromise"
            defaultValue={
              Array.isArray(profile?.neverPromise)
                ? (profile.neverPromise as string[]).join(", ")
                : ""
            }
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
              id="escalationContactName"
              name="escalationContactName"
              defaultValue={profile?.escalationContactName ?? ""}
              placeholder="Jane Doe"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="escalationContactEmail">Contact email</Label>
            <Input
              id="escalationContactEmail"
              name="escalationContactEmail"
              type="email"
              defaultValue={profile?.escalationContactEmail ?? ""}
              placeholder="jane@acme.com"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="escalationRules">Escalation rules</Label>
          <Textarea
            id="escalationRules"
            name="escalationRules"
            defaultValue={profile?.escalationRules ?? ""}
            placeholder="e.g. Escalate if customer mentions legal action. Always escalate billing disputes."
            rows={3}
          />
        </div>
      </section>

      <Button type="submit" size="lg" className="w-full" disabled={isPending}>
        {isPending
          ? "Saving..."
          : profile
            ? "Update profile"
            : "Save & start chatting"}
      </Button>
    </form>
  );
}
