import { useEffect, useMemo, useState } from "react";
import { Search, FilePlus2, Save, X, FolderOpen } from "lucide-react";
import { useStore } from "../store";
import { inView, type CaseView } from "../lib/lifecycle";
import { PRIORITIES, SOURCES } from "../lib/types";
import { Card, PageHeader, Button, EmptyState, inputCls, Skeleton } from "../components/ui";
import CaseTable from "../components/CaseTable";
import { go } from "../nav";

const META: Record<string, { view: CaseView; title: string; desc: string }> = {
  "cases/active": { view: "active", title: "Active complaints", desc: "Open and In Progress cases within your record scope." },
  "cases/awaiting": { view: "awaiting", title: "Awaiting regional feedback", desc: "In Progress cases waiting on a Group Manager response. Resolution is blocked until the response arrives." },
  "cases/review": { view: "review", title: "Pending review", desc: "Resolved by a Technical Officer and waiting for a Manager to close or return." },
  "cases/closed-month": { view: "closedMonth", title: "Closed this month", desc: "Closed since the start of the current month (Asia/Colombo), excluding manually archived cases." },
  "cases/archive": { view: "archive", title: "Archive", desc: "Closed before this month began (by closedAt, Asia/Colombo) or manually archived. Archived cases remain Closed, read-only and included in reports." },
};

export default function CaseList({ view }: { view: string }) {
  const { visibleComplaints, db, can, me, act, toast } = useStore();
  const meta = META[view];
  // Scoped per-user cache: cleared on account switch
  const cacheKey = `ct:${me?.id}:filters:${view}`;
  const init = (() => { try { return JSON.parse(sessionStorage.getItem(cacheKey) ?? "{}"); } catch { return {}; } })();
  const [q, setQ] = useState<string>(init.q ?? "");
  const [prio, setPrio] = useState<string>(init.prio ?? "");
  const [source, setSource] = useState<string>(init.source ?? "");
  const [month, setMonth] = useState<string>(init.month ?? "");
  const [loading, setLoading] = useState(true);
  useEffect(() => { const t = setTimeout(() => setLoading(false), 220); return () => clearTimeout(t); }, []);
  useEffect(() => { sessionStorage.setItem(cacheKey, JSON.stringify({ q, prio, source, month })); }, [q, prio, source, month, cacheKey]);

  const base = visibleComplaints.filter((c) => inView(c, meta.view, db.requests));
  const months = Array.from(new Set(base.map((c) => c.closedAt?.slice(0, 7)).filter(Boolean))) as string[];
  const rows = useMemo(() => base.filter((c) => {
    const s = q.trim().toLowerCase();
    return (!s || [c.id, c.customer, c.sltNumber, c.sourceRef, c.issueType].some((v) => v.toLowerCase().includes(s))) && (!prio || c.priority === prio) && (!source || c.source === source) && (!month || c.closedAt?.startsWith(month));
  }).sort((a, b) => (meta.view === "archive" || meta.view === "closedMonth" ? (b.closedAt ?? "").localeCompare(a.closedAt ?? "") : b.receivedAt.localeCompare(a.receivedAt))), [base, q, prio, source, month, meta.view]);
  const filtered = q || prio || source || month;
  const presets = db.queuePresets.filter((p) => p.ownerId === me?.id && p.view === view);

  return (
    <>
      <PageHeader crumbs={["Complaints", meta.title]} title={meta.title} description={meta.desc}
        actions={can("intake.manual") && meta.view === "active" ? <Button variant="primary" onClick={() => go("training/all", { sub: "assign", tab: "register" })}><FilePlus2 size={15} />Register complaint</Button> : undefined} />
      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
          <div className="relative min-w-[200px] flex-1">
            <label htmlFor="list-q" className="sr-only">Filter cases</label>
            <Search size={15} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
            <input id="list-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by ID, customer, service no., reference…" className={`${inputCls} pl-9`} />
          </div>
          <label className="sr-only" htmlFor="f-prio">Priority</label>
          <select id="f-prio" value={prio} onChange={(e) => setPrio(e.target.value)} className={`${inputCls} w-auto`}><option value="">All priorities</option>{PRIORITIES.map((p) => <option key={p}>{p}</option>)}</select>
          <label className="sr-only" htmlFor="f-src">Source</label>
          <select id="f-src" value={source} onChange={(e) => setSource(e.target.value)} className={`${inputCls} w-auto`}><option value="">All sources</option>{SOURCES.map((p) => <option key={p}>{p}</option>)}</select>
          {meta.view === "archive" && <><label className="sr-only" htmlFor="f-m">Closed month</label><select id="f-m" value={month} onChange={(e) => setMonth(e.target.value)} className={`${inputCls} w-auto`}><option value="">All months</option>{months.sort().reverse().map((m) => <option key={m}>{m}</option>)}</select></>}
          {filtered && <Button variant="ghost" size="sm" onClick={() => { setQ(""); setPrio(""); setSource(""); setMonth(""); }}><X size={14} />Clear</Button>}
          {filtered && <Button variant="ghost" size="sm" onClick={() => { const name = prompt("Name this queue preset"); if (name) { act.savePreset("queuePresets", { id: `QP-${Date.now()}`, ownerId: me!.id, name, view, query: q, priority: prio, source }); toast("success", "Preset saved."); } }}><Save size={14} />Save preset</Button>}
          {presets.map((p) => <button key={p.id} onClick={() => { setQ(p.query); setPrio(p.priority); setSource(p.source); }} className="rounded-full border border-line-strong px-2.5 py-1 text-xs text-ink-soft hover:border-slt-blue hover:text-slt-blue">{p.name}</button>)}
          <span className="ml-auto text-xs text-ink-faint" aria-live="polite">{rows.length} of {base.length}</span>
        </div>
        {loading ? <div className="space-y-2 p-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12" />)}</div> : (
          <CaseTable caption={meta.title} rows={rows} archive={meta.view === "archive" || meta.view === "closedMonth"}
            empty={<EmptyState icon={FolderOpen} title={filtered ? "No cases match these filters" : "Nothing here right now"} body={filtered ? "Try clearing a filter." : "Cases will appear here when they reach this stage within your scope."} />} />
        )}
      </Card>
    </>
  );
}
