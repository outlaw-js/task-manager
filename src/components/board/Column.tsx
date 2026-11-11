"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useEffect, useRef, useState } from "react";
import { SortableTaskCard } from "./TaskCard";
import { faNum } from "@/lib/date";
import type { ColumnT, TaskT } from "@/lib/types";

export const columnDropId = (id: string) => `col:${id}`;

const COLUMN_COLORS = ["#64748b", "#3b82f6", "#a855f7", "#22c55e", "#f59e0b", "#ef4444", "#ec4899", "#14b8a6"];

interface Props {
  column: ColumnT;
  tasks: TaskT[];
  total: number;
  isFirst: boolean;
  isLast: boolean;
  onOpenTask: (t: TaskT) => void;
  onQuickAdd: (columnId: string, title: string) => Promise<void>;
  onUpdate: (columnId: string, data: Partial<Pick<ColumnT, "title" | "color">>) => void;
  onMove: (columnId: string, dir: -1 | 1) => void;
  onDelete: (columnId: string) => void;
}

export function Column({ column, tasks, total, isFirst, isLast, onOpenTask, onQuickAdd, onUpdate, onMove, onDelete }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: columnDropId(column.id), data: { type: "column" } });
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => !menuRef.current?.contains(e.target as Node) && setMenuOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpen]);

  async function submitQuickAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    await onQuickAdd(column.id, title.trim());
    setTitle("");
  }

  return (
    <section className="flex max-h-full w-[290px] shrink-0 flex-col rounded-2xl bg-slate-200/60">
      <header className="flex items-center gap-2 px-3 pb-2 pt-3">
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
          <h3 className="min-w-0 flex-1 truncate text-sm font-bold" onDoubleClick={() => setRenaming(true)}>
            {column.title}
          </h3>
        )}
        <span className="rounded-full bg-white/70 px-2 py-0.5 text-xs font-medium text-slate-500">
          {tasks.length === total ? faNum(total) : `${faNum(tasks.length)} از ${faNum(total)}`}
        </span>
        <div className="relative" ref={menuRef}>
          <button className="btn-ghost !p-1" onClick={() => setMenuOpen((v) => !v)} aria-label="تنظیمات ستون">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="5" cy="12" r="1.8" />
              <circle cx="12" cy="12" r="1.8" />
              <circle cx="19" cy="12" r="1.8" />
            </svg>
          </button>
          {menuOpen && (
            <div className="absolute left-0 top-8 z-20 w-48 rounded-xl border border-slate-200 bg-white p-1.5 text-sm shadow-lg">
              <MenuItem onClick={() => (setRenaming(true), setMenuOpen(false))}>تغییر نام</MenuItem>
              <MenuItem disabled={isFirst} onClick={() => (onMove(column.id, -1), setMenuOpen(false))}>انتقال به راست</MenuItem>
              <MenuItem disabled={isLast} onClick={() => (onMove(column.id, 1), setMenuOpen(false))}>انتقال به چپ</MenuItem>
              <div className="flex flex-wrap gap-1.5 px-2 py-2">
                {COLUMN_COLORS.map((c) => (
                  <button
                    key={c}
                    className={`h-5 w-5 rounded-full ${c === column.color ? "ring-2 ring-slate-400 ring-offset-1" : ""}`}
                    style={{ backgroundColor: c }}
                    onClick={() => onUpdate(column.id, { color: c })}
                    aria-label="رنگ ستون"
                  />
                ))}
              </div>
              <MenuItem danger onClick={() => (onDelete(column.id), setMenuOpen(false))}>حذف ستون</MenuItem>
            </div>
          )}
        </div>
      </header>

      <div
        ref={setNodeRef}
        className={`scrollbar-thin mx-2 flex min-h-24 flex-1 flex-col gap-2 overflow-y-auto rounded-xl p-1 pb-2 transition-colors ${
          isOver ? "bg-brand-100/60" : ""
        }`}
      >
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((t) => (
            <SortableTaskCard key={t.id} task={t} onOpen={onOpenTask} />
          ))}
        </SortableContext>
        {tasks.length === 0 && (
          <div className="flex flex-1 items-center justify-center rounded-xl border-2 border-dashed border-slate-300/80 py-6 text-xs text-slate-400">
            {total > 0 ? "تسکی با فیلترهای فعلی نیست" : "تسک را اینجا رها کنید"}
          </div>
        )}
      </div>

      <div className="p-2 pt-0">
        {adding ? (
          <form onSubmit={submitQuickAdd} className="space-y-2">
            <textarea
              autoFocus
              className="input min-h-16 resize-none"
              placeholder="عنوان تسک…"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) submitQuickAdd(e);
                if (e.key === "Escape") setAdding(false);
              }}
            />
            <div className="flex gap-2">
              <button className="btn-primary !py-1.5">افزودن</button>
              <button type="button" className="btn-ghost !py-1.5" onClick={() => setAdding(false)}>انصراف</button>
            </div>
          </form>
        ) : (
          <button className="btn-ghost w-full !justify-start text-slate-500" onClick={() => setAdding(true)}>
            <span className="text-lg leading-none">+</span> افزودن تسک
          </button>
        )}
      </div>
    </section>
  );
}

function MenuItem({ children, onClick, disabled, danger }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={`block w-full rounded-lg px-2.5 py-1.5 text-right transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 ${
        danger ? "text-red-600 hover:bg-red-50" : ""
      }`}
    >
      {children}
    </button>
  );
}
