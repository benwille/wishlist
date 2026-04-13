import { NextRequest, NextResponse } from "next/server";
import { eq, inArray } from "drizzle-orm";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/lib/db";
import { pushSubscriptions } from "@/lib/db/schema";
import { validateSession, getSessionCookieName } from "@/lib/auth/session";
import { sendPush } from "@/lib/push/send";

export async function POST(request: NextRequest) {
  const { env } = getCloudflareContext();
  const db = getDb(env.DB);

  const sessionId = request.cookies.get(getSessionCookieName())?.value;
  if (!sessionId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = await validateSession(db, sessionId);
  if (!admin?.isAdmin) return NextResponse.json({ error: "Admin required" }, { status: 403 });

  const body = (await request.json()) as {
    title?: string;
    body?: string;
    url?: string;
    userIds?: number[];
  };

  if (!body.title || !body.body) {
    return NextResponse.json({ error: "Title and body required" }, { status: 400 });
  }

  // Get subscriptions — for specific users or all
  let subs;
  if (body.userIds && body.userIds.length > 0) {
    subs = await db.select().from(pushSubscriptions).where(inArray(pushSubscriptions.userId, body.userIds));
  } else {
    subs = await db.select().from(pushSubscriptions);
  }

  if (subs.length === 0) {
    return NextResponse.json({ error: "No subscriptions found" }, { status: 404 });
  }

  const result = await sendPush(
    env.PUSH_WORKER,
    subs.map((s) => ({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth })),
    { title: body.title, body: body.body, url: body.url },
  );

  // Clean up gone subscriptions
  if (result.gone.length > 0) {
    await db.delete(pushSubscriptions).where(inArray(pushSubscriptions.endpoint, result.gone));
  }

  return NextResponse.json(result);
}
