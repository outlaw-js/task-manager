import { promises as fs } from "node:fs";
import { prisma } from "@/lib/prisma";
import { HttpError, handle, requireUser } from "@/lib/api";
import { resolveKey } from "@/lib/uploads";

type Ctx = { params: Promise<{ userId: string }> };

const TYPES: Record<string, string> = { png: "image/png", jpg: "image/jpeg", gif: "image/gif", webp: "image/webp" };

/** Profile photos are visible to any signed-in user (like names). The URL carries a version, so it caches long. */
export const GET = handle(async (_req: Request, { params }: Ctx) => {
  await requireUser();
  const { userId } = await params;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { avatar: true } });
  if (!user?.avatar) throw new HttpError(404, "عکس پروفایل وجود ندارد");
  const data = await fs.readFile(resolveKey(user.avatar)).catch(() => null);
  if (!data) throw new HttpError(404, "عکس پروفایل وجود ندارد");
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": TYPES[user.avatar.split(".").pop() ?? ""] ?? "application/octet-stream",
      "Content-Length": String(data.length),
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
});
