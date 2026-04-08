import { notFound } from "next/navigation";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { eq, desc } from "drizzle-orm";
import { getUser } from "@/lib/auth/getUser";
import { getDb } from "@/lib/db";
import { users, items } from "@/lib/db/schema";
import Nav from "@/components/layout/Nav";
import ClaimableItemList from "@/components/wishlist/ClaimableItemList";

export default async function UserListPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const currentUser = await getUser();
  const { env } = getCloudflareContext();
  const db = getDb(env.DB);

  const [listOwner] = await db.select().from(users).where(eq(users.id, Number(userId))).limit(1);
  if (!listOwner || !listOwner.active) notFound();

  const userItems = await db
    .select()
    .from(items)
    .where(eq(items.userId, listOwner.id))
    .orderBy(desc(items.createdAt));

  // Strip claim info if viewing own list
  const isOwner = currentUser.id === listOwner.id;
  const safeItems = userItems.map((item) => ({
    ...item,
    claimedBy: isOwner ? null : item.claimedBy,
    purchased: isOwner ? 0 : item.purchased,
  }));

  return (
    <>
      <Nav user={currentUser} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        <h1 className="text-2xl font-bold">{listOwner.firstName}&apos;s List</h1>
        <p className="mt-1 text-sm text-muted">{safeItems.length} items</p>

        <div className="mt-6">
          {isOwner ? (
            <p className="text-sm text-muted">This is your list. Go to <a href="/my-list" className="text-primary hover:underline">My List</a> to edit it.</p>
          ) : (
            <ClaimableItemList items={safeItems} currentUserId={currentUser.id} ownerName={listOwner.firstName} />
          )}
        </div>
      </main>
    </>
  );
}
