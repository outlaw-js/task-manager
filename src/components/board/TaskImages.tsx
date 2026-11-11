"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { attachmentUrl, type AttachmentT } from "@/lib/types";
import { formatBytes } from "@/lib/image";

/** An image chosen for a task that isn't on the server yet. */
export interface PendingImage {
  id: string;
  file: File;
  url: string;
  uploading?: boolean;
}

interface Props {
  attachments: AttachmentT[];
  pending: PendingImage[];
  onAdd: (files: File[]) => void;
  onRemovePending: (id: string) => void;
  onDelete: (attachment: AttachmentT) => void;
  canDelete: (attachment: AttachmentT) => boolean;
}

export const imageFiles = (list: FileList | File[] | null | undefined) => [...(list ?? [])].filter((f) => f.type.startsWith("image/"));

/** Thumbnail grid with add button, drag & drop target and a lightbox. */
export function TaskImages({ attachments, pending, onAdd, onRemovePending, onDelete, canDelete }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [viewer, setViewer] = useState<number | null>(null);

  const all = [
    ...attachments.map((a) => ({ key: a.id, src: attachmentUrl(a.id), name: a.name, size: a.size, saved: a as AttachmentT | null, pending: null as PendingImage | null })),
    ...pending.map((p) => ({ key: p.id, src: p.url, name: p.file.name, size: p.file.size, saved: null, pending: p })),
  ];

  return (
    <div
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
        const files = imageFiles(e.dataTransfer.files);
        if (files.length) onAdd(files);
      }}
      className={`rounded-xl border-2 border-dashed p-2 transition ${dragging ? "border-brand-500 bg-brand-50" : "border-slate-200"}`}
    >
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {all.map((img, i) => (
          <div key={img.key} className="group relative aspect-square overflow-hidden rounded-lg bg-slate-100">
            <button type="button" className="block h-full w-full" onClick={() => setViewer(i)} aria-label={`نمایش ${img.name}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.src} alt={img.name} loading="lazy" className="h-full w-full object-cover transition group-hover:scale-105" />
            </button>
            {img.pending?.uploading && (
              <span className="absolute inset-0 flex items-center justify-center bg-white/70 text-xs text-slate-600">در حال آپلود…</span>
            )}
            {img.pending && !img.pending.uploading && (
              <span className="absolute bottom-1 right-1 rounded bg-slate-900/60 px-1 text-[10px] text-white">آماده آپلود</span>
            )}
            {(img.pending ? !img.pending.uploading : canDelete(img.saved!)) && (
              <button
                type="button"
                className="absolute left-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-slate-900/60 text-sm text-white opacity-0 transition hover:bg-red-600 focus:opacity-100 group-hover:opacity-100"
                onClick={() => (img.pending ? onRemovePending(img.pending.id) : onDelete(img.saved!))}
                aria-label={`حذف ${img.name}`}
              >
                ×
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg bg-slate-50 text-xs text-slate-500 transition hover:bg-brand-50 hover:text-brand-700"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <circle cx="9" cy="10" r="1.6" />
            <path d="m21 16-5-5-8 8" />
          </svg>
          افزودن تصویر
        </button>
      </div>
      <p className="mt-2 text-center text-[11px] text-slate-400">تصویر را بکشید و رها کنید، یا Ctrl+V بزنید · حداکثر ۵ مگابایت</p>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          const files = imageFiles(e.target.files);
          if (files.length) onAdd(files);
          e.target.value = "";
        }}
      />
      {viewer !== null && all[viewer] && (
        <Lightbox
          images={all.map((a) => ({ src: a.src, name: a.name, size: a.size }))}
          index={viewer}
          onIndex={setViewer}
          onClose={() => setViewer(null)}
        />
      )}
    </div>
  );
}

export function Lightbox({ images, index, onIndex, onClose }: { images: { src: string; name: string; size: number }[]; index: number; onIndex: (i: number) => void; onClose: () => void }) {
  useEffect(() => {
    // Capture on window so Escape closes only the lightbox, not the task modal underneath.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") onIndex((index + 1) % images.length);
      else if (e.key === "ArrowRight") onIndex((index - 1 + images.length) % images.length);
      else return;
      e.stopPropagation();
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [index, images.length, onIndex, onClose]);

  const img = images[index];
  // Portal to <body>: the modal's backdrop-blur would otherwise trap this fixed overlay in its scroll area.
  return createPortal(
    <div className="fixed inset-0 z-[70] flex flex-col bg-slate-950/90" onMouseDown={(e) => (e.stopPropagation(), onClose())}>
      <div className="flex items-center justify-between gap-3 p-3 text-sm text-white/80" onMouseDown={(e) => e.stopPropagation()}>
        <span className="truncate">
          {img.name} · {formatBytes(img.size)} {images.length > 1 && `· ${(index + 1).toLocaleString("fa-IR")} از ${images.length.toLocaleString("fa-IR")}`}
        </span>
        <div className="flex gap-1">
          <a href={img.src} target="_blank" rel="noreferrer" className="rounded-lg px-2 py-1 hover:bg-white/10">باز کردن</a>
          <button type="button" className="rounded-lg px-2 py-1 hover:bg-white/10" onClick={onClose} aria-label="بستن">✕</button>
        </div>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center p-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={img.src} alt={img.name} className="max-h-full max-w-full rounded-lg object-contain shadow-2xl" onMouseDown={(e) => e.stopPropagation()} />
        {images.length > 1 && (
          <>
            <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/10 px-3 py-2 text-2xl text-white hover:bg-white/20" onMouseDown={(e) => e.stopPropagation()} onClick={() => onIndex((index - 1 + images.length) % images.length)} aria-label="قبلی">›</button>
            <button type="button" className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/10 px-3 py-2 text-2xl text-white hover:bg-white/20" onMouseDown={(e) => e.stopPropagation()} onClick={() => onIndex((index + 1) % images.length)} aria-label="بعدی">‹</button>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
