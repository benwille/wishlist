import { getUser } from "@/lib/auth/getUser";
import { redirect } from "next/navigation";
import Nav from "@/components/layout/Nav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();

  if (!user.isAdmin) {
    redirect("/");
  }

  return (
    <>
      <Nav user={user} />
      {children}
    </>
  );
}
