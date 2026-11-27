import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth/getUser";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  people,
  groupRoster,
  children,
  groupPeople,
  exchangeGroups,
  exchangeExclusions,
  childExclusions,
  exchangeAssignments,
  childAssignments,
} from "@/lib/db/schema";
import RenameGroup from "./RenameGroup";
import GroupPeopleManager from "@/components/GroupPeopleManager";
export default async function GroupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const viewer = await getUser();
  if (!viewer.isAdmin) redirect("/");
  const groupId = Number((await params).id);
  const { env } = getCloudflareContext();
  const db = getDb(env.DB);
  const [group] = await db
    .select()
    .from(exchangeGroups)
    .where(eq(exchangeGroups.id, groupId));
  if (!group) notFound();
  const records = await db.select().from(people).orderBy(people.firstName),
    kids = await db.select().from(children);
  const members = await db
    .select()
    .from(groupPeople)
    .where(eq(groupPeople.groupId, groupId));
  const roster = await db
    .select()
    .from(groupRoster)
    .where(eq(groupRoster.groupId, groupId));
  const adultPairs = await db
      .select()
      .from(exchangeExclusions)
      .where(eq(exchangeExclusions.groupId, groupId)),
    kidPairs = await db
      .select()
      .from(childExclusions)
      .where(eq(childExclusions.groupId, groupId));
  const adultHistory = await db
      .select()
      .from(exchangeAssignments)
      .where(eq(exchangeAssignments.groupId, groupId)),
    kidHistory = await db
      .select()
      .from(childAssignments)
      .where(eq(childAssignments.groupId, groupId));
  const accountPerson = new Map(
      records
        .filter((p) => p.accountId !== null)
        .map((p) => [p.accountId!, p.id]),
    ),
    childPerson = new Map(kids.map((c) => [c.id, c.personId!]));
  const exclusions = [
    ...adultPairs.map((e) => ({
      personId1: accountPerson.get(e.userId1)!,
      personId2: accountPerson.get(e.userId2)!,
      profileType: "adult" as const,
    })),
    ...kidPairs.map((e) => ({
      personId1: childPerson.get(e.childId1)!,
      personId2: childPerson.get(e.childId2)!,
      profileType: "child" as const,
    })),
  ];
  const data = {
    groupId,
    records: records.map((p) => ({
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      profileType: p.profileType,
      active: p.active,
      hasAccount: p.accountId !== null,
    })),
    memberIds: members.map((m) => m.personId),
    rosterIds: roster.map((m) => m.personId),
    exclusions,
    adultEnabled: !!group.adultExchangeEnabled,
    kidsEnabled: !!group.kidsExchangeEnabled,
    adultYears: adultHistory.map((a) => a.year),
    kidsYears: kidHistory.map((a) => a.year),
  };
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
      <Link
        href="/admin/groups"
        className="mb-4 inline-block text-primary hover:underline"
      >
        Back to Groups
      </Link>
      <RenameGroup groupId={groupId} currentName={group.name} />
      <p className="mt-2 text-muted">
        Manage this group’s adults, kids, exclusions and independent draws.
      </p>
      <GroupPeopleManager key={groupId} {...data} />
    </main>
  );
}
