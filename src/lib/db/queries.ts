import { and, eq, inArray } from "drizzle-orm";
import { users, people, groupRoster } from "./schema";
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

  // Membership, rather than draw participation, controls family list access.
  const myGroups = await db
    .select({ groupId: groupRoster.groupId })
    .from(groupRoster)
    .innerJoin(people, eq(people.id, groupRoster.personId))
    .where(eq(people.accountId, userId));
  if (!myGroups.length) return [userId];
  const sharedMembers = await db
    .selectDistinct({ id: users.id })
    .from(groupRoster)
    .innerJoin(people, eq(people.id, groupRoster.personId))
    .innerJoin(users, eq(users.id, people.accountId))
    .where(
      and(
        inArray(
          groupRoster.groupId,
          myGroups.map((g) => g.groupId),
        ),
        eq(people.active, 1),
        eq(users.active, 1),
      ),
    );
  return [...new Set([userId, ...sharedMembers.map((u) => u.id)])];
}
