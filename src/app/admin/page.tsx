import { notFound, redirect } from "next/navigation";
import { getCurrentUser, isSuperAdmin } from "@/lib/auth";
import { Header } from "@/components/Header";
import { UsersAdmin } from "@/components/UsersAdmin";

export const metadata = { title: "مدیریت کاربران | تسک منیجر" };

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin");
  if (!isSuperAdmin(user.email)) notFound();
  return (
    <div className="min-h-full">
      <Header user={user} superAdmin />
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <UsersAdmin meId={user.id} />
      </main>
    </div>
  );
}
