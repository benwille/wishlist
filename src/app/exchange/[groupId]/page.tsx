import { notFound } from "next/navigation";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { eq, desc } from "drizzle-orm";
import { getUser } from "@/lib/auth/getUser";
import { getDb } from "@/lib/db";
import { exchangeGroups, exchangeGroupMembers, exchangeAssignments, users } from "@/lib/db/schema";
import Nav from "@/components/layout/Nav";
import Link from "next/link";

export default async function GroupExchangePage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  const user = await getUser();
  const { env } = getCloudflareContext();
  const db = getDb(env.DB);

  const [group] = await db.select().from(exchangeGroups).where(eq(exchangeGroups.id, Number(groupId))).limit(1);
  if (!group) notFound();

  // Verify user is a member of this group (or admin)
  if (!user.isAdmin) {
    const [membership] = await db
      .select()
      .from(exchangeGroupMembers)
      .where(eq(exchangeGroupMembers.groupId, group.id))
      .limit(1);
    // Check actual membership
    const myMembership = await db
      .select()
      .from(exchangeGroupMembers)
      .where(eq(exchangeGroupMembers.groupId, group.id));
    const isMember = myMembership.some((m) => m.userId === user.id);
    if (!isMember) notFound();
  }

  // Get all assignments for this group
  const assignments = await db
    .select({
      year: exchangeAssignments.year,
      giverId: exchangeAssignments.giverId,
      receiverId: exchangeAssignments.receiverId,
    })
    .from(exchangeAssignments)
    .where(eq(exchangeAssignments.groupId, group.id))
    .orderBy(desc(exchangeAssignments.year));

  // Get all user names
  const allUsers = await db.select({ id: users.id, firstName: users.firstName, lastName: users.lastName }).from(users);
  const nameMap = new Map(allUsers.map((u) => [u.id, `${u.firstName} ${u.lastName}`]));

  // Group by year
  const byYear = new Map<number, { giverName: string; receiverName: string; receiverId: number }[]>();
  for (const a of assignments) {
    const list = byYear.get(a.year) || [];
    list.push({
      giverName: nameMap.get(a.giverId) || "Unknown",
      receiverName: nameMap.get(a.receiverId) || "Unknown",
      receiverId: a.receiverId,
    });
    byYear.set(a.year, list);
  }
  const years = [...byYear.keys()].sort((a, b) => b - a);

  return (
    <>
      <Nav user={user} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/exchange" className="text-primary hover:underline text-sm">← Back</Link>
        </div>

        <h1 className="text-2xl font-bold">{group.name} — Assignments</h1>
        <p className="mt-1 text-sm text-muted">Who has who in the {group.name} exchange.</p>

        {years.length === 0 ? (
          <p className="mt-8 text-sm text-muted">No exchanges have been run for this group yet.</p>
        ) : (
          <div className="mt-6 space-y-8">
            {years.map((year) => (
              <div key={year}>
                <h2 className="text-lg font-semibold mb-3">{year}</h2>
                <div className="space-y-2">
                  {byYear.get(year)!.map((a, i) => (
                    <div key={i} className="flex items-center gap-2 rounded-lg border border-border bg-surface px-4 py-3 text-sm">
                      <span className="font-medium">{a.giverName}</span>
                      <span className="text-muted">→</span>
                      <Link href={`/lists/${a.receiverId}`} className="text-primary hover:underline">
                        {a.receiverName}
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
