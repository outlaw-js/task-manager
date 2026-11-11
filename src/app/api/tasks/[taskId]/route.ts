import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { HttpError, handle, readJson, requireBoard } from "@/lib/api";
import { parseTaskInput, taskInclude } from "@/lib/board";

type Ctx = { params: Promise<{ taskId: string }> };

async function findTask(taskId: string) {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) throw new HttpError(404, "تسک پیدا نشد");
  await requireBoard(task.boardId);
  return task;
}

export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const { taskId } = await params;
  const existing = await findTask(taskId);
  const body = await readJson(req);
  const { assigneeIds, labelIds, columnId, ...fields } = await parseTaskInput(existing.boardId, body, false);

  // Moving to another column through the edit form appends the task at the end.
  let position: number | undefined;
  if (columnId && columnId !== existing.columnId) {
    const last = await prisma.task.findFirst({ where: { columnId }, orderBy: { position: "desc" } });
    position = (last?.position ?? -1) + 1;
  }

  const task = await prisma.task.update({
    where: { id: taskId },
    data: {
      ...fields,
      ...(columnId && { columnId }),
      ...(position !== undefined && { position }),
      ...(assigneeIds && { assignees: { set: assigneeIds.map((id) => ({ id })) } }),
      ...(labelIds && { labels: { set: labelIds.map((id) => ({ id })) } }),
    },
    include: taskInclude,
  });
  return NextResponse.json({ task });
});

export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  const { taskId } = await params;
  await findTask(taskId);
  await prisma.task.delete({ where: { id: taskId } });
  return NextResponse.json({ ok: true });
});
