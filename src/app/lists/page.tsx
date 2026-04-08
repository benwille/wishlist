import Link from "next/link";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { eq, sql, count } from "drizzle-orm";
import { getUser } from "@/lib/auth/getUser";
import { getDb } from "@/lib/db";
import { users, items } from "@/lib/db/schema";
import Nav from "@/components/layout/Nav";

export const metadata = { title: "All Lists" };

export default async function AllListsPage() {
  const user = await getUser();
  const { env } = getCloudflareContext();
  const db = getDb(env.DB);

  const allUsers = await db
    .select({
      id: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
    })
    .from(users)
    .where(eq(users.active, 1))
    .orderBy(users.firstName);

  const itemCounts = await db
    .select({ userId: items.userId, count: count() })
    .from(items)
    .groupBy(items.userId);

  const countMap = new Map(itemCounts.map((r) => [r.userId, r.count]));
  const usersWithCounts = allUsers.map((u) => ({ ...u, itemCount: countMap.get(u.id) ?? 0 }));

  return (
    <>
      <Nav user={user} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <h1 className="text-2xl font-bold">All Lists</h1>
        <p className="mt-1 text-sm text-muted">See what everyone wants.</p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {usersWithCounts.map((u) => (
            <Link
              key={u.id}
              href={u.id === user.id ? "/my-list" : `/lists/${u.id}`}
              className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4 shadow-sm hover:border-primary hover:shadow-md transition-all"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-light text-primary font-bold text-sm">
                {u.firstName[0]}{u.lastName[0]}
              </div>
              <div>
                <p className="font-medium">
                  {u.firstName} {u.lastName}
                  {u.id === user.id && <span className="text-muted font-normal"> (you)</span>}
                </p>
                <p className="text-sm text-muted">{u.itemCount} items</p>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </>
  );
}
