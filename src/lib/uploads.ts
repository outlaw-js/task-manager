import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { prisma } from "./prisma";

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_FILE_BYTES = 8 * 1024 * 1024;
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

export interface DetectedFile {
  mime: string;
  ext: string;
  image: boolean;
}

const ZIP_TYPES: Record<string, string> = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  zip: "application/zip",
};
const OLE_TYPES: Record<string, string> = { doc: "application/msword", xls: "application/vnd.ms-excel", ppt: "application/vnd.ms-powerpoint" };
const TEXT_TYPES: Record<string, string> = { txt: "text/plain", csv: "text/csv", md: "text/markdown", log: "text/plain" };

/**
 * Images plus common documents, recognised by their bytes (and, for container
 * formats like .docx/.xlsx that are ZIPs inside, by the extension). Anything
 * else — executables, HTML, SVG — is refused.
 */
export function detectFile(buf: Buffer, name: string): DetectedFile | null {
  const image = detectImage(buf);
  if (image) return { mime: image, ext: IMAGE_TYPES[image], image: true };
  const ext = path.extname(name).slice(1).toLowerCase();
  if (buf.toString("ascii", 0, 5) === "%PDF-") return { mime: "application/pdf", ext: "pdf", image: false };
  if (buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04) {
    const e = ext in ZIP_TYPES ? ext : "zip";
    return { mime: ZIP_TYPES[e], ext: e, image: false };
  }
  if (buf.length >= 8 && buf.readUInt32BE(0) === 0xd0cf11e0 && buf.readUInt32BE(4) === 0xa1b11ae1 && ext in OLE_TYPES) {
    return { mime: OLE_TYPES[ext], ext, image: false };
  }
  if (buf.toString("ascii", 0, 4) === "Rar!") return { mime: "application/vnd.rar", ext: "rar", image: false };
  if (buf.length >= 6 && buf.toString("hex", 0, 6) === "377abcaf271c") return { mime: "application/x-7z-compressed", ext: "7z", image: false };
  if (ext in TEXT_TYPES && !buf.subarray(0, 8192).includes(0)) return { mime: TEXT_TYPES[ext], ext, image: false };
  return null;
}

/** Writes the file under <UPLOAD_DIR>/<folder>/ with a random name; returns the storage key. */
export async function saveFile(folder: string, buf: Buffer, ext: string) {
  const key = `${folder}/${crypto.randomUUID()}.${ext}`;
  const full = resolveKey(key);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, buf, { flag: "wx" });
  return key;
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
export async function removeAttachmentFiles(where: { taskId?: string; commentId?: string; task?: { boardId: string | { in: string[] } } }) {
  const rows = await prisma.attachment.findMany({ where, select: { storageKey: true } });
  await removeFiles(rows.map((r) => r.storageKey));
}

/** Keeps a display name safe and short (no paths, control characters). */
export function cleanName(name: string, mimeOrExt: string) {
  const base = path.basename(name || "").replace(/[\u0000-\u001f<>:"/\\|?*]+/g, "").trim().slice(0, 120);
  const ext = IMAGE_TYPES[mimeOrExt as ImageMime] ?? mimeOrExt;
  return base || `file.${ext}`;
}
