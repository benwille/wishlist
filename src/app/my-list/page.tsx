import { Suspense } from "react";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { eq, desc } from "drizzle-orm";
import { getUser } from "@/lib/auth/getUser";
import { getDb } from "@/lib/db";
import { users, items } from "@/lib/db/schema";
import Nav from "@/components/layout/Nav";
import ItemForm from "@/components/wishlist/ItemForm";
import MyItemList from "@/components/wishlist/MyItemList";
import ShareLinkButton from "./ShareLinkButton";

export const metadata = { title: "My List" };

export default async function MyListPage() {
  const user = await getUser();
  const { env } = getCloudflareContext();
  const db = getDb(env.DB);

  const [currentUser] = await db.select({ shareToken: users.shareToken }).from(users).where(eq(users.id, user.id)).limit(1);

  const myItems = await db
    .select()
    .from(items)
    .where(eq(items.userId, user.id))
    .orderBy(desc(items.createdAt));

  const activeItems = myItems.filter((i) => !i.receivedAt);
  const receivedItems = myItems.filter((i) => i.receivedAt);

  return (
    <>
      <Nav user={user} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">My List</h1>
        </div>
        <p className="mt-1 text-sm text-muted">Add things you want. Others can see your list and mark items as claimed.</p>
        <ShareLinkButton existingToken={currentUser?.shareToken ?? null} />

        <div className="mt-6 rounded-xl border border-border bg-surface p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Add an item</h2>
          <ItemForm userId={user.id} />
        </div>

        <div className="mt-8">
          <h2 className="text-lg font-semibold mb-4">Your items ({activeItems.length})</h2>
          <Suspense fallback={null}>
            <MyItemList items={activeItems} />
          </Suspense>
        </div>

        {receivedItems.length > 0 && (
          <details className="mt-8 rounded-xl border border-border bg-surface p-4 shadow-sm">
            <summary className="cursor-pointer text-sm font-semibold text-muted hover:text-foreground">
              Received ({receivedItems.length})
            </summary>
            <div className="mt-4">
              <MyItemList items={receivedItems} />
            </div>
          </details>
        )}
      </main>
    </>
  );
}
