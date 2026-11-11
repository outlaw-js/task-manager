import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { HttpError, handle, requireBoard } from "@/lib/api";
import { attachmentSelect } from "@/lib/board";
import { MAX_IMAGES_PER_TASK, MAX_IMAGE_BYTES, cleanName, detectImage, removeFiles, saveImage } from "@/lib/uploads";

type Ctx = { params: Promise<{ taskId: string }> };

/** Upload one image (multipart field "file") to a task. Any board member may attach. */
export const POST = handle(async (req: Request, { params }: Ctx) => {
  const { taskId } = await params;
  const task = await prisma.task.findUnique({ where: { id: taskId }, select: { boardId: true, _count: { select: { attachments: { where: { commentId: null } } } } } });
  if (!task) throw new HttpError(404, "تسک پیدا نشد");
  const { user } = await requireBoard(task.boardId);
  if (task._count.attachments >= MAX_IMAGES_PER_TASK) throw new HttpError(400, `هر تسک حداکثر ${MAX_IMAGES_PER_TASK.toLocaleString("fa-IR")} تصویر می‌تواند داشته باشد`);

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) throw new HttpError(400, "فایلی ارسال نشده است");
  if (file.size > MAX_IMAGE_BYTES) throw new HttpError(400, "حجم تصویر باید کمتر از ۵ مگابایت باشد");

  const buf = Buffer.from(await file.arrayBuffer());
  const mime = detectImage(buf);
  if (!mime) throw new HttpError(400, "فقط تصویر (PNG، JPG، WEBP یا GIF) مجاز است");

  const storageKey = await saveImage(task.boardId, buf, mime);
  try {
    const attachment = await prisma.attachment.create({
      data: { taskId, uploaderId: user.id, name: cleanName(file.name, mime), mimeType: mime, size: buf.length, storageKey },
      select: attachmentSelect,
    });
    return NextResponse.json({ attachment }, { status: 201 });
  } catch (err) {
    await removeFiles([storageKey]);
    throw err;
  }
});
