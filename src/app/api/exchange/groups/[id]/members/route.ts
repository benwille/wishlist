import { NextRequest, NextResponse } from "next/server";
import { eq, and, ne } from "drizzle-orm";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/lib/db";
import { exchangeGroupMembers, exchangeGroups, users } from "@/lib/db/schema";
import { validateSession, getSessionCookieName } from "@/lib/auth/session";
import { sendPushToUsers } from "@/lib/push/send";
import { newMemberCopy } from "@/lib/push/copy";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { env } = getCloudflareContext();
  const db = getDb(env.DB);

  const sessionId = request.cookies.get(getSessionCookieName())?.value;
  if (!sessionId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await validateSession(db, sessionId);
  if (!user?.isAdmin) return NextResponse.json({ error: "Admin required" }, { status: 403 });

  const body = (await request.json()) as { userId?: number };
  if (!body.userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const groupId = Number(id);

  // Check whether the user is already a member — skip notification if so
  const [alreadyMember] = await db
    .select()
    .from(exchangeGroupMembers)
    .where(and(eq(exchangeGroupMembers.groupId, groupId), eq(exchangeGroupMembers.userId, body.userId)))
    .limit(1);

  await db.insert(exchangeGroupMembers).values({ groupId, userId: body.userId }).onConflictDoNothing();

  if (!alreadyMember) {
    const [group] = await db.select().from(exchangeGroups).where(eq(exchangeGroups.id, groupId)).limit(1);
    const [newMember] = await db.select().from(users).where(eq(users.id, body.userId)).limit(1);

    if (group && newMember) {
      const existingMembers = await db
        .select({ userId: exchangeGroupMembers.userId })
        .from(exchangeGroupMembers)
        .where(and(eq(exchangeGroupMembers.groupId, groupId), ne(exchangeGroupMembers.userId, body.userId)));

      const memberName = `${newMember.firstName} ${newMember.lastName}`;
      await sendPushToUsers(
        db,
        env.PUSH_WORKER,
        existingMembers.map((m) => m.userId),
        newMemberCopy(memberName, group.name, groupId),
        { type: "new_member" },
      );
    }
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { env } = getCloudflareContext();
  const db = getDb(env.DB);

  const sessionId = request.cookies.get(getSessionCookieName())?.value;
  if (!sessionId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await validateSession(db, sessionId);
  if (!user?.isAdmin) return NextResponse.json({ error: "Admin required" }, { status: 403 });

  const body = (await request.json()) as { userId?: number };
  if (!body.userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  await db.delete(exchangeGroupMembers).where(
    and(eq(exchangeGroupMembers.groupId, Number(id)), eq(exchangeGroupMembers.userId, body.userId))
  );
  return NextResponse.json({ ok: true });
}
