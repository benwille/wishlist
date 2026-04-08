import Link from "next/link";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { eq, and, desc } from "drizzle-orm";
import { getUser } from "@/lib/auth/getUser";
import { getDb } from "@/lib/db";
import { exchangeAssignments, exchangeGroups, exchangeGroupMembers, users } from "@/lib/db/schema";
import Nav from "@/components/layout/Nav";

export const metadata = { title: "Gift Exchange" };

export default async function ExchangePage() {
  const user = await getUser();
  const { env } = getCloudflareContext();
  const db = getDb(env.DB);

  // Get groups this user belongs to
  const myGroups = await db
    .select({ groupId: exchangeGroupMembers.groupId, groupName: exchangeGroups.name })
    .from(exchangeGroupMembers)
    .innerJoin(exchangeGroups, eq(exchangeGroupMembers.groupId, exchangeGroups.id))
    .where(eq(exchangeGroupMembers.userId, user.id));

  // Get all assignments where this user is the giver
  const myAssignments = await db
    .select({
      year: exchangeAssignments.year,
      groupId: exchangeAssignments.groupId,
      groupName: exchangeGroups.name,
      receiverId: users.id,
      receiverFirstName: users.firstName,
      receiverLastName: users.lastName,
    })
    .from(exchangeAssignments)
    .innerJoin(exchangeGroups, eq(exchangeAssignments.groupId, exchangeGroups.id))
    .innerJoin(users, eq(exchangeAssignments.receiverId, users.id))
    .where(eq(exchangeAssignments.giverId, user.id))
    .orderBy(desc(exchangeAssignments.year));

  // Group by year
  const byYear = new Map<number, typeof myAssignments>();
  for (const a of myAssignments) {
    const list = byYear.get(a.year) || [];
    list.push(a);
    byYear.set(a.year, list);
  }
  const years = [...byYear.keys()].sort((a, b) => b - a);

  return (
    <>
      <Nav user={user} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Gift Exchange</h1>
            <p className="mt-1 text-sm text-muted">Your exchange assignments by year.</p>
          </div>
          {user.isAdmin && (
            <Link href="/admin/groups"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark">
              Manage Groups
            </Link>
          )}
        </div>

        {/* Your groups */}
        {myGroups.length > 0 && (
          <div className="mt-6">
            <h2 className="text-lg font-semibold mb-3">Your Groups</h2>
            <div className="flex flex-wrap gap-2">
              {myGroups.map((g) => (
                <Link
                  key={g.groupId}
                  href={`/exchange/${g.groupId}`}
                  className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium hover:border-primary transition-all"
                >
                  {g.groupName} — View all assignments →
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Your assignments by year */}
        {years.length === 0 ? (
          <p className="mt-8 text-sm text-muted">No exchange assignments yet.</p>
        ) : (
          <div className="mt-8 space-y-8">
            {years.map((year) => (
              <div key={year}>
                <h2 className="text-lg font-semibold mb-3">{year}</h2>
                <div className="space-y-3">
                  {byYear.get(year)!.map((a) => (
                    <Link
                      key={`${a.groupId}-${a.receiverId}`}
                      href={`/lists/${a.receiverId}`}
                      className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4 shadow-sm hover:border-primary transition-all"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-light text-primary font-bold text-sm">
                        {a.receiverFirstName[0]}{a.receiverLastName[0]}
                      </div>
                      <div>
                        <p className="font-medium">You&apos;re buying for {a.receiverFirstName} {a.receiverLastName}</p>
                        <p className="text-sm text-muted">{a.groupName}</p>
                      </div>
                      <span className="ml-auto text-sm text-primary">View list →</span>
                    </Link>
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
