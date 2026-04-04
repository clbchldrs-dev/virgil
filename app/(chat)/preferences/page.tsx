import { redirect } from "next/navigation";
import { auth } from "@/app/(auth)/auth";

export default async function PreferencesPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-dvh items-start justify-center bg-background p-4 pt-12 md:pt-20">
      <div className="w-full max-w-2xl space-y-4">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Preferences</h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Virgil is a personal assistant. Pick your model and options from the
            chat toolbar; theme follows your system or app settings.
          </p>
        </div>
      </div>
    </div>
  );
}
