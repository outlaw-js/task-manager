import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { HttpError, handle, readJson, str } from "@/lib/api";
import { commentInclude, requireDiscussion } from "@/lib/comments";
import { removeAttachmentFiles } from "@/lib/uploads";

type Ctx = { params: Promise<{ commentId: string }> };

async function findComment(commentId: string) {
  const comment = await prisma.comment.findUnique({ where: { id: commentId }, select: { id: true, taskId: true, authorId: true } });
  if (!comment) throw new HttpError(404, "کامنت پیدا نشد");
  const access = await requireDiscussion(comment.taskId);
  return { comment, ...access };
}

/** Edit your own comment's text. */
export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const { commentId } = await params;
  const { comment, user } = await findComment(commentId);
  if (comment.authorId !== user.id) throw new HttpError(403, "فقط نویسنده می‌تواند کامنت را ویرایش کند");
  const body = await readJson(req);
  const text = str(body.body, "متن", { required: true, max: 5000 })!;
  const updated = await prisma.comment.update({ where: { id: commentId }, data: { body: text, editedAt: new Date() }, include: commentInclude });
  return NextResponse.json({ comment: updated });
});

/** The author or a super admin may delete a comment (with its files). */
export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  const { commentId } = await params;
  const { comment, user, superAdmin } = await findComment(commentId);
  if (comment.authorId !== user.id && !superAdmin) throw new HttpError(403, "فقط نویسنده یا ادمین کل می‌تواند کامنت را حذف کند");
  await removeAttachmentFiles({ commentId });
  await prisma.comment.delete({ where: { id: commentId } });
  return NextResponse.json({ ok: true });
});
