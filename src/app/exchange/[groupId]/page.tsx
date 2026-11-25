import { notFound } from "next/navigation";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { eq, desc } from "drizzle-orm";
import { getUser } from "@/lib/auth/getUser";
import { getDb } from "@/lib/db";
import { exchangeGroups, exchangeAssignments, users } from "@/lib/db/schema";
import { accessibleGroups, kidsAssignments } from "@/lib/exchange/kids";
import Nav from "@/components/layout/Nav";
import Link from "next/link";

export default async function GroupExchangePage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  const user = await getUser();
  const { env } = getCloudflareContext();
  const db = getDb(env.DB);

  const [group] = await db
    .select()
    .from(exchangeGroups)
    .where(eq(exchangeGroups.id, Number(groupId)))
    .limit(1);
  if (!group) notFound();

  const groups = await accessibleGroups(db, user.id, user.isAdmin);
  if (!groups.some((g) => g.id === group.id)) notFound();
  const childDraws = await kidsAssignments(db, [group.id]);

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
  const allUsers = await db
    .select({
      id: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
    })
    .from(users);
  const nameMap = new Map(
    allUsers.map((u) => [u.id, `${u.firstName} ${u.lastName}`]),
  );

  // Group by year
  const byYear = new Map<
    number,
    { giverName: string; receiverName: string; receiverId: number }[]
  >();
  for (const a of assignments) {
    const list = byYear.get(a.year) || [];
    list.push({
      giverName: nameMap.get(a.giverId) || "Unknown",
      receiverName: nameMap.get(a.receiverId) || "Unknown",
      receiverId: a.receiverId,
    });
    byYear.set(a.year, list);
  }
  const years = [
    ...new Set([...byYear.keys(), ...childDraws.map((a) => a.year)]),
  ].sort((a, b) => b - a);

  return (
    <>
      <Nav user={user} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/exchange"
            className="text-primary hover:underline text-sm"
          >
            ← Back
          </Link>
        </div>

        <h1 className="text-2xl font-bold">{group.name} — Assignments</h1>
        <p className="mt-1 text-sm text-muted">
          Who has who in the {group.name} exchange.
        </p>

        {years.length === 0 ? (
          <p className="mt-8 text-sm text-muted">
            No exchanges have been run for this group yet.
          </p>
        ) : (
          <div className="mt-8 space-y-8">
            {years.map((year) => (
              <section key={year} aria-labelledby={`assignments-${year}`}>
                <h2
                  id={`assignments-${year}`}
                  className="mb-4 text-xl font-semibold"
                >
                  {year}
                </h2>
                <div className="grid gap-6 md:grid-cols-2">
                  <section
                    aria-labelledby={`adults-${year}`}
                    className="min-w-0 rounded-xl border border-border bg-surface p-4"
                  >
                    <h3
                      id={`adults-${year}`}
                      className="mb-3 text-lg font-semibold"
                    >
                      Adults
                    </h3>
                    <div className="space-y-3">
                      {(byYear.get(year) || []).map((a, i) => (
                        <p key={i} className="break-words text-sm">
                          <span className="font-medium">{a.giverName}</span>
                          <span className="text-muted"> → </span>
                          <Link
                            href={`/lists/${a.receiverId}`}
                            className="text-primary hover:underline"
                          >
                            {a.receiverName}
                          </Link>
                        </p>
                      ))}
                      {!byYear.get(year)?.length && (
                        <p className="text-sm text-muted">
                          No adult assignments for {year}.
                        </p>
                      )}
                    </div>
                  </section>
                  <section
                    aria-labelledby={`kids-${year}`}
                    className="min-w-0 rounded-xl border border-border bg-surface p-4"
                  >
                    <h3
                      id={`kids-${year}`}
                      className="mb-3 text-lg font-semibold"
                    >
                      Kids
                    </h3>
                    <div className="space-y-3">
                      {childDraws
                        .filter((a) => a.year === year)
                        .map((a) => (
                          <p key={a.giverId} className="break-words text-sm">
                            <span className="font-medium">
                              {a.giverFirstName} {a.giverLastName}
                            </span>
                            <span className="text-muted"> → </span>
                            <span>
                              {a.receiverFirstName} {a.receiverLastName}
                            </span>
                          </p>
                        ))}
                      {!childDraws.some((a) => a.year === year) && (
                        <p className="text-sm text-muted">
                          No kids’ assignments for {year}.
                        </p>
                      )}
                    </div>
                  </section>
                </div>
              </section>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
