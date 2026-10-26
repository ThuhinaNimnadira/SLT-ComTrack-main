// Local attachment binaries in IndexedDB (demo storage — not production storage, no malware scanning).
const DB_NAME = "comtrack-files";
const STORE = "blobs";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("IndexedDB unavailable"));
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function putBlob(id: string, blob: Blob) {
  const db = await open();
  await new Promise<void>((res, rej) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(blob, id);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}

export async function getBlob(id: string): Promise<Blob | null> {
  try {
    const db = await open();
    return await new Promise((res, rej) => {
      const r = db.transaction(STORE).objectStore(STORE).get(id);
      r.onsuccess = () => res((r.result as Blob) ?? null);
      r.onerror = () => rej(r.error);
    });
  } catch {
    return null;
  }
}

export async function clearBlobs() {
  try {
    const db = await open();
    await new Promise<void>((res) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).clear();
      tx.oncomplete = () => res();
      tx.onerror = () => res();
    });
  } catch {
    /* ignore */
  }
}

export function fileExt(name: string) {
  const i = name.lastIndexOf(".");
  return i < 0 ? "" : name.slice(i + 1).toLowerCase();
}

export type PreviewKind = "pdf" | "image" | "audio" | "other";
export function previewKind(name: string, type: string): PreviewKind {
  const ext = fileExt(name);
  if (ext === "pdf" || type === "application/pdf") return "pdf";
  if (["png", "jpg", "jpeg", "gif", "webp"].includes(ext) || /^image\/(png|jpeg|gif|webp)$/.test(type)) return "image";
  if (["mp3", "m4a", "wav", "ogg"].includes(ext) || type.startsWith("audio/")) return "audio";
  return "other";
}

export function fmtSize(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

const BLOCKED = ["html", "htm", "js", "exe", "bat", "cmd", "svg", "sh", "msi", "jar", "vbs", "ps1"];
const MAGIC: Record<string, number[][]> = {
  pdf: [[0x25, 0x50, 0x44, 0x46]],
  png: [[0x89, 0x50, 0x4e, 0x47]],
  jpg: [[0xff, 0xd8, 0xff]],
  jpeg: [[0xff, 0xd8, 0xff]],
  gif: [[0x47, 0x49, 0x46]],
};

// Validates extension, allow-list, size, emptiness and (for common types) file signature.
export async function validateFile(file: File, allowed: string[], maxMb: number): Promise<string | null> {
  const ext = fileExt(file.name);
  if (!ext) return "File has no extension.";
  if (BLOCKED.includes(ext)) return `.${ext} files are not permitted for security reasons.`;
  if (!allowed.includes(ext)) return `.${ext} is not an allowed type. Allowed: ${allowed.join(", ")}.`;
  if (file.size === 0) return "File is empty.";
  if (file.size > maxMb * 1024 * 1024) return `File exceeds the ${maxMb} MB limit (${fmtSize(file.size)}).`;
  const sigs = MAGIC[ext];
  if (sigs) {
    const head = new Uint8Array(await file.slice(0, 8).arrayBuffer());
    if (!sigs.some((s) => s.every((b, i) => head[i] === b))) return `File content does not match .${ext} — it may be corrupt or mislabelled.`;
  }
  return null;
}
