import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { asc } from "drizzle-orm";
import UserList from "./UserList";
import CreateUserForm from "./CreateUserForm";

export const metadata = { title: "Manage Users" };

export default async function AdminUsersPage() {
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
    })
    .from(users)
    .orderBy(asc(users.firstName));

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
      <h1 className="text-2xl font-bold">Users</h1>
      <p className="mt-1 text-sm text-muted">Create, edit, and deactivate user accounts.</p>

      <div className="mt-6 rounded-xl border border-border bg-surface p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4">Add a user</h2>
        <CreateUserForm />
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-semibold mb-4">All users ({allUsers.length})</h2>
        <UserList users={allUsers} />
      </div>
    </main>
  );
}
