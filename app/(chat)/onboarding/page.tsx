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
            {profile
              ? "Update your business profile"
              : "Enable Virgil business mode"}
          </h1>
          <p className="text-muted-foreground">
            This is optional. Tell Virgil about your business only if you want
            it to switch into front-desk mode for customer-facing chats. You can
            update this anytime.
          </p>
        </div>
        <OnboardingForm profile={profile} />
      </div>
    </div>
  );
}
