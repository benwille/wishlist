import { notFound } from "next/navigation";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import AcceptInviteForm from "./AcceptInviteForm";

export const metadata = { title: "Set up your account" };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { env } = getCloudflareContext();
  const db = getDb(env.DB);

  const [user] = await db
    .select({ id: users.id, firstName: users.firstName, lastName: users.lastName, inviteExpiresAt: users.inviteExpiresAt })
    .from(users)
    .where(eq(users.inviteToken, token))
    .limit(1);

  if (!user) notFound();

  // Check expiry
  if (user.inviteExpiresAt && new Date(user.inviteExpiresAt) < new Date()) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm text-center">
          <h1 className="text-2xl font-bold text-accent">Invite expired</h1>
          <p className="mt-2 text-sm text-muted">This invite link has expired. Ask the admin to send you a new one.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-primary">Wishlist</h1>
          <p className="mt-2 text-sm text-muted">Set up your account</p>
        </div>

        <div className="rounded-xl bg-surface border border-border p-6 shadow-sm">
          <AcceptInviteForm token={token} firstName={user.firstName} lastName={user.lastName} />
        </div>
      </div>
    </div>
  );
}
