import { redirect } from "next/navigation";
import { auth } from "@/app/(auth)/auth";
import { listAgentTasks } from "@/lib/db/queries";
import { AgentTasksClient } from "./agent-tasks-client";

export default async function AgentTasksPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const tasks = await listAgentTasks({
    userId: session.user.id,
    limit: 100,
  });

  const { status: statusQuery } = await searchParams;

  return (
    <div className="flex min-h-dvh items-start justify-center bg-background p-4 pt-12 md:pt-20">
      <div className="w-full max-w-3xl space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            Agent approvals
          </h1>
          <p className="text-muted-foreground">
            Tasks proposed in chat for execution agents (delegation bridge,
            Cursor, etc.). Approve or reject here—this is not a human to-do
            list.
          </p>
        </div>
        <AgentTasksClient initialStatus={statusQuery} initialTasks={tasks} />
      </div>
    </div>
  );
}
