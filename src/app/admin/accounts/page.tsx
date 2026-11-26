import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth/getUser";
import Link from "next/link";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { asc } from "drizzle-orm";
import UserList from "../users/UserList";
import CreateUserForm from "../users/CreateUserForm";

export const metadata = { title: "Manage Users" };

export default async function AdminUsersPage() {
  const viewer = await getUser();
  if (!viewer.isAdmin) redirect("/");
  const { env } = getCloudflareContext();
  const db = getDb(env.DB);

  const allUsers = await db
    .select({
      id: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
      email: users.email,
      isAdmin: users.isAdmin,
      active: users.active,
      inviteToken: users.inviteToken,
    })
    .from(users)
    .orderBy(asc(users.firstName));

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
      <Link
        href="/admin/people"
        className="mb-4 inline-block text-primary hover:underline"
      >
        Back to People
      </Link>
      <h1 className="text-2xl font-bold">Adult Accounts</h1>
      <p className="mt-1 text-sm text-muted">
        Create, edit, deactivate, and delete user accounts.
      </p>

      <div className="mt-6 rounded-xl border border-border bg-surface p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4">Add a user</h2>
        <CreateUserForm />
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-semibold mb-4">
          Active users (
          {allUsers.filter((u) => u.active || u.inviteToken).length})
        </h2>
        <UserList users={allUsers} />
      </div>
    </main>
  );
}
