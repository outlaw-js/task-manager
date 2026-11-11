import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { HttpError, handle, requireBoard } from "@/lib/api";

type Ctx = { params: Promise<{ boardId: string; userId: string }> };

// The owner can remove anyone except themself; a member can leave on their own.
export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  const { boardId, userId } = await params;
  const { user, role } = await requireBoard(boardId);
  if (role !== "OWNER" && user.id !== userId) throw new HttpError(403, "دسترسی ندارید");

  const target = await prisma.boardMember.findUnique({ where: { boardId_userId: { boardId, userId } } });
  if (!target) throw new HttpError(404, "عضو پیدا نشد");
  if (target.role === "OWNER") throw new HttpError(400, "مالک برد را نمی‌توان حذف کرد");

  await prisma.$transaction(async (tx) => {
    // Unassign the person from this board's tasks before removing them.
    const tasks = await tx.task.findMany({
      where: { boardId, assignees: { some: { id: userId } } },
      select: { id: true },
    });
    for (const t of tasks) {
      await tx.task.update({ where: { id: t.id }, data: { assignees: { disconnect: { id: userId } } } });
    }
    await tx.boardMember.delete({ where: { boardId_userId: { boardId, userId } } });
  });
  return NextResponse.json({ ok: true });
});
