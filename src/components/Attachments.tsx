import { useEffect, useRef, useState } from "react";
import { FileText, ImageIcon, FileAudio, File as FileIcon, UploadCloud, Download, Eye, X, ZoomIn, ZoomOut, Maximize2, RotateCcw, Trash2, ArrowLeft, ShieldAlert } from "lucide-react";
import type { AttachmentMeta } from "../lib/types";
import { useStore } from "../store";
import { getBlob, previewKind, fmtSize, validateFile, fileExt } from "../lib/files";
import { fmtDate } from "../lib/lifecycle";
import { Button, Notice, EmptyState, Confirm, Field, inputCls } from "./ui";

const KIND_LABEL: Record<AttachmentMeta["kind"], string> = { intake: "Original intake", investigation: "Investigation evidence", shared: "Shared with region", response: "Regional response", training: "Training evidence" };

export function TypeIcon({ a, size = 18 }: { a: { name: string; type: string }; size?: number }) {
  const k = previewKind(a.name, a.type);
  const I = k === "pdf" ? FileText : k === "image" ? ImageIcon : k === "audio" ? FileAudio : FileIcon;
  const c = k === "pdf" ? "text-st-breach bg-st-breach-bg" : k === "image" ? "text-st-hold bg-st-hold-bg" : k === "audio" ? "text-st-progress bg-st-progress-bg" : "text-ink-soft bg-st-closed-bg";
  return <span className={`flex shrink-0 items-center justify-center rounded-md ${c}`} style={{ width: size + 14, height: size + 14 }}><I size={size} aria-hidden /></span>;
}

export function AttachmentList({ items, onPreview, canPreview, canDownload, onRemove, emptyText = "No attachments." }: {
  items: AttachmentMeta[]; onPreview: (a: AttachmentMeta) => void; canPreview: boolean; canDownload: boolean; onRemove?: (a: AttachmentMeta) => boolean; emptyText?: string;
}) {
  const [removing, setRemoving] = useState<AttachmentMeta | null>(null);
  const [reason, setReason] = useState("");
  const { act, toast } = useStore();
  if (!items.length) return <p className="rounded-md border border-dashed border-line-strong px-4 py-5 text-center text-sm text-ink-faint">{emptyText}</p>;
  return (
    <>
      <ul className="divide-y divide-line rounded-lg border border-line">
        {items.map((a) => (
          <li key={a.id} className={`flex flex-wrap items-center gap-3 px-3 py-2.5 ${a.removed ? "opacity-60" : ""}`}>
            <TypeIcon a={a} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`truncate text-sm font-medium text-ink ${a.removed ? "line-through" : ""}`}>{a.name}</span>
                <span className="rounded bg-panel px-1.5 py-px font-mono text-[10px] font-semibold uppercase text-ink-soft ring-1 ring-line">{fileExt(a.name) || "file"}</span>
                <span className="text-[11px] text-ink-faint">{KIND_LABEL[a.kind]}</span>
              </div>
              <div className="text-xs text-ink-faint">{fmtSize(a.size)} · {a.uploadedBy} · {fmtDate(a.uploadedAt, true)}{!a.hasBinary && " · metadata only (synthetic)"}</div>
              <div className="text-[11px] text-ink-faint">Provenance: {a.provenance}</div>
              {a.removed && <div className="text-[11px] text-st-breach">Withdrawn by {a.removed.by} — {a.removed.reason}</div>}
            </div>
            <div className="flex items-center gap-1">
              {canPreview && !a.removed && <Button size="sm" variant="ghost" onClick={() => onPreview(a)} aria-label={`Preview ${a.name}`}><Eye size={14} />Preview</Button>}
              {canDownload && !a.removed && a.hasBinary && <DownloadButton a={a} />}
              {onRemove && !a.removed && onRemove(a) && <Button size="sm" variant="ghost" onClick={() => setRemoving(a)} aria-label={`Withdraw ${a.name}`}><Trash2 size={14} /></Button>}
            </div>
          </li>
        ))}
      </ul>
      {removing && (
        <Confirm title="Withdraw attachment?" confirmLabel="Withdraw attachment" variant="danger" disabled={!reason.trim()}
          consequence={<>“{removing.name}” will be marked as withdrawn. The record and its provenance stay in the case history — nothing is permanently deleted.</>}
          onCancel={() => { setRemoving(null); setReason(""); }}
          onConfirm={() => { const r = act.removeAttachment(removing.id, reason); r.ok ? toast("success", "Attachment withdrawn.") : toast("error", r.error); setRemoving(null); setReason(""); }}>
          <Field label="Reason" required htmlFor="wd-reason"><input id="wd-reason" className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
        </Confirm>
      )}
    </>
  );
}

function DownloadButton({ a }: { a: AttachmentMeta }) {
  const { toast, canSeeFile, can } = useStore();
  return (
    <Button size="sm" variant="ghost" aria-label={`Download ${a.name}`} onClick={async () => {
      if (!canSeeFile(a) || (!can("att.download") && a.kind !== "response")) return toast("error", "You no longer have access to this file.");
      const b = await getBlob(a.id);
      if (!b) return toast("error", "The file binary is not available in this browser's local storage.");
      const url = URL.createObjectURL(b);
      const el = document.createElement("a");
      el.href = url; el.download = a.name; el.click();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    }}><Download size={14} /></Button>
  );
}

interface Upload { file: File; progress: number; error?: string; status: "uploading" | "error" | "done" | "cancelled" }
export function Uploader({ onUpload, label = "Add files", existingCount }: { onUpload: (f: File) => Promise<{ ok: boolean; error?: string }>; label?: string; existingCount: number }) {
  const { db } = useStore();
  const lim = db.settings.attachment;
  const [items, setItems] = useState<Upload[]>([]);
  const [drag, setDrag] = useState(false);
  const cancelled = useRef(new Set<File>());
  const input = useRef<HTMLInputElement>(null);

  async function run(file: File) {
    const set = (p: Partial<Upload>) => setItems((l) => l.map((x) => (x.file === file ? { ...x, ...p } : x)));
    const err = await validateFile(file, lim.types, lim.maxMb);
    if (err) return set({ status: "error", error: err });
    for (let p = 15; p <= 90; p += 25) {
      await new Promise((r) => setTimeout(r, 120));
      if (cancelled.current.has(file)) return set({ status: "cancelled" });
      set({ progress: p });
    }
    const r = await onUpload(file);
    set(r.ok ? { status: "done", progress: 100 } : { status: "error", error: r.error });
  }
  function add(files: FileList | null) {
    if (!files) return;
    const arr = Array.from(files);
    const room = lim.maxCount - existingCount - items.filter((i) => i.status === "uploading" || i.status === "done").length;
    arr.forEach((f, i) => {
      if (i >= room) { setItems((l) => [...l, { file: f, progress: 0, status: "error", error: `Limit of ${lim.maxCount} attachments reached.` }]); return; }
      setItems((l) => [...l, { file: f, progress: 0, status: "uploading" }]);
      void run(f);
    });
  }
  return (
    <div>
      <div onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); add(e.dataTransfer.files); }}
        className={`flex flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed px-4 py-5 text-center transition-colors duration-150 ${drag ? "border-slt-blue bg-slt-blue-50" : "border-line-strong bg-panel"}`}>
        <UploadCloud size={22} className="text-slt-blue" aria-hidden />
        <p className="text-sm text-ink-soft">Drag files here or <button type="button" className="font-semibold text-slt-blue underline-offset-2 hover:underline" onClick={() => input.current?.click()}>{label.toLowerCase()}</button></p>
        <p className="text-[11px] text-ink-faint">Up to {lim.maxMb} MB each · max {lim.maxCount} per record · configurable demo limits. Files are stored locally in this browser; malware scanning is not performed in the demo.</p>
        <input ref={input} type="file" multiple className="sr-only" aria-label={label} onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
      </div>
      {items.length > 0 && (
        <ul className="mt-2 space-y-1.5" aria-live="polite">
          {items.map((u, i) => (
            <li key={i} className="flex items-center gap-2 rounded-md border border-line bg-white px-3 py-2 text-sm">
              <TypeIcon a={{ name: u.file.name, type: u.file.type }} size={14} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{u.file.name} <span className="font-normal text-ink-faint">· {fmtSize(u.file.size)}</span></div>
                {u.status === "uploading" && <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={u.progress} aria-valuemin={0} aria-valuemax={100} aria-label={`Uploading ${u.file.name}`}><div className="h-full bg-slt-blue transition-[width] duration-150" style={{ width: `${u.progress}%` }} /></div>}
                {u.status === "error" && <div className="text-xs text-st-breach">{u.error}</div>}
                {u.status === "done" && <div className="text-xs text-st-resolved">Uploaded</div>}
                {u.status === "cancelled" && <div className="text-xs text-ink-faint">Cancelled</div>}
              </div>
              {u.status === "uploading" && <Button size="sm" variant="ghost" onClick={() => cancelled.current.add(u.file)} aria-label={`Cancel ${u.file.name}`}><X size={14} /></Button>}
              {(u.status === "error" || u.status === "cancelled") && (
                <Button size="sm" variant="ghost" aria-label={`Retry ${u.file.name}`} onClick={() => { cancelled.current.delete(u.file); setItems((l) => l.map((x, j) => (j === i ? { ...x, status: "uploading", progress: 0, error: undefined } : x))); void run(u.file); }}><RotateCcw size={14} />Retry</Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Coordinated preview panel (replaces workspace content rather than stacking dialogs)
export function PreviewPanel({ a, onBack }: { a: AttachmentMeta; onBack: () => void }) {
  const { canSeeFile, can } = useStore();
  const [url, setUrl] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [zoom, setZoom] = useState<number | "fit">("fit");
  const [rate, setRate] = useState(1);
  const audio = useRef<HTMLAudioElement>(null);
  const allowed = canSeeFile(a);
  const kind = previewKind(a.name, a.type);

  useEffect(() => {
    let u: string | null = null;
    let live = true;
    if (!allowed || !a.hasBinary) { setState("missing"); return; }
    getBlob(a.id).then((b) => {
      if (!live) return;
      if (!b) return setState("missing");
      // never render uploaded HTML/SVG: force a safe MIME for known kinds
      const safe = kind === "pdf" ? "application/pdf" : kind === "image" ? (b.type.startsWith("image/") && b.type !== "image/svg+xml" ? b.type : "image/png") : kind === "audio" ? b.type || "audio/mpeg" : "application/octet-stream";
      u = URL.createObjectURL(new Blob([b], { type: safe }));
      setUrl(u);
      setState("ready");
    });
    return () => { live = false; if (u) URL.revokeObjectURL(u); };
  }, [a.id, a.hasBinary, allowed, kind]);

  useEffect(() => { if (audio.current) audio.current.playbackRate = rate; }, [rate, url]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-line bg-panel px-4 py-2.5">
        <Button size="sm" variant="secondary" onClick={onBack}><ArrowLeft size={14} />Back to case</Button>
        <TypeIcon a={a} size={14} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{a.name}</div>
          <div className="text-[11px] text-ink-faint">{fmtSize(a.size)} · {KIND_LABEL[a.kind]} · {a.uploadedBy}</div>
        </div>
        {kind === "image" && state === "ready" && (
          <div className="flex items-center gap-1" role="group" aria-label="Zoom controls">
            <Button size="sm" variant="ghost" aria-label="Zoom out" onClick={() => setZoom((z) => Math.max(0.25, (z === "fit" ? 1 : z) - 0.25))}><ZoomOut size={15} /></Button>
            <span className="w-12 text-center text-xs tabular-nums" aria-live="polite">{zoom === "fit" ? "Fit" : `${Math.round(zoom * 100)}%`}</span>
            <Button size="sm" variant="ghost" aria-label="Zoom in" onClick={() => setZoom((z) => Math.min(4, (z === "fit" ? 1 : z) + 0.25))}><ZoomIn size={15} /></Button>
            <Button size="sm" variant="ghost" aria-label="Fit to view" onClick={() => setZoom("fit")}><Maximize2 size={15} /></Button>
          </div>
        )}
        {state === "ready" && can("att.download") && <DownloadButton a={a} />}
      </div>
      <div className="min-h-0 flex-1 overflow-auto bg-[#eef1f6] p-4">
        {!allowed && <Notice kind="lock">You do not have access to this file.</Notice>}
        {allowed && state === "loading" && <div className="skeleton mx-auto h-64 max-w-xl rounded-lg" />}
        {allowed && state === "missing" && (
          <EmptyState icon={ShieldAlert} title={a.hasBinary ? "File not found in this browser" : "Synthetic attachment — metadata only"}
            body={a.hasBinary ? "The binary may have been cleared from local storage. Re-upload the file to preview it." : "Seeded demo records carry file metadata without a binary. Upload a real PDF, image or audio file to try previews."} />
        )}
        {state === "ready" && url && kind === "pdf" && (
          <div className="flex h-full min-h-[420px] flex-col gap-2">
            <iframe src={url} title={`PDF preview: ${a.name}`} className="min-h-[420px] w-full flex-1 rounded-md border border-line bg-white" />
            <p className="text-xs text-ink-soft">If the embedded viewer is unavailable in your browser, <a href={url} target="_blank" rel="noopener noreferrer" className="font-semibold text-slt-blue underline">open the PDF</a> or download it.</p>
          </div>
        )}
        {state === "ready" && url && kind === "image" && (
          <div className={`flex min-h-full ${zoom === "fit" ? "items-center justify-center" : ""}`}>
            <img src={url} alt={`Preview of ${a.name}`} onError={() => setState("error")}
              style={zoom === "fit" ? { maxWidth: "100%", maxHeight: "70vh" } : { width: `${zoom * 100}%`, maxWidth: "none" }} className="rounded-md bg-white shadow" />
          </div>
        )}
        {state === "ready" && url && kind === "audio" && (
          <div className="mx-auto max-w-xl rounded-lg border border-line bg-white p-5">
            <p className="mb-3 text-sm text-ink-soft">Voice clip · use the player controls to play, pause and seek. Elapsed and total time are shown by your browser's player.</p>
            <audio ref={audio} src={url} controls preload="metadata" className="w-full" onError={() => setState("error")} aria-label={`Audio: ${a.name}`} />
            <div className="mt-3 flex items-center gap-2">
              <label htmlFor="rate" className="text-xs font-medium text-ink-soft">Playback speed</label>
              <select id="rate" className={`${inputCls} w-28 py-1`} value={rate} onChange={(e) => setRate(Number(e.target.value))}>
                {[0.75, 1, 1.25, 1.5, 2].map((r) => <option key={r} value={r}>{r}×</option>)}
              </select>
            </div>
          </div>
        )}
        {state === "ready" && kind === "other" && (
          <EmptyState icon={FileIcon} title="No in-browser preview for this type" body={`${a.name} · ${fmtSize(a.size)}. Download the file to open it in the appropriate application.`} action={can("att.download") ? <DownloadButton a={a} /> : undefined} />
        )}
        {state === "error" && <Notice kind="error" title="This file could not be rendered">The browser could not decode it — it may be corrupt or in an unsupported codec. Download it instead.</Notice>}
      </div>
    </div>
  );
}
