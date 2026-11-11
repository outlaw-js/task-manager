import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { prisma } from "./prisma";

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_IMAGES_PER_TASK = 20;

export const uploadDir = () => path.resolve(process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads"));

const IMAGE_TYPES = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
} as const;
export type ImageMime = keyof typeof IMAGE_TYPES;

/** Identifies the image type from the file's own bytes; the browser's claimed type is not trusted. */
export function detectImage(buf: Buffer): ImageMime | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0x89 && buf.toString("ascii", 1, 4) === "PNG") return "image/png";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.toString("ascii", 0, 4) === "GIF8") return "image/gif";
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  return null;
}

/** Writes the file under <UPLOAD_DIR>/<folder>/ with a random name; returns the storage key. */
export async function saveImage(folder: string, buf: Buffer, mime: ImageMime) {
  const key = `${folder}/${crypto.randomUUID()}.${IMAGE_TYPES[mime]}`;
  const full = resolveKey(key);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, buf, { flag: "wx" });
  return key;
}

/** Absolute path for a storage key, refusing anything that would escape the upload directory. */
export function resolveKey(key: string) {
  const root = uploadDir();
  const full = path.resolve(root, key);
  if (!full.startsWith(root + path.sep)) throw new Error("invalid storage key");
  return full;
}

export async function removeFiles(keys: string[]) {
  await Promise.all(keys.map((k) => fs.unlink(resolveKey(k)).catch(() => {})));
}

/** Call before deleting tasks/boards: database rows cascade, files on disk don't. */
export async function removeAttachmentFiles(where: { taskId?: string; task?: { boardId: string | { in: string[] } } }) {
  const rows = await prisma.attachment.findMany({ where, select: { storageKey: true } });
  await removeFiles(rows.map((r) => r.storageKey));
}

/** Keeps a display name safe and short (no paths, control characters). */
export function cleanName(name: string, mime: ImageMime) {
  const base = path.basename(name || "").replace(/[\u0000-\u001f<>:"/\\|?*]+/g, "").trim().slice(0, 120);
  return base || `image.${IMAGE_TYPES[mime]}`;
}
