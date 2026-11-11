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
import { useRouter } from "next/navigation";
import { Column, columnDropId } from "./Column";
import { TaskCardBody } from "./TaskCard";
import { TaskModal } from "./TaskModal";
import { FilterBar } from "./FilterBar";
import { MembersModal } from "./MembersModal";
import { LabelsModal } from "./LabelsModal";
import { Avatar, AvatarStack } from "../Avatar";
import { useToast } from "../Toast";
import { MenuButton, useContextMenu, type MenuEntry } from "../ContextMenu";
import { api, errorMessage } from "@/lib/client";
import { EMPTY_FILTERS, compareTasks, matchesFilters, type Filters, type SortMode } from "@/lib/filters";
import { PRIORITIES, ROLE_LABELS, canDeleteTask, canManage, type BoardT, type ColumnT, type LabelT, type TaskT, type UserLite } from "@/lib/types";

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

export function BoardView({ boardId, me, superAdmin = false }: { boardId: string; me: UserLite; superAdmin?: boolean }) {
  const notify = useToast();
  const router = useRouter();
  const openMenu = useContextMenu();
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

  // A notification links to /boards/<id>?task=<taskId>: open that task once the board is loaded.
  const openedFromLink = useRef(false);
  useEffect(() => {
    if (!board || openedFromLink.current) return;
    const taskId = new URLSearchParams(window.location.search).get("task");
    if (!taskId) return;
    openedFromLink.current = true;
    const task = tasksRef.current.find((t) => t.id === taskId);
    if (task) setEditor({ task, columnId: task.columnId });
    window.history.replaceState(null, "", window.location.pathname);
  }, [board]);

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

  async function patchTask(task: TaskT, body: Record<string, unknown>) {
    try {
      const { task: saved } = await api<{ task: TaskT }>(`/api/tasks/${task.id}`, { method: "PATCH", body });
      upsertTask(saved);
    } catch (err) {
      notify(errorMessage(err));
    }
  }

  async function deleteTask(task: TaskT) {
    if (!confirm(`تسک «${task.title}» حذف شود؟`)) return;
    try {
      await api(`/api/tasks/${task.id}`, { method: "DELETE" });
      setTasks((prev) => prev.filter((t) => t.id !== task.id));
    } catch (err) {
      notify(errorMessage(err));
    }
  }

  function taskMenu(task: TaskT): MenuEntry[] {
    if (!board) return [];
    const assigneeIds = task.assignees.map((a) => a.id);
    const toggleAssignee = (id: string) =>
      patchTask(task, { assigneeIds: assigneeIds.includes(id) ? assigneeIds.filter((x) => x !== id) : [...assigneeIds, id] });
    return [
      { label: "باز کردن و ویرایش", onClick: () => setEditor({ task, columnId: task.columnId }) },
      "separator",
      {
        label: "انتقال به ستون",
        children: board.columns.map((c) => ({
          label: c.title,
          checked: c.id === task.columnId,
          icon: <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.color }} />,
          onClick: () => c.id !== task.columnId && patchTask(task, { columnId: c.id }),
        })),
      },
      {
        label: "اولویت",
        children: PRIORITIES.map((p) => ({
          label: p.label,
          checked: p.value === task.priority,
          icon: <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: p.color }} />,
          onClick: () => p.value !== task.priority && patchTask(task, { priority: p.value }),
        })),
      },
      {
        label: "مسئولین",
        children: board.members.map(({ user }) => ({
          label: user.id === me.id ? `${user.name} (من)` : user.name,
          checked: assigneeIds.includes(user.id),
          icon: <Avatar user={user} size="sm" />,
          onClick: () => toggleAssignee(user.id),
        })),
      },
      {
        label: "برچسب‌ها",
        disabled: board.labels.length === 0,
        children: board.labels.map((l) => {
          const ids = task.labels.map((x) => x.id);
          const on = ids.includes(l.id);
          return {
            label: l.name,
            checked: on,
            icon: <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: l.color }} />,
            onClick: () => patchTask(task, { labelIds: on ? ids.filter((x) => x !== l.id) : [...ids, l.id] }),
          };
        }),
      },
      { label: "حذف ددلاین", disabled: !task.deadline, onClick: () => patchTask(task, { deadline: null }) },
      "separator",
      { label: "کپی عنوان", onClick: () => navigator.clipboard?.writeText(task.title).then(() => notify("عنوان کپی شد", "success")) },
      ...(canDeleteTask(task, me.id, superAdmin) ? [{ label: "حذف تسک", danger: true, onClick: () => deleteTask(task) }] : []),
    ];
  }

  async function renameBoard() {
    if (!board) return;
    const name = prompt("نام جدید برد:", board.name)?.trim();
    if (!name || name === board.name) return;
    try {
      await api(`/api/boards/${boardId}`, { method: "PATCH", body: { name } });
      setBoard((b) => (b ? { ...b, name } : b));
      router.refresh();
    } catch (err) {
      notify(errorMessage(err));
    }
  }

  async function editDescription() {
    if (!board) return;
    const value = prompt("توضیحات برد:", board.description ?? "");
    if (value === null) return;
    try {
      await api(`/api/boards/${boardId}`, { method: "PATCH", body: { description: value.trim() || null } });
      setBoard((b) => (b ? { ...b, description: value.trim() || null } : b));
    } catch (err) {
      notify(errorMessage(err));
    }
  }

  async function deleteBoard() {
    if (!board) return;
    if (!confirm(`برد «${board.name}» با همه‌ی ستون‌ها و ${tasks.length.toLocaleString("fa-IR")} تسکش برای همیشه حذف شود؟\nاین کار قابل بازگشت نیست.`)) return;
    try {
      await api(`/api/boards/${boardId}`, { method: "DELETE" });
      notify("برد حذف شد", "success");
      router.replace("/");
      router.refresh();
    } catch (err) {
      notify(errorMessage(err));
    }
  }

  async function leaveBoard() {
    if (!confirm("از این برد خارج می‌شوید؟")) return;
    try {
      await api(`/api/boards/${boardId}/members/${me.id}`, { method: "DELETE" });
      router.replace("/");
      router.refresh();
    } catch (err) {
      notify(errorMessage(err));
    }
  }

  function boardMenu(): MenuEntry[] {
    const items: MenuEntry[] = [];
    if (manager) {
      items.push({ label: "تغییر نام برد", onClick: renameBoard }, { label: "ویرایش توضیحات", onClick: editDescription }, "separator");
    }
    items.push({ label: "اعضا و نقش‌ها", onClick: () => setPanel("members") }, { label: "برچسب‌ها", onClick: () => setPanel("labels") });
    if (manager) items.push({ label: "ستون جدید", onClick: addColumn });
    items.push("separator");
    items.push(myRole === "OWNER" ? { label: "حذف برد", danger: true, onClick: deleteBoard } : { label: "خروج از برد", danger: true, onClick: leaveBoard });
    return items;
  }

  const myRole = board?.members.find((m) => m.user.id === me.id)?.role;
  const manager = canManage(myRole);

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
        <div className="min-w-0 flex-1" onContextMenu={(e) => openMenu(e, boardMenu())}>
          <div className="flex items-center gap-2">
            <h1 className="truncate text-xl font-bold">{board.name}</h1>
            {myRole && <span className="chip bg-slate-100 text-slate-500">{ROLE_LABELS[myRole]}</span>}
          </div>
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
        <MenuButton items={boardMenu} label="تنظیمات برد" />
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
              canManage={manager}
              onOpenTask={(task) => setEditor({ task, columnId: task.columnId })}
              onTaskMenu={(e, task) => openMenu(e, taskMenu(task))}
              onAddTask={(columnId) => setEditor({ task: null, columnId })}
              onUpdate={updateColumn}
              onMove={moveColumn}
              onDelete={deleteColumn}
            />
          ))}
          <DragOverlay dropAnimation={{ duration: 180, easing: "ease-out" }}>
            {activeTask ? <div className="w-[274px]"><TaskCardBody task={activeTask} dragging /></div> : null}
          </DragOverlay>
        </DndContext>
        {manager && <button onClick={addColumn} className="flex h-12 w-[290px] shrink-0 items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-slate-300 text-sm text-slate-500 transition hover:border-brand-500 hover:text-brand-600">
          <span className="text-lg leading-none">+</span> ستون جدید
        </button>}
      </main>

      {editor && (
        <TaskModal
          open
          board={boardWithTasks}
          task={editor.task}
          canDelete={!!editor.task && canDeleteTask(editor.task, me.id, superAdmin)}
          meId={me.id}
          superAdmin={superAdmin}
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
