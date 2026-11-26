import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/lib/db";
import { getUser } from "@/lib/auth/getUser";
import { profileRows } from "@/lib/people";
import PeopleEditor from "@/components/PeopleEditor";
import Nav from "@/components/layout/Nav";
export const metadata = { title: "My Profiles" };
export default async function MyPeople() {
  const user = await getUser();
  const { env } = getCloudflareContext();
  const records = await profileRows(getDb(env.DB), { ...user, isAdmin: false });
  return (
    <>
      <Nav user={user} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <h1 className="text-2xl font-bold">My Profiles</h1>
        <p className="mt-2 text-muted">
          Your profile and children explicitly linked to your account. Ask the
          administrator to create children or update adult links.
        </p>
        <PeopleEditor records={records} adults={[]} admin={false} />
      </main>
    </>
  );
}
