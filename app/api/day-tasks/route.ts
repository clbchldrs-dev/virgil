import { auth } from "@/app/(auth)/auth";
import { createDayTaskForUser, listDayTasksForUser } from "@/lib/db/queries";
import { VirgilError } from "@/lib/errors";
import {
  computeWindowKey,
  getNightReviewTimezone,
} from "@/lib/night-review/config";

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

function resolveForDateParam(raw: string | null, fallbackKey: string): string {
  if (raw === null || raw === "") {
    return fallbackKey;
  }
  if (!DATE_KEY_RE.test(raw)) {
    throw new VirgilError("bad_request:api", "Invalid date (use YYYY-MM-DD)");
  }
  return raw;
}

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

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return new VirgilError("unauthorized:chat").toResponse();
  }

  const { searchParams } = new URL(request.url);
  const now = new Date();
  const todayKey = computeWindowKey(now, getNightReviewTimezone());

  let forDate: string;
  try {
    forDate = resolveForDateParam(searchParams.get("date"), todayKey);
  } catch (error) {
    if (error instanceof VirgilError) {
      return error.toResponse();
    }
    throw error;
  }

  try {
    const tasks = await listDayTasksForUser({
      userId: session.user.id,
      forDate,
    });
    return Response.json({
      forDate,
      tasks: tasks.map(serializeTask),
    });
  } catch (error) {
    if (error instanceof VirgilError) {
      return error.toResponse();
    }
    throw error;
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return new VirgilError("unauthorized:chat").toResponse();
  }

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
      : null;

  const rawDate =
    typeof body === "object" &&
    body !== null &&
    "forDate" in body &&
    typeof (body as { forDate: unknown }).forDate === "string"
      ? (body as { forDate: string }).forDate
      : null;

  const now = new Date();
  const todayKey = computeWindowKey(now, getNightReviewTimezone());

  let forDate: string;
  try {
    forDate = resolveForDateParam(rawDate, todayKey);
  } catch (error) {
    if (error instanceof VirgilError) {
      return error.toResponse();
    }
    throw error;
  }

  try {
    const task = await createDayTaskForUser({
      userId: session.user.id,
      forDate,
      title: title ?? "",
    });
    return Response.json({ task: serializeTask(task) }, { status: 201 });
  } catch (error) {
    if (error instanceof VirgilError) {
      return error.toResponse();
    }
    throw error;
  }
}
