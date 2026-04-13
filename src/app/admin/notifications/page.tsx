import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/lib/db";
import { pushSubscriptions, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import SendNotificationForm from "./SendNotificationForm";

export const metadata = { title: "Notifications" };

export default async function AdminNotificationsPage() {
  const { env } = getCloudflareContext();
  const db = getDb(env.DB);

  const subs = await db
    .select({
      id: pushSubscriptions.id,
      userId: pushSubscriptions.userId,
      firstName: users.firstName,
      lastName: users.lastName,
      createdAt: pushSubscriptions.createdAt,
    })
    .from(pushSubscriptions)
    .innerJoin(users, eq(pushSubscriptions.userId, users.id));

  // Group by user
  const byUser = new Map<number, { name: string; count: number }>();
  for (const s of subs) {
    const existing = byUser.get(s.userId);
    if (existing) {
      existing.count++;
    } else {
      byUser.set(s.userId, { name: `${s.firstName} ${s.lastName}`, count: 1 });
    }
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
      <h1 className="text-2xl font-bold">Notifications</h1>
      <p className="mt-1 text-sm text-muted">Send push notifications and view subscriptions.</p>

      <div className="mt-6 rounded-xl border border-border bg-surface p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4">Send Notification</h2>
        <SendNotificationForm />
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-semibold mb-4">Subscribed Users ({byUser.size})</h2>
        {byUser.size === 0 ? (
          <p className="text-sm text-muted">No one has subscribed to notifications yet.</p>
        ) : (
          <div className="space-y-2">
            {[...byUser.entries()].map(([userId, { name, count }]) => (
              <div key={userId} className="flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-3">
                <span className="text-sm font-medium">{name}</span>
                <span className="text-xs text-muted">{count} device{count !== 1 ? "s" : ""}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
