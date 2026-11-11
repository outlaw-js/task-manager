import { notFound, redirect } from "next/navigation";
import { getCurrentUser, isSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Header } from "@/components/Header";
import { BoardView } from "@/components/board/BoardView";

export default async function BoardPage({ params }: { params: Promise<{ boardId: string }> }) {
  const { boardId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/boards/${boardId}`);

  const membership = await prisma.boardMember.findUnique({
    where: { boardId_userId: { boardId, userId: user.id } },
    include: { board: { select: { name: true } } },
  });
  if (!membership) notFound();

  return (
    <div className="flex h-full flex-col">
      <Header user={user} superAdmin={isSuperAdmin(user.email)}>
        <span className="hidden truncate text-sm text-slate-400 sm:block">/ {membership.board.name}</span>
      </Header>
      <BoardView boardId={boardId} me={user} superAdmin={isSuperAdmin(user.email)} />
    </div>
  );
}
