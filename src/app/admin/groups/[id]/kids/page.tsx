import Link from "next/link";
import { notFound } from "next/navigation";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  children,
  childAdults,
  childGroupMembers,
  childExclusions,
  exchangeGroups,
  users,
} from "@/lib/db/schema";
import { kidsAssignments } from "@/lib/exchange/kids";
import KidsManager from "./KidsManager";
export default async function KidsAdmin({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const groupId = Number((await params).id);
  const { env } = getCloudflareContext();
  const db = getDb(env.DB);
  const [group] = await db
    .select()
    .from(exchangeGroups)
    .where(eq(exchangeGroups.id, groupId));
  if (!group) notFound();
  const records = await db.select().from(children).orderBy(children.firstName);
  const adults = await db
    .select({
      id: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
    })
    .from(users)
    .where(eq(users.active, 1))
    .orderBy(users.firstName);
  const links = await db.select().from(childAdults);
  const members = await db
    .select()
    .from(childGroupMembers)
    .where(eq(childGroupMembers.groupId, groupId));
  const exclusions = await db
    .select()
    .from(childExclusions)
    .where(eq(childExclusions.groupId, groupId));
  const assignments = await kidsAssignments(db, [groupId]);
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
      <Link
        href={`/admin/groups/${groupId}`}
        className="text-primary hover:underline"
      >
        Back to {group.name}
      </Link>
      <h1 className="mt-4 text-2xl font-bold">{group.name}: Kids Exchange</h1>
      <p className="mt-2 text-muted">
        Kids only. Add explicit sibling exclusions. Last year’s recipients are
        excluded automatically.
      </p>
      <KidsManager
        key={JSON.stringify({
          records,
          links,
          members,
          exclusions,
          assignments,
        })}
        groupId={groupId}
        records={records.map((c) => ({
          ...c,
          adultIds: links
            .filter((l) => l.childId === c.id)
            .map((l) => l.adultId),
        }))}
        adults={adults}
        memberIds={members.map((m) => m.childId)}
        exclusions={exclusions}
        assignments={assignments}
      />
    </main>
  );
}
