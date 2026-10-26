import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { X, AlertTriangle, CheckCircle2, Info, Lock, Inbox as InboxIcon, Loader2 } from "lucide-react";
import type { Status, Priority, Source, Outcome, FeedbackState, ReviewState, TrainingStatus } from "../lib/types";

// ── Badges (never colour-only: every badge carries text and an icon/shape cue) ──
const tone: Record<string, string> = {
  open: "text-st-open bg-st-open-bg",
  progress: "text-st-progress bg-st-progress-bg",
  resolved: "text-st-resolved bg-st-resolved-bg",
  closed: "text-st-closed bg-st-closed-bg",
  breach: "text-st-breach bg-st-breach-bg",
  hold: "text-st-hold bg-st-hold-bg",
};
const STATUS_TONE: Record<Status, string> = { Open: "open", "In Progress": "progress", Resolved: "resolved", Closed: "closed" };
const STATUS_GLYPH: Record<Status, string> = { Open: "○", "In Progress": "◐", Resolved: "●", Closed: "■" };

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${tone[STATUS_TONE[status]]}`}>
      <span aria-hidden className="text-[10px] leading-none">{STATUS_GLYPH[status]}</span>
      {status}
    </span>
  );
}

export function FeedbackBadge({ state }: { state: FeedbackState }) {
  if (state === "None") return null;
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-1.5 py-0.5 text-[11px] font-semibold ${state === "Awaiting" ? "border-st-hold/30 text-st-hold bg-st-hold-bg" : "border-st-resolved/30 text-st-resolved bg-white"}`}>
      <span aria-hidden>{state === "Awaiting" ? "⏳" : "↩"}</span>
      {state === "Awaiting" ? "Awaiting regional" : "Regional received"}
    </span>
  );
}

export function ReviewBadge({ state }: { state: ReviewState }) {
  if (state === "Not Submitted" || state === "Approved") return null;
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${state === "Pending Review" ? "text-st-progress ring-st-progress/30 bg-white" : "text-st-breach ring-st-breach/30 bg-white"}`}>
      {state === "Pending Review" ? "Pending review" : "Returned"}
    </span>
  );
}

export function OutcomeBadge({ outcome }: { outcome: Outcome }) {
  const map: Record<Outcome, string> = {
    Pending: "text-ink-faint border-dashed border-line-strong",
    "Officer's Fault": "text-st-breach border-st-breach/35",
    "Not an Officer's Fault": "text-st-resolved border-st-resolved/35",
    Irrelevant: "text-ink-soft border-line-strong",
  };
  return <span className={`inline-flex whitespace-nowrap rounded-md border bg-white px-2 py-0.5 text-[11px] font-semibold ${map[outcome]}`}>{outcome === "Pending" ? "Outcome: not determined" : outcome}</span>;
}

const PRIO: Record<Priority, string> = {
  Critical: "text-st-breach bg-st-breach-bg ring-st-breach/20",
  High: "text-st-progress bg-st-progress-bg ring-st-progress/20",
  Medium: "text-st-open bg-st-open-bg ring-st-open/15",
  Low: "text-ink-soft bg-st-closed-bg ring-transparent",
};
const PRIO_BARS: Record<Priority, number> = { Critical: 4, High: 3, Medium: 2, Low: 1 };
export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${PRIO[priority]}`}>
      <span aria-hidden className="flex items-end gap-px">
        {[1, 2, 3, 4].map((i) => <span key={i} className={`w-[2px] rounded-sm ${i <= PRIO_BARS[priority] ? "bg-current" : "bg-current opacity-20"}`} style={{ height: 3 + i * 2 }} />)}
      </span>
      {priority}
    </span>
  );
}

export function SourceTag({ source, legacy }: { source: Source; legacy?: string }) {
  return (
    <span title={legacy ? `Historical label: ${legacy}` : undefined} className="inline-flex items-center whitespace-nowrap rounded-md bg-slt-blue-50 px-2 py-0.5 font-mono text-[11px] font-medium text-slt-blue-dark">
      {source}
    </span>
  );
}

export function LocationBadge({ label }: { label: string }) {
  return <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-line-strong bg-panel px-1.5 py-0.5 text-[11px] font-medium text-ink-soft">🗄 {label}</span>;
}

const TS_TONE: Record<TrainingStatus, string> = {
  Proposed: "open", Approved: "hold", "In Progress": "progress", Completed: "resolved", Reviewed: "closed", "Needs Changes": "breach", Rejected: "closed",
};
export function TrainingBadge({ status, overdue }: { status: TrainingStatus; overdue?: boolean }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${tone[TS_TONE[status]]}`}>{status}</span>
      {overdue && <span className="whitespace-nowrap rounded-md bg-st-breach px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">Overdue</span>}
    </span>
  );
}

export function DemoTag({ children = "Demo" }: { children?: ReactNode }) {
  return <span className="inline-flex items-center rounded bg-st-progress-bg px-1.5 py-px font-mono text-[10px] font-semibold uppercase tracking-wide text-st-progress">{children}</span>;
}

// ── Avatar ──
const AVATAR_COLORS = ["#0a4595", "#3f7f23", "#07779f", "#8a5300", "#6b4bb0", "#a61f1f"];
export function Avatar({ initials, size = 28, label }: { initials: string | null; size?: number; label?: string }) {
  if (!initials) return <span aria-label="Unassigned" className="inline-flex items-center justify-center rounded-full border border-dashed border-line-strong text-ink-faint" style={{ width: size, height: size, fontSize: size * 0.4 }}>—</span>;
  const idx = (initials.charCodeAt(0) + (initials.charCodeAt(1) || 0)) % AVATAR_COLORS.length;
  return <span aria-label={label} className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white" style={{ width: size, height: size, fontSize: size * 0.38, background: AVATAR_COLORS[idx] }}>{initials}</span>;
}

// ── Layout primitives ──
export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-[var(--radius-card)] border border-line bg-surface ${className}`}>{children}</section>;
}
export function CardHeader({ title, subtitle, action }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-3.5">
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-ink-faint">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({ crumbs, title, description, actions }: { crumbs: string[]; title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <nav aria-label="Breadcrumb" className="mb-1 text-[11px] font-medium uppercase tracking-wide text-ink-faint">
          <ol className="flex flex-wrap items-center gap-1">
            {crumbs.map((c, i) => <li key={i} className="flex items-center gap-1">{i > 0 && <span aria-hidden>/</span>}{c}</li>)}
          </ol>
        </nav>
        <h1 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-ink-soft">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

type BtnVariant = "primary" | "secondary" | "ghost" | "danger" | "success";
export function Button({ children, variant = "secondary", size = "md", onClick, type = "button", className = "", disabled, title, loading, ...rest }: {
  children: ReactNode; variant?: BtnVariant; size?: "sm" | "md"; onClick?: () => void; type?: "button" | "submit"; className?: string; disabled?: boolean; title?: string; loading?: boolean; "aria-label"?: string;
}) {
  const sizes = { sm: "px-2.5 py-1.5 text-xs", md: "px-3.5 py-2 text-sm" };
  const variants: Record<BtnVariant, string> = {
    primary: "bg-slt-blue text-white hover:bg-slt-blue-dark shadow-sm",
    secondary: "border border-line-strong bg-white text-ink hover:bg-panel hover:border-ink-faint",
    ghost: "text-ink-soft hover:bg-st-closed-bg hover:text-ink",
    danger: "bg-st-breach text-white hover:brightness-95 shadow-sm",
    success: "bg-slt-green-dark text-white hover:brightness-95 shadow-sm",
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled || loading} title={title} aria-label={rest["aria-label"]}
      className={`inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-control)] font-medium transition-[background,border,color,box-shadow] duration-150 disabled:pointer-events-none disabled:opacity-50 ${sizes[size]} ${variants[variant]} ${className}`}>
      {loading && <Loader2 size={14} className="animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

export function Field({ label, required, hint, error, children, htmlFor }: { label: string; required?: boolean; hint?: ReactNode; error?: string; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="block">
      <label htmlFor={htmlFor} className="mb-1.5 flex items-center gap-1 text-xs font-medium text-ink-soft">
        {label}
        {required && <span className="text-st-breach" aria-hidden>*</span>}
        {required && <span className="sr-only">(required)</span>}
      </label>
      {children}
      {error ? <p role="alert" className="mt-1 flex items-center gap-1 text-xs text-st-breach"><AlertTriangle size={12} aria-hidden />{error}</p> : hint ? <p className="mt-1 text-xs text-ink-faint">{hint}</p> : null}
    </div>
  );
}

export const inputCls =
  "w-full rounded-[var(--radius-control)] border border-line-strong bg-white px-3 py-2 text-sm text-ink placeholder:text-ink-faint transition focus:border-slt-blue focus:outline-none focus:ring-2 focus:ring-slt-blue/15 disabled:bg-panel disabled:text-ink-soft read-only:bg-panel";

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h3 className="text-[12px] font-semibold uppercase tracking-wide text-ink-faint">{children}</h3>;
}

export function EmptyState({ icon: Icon = InboxIcon, title, body, action }: { icon?: typeof InboxIcon; title: string; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-slt-blue-50 text-slt-blue"><Icon size={20} aria-hidden /></div>
      <p className="text-sm font-semibold text-ink">{title}</p>
      {body && <p className="mt-1 max-w-sm text-sm text-ink-soft">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Notice({ kind = "info", children, title }: { kind?: "info" | "warn" | "error" | "success" | "lock"; children: ReactNode; title?: string }) {
  const map = {
    info: ["bg-slt-blue-50 text-slt-blue-dark border-slt-blue-100", Info],
    warn: ["bg-st-progress-bg text-[#7a4900] border-st-progress/20", AlertTriangle],
    error: ["bg-st-breach-bg text-st-breach border-st-breach/20", AlertTriangle],
    success: ["bg-st-resolved-bg text-st-resolved border-st-resolved/20", CheckCircle2],
    lock: ["bg-st-closed-bg text-ink-soft border-line", Lock],
  } as const;
  const [cls, Icon] = map[kind];
  return (
    <div role={kind === "error" ? "alert" : undefined} className={`flex items-start gap-2 rounded-md border px-3 py-2.5 text-[13px] leading-relaxed ${cls}`}>
      <Icon size={15} className="mt-0.5 shrink-0" aria-hidden />
      <div className="min-w-0">{title && <div className="font-semibold">{title}</div>}{children}</div>
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton rounded ${className}`} aria-hidden />;
}

// ── Tabs (roving keyboard) ──
export function Tabs<T extends string>({ tabs, value, onChange, label }: { tabs: { id: T; label: string; count?: number }[]; value: T; onChange: (v: T) => void; label: string }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  return (
    <div role="tablist" aria-label={label} className="flex gap-1 overflow-x-auto border-b border-line">
      {tabs.map((t, i) => (
        <button key={t.id} ref={(el) => { refs.current[i] = el; }} role="tab" aria-selected={value === t.id} tabIndex={value === t.id ? 0 : -1}
          onKeyDown={(e) => {
            if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
            const n = (i + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
            refs.current[n]?.focus();
            onChange(tabs[n].id);
          }}
          onClick={() => onChange(t.id)}
          className={`relative -mb-px flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm transition-colors duration-150 ${value === t.id ? "border-slt-blue font-semibold text-slt-blue" : "border-transparent font-medium text-ink-soft hover:text-ink"}`}>
          {t.label}
          {t.count !== undefined && <span className={`rounded-full px-1.5 text-[10px] font-semibold ${value === t.id ? "bg-slt-blue text-white" : "bg-st-closed-bg text-ink-soft"}`}>{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

// ── Accessible dialog: focus trap, initial focus, Esc, return focus. Full-screen on mobile. ──
export function Dialog({ title, subtitle, onClose, children, footer, size = "md", header, labelledBy, closeLabel = "Close dialog" }: {
  title?: ReactNode; subtitle?: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; size?: "sm" | "md" | "lg" | "xl"; header?: ReactNode; labelledBy?: string; closeLabel?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const autoId = useId();
  const titleId = labelledBy ?? autoId;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const node = ref.current!;
    const first = node.querySelector<HTMLElement>("[data-autofocus]") ?? node.querySelector<HTMLElement>("input:not([disabled]),textarea:not([disabled]),select:not([disabled]),button:not([disabled])");
    (first ?? node).focus();
    const onKey = (e: KeyboardEvent) => {
      if (!node.contains(document.activeElement) && !node.isSameNode(document.activeElement)) return;
      if (e.key === "Escape") { e.stopPropagation(); onCloseRef.current(); }
      if (e.key !== "Tab") return;
      const f = Array.from(node.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),audio[controls],iframe,[tabindex]:not([tabindex="-1"])')).filter((el) => el.offsetParent !== null);
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    };
    node.addEventListener("keydown", onKey);
    return () => { node.removeEventListener("keydown", onKey); prev?.focus?.(); };
  }, []);
  const w = { sm: "sm:max-w-md", md: "sm:max-w-xl", lg: "sm:max-w-3xl", xl: "sm:max-w-6xl" }[size];
  return (
    <div className="animate-overlay fixed inset-0 z-50 flex items-stretch justify-center bg-[#10233c]/45 backdrop-blur-[2px] sm:items-center sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}
        className={`animate-pop flex h-full w-full flex-col overflow-hidden bg-white shadow-[var(--shadow-overlay)] outline-none sm:h-auto sm:max-h-[92vh] sm:rounded-xl ${w} ${size === "xl" ? "sm:h-[92vh]" : ""}`}>
        {header ?? (
          <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4 sm:px-6">
            <div className="min-w-0">
              <h2 id={titleId} className="text-base font-semibold text-ink">{title}</h2>
              {subtitle && <div className="mt-0.5 text-xs text-ink-faint">{subtitle}</div>}
            </div>
            <button onClick={onClose} aria-label={closeLabel} className="rounded-md p-1.5 text-ink-faint hover:bg-panel hover:text-ink"><X size={18} /></button>
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-panel px-5 py-3 sm:px-6">{footer}</div>}
      </div>
    </div>
  );
}

// ── Confirmation with explicit consequence and action-specific label ──
export function Confirm({ title, consequence, confirmLabel, onConfirm, onCancel, variant = "primary", children, requireText, disabled }: {
  title: string; consequence: ReactNode; confirmLabel: string; onConfirm: () => void; onCancel: () => void; variant?: BtnVariant; children?: ReactNode; requireText?: string; disabled?: boolean;
}) {
  const [typed, setTyped] = useState("");
  return (
    <Dialog title={title} onClose={onCancel} size="sm" footer={<>
      <Button variant="ghost" onClick={onCancel}>Cancel</Button>
      <Button variant={variant} onClick={onConfirm} disabled={disabled || (!!requireText && typed !== requireText)}>{confirmLabel}</Button>
    </>}>
      <div className="space-y-4 px-5 py-4 sm:px-6">
        <div className="text-sm leading-relaxed text-ink-soft">{consequence}</div>
        {children}
        {requireText && (
          <Field label={`Type ${requireText} to confirm`} htmlFor="confirm-type">
            <input id="confirm-type" className={inputCls} value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
          </Field>
        )}
      </div>
    </Dialog>
  );
}

// ── Responsive data table: prioritised columns on desktop, cards on mobile ──
export interface Column<T> { key: string; header: string; render: (r: T) => ReactNode; priority?: 1 | 2 | 3; className?: string; sortValue?: (r: T) => string | number }
export function DataTable<T>({ rows, columns, rowKey, onRowClick, rowLabel, empty, caption, card }: {
  rows: T[]; columns: Column<T>[]; rowKey: (r: T) => string; onRowClick?: (r: T) => void; rowLabel?: (r: T) => string; empty?: ReactNode; caption: string; card?: (r: T) => ReactNode;
}) {
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);
  const sorted = (() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortValue) return rows;
    return [...rows].sort((a, b) => { const x = col.sortValue!(a), y = col.sortValue!(b); return (x < y ? -1 : x > y ? 1 : 0) * sort.dir; });
  })();
  const vis = (p?: number) => (p === 3 ? "hidden xl:table-cell" : p === 2 ? "hidden lg:table-cell" : "");
  if (!rows.length) return <>{empty}</>;
  return (
    <>
      <div className="hidden md:block">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="border-b border-line bg-panel text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
              {columns.map((c) => (
                <th key={c.key} scope="col" className={`px-4 py-2.5 ${vis(c.priority)} ${c.className ?? ""}`} aria-sort={sort?.key === c.key ? (sort.dir === 1 ? "ascending" : "descending") : undefined}>
                  {c.sortValue ? (
                    <button className="inline-flex items-center gap-1 uppercase hover:text-ink" onClick={() => setSort((s) => (s?.key === c.key ? { key: c.key, dir: s.dir === 1 ? -1 : 1 } : { key: c.key, dir: 1 }))}>
                      {c.header}<span aria-hidden>{sort?.key === c.key ? (sort.dir === 1 ? "▲" : "▼") : "↕"}</span>
                    </button>
                  ) : c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={rowKey(r)} className={`border-b border-line last:border-0 transition-colors duration-150 ${onRowClick ? "cursor-pointer hover:bg-slt-blue-50/50" : ""}`}
                onClick={onRowClick ? () => onRowClick(r) : undefined}>
                {columns.map((c, i) => (
                  <td key={c.key} className={`px-4 py-3 align-middle ${vis(c.priority)} ${c.className ?? ""}`}>
                    {i === 0 && onRowClick ? (
                      <button className="text-left font-mono text-[13px] font-semibold text-slt-blue hover:underline" aria-label={rowLabel?.(r)} onClick={(e) => { e.stopPropagation(); onRowClick(r); }}>{c.render(r)}</button>
                    ) : c.render(r)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="divide-y divide-line md:hidden" aria-label={caption}>
        {sorted.map((r) => (
          <li key={rowKey(r)}>
            {onRowClick ? (
              <button className="block w-full px-4 py-3 text-left hover:bg-panel" onClick={() => onRowClick(r)} aria-label={rowLabel?.(r)}>{card ? card(r) : columns.map((c) => <div key={c.key} className="text-sm">{c.render(r)}</div>)}</button>
            ) : (
              <div className="px-4 py-3">{card ? card(r) : columns.map((c) => <div key={c.key} className="text-sm"><span className="text-xs text-ink-faint">{c.header}: </span>{c.render(r)}</div>)}</div>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}

export function KV({ label, children, mono }: { label: string; children: ReactNode; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-ink-faint">{label}</dt>
      <dd className={`mt-0.5 break-words text-sm text-ink ${mono ? "font-mono text-[13px]" : ""}`}>{children || <span className="text-ink-faint">—</span>}</dd>
    </div>
  );
}

export function SaveState({ state }: { state: "saved" | "dirty" | "readonly" | "pending" }) {
  const m = {
    saved: ["text-st-resolved", "✓ Saved"],
    dirty: ["text-st-progress", "● Unsaved changes"],
    readonly: ["text-ink-faint", "🔒 Read-only"],
    pending: ["text-st-progress", "⏳ Pending review"],
  }[state];
  return <span role="status" className={`text-xs font-semibold ${m[0]}`}>{m[1]}</span>;
}
