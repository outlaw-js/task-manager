"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Avatar } from "../Avatar";
import { useToast } from "../Toast";
import { useContextMenu, type MenuEntry } from "../ContextMenu";
import { Lightbox } from "./TaskImages";
import { api, errorMessage } from "@/lib/client";
import { formatFull, timeAgo } from "@/lib/date";
import { formatBytes, prepareImage, uploadFile } from "@/lib/image";
import { attachmentUrl, type AttachmentT, type CommentT, type TaskT, type UserLite } from "@/lib/types";

const ACCEPT = "image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.7z,.txt,.csv,.md";
const MAX_FILE = 8 * 1024 * 1024;

interface Props {
  task: TaskT;
  me: UserLite;
  superAdmin: boolean;
  onCount: (count: number) => void;
}

/** Discussion under a task, for its creator and assignees: text, images and files. */
export function TaskDiscussion({ task, me, superAdmin, onCount }: Props) {
  const notify = useToast();
  const openMenu = useContextMenu();
  const participant = superAdmin || task.creator?.id === me.id || task.assignees.some((a) => a.id === me.id);

  const [comments, setComments] = useState<CommentT[] | null>(null);
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const [viewer, setViewer] = useState<{ images: AttachmentT[]; index: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const lastCount = useRef(0);
  const onCountRef = useRef(onCount);
  onCountRef.current = onCount;

  const load = useCallback(async () => {
    try {
      const { comments } = await api<{ comments: CommentT[] }>(`/api/tasks/${task.id}/comments`);
      setComments(comments);
    } catch {
      setComments((c) => c ?? []);
    }
  }, [task.id]);

  // Load, then refresh every 15 s while the tab is visible.
  useEffect(() => {
    if (!participant) return;
    load();
    const t = setInterval(() => document.visibilityState === "visible" && load(), 15_000);
    return () => clearInterval(t);
  }, [participant, load]);

  // Report the count to the card and keep the newest message in view.
  useEffect(() => {
    if (!comments) return;
    onCountRef.current(comments.length);
    if (comments.length > lastCount.current) {
      requestAnimationFrame(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: lastCount.current ? "smooth" : "auto" }));
    }
    lastCount.current = comments.length;
  }, [comments]);

  function addFiles(list: FileList | File[] | null | undefined) {
    const picked = [...(list ?? [])];
    const tooBig = picked.filter((f) => f.size > MAX_FILE && !f.type.startsWith("image/"));
    if (tooBig.length) notify(`حجم ${tooBig.map((f) => f.name).join("، ")} بیش از ۸ مگابایت است`);
    setFiles((cur) => [...cur, ...picked.filter((f) => !tooBig.includes(f))].slice(0, 10));
  }

  async function send() {
    const body = text.trim();
    if ((!body && files.length === 0) || sending) return;
    setSending(true);
    try {
      const { comment } = await api<{ comment: CommentT }>(`/api/tasks/${task.id}/comments`, { body: { body, withFiles: files.length > 0 } });
      const uploaded: AttachmentT[] = [];
      for (const f of files) {
        try {
          const ready = f.type.startsWith("image/") ? await prepareImage(f) : f;
          const { attachment } = await uploadFile<{ attachment: AttachmentT }>(`/api/comments/${comment.id}/attachments`, ready);
          uploaded.push(attachment);
        } catch (err) {
          notify(`${f.name}: ${errorMessage(err)}`);
        }
      }
      setComments((list) => [...(list ?? []), { ...comment, attachments: uploaded }]);
      setText("");
      setFiles([]);
    } catch (err) {
      notify(errorMessage(err));
    } finally {
      setSending(false);
    }
  }

  async function saveEdit() {
    if (!editing) return;
    const body = editing.text.trim();
    if (!body) return;
    try {
      const { comment } = await api<{ comment: CommentT }>(`/api/comments/${editing.id}`, { method: "PATCH", body: { body } });
      setComments((list) => list?.map((c) => (c.id === comment.id ? comment : c)) ?? null);
      setEditing(null);
    } catch (err) {
      notify(errorMessage(err));
    }
  }

  async function remove(c: CommentT) {
    if (!confirm("این کامنت حذف شود؟")) return;
    try {
      await api(`/api/comments/${c.id}`, { method: "DELETE" });
      setComments((list) => list?.filter((x) => x.id !== c.id) ?? null);
    } catch (err) {
      notify(errorMessage(err));
    }
  }

  const menuFor = (c: CommentT): MenuEntry[] => {
    const mine = c.author?.id === me.id;
    const items: MenuEntry[] = [];
    if (c.body) items.push({ label: "کپی متن", onClick: () => navigator.clipboard?.writeText(c.body).then(() => notify("متن کپی شد", "success")) });
    if (mine && c.body) items.push({ label: "ویرایش", onClick: () => setEditing({ id: c.id, text: c.body }) });
    if (mine || superAdmin) items.push("separator", { label: "حذف کامنت", danger: true, onClick: () => remove(c) });
    return items;
  };

  if (!participant) {
    return (
      <section className="border-t border-slate-100 pt-4">
        <h3 className="label">گفتگو</h3>
        <p className="rounded-lg bg-slate-50 p-3 text-center text-xs text-slate-500">
          گفتگوی این تسک فقط برای سازنده و مسئولین آن است{task._count?.comments ? ` · ${task._count.comments.toLocaleString("fa-IR")} کامنت` : ""}.
        </p>
      </section>
    );
  }

  return (
    <section className="border-t border-slate-100 pt-4">
      <h3 className="label">
        گفتگو{comments && comments.length > 0 && ` (${comments.length.toLocaleString("fa-IR")})`}
        <span className="ms-2 text-xs font-normal text-slate-400">بین سازنده و مسئولین تسک</span>
      </h3>

      <div ref={listRef} className="scrollbar-thin mb-3 max-h-80 space-y-3 overflow-y-auto pe-1">
        {comments === null && <p className="py-4 text-center text-xs text-slate-400">در حال بارگذاری…</p>}
        {comments?.length === 0 && <p className="py-4 text-center text-xs text-slate-400">هنوز کامنتی نیست؛ اولین نفر باشید.</p>}
        {comments?.map((c) => {
          const mine = c.author?.id === me.id;
          const images = c.attachments.filter((a) => a.mimeType.startsWith("image/"));
          const docs = c.attachments.filter((a) => !a.mimeType.startsWith("image/"));
          return (
            <div key={c.id} className="group flex gap-2.5" onContextMenu={(e) => openMenu(e, menuFor(c))}>
              {c.author ? <Avatar user={c.author} size="md" /> : <span className="h-8 w-8 shrink-0 rounded-full bg-slate-200" />}
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2 text-xs">
                  <span className="font-bold text-slate-700">{c.author?.name ?? "کاربر حذف‌شده"}</span>
                  <span className="text-slate-400" title={formatFull(c.createdAt)}>{timeAgo(c.createdAt)}</span>
                  {c.editedAt && <span className="text-slate-400">(ویرایش‌شده)</span>}
                  <span className="flex-1" />
                  {(mine || superAdmin) && (
                    <span className="flex gap-1 opacity-0 transition group-hover:opacity-100">
                      {mine && c.body && (
                        <button type="button" className="text-slate-400 hover:text-brand-600" onClick={() => setEditing({ id: c.id, text: c.body })}>ویرایش</button>
                      )}
                      <button type="button" className="text-slate-400 hover:text-red-600" onClick={() => remove(c)}>حذف</button>
                    </span>
                  )}
                </div>
                {editing?.id === c.id ? (
                  <div className="mt-1 space-y-1.5">
                    <textarea
                      autoFocus
                      className="input min-h-16 text-sm leading-6"
                      value={editing.text}
                      onChange={(e) => setEditing({ ...editing, text: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) saveEdit();
                        if (e.key === "Escape") {
                          e.stopPropagation();
                          e.nativeEvent.stopImmediatePropagation();
                          setEditing(null);
                        }
                      }}
                    />
                    <div className="flex gap-1.5">
                      <button type="button" className="btn-primary !px-2.5 !py-1 text-xs" onClick={saveEdit}>ذخیره</button>
                      <button type="button" className="btn-ghost !px-2.5 !py-1 text-xs" onClick={() => setEditing(null)}>انصراف</button>
                    </div>
                  </div>
                ) : (
                  c.body && (
                    <div className={`mt-1 inline-block max-w-full whitespace-pre-wrap break-words rounded-2xl rounded-tr-sm px-3 py-2 text-sm leading-6 ${mine ? "bg-brand-50 text-slate-800" : "bg-slate-100 text-slate-800"}`}>
                      <Linkified text={c.body} />
                    </div>
                  )
                )}
                {images.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {images.map((a, i) => (
                      <button key={a.id} type="button" onClick={() => setViewer({ images, index: i })} className="h-20 w-20 overflow-hidden rounded-lg bg-slate-100" aria-label={`نمایش ${a.name}`}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={attachmentUrl(a.id)} alt={a.name} loading="lazy" className="h-full w-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
                {docs.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {docs.map((a) => (
                      <a key={a.id} href={attachmentUrl(a.id)} download={a.name} className="flex max-w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs hover:border-brand-500 hover:text-brand-700">
                        <FileIcon mime={a.mimeType} />
                        <span className="truncate" dir="auto">{a.name}</span>
                        <span className="shrink-0 text-slate-400">{formatBytes(a.size)}</span>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div
        className={`rounded-xl border bg-white transition ${dragging ? "border-brand-500 ring-2 ring-brand-100" : "border-slate-300 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-100"}`}
        onDragOver={(e) => {
          if ([...e.dataTransfer.items].some((i) => i.kind === "file")) {
            e.preventDefault();
            setDragging(true);
          }
        }}
        onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          addFiles(e.dataTransfer.files);
        }}
      >
        <textarea
          className="block min-h-16 w-full resize-y rounded-xl bg-transparent px-3 py-2 text-sm leading-6 outline-none placeholder:text-slate-400"
          placeholder="کامنت، توضیح یا سؤال… (Ctrl+Enter برای ارسال)"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onPaste={(e) => {
            if (e.clipboardData.files.length) {
              e.preventDefault();
              addFiles(e.clipboardData.files);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              send();
            }
          }}
        />
        {files.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-3 pb-2">
            {files.map((f, i) => (
              <span key={`${f.name}-${i}`} className="chip max-w-full gap-1.5 border border-slate-200 bg-slate-50 !py-1 text-slate-600">
                <FileIcon mime={f.type} />
                <span className="max-w-40 truncate" dir="auto">{f.name}</span>
                <span className="text-slate-400">{formatBytes(f.size)}</span>
                <button type="button" className="text-slate-400 hover:text-red-600" onClick={() => setFiles((cur) => cur.filter((_, j) => j !== i))} aria-label={`حذف ${f.name}`}>
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2 border-t border-slate-100 px-2 py-1.5">
          <button type="button" className="btn-ghost !px-2 !py-1 text-xs" onClick={() => fileInput.current?.click()} title="پیوست فایل یا تصویر">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m21.4 11.6-9.2 9.2a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5" />
            </svg>
            پیوست
          </button>
          <span className="text-[11px] text-slate-400">تصویر، PDF، Word، Excel، ZIP · حداکثر ۸ مگابایت</span>
          <span className="flex-1" />
          <button type="button" className="btn-primary !px-3 !py-1.5 text-xs" disabled={sending || (!text.trim() && files.length === 0)} onClick={send}>
            {sending ? "در حال ارسال…" : "ارسال"}
          </button>
        </div>
        <input
          ref={fileInput}
          type="file"
          multiple
          hidden
          accept={ACCEPT}
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {viewer && (
        <Lightbox
          images={viewer.images.map((a) => ({ src: attachmentUrl(a.id), name: a.name, size: a.size }))}
          index={viewer.index}
          onIndex={(index) => setViewer({ ...viewer, index })}
          onClose={() => setViewer(null)}
        />
      )}
    </section>
  );
}

/** Turns http(s) links in plain text into anchors; everything else stays text. */
function Linkified({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s<>"']+)/g);
  return (
    <>
      {parts.map((p, i) =>
        /^https?:\/\//.test(p) ? (
          <a key={i} href={p} target="_blank" rel="noreferrer noopener" className="text-brand-700 underline break-all" dir="ltr">
            {p}
          </a>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

function FileIcon({ mime }: { mime: string }) {
  const kind = mime.startsWith("image/")
    ? ["#0ea5e9", "IMG"]
    : mime === "application/pdf"
      ? ["#dc2626", "PDF"]
      : /word|msword/.test(mime)
        ? ["#2563eb", "DOC"]
        : /sheet|excel|csv/.test(mime)
          ? ["#16a34a", "XLS"]
          : /presentation|powerpoint/.test(mime)
            ? ["#ea580c", "PPT"]
            : /zip|rar|7z/.test(mime)
              ? ["#7c3aed", "ZIP"]
              : ["#64748b", "TXT"];
  return (
    <span className="inline-flex h-5 shrink-0 items-center rounded px-1 text-[9px] font-bold text-white" style={{ backgroundColor: kind[0] }}>
      {kind[1]}
    </span>
  );
}
