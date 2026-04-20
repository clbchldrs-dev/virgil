import { auth } from "@/app/(auth)/auth";
import { deleteDayTaskForUser, updateDayTaskForUser } from "@/lib/db/queries";
import { VirgilError } from "@/lib/errors";

function serializeTask(row: {
  id: string;
  userId: string;
  forDate: string;
  title: string;
  sortOrder: number;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    userId: row.userId,
    forDate: row.forDate,
    title: row.title,
    sortOrder: row.sortOrder,
    completedAt: row.completedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ taskId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return new VirgilError("unauthorized:chat").toResponse();
  }

  const { taskId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new VirgilError("bad_request:api", "Invalid JSON").toResponse();
  }

  const title =
    typeof body === "object" &&
    body !== null &&
    "title" in body &&
    typeof (body as { title: unknown }).title === "string"
      ? (body as { title: string }).title
      : undefined;

  let completed: boolean | undefined;
  if (
    typeof body === "object" &&
    body !== null &&
    "completed" in body &&
    typeof (body as { completed: unknown }).completed === "boolean"
  ) {
    completed = (body as { completed: boolean }).completed;
  }

  if (title === undefined && completed === undefined) {
    return new VirgilError(
      "bad_request:api",
      "Provide title and/or completed"
    ).toResponse();
  }

  try {
    const task = await updateDayTaskForUser({
      taskId,
      userId: session.user.id,
      ...(title === undefined ? {} : { title }),
      ...(completed === undefined ? {} : { completed }),
    });
    return Response.json({ task: serializeTask(task) });
  } catch (error) {
    if (error instanceof VirgilError) {
      return error.toResponse();
    }
    throw error;
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ taskId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return new VirgilError("unauthorized:chat").toResponse();
  }

  const { taskId } = await context.params;

  try {
    await deleteDayTaskForUser({ taskId, userId: session.user.id });
    return new Response(null, { status: 204 });
  } catch (error) {
    if (error instanceof VirgilError) {
      return error.toResponse();
    }
    throw error;
  }
}
