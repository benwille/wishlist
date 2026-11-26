import { groupIdsForAccount } from "@/lib/people";
import { eq, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import type { Database } from "@/lib/db";
import {
  children,
  childAdults,
  childAssignments,
  exchangeGroups,
} from "@/lib/db/schema";
export async function accessibleGroups(
  db: Database,
  adultId: number,
  admin: boolean,
) {
  const ids = await groupIdsForAccount(db, adultId, admin);
  return ids.length
    ? db
        .select({ id: exchangeGroups.id, name: exchangeGroups.name })
        .from(exchangeGroups)
        .where(inArray(exchangeGroups.id, ids))
    : [];
}
function kidsAssignmentQuery(db: Database) {
  const giver = alias(children, "child_giver"),
    receiver = alias(children, "child_receiver");
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
    .innerJoin(exchangeGroups, eq(childAssignments.groupId, exchangeGroups.id));
}
export async function kidsAssignments(db: Database, groupIds: number[]) {
  if (!groupIds.length) return [];
  return kidsAssignmentQuery(db).where(
    inArray(childAssignments.groupId, groupIds),
  );
}
// The personal overview follows explicit adult links, including a child's
// historical assignments after they leave an exchange roster.
export async function kidsAssignmentsForAdult(db: Database, adultId: number) {
  return kidsAssignmentQuery(db)
    .innerJoin(childAdults, eq(childAdults.childId, childAssignments.giverId))
    .where(eq(childAdults.adultId, adultId));
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
