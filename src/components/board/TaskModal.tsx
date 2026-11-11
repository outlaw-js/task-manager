"use client";

import { useEffect, useState } from "react";
import { Modal } from "../Modal";
import { Avatar } from "../Avatar";
import { DeadlinePicker } from "./JalaliDatePicker";
import { useToast } from "../Toast";
import { SearchSelect } from "../SearchSelect";
import { api, errorMessage } from "@/lib/client";
import { formatFull } from "@/lib/date";
import { PRIORITIES, type BoardT, type LabelT, type Priority, type TaskT } from "@/lib/types";

interface Props {
  board: BoardT;
  task: TaskT | null;
  /** Creator of the task or board owner. */
  canDelete: boolean;
  defaultColumnId: string;
  open: boolean;
  onClose: () => void;
  onSaved: (task: TaskT) => void;
  onDeleted: (taskId: string) => void;
  onLabelCreated: (label: LabelT) => void;
}

interface FormState {
  title: string;
  description: string;
  columnId: string;
  priority: Priority;
  deadline: string | null;
  assigneeIds: string[];
  labelIds: string[];
}

function initialState(task: TaskT | null, columnId: string): FormState {
  return {
    title: task?.title ?? "",
    description: task?.description ?? "",
    columnId: task?.columnId ?? columnId,
    priority: task?.priority ?? "MEDIUM",
    deadline: task?.deadline ?? null,
    assigneeIds: task?.assignees.map((a) => a.id) ?? [],
    labelIds: task?.labels.map((l) => l.id) ?? [],
  };
}

function presetDeadline(daysFromToday: number) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromToday);
  d.setHours(18, 0, 0, 0);
  return d.toISOString();
}

export function TaskModal({ board, task, canDelete, defaultColumnId, open, onClose, onSaved, onDeleted, onLabelCreated }: Props) {
  const notify = useToast();
  const [form, setForm] = useState<FormState>(() => initialState(task, defaultColumnId));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm(initialState(task, defaultColumnId));
  }, [open, task, defaultColumnId]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const body = { ...form, description: form.description.trim() || null };
      const { task: saved } = task
        ? await api<{ task: TaskT }>(`/api/tasks/${task.id}`, { method: "PATCH", body })
        : await api<{ task: TaskT }>(`/api/boards/${board.id}/tasks`, { body });
      onSaved(saved);
      onClose();
    } catch (err) {
      notify(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!task || !confirm(`تسک «${task.title}» حذف شود؟`)) return;
    try {
      await api(`/api/tasks/${task.id}`, { method: "DELETE" });
      onDeleted(task.id);
      onClose();
    } catch (err) {
      notify(errorMessage(err));
    }
  }

  async function createLabel(name: string) {
    try {
      const palette = ["#6366f1", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#0ea5e9", "#ec4899"];
      const { label } = await api<{ label: LabelT }>(`/api/boards/${board.id}/labels`, {
        body: { name, color: palette[board.labels.length % palette.length] },
      });
      onLabelCreated(label);
      return label.id;
    } catch (err) {
      notify(errorMessage(err));
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={task ? "ویرایش تسک" : "تسک جدید"} wide>
      <form onSubmit={save} className="space-y-5">
        <div>
          <label className="label" htmlFor="task-title">عنوان</label>
          <input id="task-title" className="input text-base" autoFocus required value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="چه کاری باید انجام شود؟" />
        </div>

        <div>
          <label className="label" htmlFor="task-desc">توضیحات</label>
          <textarea id="task-desc" className="input min-h-28 leading-7" value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="جزئیات، لینک‌ها، چک‌لیست…" />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="task-col">وضعیت (ستون)</label>
            <select id="task-col" className="input" value={form.columnId} onChange={(e) => set("columnId", e.target.value)}>
              {board.columns.map((c) => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>
          </div>
          <div>
            <span className="label">اولویت</span>
            <div className="grid grid-cols-4 gap-1 rounded-lg bg-slate-100 p-1">
              {PRIORITIES.map((p) => (
                <button
                  type="button"
                  key={p.value}
                  onClick={() => set("priority", p.value)}
                  className={`rounded-md py-1.5 text-xs font-medium transition ${form.priority === p.value ? "bg-white shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                  style={form.priority === p.value ? { color: p.color } : undefined}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <label className="label" htmlFor="task-deadline">ددلاین</label>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="flex-1">
              <DeadlinePicker id="task-deadline" value={form.deadline} onChange={(v) => set("deadline", v)} />
            </div>
            <div className="flex gap-1">
              <button type="button" className="btn-secondary !px-2.5 !py-1.5 text-xs" onClick={() => set("deadline", presetDeadline(0))}>امروز</button>
              <button type="button" className="btn-secondary !px-2.5 !py-1.5 text-xs" onClick={() => set("deadline", presetDeadline(1))}>فردا</button>
              <button type="button" className="btn-secondary !px-2.5 !py-1.5 text-xs" onClick={() => set("deadline", presetDeadline(7))}>هفته بعد</button>
              {form.deadline && (
                <button type="button" className="btn-danger !px-2.5 !py-1.5 text-xs" onClick={() => set("deadline", null)}>حذف</button>
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="task-assignees">مسئولین</label>
            <SearchSelect
              id="task-assignees"
              placeholder="جستجوی نام یا ایمیل…"
              value={form.assigneeIds}
              onChange={(v) => set("assigneeIds", v)}
              options={board.members.map(({ user }) => ({
                value: user.id,
                label: user.name,
                hint: user.email,
                icon: <Avatar user={user} size="sm" />,
              }))}
            />
          </div>
          <div>
            <label className="label" htmlFor="task-labels">برچسب‌ها</label>
            <SearchSelect
              id="task-labels"
              placeholder="جستجو یا ساخت برچسب…"
              value={form.labelIds}
              onChange={(v) => set("labelIds", v)}
              onCreate={createLabel}
              createLabel={(t) => `ساخت برچسب «${t}»`}
              options={board.labels.map((l) => ({
                value: l.id,
                label: l.name,
                color: l.color,
                icon: <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: l.color }} />,
              }))}
            />
          </div>
        </div>

        {task && (
          <p className="text-xs text-slate-400">
            {task.creator ? `ساخته‌شده توسط ${task.creator.name} · ` : ""}
            {formatFull(task.createdAt)}
          </p>
        )}

        <div className="flex items-center gap-2 border-t border-slate-100 pt-4">
          {task && canDelete && (
            <button type="button" className="btn-danger" onClick={remove}>حذف تسک</button>
          )}
          <span className="flex-1" />
          <button type="button" className="btn-secondary" onClick={onClose}>انصراف</button>
          <button className="btn-primary" disabled={saving}>{saving ? "در حال ذخیره…" : task ? "ذخیره تغییرات" : "ساخت تسک"}</button>
        </div>
      </form>
    </Modal>
  );
}
