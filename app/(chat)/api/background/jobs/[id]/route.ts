import { auth } from "@/app/(auth)/auth";
import { getBackgroundJobForUser } from "@/lib/db/queries";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const job = await getBackgroundJobForUser({
    id,
    userId: session.user.id,
  });

  if (!job) {
    return Response.json({ error: "not found" }, { status: 404 });
  }

  return Response.json({ job });
}
