import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { publicUserSelect } from "@/lib/auth";
import { HttpError, handle, requireUser } from "@/lib/api";
import { detectImage, removeFiles, saveImage } from "@/lib/uploads";

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

/** Upload or replace your profile photo (multipart field "file"). */
export const POST = handle(async (req: Request) => {
  const me = await requireUser();
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) throw new HttpError(400, "فایلی ارسال نشده است");
  if (file.size > MAX_AVATAR_BYTES) throw new HttpError(400, "حجم عکس پروفایل باید کمتر از ۲ مگابایت باشد");
  const buf = Buffer.from(await file.arrayBuffer());
  const mime = detectImage(buf);
  if (!mime) throw new HttpError(400, "فقط تصویر (PNG، JPG، WEBP یا GIF) مجاز است");

  const key = await saveImage(`avatars/${me.id}`, buf, mime);
  const user = await prisma.user.update({ where: { id: me.id }, data: { avatar: key }, select: publicUserSelect });
  if (me.avatar && me.avatar !== key) await removeFiles([me.avatar]);
  return NextResponse.json({ user });
});

/** Remove your profile photo (back to initials). */
export const DELETE = handle(async () => {
  const me = await requireUser();
  const user = await prisma.user.update({ where: { id: me.id }, data: { avatar: null }, select: publicUserSelect });
  if (me.avatar) await removeFiles([me.avatar]);
  return NextResponse.json({ user });
});
