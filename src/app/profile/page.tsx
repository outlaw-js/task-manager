import { redirect } from "next/navigation";
import { getCurrentUser, isSuperAdmin } from "@/lib/auth";
import { Header } from "@/components/Header";
import { ProfileView } from "@/components/ProfileView";

export const metadata = { title: "پروفایل | تسک منیجر" };

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/profile");
  return (
    <div className="min-h-full">
      <Header user={user} superAdmin={isSuperAdmin(user.email)} />
      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <ProfileView user={user} />
      </main>
    </div>
  );
}
