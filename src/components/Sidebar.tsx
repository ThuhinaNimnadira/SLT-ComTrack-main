import { useEffect, useState } from "react";
import { ChevronDown, PanelLeftClose, PanelLeftOpen, X, Lock, FlaskConical } from "lucide-react";
import logo from "../assets/slt-logo.png";
import { useStore } from "../store";
import { navFor, go, type RouteKey, type CountCtx } from "../nav";

export default function Sidebar({ active, collapsed, onToggle, mobileOpen, onCloseMobile }: { active: string; collapsed: boolean; onToggle: () => void; mobileOpen: boolean; onCloseMobile: () => void }) {
  const { me, db } = useStore();
  const groups = navFor(me, db.templates);
  const key = `comtrack:nav:${me?.id}`;
  const [open, setOpen] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem(key) ?? "{}"); } catch { return {}; }
  });
  useEffect(() => { localStorage.setItem(key, JSON.stringify(open)); }, [open, key]);
  const cctx: CountCtx | null = me ? { me, complaints: db.complaints, requests: db.requests, training: db.training, inbox: db.inbox, templates: db.templates } : null;

  const nav = (k: RouteKey) => { go(k); onCloseMobile(); };
  const isOpen = (id: string, hasActive: boolean) => open[id] ?? (hasActive || true);

  const content = (compact: boolean) => (
    <nav aria-label="Main" className="flex-1 overflow-y-auto px-2.5 py-3">
      {groups.map((g) => {
        const hasActive = g.items.some((i) => i.key === active);
        const expanded = compact || isOpen(g.id, hasActive);
        const single = g.items.length === 1;
        return (
          <div key={g.id} className={compact ? "mb-2 border-b border-line pb-2 last:border-0" : "mb-1"}>
            {!compact && !single && (
              <button aria-expanded={expanded} onClick={() => setOpen((o) => ({ ...o, [g.id]: !expanded }))}
                className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-[11px] font-semibold uppercase tracking-wider transition-colors ${hasActive ? "text-slt-blue" : "text-ink-faint hover:text-ink-soft"}`}>
                <span className="flex-1 text-left">{g.label}</span>
                <ChevronDown size={14} aria-hidden className={`transition-transform duration-200 ${expanded ? "" : "-rotate-90"}`} />
              </button>
            )}
            {!compact && single && <div className="px-2.5 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-ink-faint">{g.label}</div>}
            <div className={single ? "" : `grid transition-[grid-template-rows] duration-200 ${expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
              <ul className="overflow-hidden">
                {g.items.map((item) => {
                  const isActive = active === item.key || (item.key.startsWith("reports/") && active.startsWith("reports/"));
                  const Icon = item.icon;
                  const count = cctx && item.count ? item.count(cctx) : 0;
                  return (
                    <li key={item.key} className="group relative">
                      <button onClick={() => nav(item.key)} aria-current={isActive ? "page" : undefined} tabIndex={expanded ? 0 : -1}
                        aria-label={compact ? `${item.label}${count ? `, ${count}` : ""}` : undefined}
                        className={`relative mb-0.5 flex w-full items-center gap-2.5 rounded-md py-2 text-sm transition-colors duration-150 ${compact ? "justify-center px-0" : "px-2.5"} ${isActive ? "bg-slt-blue-50 font-semibold text-slt-blue" : "font-medium text-ink-soft hover:bg-panel hover:text-ink"}`}>
                        {isActive && <span aria-hidden className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r bg-slt-blue" />}
                        <Icon size={17} aria-hidden className={isActive ? "text-slt-blue" : "text-ink-faint"} />
                        {!compact && <span className="flex-1 truncate text-left">{item.label}</span>}
                        {!!count && (compact
                          ? <span className="absolute right-1.5 top-1 h-2 w-2 rounded-full bg-slt-green" aria-hidden />
                          : <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${isActive ? "bg-slt-blue text-white" : "bg-st-closed-bg text-ink-soft"}`}>{count}</span>)}
                      </button>
                      {compact && (
                        <span role="tooltip" className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 whitespace-nowrap rounded-md bg-ink px-2 py-1 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
                          {g.label} · {item.label}{count ? ` (${count})` : ""}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        );
      })}
    </nav>
  );

  const footer = (compact: boolean) => !compact && me && (
    <div className="border-t border-line p-3">
      <div className="flex items-start gap-2 rounded-md bg-slt-green-50 px-3 py-2 text-[11px] leading-tight text-slt-green-dark">
        {me.role === "Group Manager" ? <Lock size={14} className="mt-0.5 shrink-0" aria-hidden /> : <FlaskConical size={14} className="mt-0.5 shrink-0" aria-hidden />}
        <div>
          <div className="font-semibold">{me.role === "Group Manager" ? "Restricted workspace" : me.role === "Admin" ? "System administration" : "Prototype environment"}</div>
          <div className="opacity-85">{me.role === "Group Manager" ? "Assigned feedback requests only" : me.role === "Admin" ? "No access to complaint content" : "Synthetic data · simulated mail sync"}</div>
        </div>
      </div>
    </div>
  );

  const brand = (compact: boolean) => (
    <div className={`flex h-16 shrink-0 items-center border-b border-line ${compact ? "justify-center px-2" : "gap-2.5 px-4"}`}>
      {compact ? <span className="flex h-8 w-8 items-center justify-center rounded-md bg-slt-blue text-[11px] font-bold text-white">CT</span> : (
        <>
          <img src={logo} alt="SLT Mobitel" className="h-8 w-auto" />
          <div className="border-l border-line pl-2.5">
            <div className="text-[13px] font-bold leading-tight text-slt-blue">ComTrack</div>
            <div className="text-[10px] leading-tight text-ink-faint">Contact Centre CMTS</div>
          </div>
        </>
      )}
    </div>
  );

  return (
    <>
      <aside className={`hidden h-full shrink-0 flex-col border-r border-line bg-surface transition-[width] duration-200 lg:flex ${collapsed ? "w-[68px]" : "w-64"}`}>
        {brand(collapsed)}
        {content(collapsed)}
        {footer(collapsed)}
        <button onClick={onToggle} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar to icons"} className="flex items-center gap-2 border-t border-line px-4 py-2.5 text-xs font-medium text-ink-faint hover:bg-panel hover:text-ink">
          {collapsed ? <PanelLeftOpen size={16} className="mx-auto" /> : <><PanelLeftClose size={16} /> Collapse</>}
        </button>
      </aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <div className="animate-overlay absolute inset-0 bg-[#10233c]/45" onClick={onCloseMobile} />
          <aside className="animate-drawer relative flex h-full w-[min(84vw,300px)] flex-col bg-surface shadow-2xl">
            <div className="flex items-center justify-between pr-2">{brand(false)}<button aria-label="Close navigation" onClick={onCloseMobile} className="rounded-md p-2 text-ink-faint hover:bg-panel"><X size={18} /></button></div>
            {content(false)}
            {footer(false)}
          </aside>
        </div>
      )}
    </>
  );
}
