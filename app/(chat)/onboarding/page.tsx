import { redirect } from "next/navigation";
import { auth } from "@/app/(auth)/auth";
import { getExistingProfile } from "./actions";
import { OnboardingForm } from "./onboarding-form";

export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const profile = await getExistingProfile();

  return (
    <div className="flex min-h-dvh items-start justify-center bg-background p-4 pt-12 md:pt-20">
      <div className="w-full max-w-2xl space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            {profile ? "Update your business profile" : "Set up your front desk assistant"}
          </h1>
          <p className="text-muted-foreground">
            Tell us about your business so the assistant can represent you
            accurately. You can update this anytime.
          </p>
        </div>
        <OnboardingForm profile={profile} />
      </div>
    </div>
  );
}
