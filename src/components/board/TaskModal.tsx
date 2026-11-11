"use client";

import { useEffect, useRef, useState } from "react";
import { Modal } from "../Modal";
import { Avatar } from "../Avatar";
import { DeadlinePicker } from "./JalaliDatePicker";
import { useToast } from "../Toast";
import { SearchSelect } from "../SearchSelect";
import { TaskImages, imageFiles, type PendingImage } from "./TaskImages";
import { TaskDiscussion } from "./TaskDiscussion";
import { prepareImage, uploadFile } from "@/lib/image";
import { api, errorMessage } from "@/lib/client";
import { formatFull } from "@/lib/date";
import { PRIORITIES, type AttachmentT, type BoardT, type LabelT, type Priority, type TaskT, type UserLite } from "@/lib/types";

interface Props {
  board: BoardT;
  task: TaskT | null;
  /** Creator of the task or a super admin. */
  canDelete: boolean;
  me: UserLite;
  superAdmin: boolean;
  onCommentCount: (taskId: string, count: number) => void;
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

export function TaskModal({ board, task, canDelete, me, superAdmin, onCommentCount, defaultColumnId, open, onClose, onSaved, onDeleted, onLabelCreated }: Props) {
  const meId = me.id;
  const notify = useToast();
  const [form, setForm] = useState<FormState>(() => initialState(task, defaultColumnId));
  const [saving, setSaving] = useState(false);
  const [attachments, setAttachments] = useState<AttachmentT[]>(task?.attachments ?? []);
  const [pending, setPending] = useState<PendingImage[]>([]);
  const latest = useRef(task);
  latest.current = task;

  useEffect(() => {
    if (open) {
      setForm(initialState(task, defaultColumnId));
      setAttachments(task?.attachments ?? []);
    }
  }, [open, task, defaultColumnId]);

  // Free preview URLs of images that never got uploaded.
  const pendingRef = useRef(pending);
  pendingRef.current = pending;
  useEffect(() => () => pendingRef.current.forEach((p) => URL.revokeObjectURL(p.url)), []);

  /** Uploads one queued image to `taskId`; returns the saved attachment, or null on failure. */
  async function uploadOne(taskId: string, item: PendingImage) {
    setPending((list) => list.map((p) => (p.id === item.id ? { ...p, uploading: true } : p)));
    try {
      const file = await prepareImage(item.file);
      const { attachment } = await uploadFile<{ attachment: AttachmentT }>(`/api/tasks/${taskId}/attachments`, file);
      setPending((list) => list.filter((p) => p.id !== item.id));
      URL.revokeObjectURL(item.url);
      return attachment;
    } catch (err) {
      notify(`${item.file.name}: ${errorMessage(err)}`);
      setPending((list) => list.map((p) => (p.id === item.id ? { ...p, uploading: false } : p)));
      return null;
    }
  }

  async function addImages(files: File[]) {
    const items = files.map((file) => ({ id: crypto.randomUUID(), file, url: URL.createObjectURL(file) }));
    setPending((list) => [...list, ...items]);
    // On an existing task, upload right away; a new task uploads them after it's created.
    if (!task) return;
    for (const item of items) {
      const saved = await uploadOne(task.id, item);
      if (saved) {
        setAttachments((list) => {
          const next = [...list, saved];
          if (latest.current) onSaved({ ...latest.current, attachments: next });
          return next;
        });
      }
    }
  }

  async function deleteAttachment(a: AttachmentT) {
    if (!confirm(`تصویر «${a.name}» حذف شود؟`)) return;
    try {
      await api(`/api/attachments/${a.id}`, { method: "DELETE" });
      setAttachments((list) => {
        const next = list.filter((x) => x.id !== a.id);
        if (latest.current) onSaved({ ...latest.current, attachments: next });
        return next;
      });
    } catch (err) {
      notify(errorMessage(err));
    }
  }

  const canDeleteAttachment = (a: AttachmentT) => superAdmin || a.uploaderId === meId || task?.creator?.id === meId;

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
      // New task: now that it exists, upload the queued images.
      const queued = pending.filter((p) => !p.uploading);
      if (!task && queued.length) {
        const uploaded: AttachmentT[] = [];
        for (const item of queued) {
          const a = await uploadOne(saved.id, item);
          if (a) uploaded.push(a);
        }
        onSaved({ ...saved, attachments: [...saved.attachments, ...uploaded] });
        if (uploaded.length < queued.length) {
          notify("تسک ساخته شد، اما بعضی تصاویر آپلود نشدند؛ از ویرایش تسک دوباره امتحان کنید");
        }
      }
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
      <form
        onSubmit={save}
        className="space-y-5"
        onPaste={(e) => {
          const files = imageFiles(e.clipboardData.files);
          if (files.length) {
            e.preventDefault();
            addImages(files);
          }
        }}
      >
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

        <div>
          <span className="label">
            تصاویر{attachments.length + pending.length > 0 && ` (${(attachments.length + pending.length).toLocaleString("fa-IR")})`}
          </span>
          <TaskImages
            attachments={attachments}
            pending={pending}
            onAdd={addImages}
            onRemovePending={(id) =>
              setPending((list) => {
                const item = list.find((p) => p.id === id);
                if (item) URL.revokeObjectURL(item.url);
                return list.filter((p) => p.id !== id);
              })
            }
            onDelete={deleteAttachment}
            canDelete={canDeleteAttachment}
          />
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
          <button className="btn-primary" disabled={saving || pending.some((p) => p.uploading)}>
            {saving ? (pending.some((p) => p.uploading) ? "در حال آپلود تصاویر…" : "در حال ذخیره…") : task ? "ذخیره تغییرات" : "ساخت تسک"}
          </button>
        </div>
      </form>
      {/* Outside the form so typing a comment never submits the task. */}
      {task && (
        <div className="mt-5">
          <TaskDiscussion task={task} me={me} superAdmin={superAdmin} onCount={(n) => onCommentCount(task.id, n)} />
        </div>
      )}
    </Modal>
  );
}
