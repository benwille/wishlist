import { and, eq, inArray } from "drizzle-orm";
import type { Database } from "@/lib/db";
import {
  people,
  personGuardians,
  users,
  groupRoster,
  exchangeGroups,
} from "@/lib/db/schema";
import type { SessionUser } from "@/lib/auth/session";
export async function ownPerson(db: Database, accountId: number) {
  const [person] = await db
    .select()
    .from(people)
    .where(eq(people.accountId, accountId));
  return person;
}
export async function manageablePeople(db: Database, user: SessionUser) {
  if (user.isAdmin) return db.select().from(people).orderBy(people.firstName);
  const self = await ownPerson(db, user.id);
  if (!self) return [];
  const linked = await db
    .select({ id: personGuardians.personId })
    .from(personGuardians)
    .where(eq(personGuardians.adultPersonId, self.id));
  return db
    .select()
    .from(people)
    .where(inArray(people.id, [self.id, ...linked.map((p) => p.id)]))
    .orderBy(people.firstName);
}
export async function canEditPerson(
  db: Database,
  user: SessionUser,
  personId: number,
) {
  if (user.isAdmin) return true;
  const self = await ownPerson(db, user.id);
  if (!self) return false;
  if (self.id === personId) return true;
  return (
    (
      await db
        .select()
        .from(personGuardians)
        .where(
          and(
            eq(personGuardians.personId, personId),
            eq(personGuardians.adultPersonId, self.id),
          ),
        )
    ).length > 0
  );
}
export async function guardianChoices(db: Database, user: SessionUser) {
  // Only global administrators can enumerate accounts or assign guardian rights.
  if (!user.isAdmin) return [];
  return db
    .select({
      id: people.id,
      firstName: people.firstName,
      lastName: people.lastName,
      accountId: people.accountId,
    })
    .from(people)
    .innerJoin(users, eq(users.id, people.accountId))
    .where(
      and(
        eq(people.profileType, "adult"),
        eq(people.active, 1),
        eq(users.active, 1),
      ),
    )
    .orderBy(people.firstName);
}
export async function profileRows(db: Database, user: SessionUser) {
  const records = await manageablePeople(db, user),
    ids = records.map((p) => p.id);
  const links = ids.length
    ? await db
        .select()
        .from(personGuardians)
        .where(inArray(personGuardians.personId, ids))
    : [];
  // Non-admin clients receive names/types only, never account emails or others' guardian links.
  return records.map((p) => ({
    id: p.id,
    firstName: p.firstName,
    lastName: p.lastName,
    profileType: p.profileType,
    active: p.active,
    accountId: user.isAdmin ? p.accountId : undefined,
    guardianIds: user.isAdmin
      ? links.filter((l) => l.personId === p.id).map((l) => l.adultPersonId)
      : undefined,
  }));
}
export async function groupIdsForAccount(
  db: Database,
  accountId: number,
  admin: boolean,
) {
  if (admin)
    return (
      await db.select({ id: exchangeGroups.id }).from(exchangeGroups)
    ).map((g) => g.id);
  const self = await ownPerson(db, accountId);
  if (!self) return [];
  const linked = await db
    .select({ id: personGuardians.personId })
    .from(personGuardians)
    .where(eq(personGuardians.adultPersonId, self.id));
  return [
    ...new Set(
      (
        await db
          .select({ id: groupRoster.groupId })
          .from(groupRoster)
          .where(
            inArray(groupRoster.personId, [
              self.id,
              ...linked.map((l) => l.id),
            ]),
          )
      ).map((g) => g.id),
    ),
  ];
}
