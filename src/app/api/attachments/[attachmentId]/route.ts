import { promises as fs } from "node:fs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { HttpError, handle, requireBoard } from "@/lib/api";
import { requireDiscussion } from "@/lib/comments";
import { removeFiles, resolveKey } from "@/lib/uploads";

type Ctx = { params: Promise<{ attachmentId: string }> };

async function findAttachment(attachmentId: string) {
  const attachment = await prisma.attachment.findUnique({
    where: { id: attachmentId },
    include: { task: { select: { boardId: true, creatorId: true } } },
  });
  if (!attachment) throw new HttpError(404, "فایل پیدا نشد");
  // Files in a comment are as private as the discussion itself.
  const access = attachment.commentId ? await requireDiscussion(attachment.taskId) : await requireBoard(attachment.task.boardId);
  return { attachment, ...access };
}

/** Serves the file to members of the task's board (comment files: discussion participants only). */
export const GET = handle(async (_req: Request, { params }: Ctx) => {
  const { attachmentId } = await params;
  const { attachment } = await findAttachment(attachmentId);
  const data = await fs.readFile(resolveKey(attachment.storageKey)).catch(() => null);
  if (!data) throw new HttpError(404, "فایل پیدا نشد");
  // Images display inline; everything else downloads, so a document can never run as a page on our origin.
  const inline = attachment.mimeType.startsWith("image/");
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": attachment.mimeType.startsWith("text/") ? `${attachment.mimeType}; charset=utf-8` : attachment.mimeType,
      "Content-Length": String(data.length),
      "Cache-Control": "private, max-age=31536000, immutable",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(attachment.name)}`,
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
      "X-Content-Type-Options": "nosniff",
    },
  });
});

/** The uploader, the task's creator or a super admin may remove an image. */
export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  const { attachmentId } = await params;
  const { attachment, user, superAdmin } = await findAttachment(attachmentId);
  if (attachment.uploaderId !== user.id && attachment.task.creatorId !== user.id && !superAdmin) {
    throw new HttpError(403, "فقط آپلودکننده، سازنده تسک یا ادمین کل می‌تواند فایل را حذف کند");
  }
  await prisma.attachment.delete({ where: { id: attachmentId } });
  await removeFiles([attachment.storageKey]);
  return NextResponse.json({ ok: true });
});
