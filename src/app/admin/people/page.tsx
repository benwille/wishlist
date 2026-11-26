import { redirect } from "next/navigation";
import Link from "next/link";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/lib/db";
import { getUser } from "@/lib/auth/getUser";
import { profileRows, guardianChoices } from "@/lib/people";
import PeopleEditor from "@/components/PeopleEditor";
export const metadata = { title: "People" };
export default async function AdminPeople() {
  const user = await getUser();
  if (!user.isAdmin) redirect("/people");
  const { env } = getCloudflareContext();
  const db = getDb(env.DB);
  const records = await profileRows(db, user),
    adults = await guardianChoices(db, user);
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
      <Link href="/admin" className="text-primary hover:underline">
        Back to Admin
      </Link>
      <h1 className="mt-4 text-2xl font-bold">People</h1>
      <p className="mt-2 text-muted">
        One profile for each adult or child, reusable across family and friend
        groups.
      </p>
      <PeopleEditor records={records} adults={adults} admin />
      <Link
        href="/admin/groups"
        className="mt-6 inline-block text-primary hover:underline"
      >
        Manage groups and exchange participation
      </Link>
    </main>
  );
}
