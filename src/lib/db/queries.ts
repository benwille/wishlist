import { eq, inArray } from "drizzle-orm";
import { users, exchangeGroupMembers } from "./schema";
import type { Database } from "./index";

/**
 * Returns IDs of users visible to the given user.
 * Admins see all active users. Regular users see those
 * who share at least one exchange group with them.
 * The current user is always included.
 */
export async function getVisibleUserIds(
  db: Database,
  userId: number,
  isAdmin: boolean
): Promise<number[]> {
  if (isAdmin) {
    const rows = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.active, 1));
    return rows.map((r) => r.id);
  }

  // Find groups the current user belongs to
  const myGroups = await db
    .select({ groupId: exchangeGroupMembers.groupId })
    .from(exchangeGroupMembers)
    .where(eq(exchangeGroupMembers.userId, userId));

  if (myGroups.length === 0) return [userId];

  const groupIds = myGroups.map((g) => g.groupId);

  // Find all users in those groups
  const sharedMembers = await db
    .selectDistinct({ userId: exchangeGroupMembers.userId })
    .from(exchangeGroupMembers)
    .where(inArray(exchangeGroupMembers.groupId, groupIds));

  const ids = new Set(sharedMembers.map((m) => m.userId));
  ids.add(userId); // always include self
  return [...ids];
}
