import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/lib/db";
import { exchangeGroupMembers, exchangeExclusions, exchangeAssignments, users } from "@/lib/db/schema";
import { validateSession, getSessionCookieName } from "@/lib/auth/session";
import { generateAssignments } from "@/lib/exchange/algorithm";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: groupIdStr } = await params;
  const groupId = Number(groupIdStr);
  const { env } = getCloudflareContext();
  const db = getDb(env.DB);

  const sessionId = request.cookies.get(getSessionCookieName())?.value;
  if (!sessionId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await validateSession(db, sessionId);
  if (!user?.isAdmin) return NextResponse.json({ error: "Admin required" }, { status: 403 });

  const body = (await request.json()) as { year: number; preview: boolean };
  const { year, preview } = body;

  if (!year) return NextResponse.json({ error: "Year required" }, { status: 400 });

  // Get members
  const members = await db
    .select({ userId: exchangeGroupMembers.userId })
    .from(exchangeGroupMembers)
    .where(eq(exchangeGroupMembers.groupId, groupId));

  if (members.length < 2) {
    return NextResponse.json({ error: "Need at least 2 members" }, { status: 400 });
  }

  // Get exclusions
  const exclusions = await db
    .select({ userId1: exchangeExclusions.userId1, userId2: exchangeExclusions.userId2 })
    .from(exchangeExclusions)
    .where(eq(exchangeExclusions.groupId, groupId));

  // Get history
  const history = await db
    .select({ giverId: exchangeAssignments.giverId, receiverId: exchangeAssignments.receiverId, year: exchangeAssignments.year })
    .from(exchangeAssignments)
    .where(eq(exchangeAssignments.groupId, groupId));

  try {
    const assignments = generateAssignments(
      members.map((m) => m.userId),
      exclusions,
      history,
      year
    );

    // Get names for display
    const allUsers = await db.select({ id: users.id, firstName: users.firstName, lastName: users.lastName }).from(users);
    const nameMap = new Map(allUsers.map((u) => [u.id, `${u.firstName} ${u.lastName}`]));

    const namedAssignments = assignments.map((a) => ({
      giverId: a.giverId,
      receiverId: a.receiverId,
      giverName: nameMap.get(a.giverId) || "Unknown",
      receiverName: nameMap.get(a.receiverId) || "Unknown",
    }));

    if (preview) {
      return NextResponse.json({ assignments: namedAssignments });
    }

    // Check for existing assignments this year
    const existing = await db
      .select()
      .from(exchangeAssignments)
      .where(and(eq(exchangeAssignments.groupId, groupId), eq(exchangeAssignments.year, year)))
      .limit(1);

    if (existing.length > 0) {
      // Delete existing and replace
      await db.delete(exchangeAssignments).where(
        and(eq(exchangeAssignments.groupId, groupId), eq(exchangeAssignments.year, year))
      );
    }

    // Save
    await db.insert(exchangeAssignments).values(
      assignments.map((a) => ({
        groupId,
        giverId: a.giverId,
        receiverId: a.receiverId,
        year,
      }))
    );

    return NextResponse.json({ ok: true, assignments: namedAssignments });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to generate assignments";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
