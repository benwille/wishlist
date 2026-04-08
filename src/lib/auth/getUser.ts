import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/lib/db";
import { validateSession, getSessionCookieName, type SessionUser } from "./session";

/**
 * Get the current user from the session cookie.
 * Call this in server components and API routes.
 * Redirects to /login if no valid session.
 */
export async function getUser(): Promise<SessionUser> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(getSessionCookieName())?.value;

  if (!sessionId) {
    redirect("/login");
  }

  const { env } = getCloudflareContext();
  const db = getDb(env.DB);
  const user = await validateSession(db, sessionId);

  if (!user) {
    redirect("/login");
  }

  return user;
}

/**
 * Get user or null (for pages that can work without auth).
 */
export async function getUserOptional(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(getSessionCookieName())?.value;

  if (!sessionId) return null;

  const { env } = getCloudflareContext();
  const db = getDb(env.DB);
  return validateSession(db, sessionId);
}
