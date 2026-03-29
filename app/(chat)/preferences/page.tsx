import { redirect } from "next/navigation";
import { auth } from "@/app/(auth)/auth";
import { getBusinessProfileByUserId } from "@/lib/db/queries";
import { PreferencesClient } from "./preferences-client";

export default async function PreferencesPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const profile = await getBusinessProfileByUserId({
    userId: session.user.id,
  });

  return (
    <div className="flex min-h-dvh items-start justify-center bg-background p-4 pt-12 md:pt-20">
      <div className="w-full max-w-2xl space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Preferences</h1>
          <p className="text-muted-foreground">
            Quick toggles for how Virgil behaves. Detailed business fields live
            on the business profile page.
          </p>
        </div>
        <PreferencesClient profile={profile} />
      </div>
    </div>
  );
}
