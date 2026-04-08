import { notFound } from "next/navigation";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { eq, desc } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { users, items } from "@/lib/db/schema";

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { env } = getCloudflareContext();
  const db = getDb(env.DB);

  const [user] = await db.select().from(users).where(eq(users.shareToken, token)).limit(1);
  if (!user || !user.active) return { title: "Not Found" };

  return { title: `${user.firstName}'s Wishlist` };
}

export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { env } = getCloudflareContext();
  const db = getDb(env.DB);

  const [user] = await db.select().from(users).where(eq(users.shareToken, token)).limit(1);
  if (!user || !user.active) notFound();

  const userItems = await db
    .select()
    .from(items)
    .where(eq(items.userId, user.id))
    .orderBy(desc(items.createdAt));

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
      <h1 className="text-2xl font-bold">{user.firstName}&apos;s Wishlist</h1>
      <p className="mt-1 text-sm text-muted">{userItems.length} items</p>

      <div className="mt-6 space-y-3">
        {userItems.length === 0 ? (
          <p className="text-sm text-muted">{user.firstName} hasn&apos;t added anything yet.</p>
        ) : (
          userItems.map((item) => (
            <div
              key={item.id}
              className="rounded-xl border border-border bg-surface p-4 shadow-sm"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {item.link ? (
                    <a
                      href={item.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-primary hover:underline"
                    >
                      {item.name}
                    </a>
                  ) : (
                    <span className="font-medium">{item.name}</span>
                  )}
                  {item.priceRange && (
                    <span className="rounded-full bg-primary-light px-2 py-0.5 text-xs font-medium text-primary-dark">
                      {item.priceRange}
                    </span>
                  )}
                </div>
                {item.description && (
                  <p className="mt-1 text-sm text-muted">{item.description}</p>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </main>
  );
}
