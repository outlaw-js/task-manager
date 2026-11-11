import { promises as fs } from "node:fs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { HttpError, handle, requireBoard } from "@/lib/api";
import { removeFiles, resolveKey } from "@/lib/uploads";

type Ctx = { params: Promise<{ attachmentId: string }> };

async function findAttachment(attachmentId: string) {
  const attachment = await prisma.attachment.findUnique({
    where: { id: attachmentId },
    include: { task: { select: { boardId: true, creatorId: true } } },
  });
  if (!attachment) throw new HttpError(404, "تصویر پیدا نشد");
  const access = await requireBoard(attachment.task.boardId);
  return { attachment, ...access };
}

/** Serves the image to members of the task's board only. */
export const GET = handle(async (_req: Request, { params }: Ctx) => {
  const { attachmentId } = await params;
  const { attachment } = await findAttachment(attachmentId);
  const data = await fs.readFile(resolveKey(attachment.storageKey)).catch(() => null);
  if (!data) throw new HttpError(404, "فایل تصویر پیدا نشد");
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": attachment.mimeType,
      "Content-Length": String(data.length),
      "Cache-Control": "private, max-age=31536000, immutable",
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(attachment.name)}`,
      "X-Content-Type-Options": "nosniff",
    },
  });
});

/** The uploader, the task's creator or a super admin may remove an image. */
export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  const { attachmentId } = await params;
  const { attachment, user, superAdmin } = await findAttachment(attachmentId);
  if (attachment.uploaderId !== user.id && attachment.task.creatorId !== user.id && !superAdmin) {
    throw new HttpError(403, "فقط آپلودکننده، سازنده تسک یا ادمین کل می‌تواند تصویر را حذف کند");
  }
  await prisma.attachment.delete({ where: { id: attachmentId } });
  await removeFiles([attachment.storageKey]);
  return NextResponse.json({ ok: true });
});
