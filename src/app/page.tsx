import Link from "next/link";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { eq, and } from "drizzle-orm";
import { getUser } from "@/lib/auth/getUser";
import { getDb } from "@/lib/db";
import { exchangeAssignments, exchangeGroups, users } from "@/lib/db/schema";
import Nav from "@/components/layout/Nav";

export default async function DashboardPage() {
  const user = await getUser();
  const { env } = getCloudflareContext();
  const db = getDb(env.DB);

  const currentYear = new Date().getFullYear();

  const myAssignments = await db
    .select({
      groupName: exchangeGroups.name,
      receiverFirstName: users.firstName,
      receiverLastName: users.lastName,
      receiverId: users.id,
    })
    .from(exchangeAssignments)
    .innerJoin(exchangeGroups, eq(exchangeAssignments.groupId, exchangeGroups.id))
    .innerJoin(users, eq(exchangeAssignments.receiverId, users.id))
    .where(
      and(
        eq(exchangeAssignments.giverId, user.id),
        eq(exchangeAssignments.year, currentYear)
      )
    );

  return (
    <>
      <Nav user={user} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <h1 className="text-2xl font-bold">Hey, {user.firstName}</h1>
        <p className="mt-1 text-muted">Welcome to your family wishlist.</p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Link
            href="/my-list"
            className="rounded-xl border border-border bg-surface p-5 shadow-sm hover:border-primary hover:shadow-md transition-all"
          >
            <div className="text-2xl mb-2">🎁</div>
            <h2 className="font-semibold">My List</h2>
            <p className="mt-1 text-sm text-muted">Add and manage your wishlist items</p>
          </Link>

          <Link
            href="/lists"
            className="rounded-xl border border-border bg-surface p-5 shadow-sm hover:border-primary hover:shadow-md transition-all"
          >
            <div className="text-2xl mb-2">👨‍👩‍👧‍👦</div>
            <h2 className="font-semibold">All Lists</h2>
            <p className="mt-1 text-sm text-muted">See what everyone wants</p>
          </Link>

          <Link
            href="/exchange"
            className="rounded-xl border border-border bg-surface p-5 shadow-sm hover:border-primary hover:shadow-md transition-all"
          >
            <div className="text-2xl mb-2">🔄</div>
            <h2 className="font-semibold">Gift Exchange</h2>
            <p className="mt-1 text-sm text-muted">View your exchange assignments</p>
          </Link>
        </div>

        {myAssignments.length > 0 && (
          <div className="mt-8">
            <h2 className="text-lg font-semibold mb-3">Your {currentYear} Assignments</h2>
            <div className="space-y-3">
              {myAssignments.map((a) => (
                <Link
                  key={a.receiverId}
                  href={`/lists/${a.receiverId}`}
                  className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4 shadow-sm hover:border-primary transition-all"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-light text-primary font-bold text-sm">
                    {a.receiverFirstName[0]}{a.receiverLastName[0]}
                  </div>
                  <div>
                    <p className="font-medium">{a.receiverFirstName} {a.receiverLastName}</p>
                    <p className="text-sm text-muted">{a.groupName}</p>
                  </div>
                  <span className="ml-auto text-sm text-primary">View list →</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </main>
    </>
  );
}
