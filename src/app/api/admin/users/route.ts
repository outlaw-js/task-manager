import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isSuperAdmin } from "@/lib/auth";
import { handle, requireSuperAdmin } from "@/lib/api";

/** Super admin: all users, optionally filtered by ?q= on name or email. */
export const GET = handle(async (req: Request) => {
  await requireSuperAdmin();
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 100);
  const users = await prisma.user.findMany({
    where: q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] } : undefined,
    select: {
      id: true,
      name: true,
      email: true,
      color: true,
      avatar: true,
      createdAt: true,
      _count: { select: { memberships: true, ownedBoards: true, assigned: true } },
    },
    orderBy: { createdAt: "asc" },
    take: 500,
  });
  return NextResponse.json({ users: users.map((u) => ({ ...u, superAdmin: isSuperAdmin(u.email) })) });
});
