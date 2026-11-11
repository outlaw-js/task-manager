"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Column, columnDropId } from "./Column";
import { TaskCardBody } from "./TaskCard";
import { TaskModal } from "./TaskModal";
import { FilterBar } from "./FilterBar";
import { MembersModal } from "./MembersModal";
import { LabelsModal } from "./LabelsModal";
import { AvatarStack } from "../Avatar";
import { useToast } from "../Toast";
import { api, errorMessage } from "@/lib/client";
import { EMPTY_FILTERS, compareTasks, matchesFilters, type Filters, type SortMode } from "@/lib/filters";
import type { BoardT, ColumnT, LabelT, TaskT, UserLite } from "@/lib/types";

/** Task ids of one column in manual (position) order. */
const orderedIds = (tasks: TaskT[], columnId: string) =>
  tasks
    .filter((t) => t.columnId === columnId)
    .sort((a, b) => a.position - b.position)
    .map((t) => t.id);

/** Rewrites positions 0..n for one column following `ids`. */
function applyOrder(tasks: TaskT[], columnId: string, ids: string[]) {
  const index = new Map(ids.map((id, i) => [id, i]));
  return tasks.map((t) => (index.has(t.id) ? { ...t, columnId, position: index.get(t.id)! } : t));
}

export function BoardView({ boardId, me }: { boardId: string; me: UserLite }) {
  const notify = useToast();
  const [board, setBoard] = useState<BoardT | null>(null);
  const [tasks, setTasksState] = useState<TaskT[]>([]);
  const tasksRef = useRef<TaskT[]>([]);
  const [loadError, setLoadError] = useState("");
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [sort, setSort] = useState<SortMode>("manual");
  const [editor, setEditor] = useState<{ task: TaskT | null; columnId: string } | null>(null);
  const [panel, setPanel] = useState<"members" | "labels" | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const dragOrigin = useRef<{ columnId: string; snapshot: TaskT[] } | null>(null);

  // Drag handlers read the latest tasks synchronously, so keep a ref in step with state.
  const setTasks = useCallback((next: TaskT[] | ((prev: TaskT[]) => TaskT[])) => {
    const value = typeof next === "function" ? next(tasksRef.current) : next;
    tasksRef.current = value;
    setTasksState(value);
  }, []);

  const load = useCallback(async () => {
    try {
      const { board } = await api<{ board: BoardT }>(`/api/boards/${boardId}`);
      setBoard(board);
      setTasks(board.tasks);
    } catch (err) {
      setLoadError(errorMessage(err));
    }
  }, [boardId, setTasks]);

  useEffect(() => {
    load();
  }, [load]);

  // Remember sort/filter choices per board in this browser.
  const storageKey = `board-view:${boardId}`;
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) ?? "null");
      if (saved?.sort) setSort(saved.sort);
      if (saved?.filters) setFilters({ ...EMPTY_FILTERS, ...saved.filters });
    } catch {}
  }, [storageKey]);
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ sort, filters }));
    } catch {}
  }, [storageKey, sort, filters]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const visible = useMemo(() => {
    const map: Record<string, TaskT[]> = {};
    const totals: Record<string, number> = {};
    if (!board) return { map, totals, shown: 0 };
    for (const c of board.columns) {
      map[c.id] = [];
      totals[c.id] = 0;
    }
    const now = new Date();
    let shown = 0;
    for (const t of tasks) {
      if (!(t.columnId in map)) continue;
      totals[t.columnId]++;
      if (matchesFilters(t, filters, now)) {
        map[t.columnId].push(t);
        shown++;
      }
    }
    const cmp = compareTasks(sort);
    for (const id in map) map[id].sort(cmp);
    return { map, totals, shown };
  }, [board, tasks, filters, sort]);

  const columnOf = (id: string) =>
    id.startsWith("col:") ? id.slice(4) : tasksRef.current.find((t) => t.id === id)?.columnId;

  function onDragStart({ active }: DragStartEvent) {
    const task = tasksRef.current.find((t) => t.id === active.id);
    if (!task) return;
    setActiveId(task.id);
    dragOrigin.current = { columnId: task.columnId, snapshot: tasksRef.current };
  }

  // Moving across columns happens live while dragging so the card previews in place.
  function onDragOver({ active, over }: DragOverEvent) {
    if (!over) return;
    const activeTask = tasksRef.current.find((t) => t.id === active.id);
    const toColumn = columnOf(String(over.id));
    if (!activeTask || !toColumn || activeTask.columnId === toColumn) return;

    setTasks((prev) => {
      const overTask = prev.find((t) => t.id === over.id);
      let position: number;
      if (overTask && sort === "manual") {
        const translated = active.rect.current.translated;
        const below = translated ? translated.top > over.rect.top + over.rect.height / 2 : false;
        position = overTask.position + (below ? 0.5 : -0.5);
      } else {
        position = Math.max(-1, ...prev.filter((t) => t.columnId === toColumn).map((t) => t.position)) + 1;
      }
      return prev.map((t) => (t.id === active.id ? { ...t, columnId: toColumn, position } : t));
    });
  }

  async function onDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);
    const origin = dragOrigin.current;
    dragOrigin.current = null;
    if (!origin) return;
    if (!over) {
      setTasks(origin.snapshot);
      return;
    }

    let next = tasksRef.current;
    const toColumn = next.find((t) => t.id === active.id)!.columnId;

    // Reordering inside a column only makes sense when the view shows manual order.
    if (sort === "manual" && over.id !== active.id) {
      const overTask = next.find((t) => t.id === over.id);
      if (overTask?.columnId === toColumn) {
        const ids = orderedIds(next, toColumn);
        next = applyOrder(next, toColumn, arrayMove(ids, ids.indexOf(String(active.id)), ids.indexOf(overTask.id)));
      }
    }

    const affected = [...new Set([origin.columnId, toColumn])];
    for (const c of affected) next = applyOrder(next, c, orderedIds(next, c));
    setTasks(next);

    const changed = affected.some((c) => orderedIds(next, c).join() !== orderedIds(origin.snapshot, c).join());
    if (!changed) return;
    try {
      await api(`/api/boards/${boardId}/reorder`, {
        body: { columns: affected.map((c) => ({ id: c, taskIds: orderedIds(next, c) })) },
      });
    } catch (err) {
      notify(errorMessage(err));
      setTasks(origin.snapshot);
    }
  }

  function upsertTask(task: TaskT) {
    setTasks((prev) => (prev.some((t) => t.id === task.id) ? prev.map((t) => (t.id === task.id ? task : t)) : [...prev, task]));
  }

  async function quickAdd(columnId: string, title: string) {
    try {
      const { task } = await api<{ task: TaskT }>(`/api/boards/${boardId}/tasks`, { body: { title, columnId } });
      upsertTask(task);
    } catch (err) {
      notify(errorMessage(err));
    }
  }

  const setColumns = (fn: (cols: ColumnT[]) => ColumnT[]) => setBoard((b) => (b ? { ...b, columns: fn(b.columns) } : b));

  async function updateColumn(columnId: string, data: Partial<Pick<ColumnT, "title" | "color">>) {
    setColumns((cols) => cols.map((c) => (c.id === columnId ? { ...c, ...data } : c)));
    try {
      await api(`/api/columns/${columnId}`, { method: "PATCH", body: data });
    } catch (err) {
      notify(errorMessage(err));
      load();
    }
  }

  async function moveColumn(columnId: string, dir: -1 | 1) {
    if (!board) return;
    const ids = board.columns.map((c) => c.id);
    const from = ids.indexOf(columnId);
    const order = arrayMove(ids, from, from + dir);
    setColumns((cols) => order.map((id, position) => ({ ...cols.find((c) => c.id === id)!, position })));
    try {
      await api(`/api/boards/${boardId}/reorder`, { body: { columnOrder: order } });
    } catch (err) {
      notify(errorMessage(err));
      load();
    }
  }

  async function deleteColumn(columnId: string) {
    const col = board?.columns.find((c) => c.id === columnId);
    if (!col || !confirm(`ستون «${col.title}» حذف شود؟`)) return;
    try {
      await api(`/api/columns/${columnId}`, { method: "DELETE" });
      setColumns((cols) => cols.filter((c) => c.id !== columnId));
    } catch (err) {
      notify(errorMessage(err));
    }
  }

  async function addColumn() {
    const title = prompt("عنوان ستون جدید:")?.trim();
    if (!title) return;
    try {
      const { column } = await api<{ column: ColumnT }>(`/api/boards/${boardId}/columns`, { body: { title } });
      setColumns((cols) => [...cols, column]);
    } catch (err) {
      notify(errorMessage(err));
    }
  }

  if (loadError) {
    return <div className="flex flex-1 items-center justify-center text-red-600">{loadError}</div>;
  }
  if (!board) {
    return (
      <div className="flex flex-1 gap-4 overflow-hidden p-6">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-96 w-[290px] shrink-0 animate-pulse rounded-2xl bg-slate-200/70" />
        ))}
      </div>
    );
  }

  const boardWithTasks = { ...board, tasks };
  const activeTask = activeId ? tasks.find((t) => t.id === activeId) : null;

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 bg-white px-4 pt-4 sm:px-6">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-bold">{board.name}</h1>
          {board.description && <p className="truncate text-sm text-slate-500">{board.description}</p>}
        </div>
        <button className="flex items-center gap-2 rounded-full py-1 pe-1 ps-3 text-sm text-slate-600 hover:bg-slate-100" onClick={() => setPanel("members")}>
          اعضا
          <AvatarStack users={board.members.map((m) => m.user)} max={4} size="md" />
        </button>
        <button className="btn-secondary" onClick={() => setPanel("labels")}>برچسب‌ها</button>
        <button className="btn-primary" onClick={() => setEditor({ task: null, columnId: board.columns[0]?.id })}>
          <span className="text-lg leading-none">+</span> تسک جدید
        </button>
      </div>

      <FilterBar
        board={boardWithTasks}
        me={me}
        filters={filters}
        onFilters={setFilters}
        sort={sort}
        onSort={setSort}
        shown={visible.shown}
        total={tasks.length}
      />
      {sort !== "manual" && (
        <p className="bg-amber-50 px-6 py-1.5 text-xs text-amber-700">
          مرتب‌سازی خودکار فعال است؛ با کشیدن می‌توانید تسک را به ستون دیگر ببرید، اما برای تغییر ترتیب داخل ستون، «ترتیب دستی» را انتخاب کنید.
        </p>
      )}

      <main className="scrollbar-thin flex min-h-0 flex-1 items-start gap-4 overflow-x-auto p-4 sm:p-6">
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd} onDragCancel={() => {
          if (dragOrigin.current) setTasks(dragOrigin.current.snapshot);
          dragOrigin.current = null;
          setActiveId(null);
        }}>
          {board.columns.map((c, i) => (
            <Column
              key={c.id}
              column={c}
              tasks={visible.map[c.id] ?? []}
              total={visible.totals[c.id] ?? 0}
              isFirst={i === 0}
              isLast={i === board.columns.length - 1}
              onOpenTask={(task) => setEditor({ task, columnId: task.columnId })}
              onQuickAdd={quickAdd}
              onUpdate={updateColumn}
              onMove={moveColumn}
              onDelete={deleteColumn}
            />
          ))}
          <DragOverlay dropAnimation={{ duration: 180, easing: "ease-out" }}>
            {activeTask ? <div className="w-[274px]"><TaskCardBody task={activeTask} dragging /></div> : null}
          </DragOverlay>
        </DndContext>
        <button onClick={addColumn} className="flex h-12 w-[290px] shrink-0 items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-slate-300 text-sm text-slate-500 transition hover:border-brand-500 hover:text-brand-600">
          <span className="text-lg leading-none">+</span> ستون جدید
        </button>
      </main>

      {editor && (
        <TaskModal
          open
          board={boardWithTasks}
          task={editor.task}
          defaultColumnId={editor.columnId}
          onClose={() => setEditor(null)}
          onSaved={upsertTask}
          onDeleted={(id) => setTasks((prev) => prev.filter((t) => t.id !== id))}
          onLabelCreated={(label: LabelT) => setBoard((b) => (b ? { ...b, labels: [...b.labels, label] } : b))}
        />
      )}
      <MembersModal board={boardWithTasks} me={me} open={panel === "members"} onClose={() => setPanel(null)} onChanged={load} />
      <LabelsModal board={boardWithTasks} open={panel === "labels"} onClose={() => setPanel(null)} onChanged={load} />
    </>
  );
}
