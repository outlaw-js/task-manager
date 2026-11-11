"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AvatarStack } from "./Avatar";
import { MenuButton, useContextMenu, type MenuEntry } from "./ContextMenu";
import { useToast } from "./Toast";
import { api, errorMessage } from "@/lib/client";
import { faNum } from "@/lib/date";
import { ROLE_LABELS, canManage, type Role } from "@/lib/types";

export interface BoardCardData {
  id: string;
  name: string;
  description: string | null;
  role: Role;
  taskCount: number;
  columns: { id: string; title: string; color: string; count: number }[];
  members: { id: string; name: string; color: string }[];
}

export function BoardCard({ board, meId }: { board: BoardCardData; meId: string }) {
  const router = useRouter();
  const notify = useToast();
  const openMenu = useContextMenu();
  const href = `/boards/${board.id}`;

  async function run(fn: () => Promise<unknown>, success?: string) {
    try {
      await fn();
      if (success) notify(success, "success");
      router.refresh();
    } catch (err) {
      notify(errorMessage(err));
    }
  }

  function rename() {
    const name = prompt("نام جدید برد:", board.name)?.trim();
    if (name && name !== board.name) run(() => api(`/api/boards/${board.id}`, { method: "PATCH", body: { name } }));
  }

  function remove() {
    if (!confirm(`برد «${board.name}» با همه‌ی ستون‌ها و ${faNum(board.taskCount)} تسکش برای همیشه حذف شود؟\nاین کار قابل بازگشت نیست.`)) return;
    run(() => api(`/api/boards/${board.id}`, { method: "DELETE" }), "برد حذف شد");
  }

  function leave() {
    if (!confirm(`از برد «${board.name}» خارج می‌شوید؟`)) return;
    run(() => api(`/api/boards/${board.id}/members/${meId}`, { method: "DELETE" }), "از برد خارج شدید");
  }

  const items = (): MenuEntry[] => [
    { label: "باز کردن", onClick: () => router.push(href) },
    { label: "باز کردن در تب جدید", onClick: () => window.open(href, "_blank") },
    { label: "کپی لینک", onClick: () => navigator.clipboard?.writeText(location.origin + href).then(() => notify("لینک کپی شد", "success")) },
    ...(canManage(board.role) ? (["separator", { label: "تغییر نام", onClick: rename }] as MenuEntry[]) : []),
    "separator",
    board.role === "OWNER" ? { label: "حذف برد", danger: true, onClick: remove } : { label: "خروج از برد", danger: true, onClick: leave },
  ];

  return (
    <Link
      href={href}
      onContextMenu={(e) => openMenu(e, items())}
      className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-500/40 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <h2 className="font-bold group-hover:text-brand-700">{board.name}</h2>
        <div className="flex shrink-0 items-center gap-1">
          {board.role !== "MEMBER" && (
            <span className={`chip ${board.role === "OWNER" ? "bg-brand-50 text-brand-700" : "bg-amber-50 text-amber-700"}`}>{ROLE_LABELS[board.role]}</span>
          )}
          <MenuButton items={items} label="گزینه‌های برد" className="-my-1 opacity-60 group-hover:opacity-100" />
        </div>
      </div>
      {board.description && <p className="mt-1 line-clamp-2 text-sm text-slate-500">{board.description}</p>}
      <div className="mt-4 flex h-2 overflow-hidden rounded-full bg-slate-100">
        {board.taskCount > 0 &&
          board.columns.map((c) => (
            <span key={c.id} title={`${c.title}: ${faNum(c.count)}`} style={{ width: `${(c.count / board.taskCount) * 100}%`, backgroundColor: c.color }} />
          ))}
      </div>
      <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
        <span>{faNum(board.taskCount)} تسک</span>
        <AvatarStack users={board.members} max={4} />
      </div>
    </Link>
  );
}
