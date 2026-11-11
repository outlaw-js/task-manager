import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { HttpError, handle, readJson, requireBoard } from "@/lib/api";
import { parseTaskInput, taskInclude } from "@/lib/board";
import { notifyUsers } from "@/lib/push";
import { removeAttachmentFiles } from "@/lib/uploads";

type Ctx = { params: Promise<{ taskId: string }> };

async function findTask(taskId: string) {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) throw new HttpError(404, "تسک پیدا نشد");
  const { user, role, superAdmin } = await requireBoard(task.boardId);
  return { task, user, role, superAdmin };
}

export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const { taskId } = await params;
  const { task: existing, user } = await findTask(taskId);
  const body = await readJson(req);
  const { assigneeIds, labelIds, columnId, ...fields } = await parseTaskInput(existing.boardId, body, false);

  // Moving to another column through the edit form appends the task at the end.
  let position: number | undefined;
  if (columnId && columnId !== existing.columnId) {
    const last = await prisma.task.findFirst({ where: { columnId }, orderBy: { position: "desc" } });
    position = (last?.position ?? -1) + 1;
  }

  const before = assigneeIds
    ? (await prisma.task.findUnique({ where: { id: taskId }, select: { assignees: { select: { id: true } } } }))?.assignees.map((a) => a.id) ?? []
    : [];

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

  // People newly assigned by someone else get a notification.
  const added = (assigneeIds ?? []).filter((id) => !before.includes(id) && id !== user.id);
  if (added.length) {
    const board = await prisma.board.findUnique({ where: { id: task.boardId }, select: { name: true } });
    notifyUsers(added, {
      title: `تسک به شما واگذار شد · ${board?.name ?? ""}`,
      body: `${user.name}: ${task.title}`,
      url: `/boards/${task.boardId}?task=${task.id}`,
      tag: task.id,
    });
  }
  return NextResponse.json({ task });
});

export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  const { taskId } = await params;
  const { task, user, superAdmin } = await findTask(taskId);
  // Only the task's creator or a super admin may delete it.
  if (task.creatorId !== user.id && !superAdmin) {
    throw new HttpError(403, "فقط سازنده تسک یا ادمین کل می‌تواند آن را حذف کند");
  }
  await removeAttachmentFiles({ taskId });
  await prisma.task.delete({ where: { id: taskId } });
  return NextResponse.json({ ok: true });
});
