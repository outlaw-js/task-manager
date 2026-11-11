// Seeds demo users and a sample board. Safe to re-run: it resets the demo board.
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const DEMO_PASSWORD = "demo1234";

const people = [
  { name: "مدیر سیستم", email: "admin@example.com", color: "#6366f1" },
  { name: "سارا احمدی", email: "sara@example.com", color: "#ec4899" },
  { name: "علی رضایی", email: "ali@example.com", color: "#10b981" },
];

const day = (n, hour = 18) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(hour, 0, 0, 0);
  return d;
};

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const users = [];
  for (const p of people) {
    users.push(await prisma.user.upsert({ where: { email: p.email }, update: {}, create: { ...p, passwordHash } }));
  }
  const [admin, sara, ali] = users;

  await prisma.board.deleteMany({ where: { name: "پروژه وب‌سایت شرکت", ownerId: admin.id } });
  const board = await prisma.board.create({
    data: {
      name: "پروژه وب‌سایت شرکت",
      description: "طراحی و پیاده‌سازی نسخه جدید وب‌سایت",
      ownerId: admin.id,
      members: {
        create: [
          { userId: admin.id, role: "OWNER" },
          { userId: sara.id },
          { userId: ali.id },
        ],
      },
      columns: {
        create: [
          { title: "برای انجام", color: "#64748b", position: 0 },
          { title: "در حال انجام", color: "#3b82f6", position: 1 },
          { title: "بازبینی", color: "#a855f7", position: 2 },
          { title: "انجام شده", color: "#22c55e", position: 3 },
        ],
      },
      labels: {
        create: [
          { name: "باگ", color: "#ef4444" },
          { name: "ویژگی جدید", color: "#3b82f6" },
          { name: "طراحی", color: "#ec4899" },
          { name: "مستندات", color: "#14b8a6" },
        ],
      },
    },
    include: { columns: { orderBy: { position: "asc" } }, labels: true },
  });

  const col = board.columns;
  const label = Object.fromEntries(board.labels.map((l) => [l.name, l.id]));
  const tasks = [
    { title: "طراحی صفحه اصلی", description: "وایرفریم و طرح نهایی صفحه اصلی در فیگما", priority: "HIGH", deadline: day(3), column: 0, assignees: [sara], labels: ["طراحی"] },
    { title: "نوشتن مستندات API", priority: "LOW", deadline: day(10), column: 0, assignees: [ali], labels: ["مستندات"] },
    { title: "صفحه تماس با ما", priority: "MEDIUM", column: 0, assignees: [], labels: ["ویژگی جدید"] },
    { title: "پیاده‌سازی ورود کاربران", description: "ورود با ایمیل و رمز عبور، همراه با بازیابی رمز", priority: "URGENT", deadline: day(1), column: 1, assignees: [ali, admin], labels: ["ویژگی جدید"] },
    { title: "رفع مشکل نمایش در موبایل", priority: "HIGH", deadline: day(-1), column: 1, assignees: [sara], labels: ["باگ"] },
    { title: "بهینه‌سازی تصاویر", priority: "MEDIUM", deadline: day(5), column: 2, assignees: [ali], labels: [] },
    { title: "راه‌اندازی دیتابیس", priority: "HIGH", column: 3, assignees: [admin], labels: [] },
  ];

  const positions = {};
  for (const t of tasks) {
    const columnId = col[t.column].id;
    positions[columnId] = (positions[columnId] ?? -1) + 1;
    await prisma.task.create({
      data: {
        title: t.title,
        description: t.description,
        priority: t.priority,
        deadline: t.deadline,
        position: positions[columnId],
        boardId: board.id,
        columnId,
        creatorId: admin.id,
        assignees: { connect: t.assignees.map((u) => ({ id: u.id })) },
        labels: { connect: t.labels.map((n) => ({ id: label[n] })) },
      },
    });
  }
  console.log(`Seeded ${users.length} users and board "${board.name}" with ${tasks.length} tasks.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
