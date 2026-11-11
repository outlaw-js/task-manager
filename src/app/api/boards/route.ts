import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handle, readJson, requireUser, str } from "@/lib/api";

const DEFAULT_COLUMNS = [
  { title: "برای انجام", color: "#64748b" },
  { title: "در حال انجام", color: "#3b82f6" },
  { title: "بازبینی", color: "#a855f7" },
  { title: "انجام شده", color: "#22c55e" },
];

const DEFAULT_LABELS = [
  { name: "باگ", color: "#ef4444" },
  { name: "ویژگی جدید", color: "#3b82f6" },
  { name: "طراحی", color: "#ec4899" },
  { name: "مستندات", color: "#14b8a6" },
];

export const GET = handle(async () => {
  const user = await requireUser();
  const boards = await prisma.board.findMany({
    where: { members: { some: { userId: user.id } } },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { tasks: true, members: true } },
      members: { take: 5, include: { user: { select: { id: true, name: true, color: true } } } },
    },
  });
  return NextResponse.json({ boards });
});

export const POST = handle(async (req: Request) => {
  const user = await requireUser();
  const body = await readJson(req);
  const name = str(body.name, "نام برد", { required: true, max: 100 })!;
  const description = str(body.description, "توضیحات", { max: 1000 });

  const board = await prisma.board.create({
    data: {
      name,
      description,
      ownerId: user.id,
      members: { create: { userId: user.id, role: "OWNER" } },
      columns: { create: DEFAULT_COLUMNS.map((c, i) => ({ ...c, position: i })) },
      labels: { create: DEFAULT_LABELS },
    },
  });
  return NextResponse.json({ board }, { status: 201 });
});
