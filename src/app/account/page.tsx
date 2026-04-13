import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getUser } from "@/lib/auth/getUser";
import Nav from "@/components/layout/Nav";
import PasswordForm from "./PasswordForm";
import ShareLinkSection from "./ShareLinkSection";
import PushNotificationToggle from "./PushNotificationToggle";

export const metadata = { title: "Account" };

export default async function AccountPage() {
  const user = await getUser();
  const { env } = getCloudflareContext();

  return (
    <>
      <Nav user={user} />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
        <h1 className="text-2xl font-bold">Account</h1>

        <div className="mt-6 rounded-xl border border-border bg-surface p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Profile</h2>
          <div className="mt-3 space-y-2 text-sm">
            <p><span className="text-muted">Name:</span> {user.firstName} {user.lastName}</p>
            <p><span className="text-muted">Email:</span> {user.email || "Not set"}</p>
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-border bg-surface p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Change Password</h2>
          <PasswordForm />
        </div>

        <div className="mt-6 rounded-xl border border-border bg-surface p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Notifications</h2>
          <PushNotificationToggle />
        </div>

        <div className="mt-6 rounded-xl border border-border bg-surface p-6 shadow-sm">
          <ShareLinkSection userId={user.id} />
        </div>
      </main>
    </>
  );
}
