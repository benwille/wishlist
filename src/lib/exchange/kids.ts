import { eq, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import type { Database } from "@/lib/db";
import {
  children,
  childAdults,
  childAssignments,
  childGroupMembers,
  exchangeGroups,
  exchangeGroupMembers,
} from "@/lib/db/schema";
export async function accessibleGroups(
  db: Database,
  adultId: number,
  admin: boolean,
) {
  if (admin)
    return db
      .select({ id: exchangeGroups.id, name: exchangeGroups.name })
      .from(exchangeGroups);
  const own = await db
    .select({ id: exchangeGroupMembers.groupId })
    .from(exchangeGroupMembers)
    .where(eq(exchangeGroupMembers.userId, adultId));
  const linked = await db
    .select({ id: childGroupMembers.groupId })
    .from(childGroupMembers)
    .innerJoin(childAdults, eq(childAdults.childId, childGroupMembers.childId))
    .where(eq(childAdults.adultId, adultId));
  const ids = [...new Set([...own, ...linked].map((g) => g.id))];
  return ids.length
    ? db
        .select({ id: exchangeGroups.id, name: exchangeGroups.name })
        .from(exchangeGroups)
        .where(inArray(exchangeGroups.id, ids))
    : [];
}
export async function kidsAssignments(db: Database, groupIds: number[]) {
  const giver = alias(children, "child_giver"),
    receiver = alias(children, "child_receiver");
  if (!groupIds.length) return [];
  return db
    .select({
      groupId: childAssignments.groupId,
      groupName: exchangeGroups.name,
      year: childAssignments.year,
      giverId: giver.id,
      giverFirstName: giver.firstName,
      giverLastName: giver.lastName,
      receiverFirstName: receiver.firstName,
      receiverLastName: receiver.lastName,
    })
    .from(childAssignments)
    .innerJoin(giver, eq(childAssignments.giverId, giver.id))
    .innerJoin(receiver, eq(childAssignments.receiverId, receiver.id))
    .innerJoin(exchangeGroups, eq(childAssignments.groupId, exchangeGroups.id))
    .where(inArray(childAssignments.groupId, groupIds));
}
export async function linkedKids(db: Database, adultId: number) {
  return db
    .select({
      id: children.id,
      firstName: children.firstName,
      lastName: children.lastName,
    })
    .from(children)
    .innerJoin(childAdults, eq(childAdults.childId, children.id))
    .where(eq(childAdults.adultId, adultId));
}
