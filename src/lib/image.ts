"use client";

/**
 * Shrinks big photos in the browser before upload (phone photos are often
 * 4–10 MB). GIFs are left alone so animations survive. If the browser can't
 * decode the file, it's sent as-is and the server decides.
 */
export async function prepareImage(file: File, { maxDim = 2000, square = false, quality = 0.85 } = {}): Promise<File> {
  if (file.type === "image/gif" && !square) return file;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file;
  }
  const { width, height } = bitmap;
  // Square mode: centre crop (for profile photos).
  const side = Math.min(width, height);
  const sx = square ? (width - side) / 2 : 0;
  const sy = square ? (height - side) / 2 : 0;
  const sw = square ? side : width;
  const sh = square ? side : height;
  const scale = Math.min(1, maxDim / Math.max(sw, sh));
  const needsWork = square || scale < 1 || file.size > 1.5 * 1024 * 1024 || !/^image\/(png|jpeg|webp|gif)$/.test(file.type);
  if (!needsWork) {
    bitmap.close();
    return file;
  }

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(sw * scale);
  canvas.height = Math.round(sh * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  // Keep PNG for screenshots (sharp text, transparency) unless it's huge; photos become JPEG.
  const keepPng = file.type === "image/png" && !square && file.size < 3 * 1024 * 1024;
  const type = keepPng ? "image/png" : "image/jpeg";
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
  if (!blob) return file;
  const ext = type === "image/png" ? "png" : "jpg";
  const name = (file.name || "image").replace(/\.[^.]+$/, "") + "." + ext;
  return new File([blob], name, { type });
}

/** Uploads one file as multipart "file"; returns the parsed JSON body. */
export async function uploadFile<T>(url: string, file: File): Promise<T> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(url, { method: "POST", body: form });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "آپلود ناموفق بود");
  return data as T;
}

export const formatBytes = (n: number) =>
  n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024)).toLocaleString("fa-IR")} کیلوبایت` : `${(n / 1024 / 1024).toLocaleString("fa-IR", { maximumFractionDigits: 1 })} مگابایت`;
