import Link from "next/link";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { eq, sql, count } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { exchangeGroups, exchangeGroupMembers } from "@/lib/db/schema";
import CreateGroupForm from "./CreateGroupForm";

export const metadata = { title: "Exchange Groups" };

export default async function GroupsPage() {
  const { env } = getCloudflareContext();
  const db = getDb(env.DB);

  const groups = await db
    .select({
      id: exchangeGroups.id,
      name: exchangeGroups.name,
    })
    .from(exchangeGroups)
    .orderBy(exchangeGroups.name);

  const memberCounts = await db
    .select({ groupId: exchangeGroupMembers.groupId, count: count() })
    .from(exchangeGroupMembers)
    .groupBy(exchangeGroupMembers.groupId);

  const countMap = new Map(memberCounts.map((r) => [r.groupId, r.count]));

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
      <h1 className="text-2xl font-bold">Exchange Groups</h1>
      <p className="mt-1 text-sm text-muted">Each group runs its own Secret Santa exchange.</p>

      <div className="mt-6 rounded-xl border border-border bg-surface p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4">Create a group</h2>
        <CreateGroupForm />
      </div>

      <div className="mt-8 space-y-3">
        {groups.map((g) => (
          <Link
            key={g.id}
            href={`/admin/groups/${g.id}`}
            className="flex items-center justify-between rounded-xl border border-border bg-surface p-4 shadow-sm hover:border-primary transition-all"
          >
            <div>
              <p className="font-medium">{g.name}</p>
              <p className="text-sm text-muted">{countMap.get(g.id) ?? 0} members</p>
            </div>
            <span className="text-sm text-primary">Manage →</span>
          </Link>
        ))}
        {groups.length === 0 && <p className="text-sm text-muted">No groups yet.</p>}
      </div>
    </main>
  );
}
