import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handle, readJson, requireBoard, str } from "@/lib/api";
import { loadBoard } from "@/lib/board";

type Ctx = { params: Promise<{ boardId: string }> };

export const GET = handle(async (_req: Request, { params }: Ctx) => {
  const { boardId } = await params;
  const { user } = await requireBoard(boardId);
  const board = await loadBoard(boardId);
  return NextResponse.json({ board, me: user });
});

export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const { boardId } = await params;
  await requireBoard(boardId, { manage: true });
  const body = await readJson(req);
  const board = await prisma.board.update({
    where: { id: boardId },
    data: {
      ...("name" in body && { name: str(body.name, "نام برد", { required: true, max: 100 }) }),
      ...("description" in body && { description: str(body.description, "توضیحات", { max: 1000 }) ?? null }),
    },
  });
  return NextResponse.json({ board });
});

export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  const { boardId } = await params;
  await requireBoard(boardId, { owner: true });
  await prisma.board.delete({ where: { id: boardId } });
  return NextResponse.json({ ok: true });
});
