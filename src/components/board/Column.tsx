"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useState } from "react";
import { SortableTaskCard } from "./TaskCard";
import { MenuButton, useContextMenu, type MenuEntry } from "../ContextMenu";
import { faNum } from "@/lib/date";
import type { ColumnT, TaskT } from "@/lib/types";

export const columnDropId = (id: string) => `col:${id}`;

const COLUMN_COLORS: [string, string][] = [
  ["#64748b", "خاکستری"],
  ["#3b82f6", "آبی"],
  ["#a855f7", "بنفش"],
  ["#22c55e", "سبز"],
  ["#f59e0b", "نارنجی"],
  ["#ef4444", "قرمز"],
  ["#ec4899", "صورتی"],
  ["#14b8a6", "فیروزه‌ای"],
];

interface Props {
  column: ColumnT;
  tasks: TaskT[];
  total: number;
  isFirst: boolean;
  isLast: boolean;
  canManage: boolean;
  onOpenTask: (t: TaskT) => void;
  onTaskMenu: (e: React.MouseEvent, t: TaskT) => void;
  /** Opens the full task form for this column (so it can be assigned right away). */
  onAddTask: (columnId: string) => void;
  onUpdate: (columnId: string, data: Partial<Pick<ColumnT, "title" | "color">>) => void;
  onMove: (columnId: string, dir: -1 | 1) => void;
  onDelete: (columnId: string) => void;
}

export function Column({ column, tasks, total, isFirst, isLast, canManage, onOpenTask, onTaskMenu, onAddTask, onUpdate, onMove, onDelete }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: columnDropId(column.id), data: { type: "column" } });
  const openMenu = useContextMenu();
  const [renaming, setRenaming] = useState(false);

  const menuItems = (): MenuEntry[] => {
    const items: MenuEntry[] = [{ label: "افزودن تسک", icon: "+", onClick: () => onAddTask(column.id) }];
    if (!canManage) return items;
    return [
      ...items,
      "separator",
      { label: "تغییر نام", onClick: () => setRenaming(true) },
      {
        label: "رنگ ستون",
        icon: <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: column.color }} />,
        children: COLUMN_COLORS.map(([c, name]) => ({
          label: name,
          checked: c === column.color,
          icon: <span className="h-3 w-3 rounded-full" style={{ backgroundColor: c }} />,
          onClick: () => onUpdate(column.id, { color: c }),
        })),
      },
      { label: "انتقال به راست", disabled: isFirst, onClick: () => onMove(column.id, -1) },
      { label: "انتقال به چپ", disabled: isLast, onClick: () => onMove(column.id, 1) },
      "separator",
      { label: "حذف ستون", danger: true, onClick: () => onDelete(column.id) },
    ];
  };

  return (
    <section className="flex max-h-full w-[290px] shrink-0 flex-col rounded-2xl bg-slate-200/60">
      <header className="flex items-center gap-2 px-3 pb-2 pt-3" onContextMenu={(e) => openMenu(e, menuItems())}>
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: column.color }} />
        {renaming ? (
          <input
            autoFocus
            defaultValue={column.title}
            className="input !py-1"
            onBlur={(e) => {
              setRenaming(false);
              const v = e.target.value.trim();
              if (v && v !== column.title) onUpdate(column.id, { title: v });
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") setRenaming(false);
            }}
          />
        ) : (
          <h3 className="min-w-0 flex-1 truncate text-sm font-bold" onDoubleClick={() => canManage && setRenaming(true)}>
            {column.title}
          </h3>
        )}
        <span className="rounded-full bg-white/70 px-2 py-0.5 text-xs font-medium text-slate-500">
          {tasks.length === total ? faNum(total) : `${faNum(tasks.length)} از ${faNum(total)}`}
        </span>
        <MenuButton items={menuItems} label="تنظیمات ستون" />
      </header>

      <div
        ref={setNodeRef}
        className={`scrollbar-thin mx-2 flex min-h-24 flex-1 flex-col gap-2 overflow-y-auto rounded-xl p-1 pb-2 transition-colors ${
          isOver ? "bg-brand-100/60" : ""
        }`}
      >
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((t) => (
            <SortableTaskCard key={t.id} task={t} onOpen={onOpenTask} onContextMenu={onTaskMenu} />
          ))}
        </SortableContext>
        {tasks.length === 0 && (
          <div className="flex flex-1 items-center justify-center rounded-xl border-2 border-dashed border-slate-300/80 py-6 text-xs text-slate-400">
            {total > 0 ? "تسکی با فیلترهای فعلی نیست" : "تسک را اینجا رها کنید"}
          </div>
        )}
      </div>

      <div className="p-2 pt-0">
        <button className="btn-ghost w-full !justify-start text-slate-500" onClick={() => onAddTask(column.id)}>
          <span className="text-lg leading-none">+</span> افزودن تسک
        </button>
      </div>
    </section>
  );
}

