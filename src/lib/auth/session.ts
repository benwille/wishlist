import { eq, and, gt } from "drizzle-orm";
import { sessions, users } from "@/lib/db/schema";
import type { Database } from "@/lib/db";

const SESSION_COOKIE = "session_id";
const SESSION_MAX_AGE_DAYS = 30;

export type SessionUser = {
  id: number;
  firstName: string;
  lastName: string;
  email: string | null;
  isAdmin: boolean;
  participatesInExchanges: boolean;
  active: boolean;
};

export function getSessionCookieName() {
  return SESSION_COOKIE;
}

export async function createSession(db: Database, userId: number): Promise<{ sessionId: string; expires: Date }> {
  const sessionId = crypto.randomUUID();
  const expires = new Date();
  expires.setDate(expires.getDate() + SESSION_MAX_AGE_DAYS);

  await db.insert(sessions).values({
    id: sessionId,
    userId,
    expiresAt: expires.toISOString(),
  });

  return { sessionId, expires };
}

export async function validateSession(db: Database, sessionId: string): Promise<SessionUser | null> {
  const now = new Date().toISOString();

  const result = await db
    .select({
      userId: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
      email: users.email,
      isAdmin: users.isAdmin,
      participatesInExchanges: users.participatesInExchanges,
      active: users.active,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(
      and(
        eq(sessions.id, sessionId),
        gt(sessions.expiresAt, now),
        eq(users.active, 1)
      )
    )
    .limit(1);

  if (result.length === 0) return null;

  const row = result[0];
  return {
    id: row.userId,
    firstName: row.firstName,
    lastName: row.lastName,
    email: row.email,
    isAdmin: row.isAdmin === 1,
    participatesInExchanges: row.participatesInExchanges === 1,
    active: row.active === 1,
  };
}

export async function destroySession(db: Database, sessionId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, sessionId));
}

export function sessionCookieOptions(expires: Date) {
  return {
    name: SESSION_COOKIE,
    httpOnly: true,
    secure: true,
    sameSite: "lax" as const,
    expires,
    path: "/",
  };
}
