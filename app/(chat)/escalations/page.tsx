import { redirect } from "next/navigation";
import { auth } from "@/app/(auth)/auth";
import {
  getBusinessProfileByUserId,
  getEscalationRecords,
} from "@/lib/db/queries";
import { EscalationList } from "./escalation-list";

export default async function EscalationsPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const profile = await getBusinessProfileByUserId({
    userId: session.user.id,
  });

  if (!profile) {
    redirect("/onboarding");
  }

  const escalations = await getEscalationRecords({
    businessProfileId: profile.id,
  });

  return (
    <div className="flex min-h-dvh items-start justify-center bg-background p-4 pt-12 md:pt-20">
      <div className="w-full max-w-3xl space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            Escalations
          </h1>
          <p className="text-muted-foreground">
            Conversations the assistant couldn't handle and handed off to you.
          </p>
        </div>
        <EscalationList initialEscalations={escalations} />
      </div>
    </div>
  );
}
