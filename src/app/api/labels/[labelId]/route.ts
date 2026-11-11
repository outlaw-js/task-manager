import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { HttpError, handle, readJson, requireBoard, str } from "@/lib/api";
import { color } from "@/lib/board";

type Ctx = { params: Promise<{ labelId: string }> };

async function findLabel(labelId: string) {
  const label = await prisma.label.findUnique({ where: { id: labelId } });
  if (!label) throw new HttpError(404, "برچسب پیدا نشد");
  await requireBoard(label.boardId);
  return label;
}

export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const { labelId } = await params;
  await findLabel(labelId);
  const body = await readJson(req);
  const label = await prisma.label.update({
    where: { id: labelId },
    data: {
      ...("name" in body && { name: str(body.name, "نام برچسب", { required: true, max: 40 }) }),
      ...("color" in body && { color: color(body.color) }),
    },
    select: { id: true, name: true, color: true },
  });
  return NextResponse.json({ label });
});

export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  const { labelId } = await params;
  await findLabel(labelId);
  await prisma.label.delete({ where: { id: labelId } });
  return NextResponse.json({ ok: true });
});
