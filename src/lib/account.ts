import { prisma } from "./prisma";
import { notifyUsers } from "./push";
import { removeAttachmentFiles, removeFiles } from "./uploads";

/**
 * What deleting this account does to the boards it owns: a board that has
 * other members is handed to an admin (or else the longest-standing member);
 * a board with no one else is deleted.
 */
export async function ownedBoardsPlan(userId: string) {
  const boards = await prisma.board.findMany({
    where: { ownerId: userId },
    select: {
      id: true,
      name: true,
      members: {
        where: { userId: { not: userId } },
        orderBy: { joinedAt: "asc" },
        select: { role: true, user: { select: { id: true, name: true } } },
      },
    },
  });
  return boards.map((b) => {
    const heir = b.members.find((m) => m.role === "ADMIN") ?? b.members[0];
    return { id: b.id, name: b.name, newOwner: heir?.user ?? null };
  });
}

export async function deleteAccount(userId: string) {
  const plan = await ownedBoardsPlan(userId);
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, avatar: true } });
  const removedBoards = plan.filter((b) => !b.newOwner).map((b) => b.id);
  if (removedBoards.length) await removeAttachmentFiles({ task: { boardId: { in: removedBoards } } });

  await prisma.$transaction(async (tx) => {
    for (const board of plan) {
      if (board.newOwner) {
        await tx.board.update({ where: { id: board.id }, data: { ownerId: board.newOwner.id } });
        await tx.boardMember.update({
          where: { boardId_userId: { boardId: board.id, userId: board.newOwner.id } },
          data: { role: "OWNER" },
        });
      } else {
        await tx.board.delete({ where: { id: board.id } });
      }
    }
    // Memberships, assignments and push subscriptions go with the user;
    // tasks they created stay, with no creator.
    await tx.user.delete({ where: { id: userId } });
  });

  if (user?.avatar) await removeFiles([user.avatar]);

  for (const board of plan) {
    if (board.newOwner) {
      notifyUsers([board.newOwner.id], {
        title: "مالک برد شدید",
        body: `${user?.name ?? "یک کاربر"} حسابش را حذف کرد و مالکیت «${board.name}» به شما رسید`,
        url: `/boards/${board.id}`,
      });
    }
  }
  return plan;
}
