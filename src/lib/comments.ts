import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { publicUserSelect } from "./auth";
import { HttpError, requireBoard } from "./api";
import { attachmentSelect } from "./board";

export const commentInclude = {
  author: { select: publicUserSelect },
  attachments: { select: attachmentSelect, orderBy: { createdAt: "asc" } },
} satisfies Prisma.CommentInclude;

/**
 * A task's discussion is for its creator and assignees (and super admins).
 * Returns the task with who is involved, after checking the caller may join in.
 */
export async function requireDiscussion(taskId: string) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { id: true, title: true, boardId: true, creatorId: true, assignees: { select: { id: true } } },
  });
  if (!task) throw new HttpError(404, "تسک پیدا نشد");
  const access = await requireBoard(task.boardId);
  const participants = [...new Set([task.creatorId, ...task.assignees.map((a) => a.id)].filter(Boolean) as string[])];
  if (!participants.includes(access.user.id) && !access.superAdmin) {
    throw new HttpError(403, "گفتگوی این تسک فقط برای سازنده و مسئولین آن است");
  }
  return { task, participants, ...access };
}
