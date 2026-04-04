import { redirect } from "next/navigation";
import { auth } from "@/app/(auth)/auth";
import { getProposalMemoriesForUser } from "@/lib/db/queries";
import { ProposalsClient } from "./proposals-client";

export default async function ProposalsPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const memories = await getProposalMemoriesForUser({
    userId: session.user.id,
    since,
    limit: 60,
    includeDismissed: false,
  });

  return (
    <div className="flex min-h-dvh items-start justify-center bg-background p-4 pt-12 md:pt-20">
      <div className="w-full max-w-3xl space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Proposals</h1>
          <p className="text-muted-foreground">
            Suggested actions and opportunities (tier &quot;propose&quot;).
            Accept to keep them in mind; dismiss if they are not useful. Nothing
            executes automatically from this list.
          </p>
        </div>
        <ProposalsClient initialMemories={memories} />
      </div>
    </div>
  );
}
