import Link from "next/link";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { eq, desc } from "drizzle-orm";
import { getUser } from "@/lib/auth/getUser";
import { getDb } from "@/lib/db";
import { exchangeAssignments, exchangeGroups, users } from "@/lib/db/schema";
import {
  accessibleGroups,
  kidsAssignmentsForAdult,
  linkedKids,
} from "@/lib/exchange/kids";
import Nav from "@/components/layout/Nav";

export const metadata = { title: "Gift Exchange" };

export default async function ExchangePage() {
  const user = await getUser();
  const { env } = getCloudflareContext();
  const db = getDb(env.DB);

  // Get groups this user belongs to
  const groups = await accessibleGroups(db, user.id, user.isAdmin);
  const myGroups = groups.map((g) => ({ groupId: g.id, groupName: g.name }));
  const linked = await linkedKids(db, user.id);
  const childDraws = await kidsAssignmentsForAdult(db, user.id);

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
    .innerJoin(
      exchangeGroups,
      eq(exchangeAssignments.groupId, exchangeGroups.id),
    )
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
  const years = [
    ...new Set([...byYear.keys(), ...childDraws.map((a) => a.year)]),
  ].sort((a, b) => b - a);

  return (
    <>
      <Nav user={user} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Gift Exchange</h1>
            <p className="mt-1 text-sm text-muted">
              Your assignments and your linked kids’ assignments, grouped by
              year.
            </p>
          </div>
          {user.isAdmin && (
            <Link
              href="/admin/groups"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark"
            >
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
                <a
                  key={g.groupId}
                  href={`/exchange/${g.groupId}`}
                  className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium hover:border-primary transition-all"
                >
                  {g.groupName} — View all assignments
                </a>
              ))}
            </div>
          </div>
        )}

        {years.length === 0 ? (
          <p className="mt-8 text-sm text-muted">
            No assignments for you or your linked kids yet.
          </p>
        ) : (
          <div className="mt-8 space-y-8">
            {years.map((year) => (
              <section key={year} aria-labelledby={`personal-year-${year}`}>
                <h2
                  id={`personal-year-${year}`}
                  className="mb-4 text-xl font-semibold"
                >
                  {year}
                </h2>
                <div className="space-y-5">
                  <section aria-labelledby={`your-assignment-${year}`}>
                    <h3
                      id={`your-assignment-${year}`}
                      className="mb-3 text-lg font-semibold"
                    >
                      Your assignments
                    </h3>
                    <div className="space-y-3">
                      {(byYear.get(year) || []).map((a) => (
                        <Link
                          key={`${a.groupId}-${a.receiverId}`}
                          href={`/lists/${a.receiverId}`}
                          className="block rounded-xl border border-border bg-surface p-4 shadow-sm hover:border-primary"
                        >
                          <p className="break-words font-medium">
                            You’re buying for {a.receiverFirstName}{" "}
                            {a.receiverLastName}
                          </p>
                          <p className="mt-1 text-sm text-muted">
                            {a.groupName} · View list
                          </p>
                        </Link>
                      ))}
                      {!byYear.get(year)?.length && (
                        <p className="text-sm text-muted">
                          No assignment for you in {year}.
                        </p>
                      )}
                    </div>
                  </section>
                  {linked.length > 0 && (
                    <section aria-labelledby={`your-kids-${year}`}>
                      <h3
                        id={`your-kids-${year}`}
                        className="mb-3 text-lg font-semibold"
                      >
                        Your kids’ assignments
                      </h3>
                      <div className="space-y-3">
                        {childDraws
                          .filter((a) => a.year === year)
                          .map((a) => (
                            <div
                              key={`${a.groupId}-${a.giverId}`}
                              className="rounded-xl border border-border bg-surface p-4 shadow-sm"
                            >
                              <p className="break-words font-medium">
                                {a.giverFirstName} {a.giverLastName} →{" "}
                                {a.receiverFirstName} {a.receiverLastName}
                              </p>
                              <p className="mt-1 text-sm text-muted">
                                {a.groupName}
                              </p>
                            </div>
                          ))}
                        {!childDraws.some((a) => a.year === year) && (
                          <p className="text-sm text-muted">
                            No assignments for your kids in {year}.
                          </p>
                        )}
                      </div>
                    </section>
                  )}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
