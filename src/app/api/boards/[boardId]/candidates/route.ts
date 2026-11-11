import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { publicUserSelect } from "@/lib/auth";
import { handle, requireBoard } from "@/lib/api";

type Ctx = { params: Promise<{ boardId: string }> };

/** Autocomplete for "add member": existing accounts matching ?q= by name or email, minus current members. */
export const GET = handle(async (req: Request, { params }: Ctx) => {
  const { boardId } = await params;
  await requireBoard(boardId, { manage: true });
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 100);
  if (!q) return NextResponse.json({ users: [] });

  const users = await prisma.user.findMany({
    where: {
      memberships: { none: { boardId } },
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
      ],
    },
    select: publicUserSelect,
    orderBy: { name: "asc" },
    take: 8,
  });
  return NextResponse.json({ users });
});
