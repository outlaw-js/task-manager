import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handle, readJson, requireBoard } from "@/lib/api";
import { parseTaskInput, taskInclude } from "@/lib/board";
import { notifyUsers } from "@/lib/push";

type Ctx = { params: Promise<{ boardId: string }> };

export const POST = handle(async (req: Request, { params }: Ctx) => {
  const { boardId } = await params;
  const { user } = await requireBoard(boardId);
  const body = await readJson(req);
  const { assigneeIds, labelIds, columnId, ...fields } = await parseTaskInput(boardId, body, true);

  const last = await prisma.task.findFirst({ where: { columnId }, orderBy: { position: "desc" } });
  const task = await prisma.task.create({
    data: {
      ...fields,
      title: fields.title!,
      boardId,
      columnId: columnId!,
      creatorId: user.id,
      position: (last?.position ?? -1) + 1,
      assignees: { connect: (assigneeIds ?? []).map((id) => ({ id })) },
      labels: { connect: (labelIds ?? []).map((id) => ({ id })) },
    },
    include: taskInclude,
  });

  // Assignees hear "assigned to you"; everyone else on the board hears "new task".
  const [board, members] = await Promise.all([
    prisma.board.findUnique({ where: { id: boardId }, select: { name: true } }),
    prisma.boardMember.findMany({ where: { boardId, userId: { not: user.id } }, select: { userId: true } }),
  ]);
  const url = `/boards/${boardId}?task=${task.id}`;
  const assigned = task.assignees.map((a) => a.id).filter((id) => id !== user.id);
  notifyUsers(assigned, { title: `تسک جدید برای شما · ${board?.name ?? ""}`, body: `${user.name}: ${task.title}`, url, tag: task.id });
  notifyUsers(
    members.map((m) => m.userId).filter((id) => !assigned.includes(id)),
    { title: `تسک جدید · ${board?.name ?? ""}`, body: `${user.name}: ${task.title}`, url, tag: task.id },
  );

  return NextResponse.json({ task }, { status: 201 });
});
