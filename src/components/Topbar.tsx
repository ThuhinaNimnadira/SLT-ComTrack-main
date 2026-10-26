import { useEffect, useMemo, useRef, useState } from "react";
import { Search, Bell, Menu, ChevronDown, LogOut, UserCircle, RotateCcw, Users2, CheckCheck, ShieldAlert } from "lucide-react";
import { useStore } from "../store";
import { Avatar, DemoTag, Confirm, StatusBadge } from "./ui";
import { go, setParam, allItems } from "../nav";
import { relTime } from "../lib/lifecycle";
import { canViewCase, canViewTraining } from "../lib/permissions";
import type { Notification, NotifEvent } from "../lib/types";

const EVENT_LABEL: Record<NotifEvent, string> = {
  assignment: "Assignment", regional_request: "Regional request", regional_response: "Regional response", pending_review: "Pending review",
  returned: "Returned", closed: "Closed", training_assigned: "Training", training_reminder: "Training reminder", training_review: "Training review", system: "System",
};

export default function Topbar({ routeKey, onMenu }: { routeKey: string; onMenu: () => void }) {
  const { me, db, visibleComplaints, can, logout, login, resetDemo, act } = useStore();
  const [panel, setPanel] = useState<null | "notif" | "user" | "switch">(null);
  const [q, setQ] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const wrap = useRef<HTMLDivElement>(null);
  const item = allItems().find((i) => i.key === routeKey);
  const isBiz = me && (me.role === "Manager" || me.role === "Technical Officer") && can("case.view");

  useEffect(() => {
    const on = (e: MouseEvent) => { if (wrap.current && !wrap.current.contains(e.target as Node)) setPanel(null); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setPanel(null); };
    document.addEventListener("mousedown", on);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", on); document.removeEventListener("keydown", key); };
  }, []);

  // Notifications never grant access: targets are re-checked against current policy.
  const mine = db.notifications.filter((n) => n.userId === me?.id);
  const accessible = (n: Notification) => {
    if (!me || !n.target) return !!me;
    if (n.target.kind === "case") { const c = db.complaints.find((x) => x.id === n.target!.id); return !!c && canViewCase(me, c, db.templates); }
    if (n.target.kind === "request") return me.role === "Group Manager" && db.requests.some((r) => r.id === n.target!.id && r.groupManagerId === me.id);
    const t = db.training.find((x) => x.id === n.target!.id);
    return !!t && canViewTraining(me, t, db.templates);
  };
  const shown = mine.filter((n) => filter === "all" || !n.read);
  const unread = mine.filter((n) => !n.read).length;

  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s || !isBiz) return [];
    return visibleComplaints.filter((c) => [c.id, c.customer, c.sltNumber, c.sourceRef, c.contact].some((v) => v.toLowerCase().includes(s))).slice(0, 7);
  }, [q, visibleComplaints, isBiz]);

  function openNotif(n: Notification) {
    act.markRead(n.id);
    setPanel(null);
    if (!n.target || !accessible(n)) return;
    if (n.target.kind === "case") setParam("case", n.target.id);
    else if (n.target.kind === "request") go("gm/pending", { req: n.target.id });
    else go(me?.role === "Manager" ? "training/all" : "training/mine", { tr: n.target.id });
  }

  if (!me) return null;
  return (
    <header ref={wrap} className="relative z-30 flex h-16 shrink-0 items-center gap-2 border-b border-line bg-surface px-3 sm:gap-4 sm:px-6">
      <button onClick={onMenu} aria-label="Open navigation" className="rounded-md p-2 text-ink-soft hover:bg-panel lg:hidden"><Menu size={20} /></button>
      <div className="min-w-0 flex-1 sm:flex-none">
        <div className="truncate text-[11px] font-medium uppercase tracking-wide text-ink-faint">{me.role === "Admin" ? "Administration" : me.role === "Group Manager" ? "Regional Feedback Workspace" : "ComTrack"}</div>
        <div className="truncate text-[13px] font-semibold text-ink">{item?.label ?? "ComTrack"}</div>
      </div>

      {isBiz ? (
        <div className="relative ml-auto hidden w-full max-w-md md:block">
          <label htmlFor="global-search" className="sr-only">Search complaints you can access</label>
          <Search size={16} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input id="global-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search case ID, customer, service no., source ref…" autoComplete="off"
            className="w-full rounded-md border border-line bg-panel py-2 pl-9 pr-3 text-sm placeholder:text-ink-faint focus:border-slt-blue focus:bg-white focus:outline-none focus:ring-2 focus:ring-slt-blue/15" />
          {q.trim() && (
            <div className="animate-pop absolute left-0 right-0 top-full mt-1 overflow-hidden rounded-lg border border-line bg-white shadow-[var(--shadow-overlay)]">
              {results.length ? (
                <ul role="listbox" aria-label="Search results">
                  {results.map((c) => (
                    <li key={c.id}>
                      <button className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-panel" onClick={() => { setQ(""); setParam("case", c.id); }}>
                        <span className="font-mono text-xs font-semibold text-slt-blue">{c.id}</span>
                        <span className="min-w-0 flex-1 truncate text-sm text-ink">{c.customer || "Customer not recorded"}</span>
                        <StatusBadge status={c.status} />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : <p className="px-3 py-3 text-sm text-ink-soft">No accessible cases match “{q}”.</p>}
              <p className="border-t border-line bg-panel px-3 py-1.5 text-[11px] text-ink-faint">Results limited to your record scope.</p>
            </div>
          )}
        </div>
      ) : <div className="ml-auto" />}

      <div className="flex items-center gap-1 sm:gap-2">
        <div className="relative">
          <button onClick={() => setPanel(panel === "notif" ? null : "notif")} aria-expanded={panel === "notif"} aria-label={`Notifications, ${unread} unread`} className="relative rounded-md p-2 text-ink-soft hover:bg-panel">
            <Bell size={19} />
            {unread > 0 && <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-st-breach px-1 text-[10px] font-bold text-white">{unread}</span>}
          </button>
          {panel === "notif" && (
            <div className="animate-pop fixed inset-x-2 top-16 max-h-[75vh] overflow-hidden rounded-xl border border-line bg-white shadow-[var(--shadow-overlay)] sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-96" role="region" aria-label="Notification centre">
              <div className="flex items-center justify-between border-b border-line px-4 py-3">
                <div className="text-sm font-semibold">Notifications</div>
                <div className="flex items-center gap-1">
                  {(["all", "unread"] as const).map((f) => <button key={f} onClick={() => setFilter(f)} aria-pressed={filter === f} className={`rounded px-2 py-1 text-xs font-medium ${filter === f ? "bg-slt-blue-50 text-slt-blue" : "text-ink-soft hover:bg-panel"}`}>{f === "all" ? "All" : "Unread"}</button>)}
                  <button onClick={() => act.markRead("all")} className="ml-1 flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-ink-soft hover:bg-panel"><CheckCheck size={13} />Mark all read</button>
                </div>
              </div>
              <ul className="max-h-[60vh] overflow-y-auto">
                {shown.length === 0 && <li className="px-4 py-8 text-center text-sm text-ink-soft">You're all caught up.</li>}
                {shown.map((n) => {
                  const ok = accessible(n);
                  return (
                    <li key={n.id} className="border-b border-line last:border-0">
                      <button onClick={() => openNotif(n)} className={`flex w-full gap-3 px-4 py-3 text-left hover:bg-panel ${n.read ? "" : "bg-slt-blue-50/40"}`}>
                        <span aria-hidden className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read ? "bg-transparent" : "bg-slt-blue"}`} />
                        <span className="min-w-0 flex-1">
                          <span className="block text-[11px] font-semibold uppercase tracking-wide text-ink-faint">{EVENT_LABEL[n.event]} · {relTime(n.ts)}{!n.read && <span className="sr-only">, unread</span>}</span>
                          <span className="mt-0.5 block text-sm text-ink">{ok ? n.title : "This item is no longer available with your current access."}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <p className="border-t border-line bg-panel px-4 py-2 text-[11px] text-ink-faint">In-app delivery works in this demo. Outbound email and scheduled reminders are simulated.</p>
            </div>
          )}
        </div>

        <div className="relative">
          <button onClick={() => setPanel(panel === "user" || panel === "switch" ? null : "user")} aria-expanded={panel === "user"} className="flex items-center gap-2 rounded-md py-1 pl-1 pr-2 hover:bg-panel">
            <Avatar initials={me.initials} size={30} />
            <span className="hidden text-left leading-tight sm:block">
              <span className="block text-[13px] font-semibold text-ink">{me.name}</span>
              <span className="block text-[11px] text-ink-faint">{me.role}</span>
            </span>
            <ChevronDown size={14} className="text-ink-faint" aria-hidden />
          </button>
          {panel === "user" && (
            <div className="animate-pop absolute right-0 top-full mt-2 w-72 overflow-hidden rounded-xl border border-line bg-white shadow-[var(--shadow-overlay)]">
              <div className="border-b border-line px-4 py-3">
                <div className="text-sm font-semibold">{me.name}</div>
                <div className="text-xs text-ink-faint">{me.title} · {me.team}</div>
              </div>
              <button onClick={() => { setPanel(null); go("profile"); }} className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-panel"><UserCircle size={16} className="text-ink-faint" />Profile & notification preferences</button>
              <button onClick={() => setPanel("switch")} className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-panel"><Users2 size={16} className="text-ink-faint" />Switch demo account <DemoTag /></button>
              <button onClick={() => { setPanel(null); setConfirmReset(true); }} className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-panel"><RotateCcw size={16} className="text-ink-faint" />Reset demo data <DemoTag /></button>
              <button onClick={() => { act.auditAuth("Signed out"); logout(); }} className="flex w-full items-center gap-2.5 border-t border-line px-4 py-2.5 text-sm text-st-breach hover:bg-st-breach-bg"><LogOut size={16} />Sign out</button>
            </div>
          )}
          {panel === "switch" && (
            <div className="animate-pop absolute right-0 top-full mt-2 w-80 overflow-hidden rounded-xl border border-line bg-white shadow-[var(--shadow-overlay)]">
              <div className="flex items-center gap-2 border-b border-line bg-st-progress-bg px-4 py-2.5 text-xs text-[#7a4900]"><ShieldAlert size={14} />Demo control — clears all scoped views on switch.</div>
              <ul className="max-h-96 overflow-y-auto py-1">
                {db.users.filter((u) => u.active).map((u) => (
                  <li key={u.id}>
                    <button disabled={u.id === me.id} onClick={() => { setPanel(null); login(u.id); window.location.hash = ""; }} className="flex w-full items-center gap-2.5 px-4 py-2 text-left hover:bg-panel disabled:opacity-50">
                      <Avatar initials={u.initials} size={26} />
                      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{u.name}</span><span className="block truncate text-[11px] text-ink-faint">{u.role} · {u.team}</span></span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
      {confirmReset && (
        <Confirm title="Reset all demo data?" variant="danger" confirmLabel="Reset demo data" onCancel={() => setConfirmReset(false)}
          onConfirm={() => { setConfirmReset(false); void resetDemo(); window.location.hash = ""; }}
          consequence="All complaints, mail, users, permissions, settings, notifications and locally stored attachments in this browser will return to the original synthetic records. You will be signed out." />
      )}
    </header>
  );
}
