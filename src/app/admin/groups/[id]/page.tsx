import { notFound } from "next/navigation";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { eq, desc } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { exchangeGroups, exchangeGroupMembers, exchangeExclusions, exchangeAssignments, users } from "@/lib/db/schema";
import MemberManager from "./MemberManager";
import ExclusionManager from "./ExclusionManager";
import RunExchange from "./RunExchange";
import AssignmentHistory from "./AssignmentHistory";

export default async function GroupDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { env } = getCloudflareContext();
  const db = getDb(env.DB);

  const [group] = await db.select().from(exchangeGroups).where(eq(exchangeGroups.id, Number(id))).limit(1);
  if (!group) notFound();

  const allUsers = await db.select({ id: users.id, firstName: users.firstName, lastName: users.lastName, active: users.active, participatesInExchanges: users.participatesInExchanges }).from(users).where(eq(users.active, 1)).orderBy(users.firstName);

  const members = await db
    .select({ userId: exchangeGroupMembers.userId, firstName: users.firstName, lastName: users.lastName })
    .from(exchangeGroupMembers)
    .innerJoin(users, eq(exchangeGroupMembers.userId, users.id))
    .where(eq(exchangeGroupMembers.groupId, group.id));

  const exclusions = await db
    .select({
      id: exchangeExclusions.id,
      userId1: exchangeExclusions.userId1,
      userId2: exchangeExclusions.userId2,
    })
    .from(exchangeExclusions)
    .where(eq(exchangeExclusions.groupId, group.id));

  const assignments = await db
    .select({
      year: exchangeAssignments.year,
      giverFirstName: users.firstName,
      giverLastName: users.lastName,
      receiverId: exchangeAssignments.receiverId,
    })
    .from(exchangeAssignments)
    .innerJoin(users, eq(exchangeAssignments.giverId, users.id))
    .where(eq(exchangeAssignments.groupId, group.id))
    .orderBy(desc(exchangeAssignments.year));

  // Resolve receiver names
  const userMap = new Map(allUsers.map((u) => [u.id, `${u.firstName} ${u.lastName}`]));
  const assignmentsWithNames = assignments.map((a) => ({
    ...a,
    giverName: `${a.giverFirstName} ${a.giverLastName}`,
    receiverName: userMap.get(a.receiverId) || "Unknown",
  }));

  const memberIds = new Set(members.map((m) => m.userId));

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
      <h1 className="text-2xl font-bold">{group.name}</h1>
      <p className="mt-1 text-sm text-muted">Manage members, exclusions, and run the exchange.</p>

      <div className="mt-6 rounded-xl border border-border bg-surface p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4">Members ({members.length})</h2>
        <MemberManager
          groupId={group.id}
          members={members}
          allUsers={allUsers.filter((u) => u.participatesInExchanges === 1)}
          memberIds={[...memberIds]}
        />
      </div>

      <div className="mt-6 rounded-xl border border-border bg-surface p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4">Exclusions</h2>
        <p className="mb-3 text-sm text-muted">Pairs who shouldn&apos;t be assigned to each other (e.g. same household).</p>
        <ExclusionManager
          groupId={group.id}
          exclusions={exclusions}
          members={members}
        />
      </div>

      <div className="mt-6 rounded-xl border border-border bg-surface p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4">Run Exchange</h2>
        <RunExchange groupId={group.id} memberCount={members.length} />
      </div>

      <div className="mt-6 rounded-xl border border-border bg-surface p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4">Assignment History</h2>
        <AssignmentHistory assignments={assignmentsWithNames} />
      </div>
    </main>
  );
}
