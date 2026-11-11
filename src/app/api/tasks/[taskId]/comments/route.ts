import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { HttpError, handle, readJson, str } from "@/lib/api";
import { commentInclude, requireDiscussion } from "@/lib/comments";
import { notifyUsers } from "@/lib/push";

type Ctx = { params: Promise<{ taskId: string }> };

export const GET = handle(async (_req: Request, { params }: Ctx) => {
  const { taskId } = await params;
  await requireDiscussion(taskId);
  const comments = await prisma.comment.findMany({ where: { taskId }, include: commentInclude, orderBy: { createdAt: "asc" }, take: 500 });
  return NextResponse.json({ comments });
});

/**
 * Posts a comment. Files are uploaded afterwards to /api/comments/<id>/attachments;
 * pass `withFiles: true` to post a comment that is only attachments (empty text).
 */
export const POST = handle(async (req: Request, { params }: Ctx) => {
  const { taskId } = await params;
  const { task, participants, user } = await requireDiscussion(taskId);
  const body = await readJson(req);
  const text = str(body.body, "متن", { max: 5000 }) ?? "";
  if (!text && body.withFiles !== true) throw new HttpError(400, "متن کامنت خالی است");

  const comment = await prisma.comment.create({
    data: { taskId, authorId: user.id, body: text },
    include: commentInclude,
  });

  notifyUsers(
    participants.filter((id) => id !== user.id),
    {
      title: `کامنت جدید · ${task.title}`,
      body: `${user.name}: ${text ? text.slice(0, 140) : "📎 پیوست"}`,
      url: `/boards/${task.boardId}?task=${task.id}`,
      tag: `comments-${task.id}`,
    },
  );
  return NextResponse.json({ comment }, { status: 201 });
});
