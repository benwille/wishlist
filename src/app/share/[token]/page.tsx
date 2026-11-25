import { notFound } from "next/navigation";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { and, eq, desc, isNull } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { users, items } from "@/lib/db/schema";
import { cookies } from "next/headers";
import { getUserOptional } from "@/lib/auth/getUser";
import { getGuest, guestCookieName } from "@/lib/share/access";
import PublicWishlist from "./PublicWishlist";

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { env } = getCloudflareContext();
  const db = getDb(env.DB);

  const [user] = await db.select().from(users).where(eq(users.shareToken, token)).limit(1);
  if (!user || !user.active) return { title: "Not Found" };

  return { title: `${user.firstName}'s Wishlist`, robots: { index: false, follow: false } };
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
    .where(and(eq(items.userId, user.id), isNull(items.receivedAt)))
    .orderBy(desc(items.createdAt));

  const member = await getUserOptional();
  const cookieStore = await cookies();
  const guest = await getGuest(db, user.id, cookieStore.get(guestCookieName(user.id))?.value);
  const isOwner = member?.id === user.id;
  const safeItems = userItems.map((item) => ({
    id: item.id, name: item.name, description: item.description, link: item.link,
    priceRange: item.priceRange,
    claimed: !isOwner && (item.claimedBy !== null || item.claimedByGuest !== null),
    mine: !isOwner && ((member != null && item.claimedBy === member.id) || (guest != null && item.claimedByGuest === guest.id)),
    purchased: !isOwner && item.purchased === 1,
  }));
  const hasGuestClaims = !isOwner && guest != null && userItems.some((item) => item.claimedByGuest === guest.id);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
      <h1 className="text-2xl font-bold">{user.firstName}&apos;s Wishlist</h1>
      <p className="mt-1 text-sm text-muted">{userItems.length} {userItems.length === 1 ? "item" : "items"}</p>
      {!isOwner && <p className="mt-3 text-muted">Choose a gift and claim it so others know it&apos;s taken. No signup needed.</p>}
      <PublicWishlist token={token} items={safeItems} isOwner={isOwner} hasGuestClaims={hasGuestClaims} />
    </main>
  );
}
