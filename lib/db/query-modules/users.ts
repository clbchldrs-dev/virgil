import "server-only";

import { and, eq, exists, or, sql } from "drizzle-orm";
import { VirgilError } from "@/lib/errors";
import { generateUUID } from "@/lib/utils";
import { db } from "../client";
import { businessProfile, chat, type User, user } from "../schema";
import { generateHashedPassword } from "../utils";

export async function getUser(email: string): Promise<User[]> {
  try {
    return await db.select().from(user).where(eq(user.email, email));
  } catch (_error) {
    throw new VirgilError(
      "bad_request:database",
      "Failed to get user by email"
    );
  }
}

export async function getUserById({
  id,
}: {
  id: string;
}): Promise<User | null> {
  try {
    const [found] = await db
      .select()
      .from(user)
      .where(eq(user.id, id))
      .limit(1);
    return found ?? null;
  } catch (_error) {
    throw new VirgilError("bad_request:database", "Failed to get user by id");
  }
}

export async function getOwnerUsers(): Promise<User[]> {
  try {
    return await db
      .select({
        id: user.id,
        email: user.email,
        password: user.password,
        name: user.name,
        emailVerified: user.emailVerified,
        image: user.image,
        isAnonymous: user.isAnonymous,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      })
      .from(user)
      .innerJoin(businessProfile, eq(businessProfile.userId, user.id));
  } catch (_error) {
    throw new VirgilError("bad_request:database", "Failed to get owner users");
  }
}

const userRowSelect = {
  id: user.id,
  email: user.email,
  password: user.password,
  name: user.name,
  emailVerified: user.emailVerified,
  image: user.image,
  isAnonymous: user.isAnonymous,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
} as const;

/**
 * Users eligible for companion background jobs (digest, night review): non-guest
 * accounts that either have a business profile **or** have at least one chat
 * (companion-only / personal Virgil use).
 */
export async function getUsersEligibleForCompanionBackgroundJobs(): Promise<
  User[]
> {
  try {
    const hasBusinessProfile = exists(
      db
        .select({ id: businessProfile.id })
        .from(businessProfile)
        .where(eq(businessProfile.userId, user.id))
    );
    const hasChat = exists(
      db.select({ id: chat.id }).from(chat).where(eq(chat.userId, user.id))
    );

    return await db
      .select(userRowSelect)
      .from(user)
      .where(
        and(
          sql`${user.email} NOT LIKE 'guest-%'`,
          or(hasBusinessProfile, hasChat)
        )
      );
  } catch (_error) {
    throw new VirgilError(
      "bad_request:database",
      "Failed to get companion-eligible users"
    );
  }
}

export async function createUser(email: string, password: string) {
  const hashedPassword = generateHashedPassword(password);

  try {
    return await db.insert(user).values({ email, password: hashedPassword });
  } catch (_error) {
    throw new VirgilError("bad_request:database", "Failed to create user");
  }
}

export async function createGuestUser() {
  const email = `guest-${Date.now()}`;
  const password = generateHashedPassword(generateUUID());

  try {
    return await db.insert(user).values({ email, password }).returning({
      id: user.id,
      email: user.email,
    });
  } catch (_error) {
    throw new VirgilError(
      "bad_request:database",
      "Failed to create guest user"
    );
  }
}
