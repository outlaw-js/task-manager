import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handle, readJson, requireBoard } from "@/lib/api";
import { parseTaskInput, taskInclude } from "@/lib/board";

type Ctx = { params: Promise<{ boardId: string }> };

export const POST = handle(async (req: Request, { params }: Ctx) => {
  const { boardId } = await params;
  const { user } = await requireBoard(boardId);
  const body = await readJson(req);
  const { assigneeIds, labelIds, columnId, ...fields } = await parseTaskInput(boardId, body, true);

  const last = await prisma.task.findFirst({ where: { columnId }, orderBy: { position: "desc" } });
  const task = await prisma.task.create({
    data: {
      ...fields,
      title: fields.title!,
      boardId,
      columnId: columnId!,
      creatorId: user.id,
      position: (last?.position ?? -1) + 1,
      assignees: { connect: (assigneeIds ?? []).map((id) => ({ id })) },
      labels: { connect: (labelIds ?? []).map((id) => ({ id })) },
    },
    include: taskInclude,
  });
  return NextResponse.json({ task }, { status: 201 });
});
