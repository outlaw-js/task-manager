import { redirect } from "next/navigation";
import { getCurrentUser, isSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Header } from "@/components/Header";
import { NewBoardButton } from "@/components/NewBoardButton";
import { BoardCard } from "@/components/BoardCard";
import { faNum } from "@/lib/date";

export default async function HomePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const boards = await prisma.board.findMany({
    where: { members: { some: { userId: user.id } } },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { tasks: true } },
      columns: { orderBy: { position: "asc" }, select: { id: true, title: true, color: true, _count: { select: { tasks: true } } } },
      members: { include: { user: { select: { id: true, name: true, color: true, avatar: true } } }, orderBy: { joinedAt: "asc" } },
    },
  });

  const myOpenTasks = await prisma.task.count({ where: { assignees: { some: { id: user.id } } } });

  return (
    <div className="min-h-full">
      <Header user={user} superAdmin={isSuperAdmin(user.email)} />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">سلام {user.name} 👋</h1>
            <p className="mt-1 text-sm text-slate-500">
              {faNum(boards.length)} برد · {faNum(myOpenTasks)} تسک به شما واگذار شده
            </p>
          </div>
          <NewBoardButton />
        </div>

        {boards.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-white/60 p-12 text-center">
            <p className="text-lg font-medium">هنوز بردی ندارید</p>
            <p className="mt-1 text-sm text-slate-500">اولین برد خود را بسازید تا تسک‌ها را مدیریت کنید.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {boards.map((b) => (
              <BoardCard
                key={b.id}
                meId={user.id}
                board={{
                  id: b.id,
                  name: b.name,
                  description: b.description,
                  role: b.members.find((m) => m.userId === user.id)?.role ?? "MEMBER",
                  taskCount: b._count.tasks,
                  columns: b.columns.map((c) => ({ id: c.id, title: c.title, color: c.color, count: c._count.tasks })),
                  members: b.members.map((m) => m.user),
                }}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
