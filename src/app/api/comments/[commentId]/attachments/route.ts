import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { HttpError, handle } from "@/lib/api";
import { attachmentSelect } from "@/lib/board";
import { requireDiscussion } from "@/lib/comments";
import { MAX_FILE_BYTES, cleanName, detectFile, removeFiles, saveFile } from "@/lib/uploads";

type Ctx = { params: Promise<{ commentId: string }> };

const MAX_FILES_PER_COMMENT = 10;

/** Attach one file (multipart "file": image or document) to your own comment. */
export const POST = handle(async (req: Request, { params }: Ctx) => {
  const { commentId } = await params;
  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: { taskId: true, authorId: true, _count: { select: { attachments: true } } },
  });
  if (!comment) throw new HttpError(404, "کامنت پیدا نشد");
  const { task, user } = await requireDiscussion(comment.taskId);
  if (comment.authorId !== user.id) throw new HttpError(403, "فقط نویسنده می‌تواند به کامنت پیوست اضافه کند");
  if (comment._count.attachments >= MAX_FILES_PER_COMMENT) throw new HttpError(400, "هر کامنت حداکثر ۱۰ پیوست می‌تواند داشته باشد");

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) throw new HttpError(400, "فایلی ارسال نشده است");
  if (file.size > MAX_FILE_BYTES) throw new HttpError(400, "حجم فایل باید کمتر از ۸ مگابایت باشد");

  const buf = Buffer.from(await file.arrayBuffer());
  const detected = detectFile(buf, file.name);
  if (!detected) throw new HttpError(400, "نوع فایل مجاز نیست (تصویر، PDF، Word، Excel، PowerPoint، ZIP، RAR یا متن)");

  const storageKey = await saveFile(task.boardId, buf, detected.ext);
  try {
    const attachment = await prisma.attachment.create({
      data: {
        taskId: comment.taskId,
        commentId,
        uploaderId: user.id,
        name: cleanName(file.name, detected.ext),
        mimeType: detected.mime,
        size: buf.length,
        storageKey,
      },
      select: attachmentSelect,
    });
    return NextResponse.json({ attachment }, { status: 201 });
  } catch (err) {
    await removeFiles([storageKey]);
    throw err;
  }
});
