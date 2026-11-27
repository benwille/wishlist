import { and, eq, inArray } from "drizzle-orm";
import { users, exchangeGroupMembers, familyListMembers } from "./schema";
import type { Database } from "./index";

/**
 * Returns IDs of users visible to the given user.
 * Admins see all active users. Regular users see those
 * who share at least one family group with them, whether or not they enter a draw.
 * The current user is always included.
 */
export async function getVisibleUserIds(
  db: Database,
  userId: number,
  isAdmin: boolean,
): Promise<number[]> {
  if (isAdmin) {
    const rows = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.active, 1));
    return rows.map((r) => r.id);
  }

  // Both exchange participants and additional family members share list access.
  // Sharing one group never grants access to a member's other groups.
  const myGroups = await db
    .select({ groupId: exchangeGroupMembers.groupId })
    .from(exchangeGroupMembers)
    .where(eq(exchangeGroupMembers.userId, userId))
    .union(
      db
        .select({ groupId: familyListMembers.groupId })
        .from(familyListMembers)
        .where(eq(familyListMembers.userId, userId)),
    );
  if (!myGroups.length) return [userId];
  const groupIds = myGroups.map((g) => g.groupId);
  const sharedMembers = await db
    .select({ userId: exchangeGroupMembers.userId })
    .from(exchangeGroupMembers)
    .where(inArray(exchangeGroupMembers.groupId, groupIds))
    .union(
      db
        .select({ userId: familyListMembers.userId })
        .from(familyListMembers)
        .where(inArray(familyListMembers.groupId, groupIds)),
    );
  const active = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        eq(users.active, 1),
        inArray(users.id, [
          ...new Set([userId, ...sharedMembers.map((m) => m.userId)]),
        ]),
      ),
    );
  return [...new Set([userId, ...active.map((u) => u.id)])];
}
