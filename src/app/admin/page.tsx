import Link from "next/link";

export const metadata = { title: "Admin" };

export default function AdminPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
      <h1 className="text-2xl font-bold">Admin</h1>
      <p className="mt-1 text-sm text-muted">Manage users, groups, and exchanges.</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Link href="/admin/users"
          className="rounded-xl border border-border bg-surface p-5 shadow-sm hover:border-primary hover:shadow-md transition-all">
          <h2 className="font-semibold">Users</h2>
          <p className="mt-1 text-sm text-muted">Create, edit, and deactivate users</p>
        </Link>
        <Link href="/admin/groups"
          className="rounded-xl border border-border bg-surface p-5 shadow-sm hover:border-primary hover:shadow-md transition-all">
          <h2 className="font-semibold">Exchange Groups</h2>
          <p className="mt-1 text-sm text-muted">Manage groups, exclusions, and run exchanges</p>
        </Link>
        <Link href="/admin/notifications"
          className="rounded-xl border border-border bg-surface p-5 shadow-sm hover:border-primary hover:shadow-md transition-all">
          <h2 className="font-semibold">Notifications</h2>
          <p className="mt-1 text-sm text-muted">Send push notifications and view subscriptions</p>
        </Link>
      </div>
    </main>
  );
}
