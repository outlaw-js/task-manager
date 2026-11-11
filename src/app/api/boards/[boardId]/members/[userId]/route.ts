import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { publicUserSelect } from "@/lib/auth";
import { HttpError, handle, readJson, requireBoard } from "@/lib/api";

type Ctx = { params: Promise<{ boardId: string; userId: string }> };

async function findMember(boardId: string, userId: string) {
  const target = await prisma.boardMember.findUnique({ where: { boardId_userId: { boardId, userId } } });
  if (!target) throw new HttpError(404, "عضو پیدا نشد");
  return target;
}

// Only the owner changes roles, between ADMIN and MEMBER.
export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const { boardId, userId } = await params;
  await requireBoard(boardId, { owner: true });
  const body = await readJson(req);
  if (body.role !== "ADMIN" && body.role !== "MEMBER") throw new HttpError(400, "نقش نامعتبر است");

  const target = await findMember(boardId, userId);
  if (target.role === "OWNER") throw new HttpError(400, "نقش مالک برد قابل تغییر نیست");

  const member = await prisma.boardMember.update({
    where: { boardId_userId: { boardId, userId } },
    data: { role: body.role },
    include: { user: { select: publicUserSelect } },
  });
  return NextResponse.json({ member });
});

// The owner can remove anyone except themself, an admin can remove plain
// members, and anyone but the owner can leave on their own.
export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  const { boardId, userId } = await params;
  const { user, role } = await requireBoard(boardId);
  const target = await findMember(boardId, userId);
  if (target.role === "OWNER") throw new HttpError(400, "مالک برد را نمی‌توان حذف کرد");

  const self = user.id === userId;
  const allowed = self || role === "OWNER" || (role === "ADMIN" && target.role === "MEMBER");
  if (!allowed) throw new HttpError(403, "دسترسی ندارید");

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
