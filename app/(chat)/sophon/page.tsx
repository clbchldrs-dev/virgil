import { redirect } from "next/navigation";
import { auth } from "@/app/(auth)/auth";
import { getSophonDailyBriefForUser } from "@/lib/sophon/daily-brief";
import { SophonDailyClient } from "./sophon-daily-client";

export default async function SophonDailyPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const brief = await getSophonDailyBriefForUser(session.user.id);

  return (
    <div className="flex min-h-dvh items-start justify-center bg-background p-4 pt-12 md:pt-20">
      <div className="w-full max-w-3xl space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            Daily command center
          </h1>
          <p className="text-muted-foreground">
            Sophon Option B: deterministic Now / Next / Later from your tasks.
            Add priorities below; end-of-day review captures wins, misses, and
            carry-forward.
          </p>
        </div>
        <SophonDailyClient initialBrief={brief} />
      </div>
    </div>
  );
}
