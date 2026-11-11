"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AvatarStack } from "../Avatar";
import { deadlineState, formatFull, formatShort } from "@/lib/date";
import { priorityMeta, type TaskT } from "@/lib/types";

const DEADLINE_STYLES = {
  overdue: "bg-red-50 text-red-700",
  soon: "bg-amber-50 text-amber-700",
  later: "bg-slate-100 text-slate-600",
};

export function TaskCardBody({ task, dragging }: { task: TaskT; dragging?: boolean }) {
  const p = priorityMeta(task.priority);
  const state = task.deadline ? deadlineState(task.deadline) : null;
  return (
    <div
      className={`group relative rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition hover:border-slate-300 hover:shadow ${
        dragging ? "rotate-2 cursor-grabbing shadow-xl ring-2 ring-brand-500/40" : "cursor-grab"
      }`}
    >
      <span className="absolute inset-y-3 right-0 w-1 rounded-l-full" style={{ backgroundColor: p.color }} />
      {task.labels.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {task.labels.map((l) => (
            <span key={l.id} className="chip text-[11px]" style={{ backgroundColor: `${l.color}1f`, color: l.color }}>
              {l.name}
            </span>
          ))}
        </div>
      )}
      <p className="text-sm font-medium leading-6 text-slate-800">{task.title}</p>
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[11px]">
        <span className="chip" style={{ backgroundColor: `${p.color}17`, color: p.color }}>
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: p.color }} />
          {p.label}
        </span>
        {task.deadline && state && (
          <span className={`chip ${DEADLINE_STYLES[state]}`} title={formatFull(task.deadline)}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" />
            </svg>
            {formatShort(task.deadline)}
          </span>
        )}
        {task.description && (
          <span className="text-slate-400" title="دارای توضیحات">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 6h16M4 12h16M4 18h10" />
            </svg>
          </span>
        )}
        <span className="flex-1" />
        {task.assignees.length > 0 && <AvatarStack users={task.assignees} />}
      </div>
    </div>
  );
}

export function SortableTaskCard({
  task,
  onOpen,
  onContextMenu,
}: {
  task: TaskT;
  onOpen: (t: TaskT) => void;
  onContextMenu: (e: React.MouseEvent, t: TaskT) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: "task" },
  });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition, opacity: isDragging ? 0.35 : 1 }}
      {...attributes}
      {...listeners}
      onClick={() => onOpen(task)}
      onContextMenu={(e) => onContextMenu(e, task)}
      onKeyDown={(e) => {
        listeners?.onKeyDown?.(e);
        if (e.key === "Enter" && !e.defaultPrevented) onOpen(task);
      }}
      className="touch-manipulation outline-none focus-visible:rounded-xl focus-visible:ring-2 focus-visible:ring-brand-500"
    >
      <TaskCardBody task={task} />
    </div>
  );
}
