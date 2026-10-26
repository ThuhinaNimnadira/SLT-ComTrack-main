import { useEffect, useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { FileText, FileSpreadsheet, FileDown, Library, Save, ArrowRight, Info, Trash2, Lock } from "lucide-react";
import { useStore } from "../store";
import type { ReportConfig, Cap } from "../lib/types";
import { SOURCES, PRIORITIES, STATUSES, OUTCOMES } from "../lib/types";
import { TEAMS } from "../lib/seed";
import { TEMPLATES, COLS, buildReport, filterSummary, type Built } from "../lib/reports";
import { exportCsv, exportPdf, exportXlsx } from "../lib/exports";
import { fmtDate } from "../lib/lifecycle";
import { colomboMonthKey, demoNow } from "../lib/permissions";
import { Card, CardHeader, PageHeader, Button, Field, inputCls, EmptyState, Notice, Tabs, Confirm } from "../components/ui";
import { go, useRoute } from "../nav";

const defaultCfg = (template = "weekly"): ReportConfig => ({
  template, basis: "received", range: template === "weekly" ? "week" : template === "monthly" ? "month" : "all", month: colomboMonthKey(demoNow().toISOString()), from: "", to: "",
  filters: {}, columns: [], groupBy: "", sortBy: "", sortDir: "desc",
});

export default function Reports({ tab }: { tab: "library" | "builder" | "generated" }) {
  return (
    <>
      <PageHeader crumbs={["Reports", tab === "library" ? "Report Library" : tab === "builder" ? "Report Builder" : "Generated Reports"]}
        title={tab === "library" ? "Report library" : tab === "builder" ? "Report builder" : "Generated reports"}
        description="Reports draw on every record within your authorised scope — active, resolved, closed and archived — and calculate live from the same data you see." />
      <div className="mb-4 max-w-md"><Tabs label="Reports" value={tab} onChange={(t) => go(`reports/${t}`)} tabs={[{ id: "library", label: "Library" }, { id: "builder", label: "Builder" }, { id: "generated", label: "Generated" }]} /></div>
      {tab === "library" && <LibraryView />}
      {tab === "builder" && <Builder />}
      {tab === "generated" && <Generated />}
    </>
  );
}

function LibraryView() {
  const { can } = useStore();
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {TEMPLATES.map((t) => (
        <Card key={t.id} className="flex flex-col p-5">
          <Library size={18} className="text-slt-blue" aria-hidden />
          <h2 className="mt-3 text-sm font-semibold text-ink">{t.title}</h2>
          <p className="mt-1 flex-1 text-sm text-ink-soft">{t.short}</p>
          <p className="mt-2 text-xs text-ink-faint">{t.description}</p>
          <div className="mt-4">{can("report.generate") ? <Button size="sm" variant="primary" onClick={() => go("reports/builder", { t: t.id })}>Open in builder <ArrowRight size={13} /></Button> : <span className="flex items-center gap-1 text-xs text-ink-faint"><Lock size={12} />Generating requires permission</span>}</div>
        </Card>
      ))}
    </div>
  );
}

function Builder() {
  const { db, me, visibleComplaints, can, canSeeTraining, act, toast } = useStore();
  const route = useRoute();
  const key = `ct:${me?.id}:report`;
  const [cfg, setCfg] = useState<ReportConfig>(() => {
    const t = route.params.get("t");
    if (t) return defaultCfg(t);
    try { return JSON.parse(sessionStorage.getItem(key) ?? "") as ReportConfig; } catch { return defaultCfg(); }
  });
  useEffect(() => { sessionStorage.setItem(key, JSON.stringify(cfg)); }, [cfg, key]);
  const [busy, setBusy] = useState<null | "PDF" | "Excel" | "CSV">(null);
  const [page, setPage] = useState(0);
  const [presetName, setPresetName] = useState("");
  const [delPreset, setDelPreset] = useState<string | null>(null);

  const built: Built = useMemo(() => buildReport(cfg, {
    me: me!, users: db.users, complaints: visibleComplaints, requests: db.requests, training: db.training.filter(canSeeTraining), canNotes: can("case.notes"), canHistory: can("case.history"),
  }), [cfg, me, db, visibleComplaints, canSeeTraining, can]);
  const t = built.template;
  const allCols = COLS[t.rowKind].filter((c) => (c.restricted === "notes" ? can("case.notes") : true));
  const selected = cfg.columns.length ? cfg.columns : t.defaultColumns;
  const set = (p: Partial<ReportConfig>) => { setCfg((c) => ({ ...c, ...p })); setPage(0); };
  const setF = (k: keyof ReportConfig["filters"], v: string) => set({ filters: { ...cfg.filters, [k]: v || undefined } });
  const officers = db.users.filter((u) => u.role === "Technical Officer" || (t.rowKind === "training" && u.role === "Manager"));
  const PAGE = 25;
  const presets = db.reportPresets.filter((p) => p.ownerId === me?.id);
  const fmtCell = (type: string, v: unknown) => (v === null || v === undefined || v === "" ? "—" : type === "date" ? fmtDate(String(v), true) : String(v));

  async function doExport(fmt: "PDF" | "Excel" | "CSV") {
    const cap: Cap = fmt === "PDF" ? "report.pdf" : fmt === "Excel" ? "report.xlsx" : "report.csv";
    if (!can("report.generate") || !can(cap)) return toast("error", `${fmt} export is not permitted for your account.`);
    setBusy(fmt);
    try {
      const meta = { title: t.title, filters: filterSummary(cfg, db.users), generatedBy: `${me!.name} (${me!.role})`, generatedAt: new Date().toISOString(), definitions: t.definitions };
      if (fmt === "PDF") await exportPdf(built, meta);
      else if (fmt === "Excel") await exportXlsx(built, meta);
      else exportCsv(built, meta);
      act.recordReport({ title: t.title, format: fmt, rows: built.rows.length, filters: meta.filters, requiredCaps: ["report.view", cap] });
      toast("success", `${fmt} generated with ${built.rows.length} records.`);
    } catch (e) {
      toast("error", `Could not generate ${fmt}: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[340px_1fr]">
      <Card className="h-fit">
        <CardHeader title="Configure" subtitle="Changes recalculate immediately" />
        <div className="space-y-4 p-4">
          <Field label="Template" htmlFor="rb-t"><select id="rb-t" className={inputCls} value={cfg.template} onChange={(e) => setCfg(defaultCfg(e.target.value))}>{TEMPLATES.map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}</select></Field>
          {t.rowKind === "case" && (
            <Field label="Date basis" htmlFor="rb-b" hint="Which date places a case in the period.">
              <select id="rb-b" className={inputCls} value={cfg.basis} onChange={(e) => set({ basis: e.target.value as ReportConfig["basis"] })}><option value="received">Received date</option><option value="resolved">Resolved date</option><option value="closed">Closed date</option></select>
            </Field>
          )}
          <Field label="Period" htmlFor="rb-r">
            <select id="rb-r" className={inputCls} value={cfg.range} onChange={(e) => set({ range: e.target.value as ReportConfig["range"] })}><option value="week">Weekly (last 7 days)</option><option value="month">Monthly</option><option value="custom">Custom range</option><option value="all">All dates</option></select>
          </Field>
          {cfg.range === "month" && <Field label="Month" htmlFor="rb-m"><input id="rb-m" type="month" className={inputCls} value={cfg.month} onChange={(e) => set({ month: e.target.value })} /></Field>}
          {cfg.range === "custom" && <div className="grid grid-cols-2 gap-2"><Field label="From" htmlFor="rb-f"><input id="rb-f" type="date" className={inputCls} value={cfg.from} onChange={(e) => set({ from: e.target.value })} /></Field><Field label="To" htmlFor="rb-to"><input id="rb-to" type="date" className={inputCls} value={cfg.to} onChange={(e) => set({ to: e.target.value })} /></Field></div>}
          <details open className="rounded-md border border-line">
            <summary className="cursor-pointer px-3 py-2 text-sm font-medium">Filters</summary>
            <div className="grid gap-2 p-3">
              {([["source", SOURCES], ["category", db.lists.categories.map((c) => c.label)], ["issueType", db.lists.issueTypes.map((c) => c.label)], ["priority", PRIORITIES], ["team", TEAMS], ["status", STATUSES], ["outcome", OUTCOMES]] as [keyof ReportConfig["filters"], readonly string[]][]).map(([k, opts]) => (
                <div key={k}><label htmlFor={`rf-${k}`} className="sr-only">{k}</label><select id={`rf-${k}`} className={`${inputCls} py-1.5`} value={cfg.filters[k] ?? ""} onChange={(e) => setF(k, e.target.value)}><option value="">Any {k === "issueType" ? "issue" : k}</option>{opts.map((o) => <option key={o}>{o}</option>)}</select></div>
              ))}
              <label htmlFor="rf-off" className="sr-only">Officer</label>
              <select id="rf-off" className={`${inputCls} py-1.5`} value={cfg.filters.officer ?? ""} onChange={(e) => setF("officer", e.target.value)}><option value="">Any officer / owner</option>{officers.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
            </div>
          </details>
          <details className="rounded-md border border-line">
            <summary className="cursor-pointer px-3 py-2 text-sm font-medium">Columns ({selected.length})</summary>
            <div className="grid gap-1 p-3">
              {allCols.map((c) => <label key={c.key} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={selected.includes(c.key)} onChange={(e) => set({ columns: e.target.checked ? [...selected, c.key] : selected.filter((x) => x !== c.key) })} />{c.label}</label>)}
            </div>
          </details>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Group by" htmlFor="rb-g"><select id="rb-g" className={inputCls} value={cfg.groupBy} onChange={(e) => set({ groupBy: e.target.value })}><option value="">None</option>{allCols.filter((c) => c.type === "text").map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}</select></Field>
            <Field label="Sort" htmlFor="rb-s"><select id="rb-s" className={inputCls} value={`${cfg.sortBy}|${cfg.sortDir}`} onChange={(e) => { const [s, d] = e.target.value.split("|"); set({ sortBy: s, sortDir: d as "asc" | "desc" }); }}>{allCols.flatMap((c) => [<option key={c.key + "d"} value={`${c.key}|desc`}>{c.label} ↓</option>, <option key={c.key + "a"} value={`${c.key}|asc`}>{c.label} ↑</option>])}</select></Field>
          </div>
          <div className="space-y-2 border-t border-line pt-3">
            <div className="flex gap-2"><label htmlFor="rp-n" className="sr-only">Preset name</label><input id="rp-n" className={`${inputCls} py-1.5`} placeholder="Preset name" value={presetName} onChange={(e) => setPresetName(e.target.value)} /><Button size="sm" disabled={!presetName.trim()} onClick={() => { act.savePreset("reportPresets", { id: `RPS-${Date.now()}`, ownerId: me!.id, name: presetName, config: cfg }); setPresetName(""); toast("success", "Report preset saved."); }}><Save size={13} />Save</Button></div>
            {presets.map((p) => <div key={p.id} className="flex items-center gap-2"><button className="flex-1 truncate text-left text-sm text-slt-blue hover:underline" onClick={() => setCfg(p.config)}>{p.name}</button><button aria-label={`Delete preset ${p.name}`} onClick={() => setDelPreset(p.id)} className="text-ink-faint hover:text-st-breach"><Trash2 size={13} /></button></div>)}
          </div>
        </div>
      </Card>

      <div className="min-w-0 space-y-4">
        <Card>
          <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-3.5">
            <div className="min-w-0 flex-1"><h2 className="text-sm font-semibold">{t.title}</h2><p className="text-xs text-ink-faint">{filterSummary(cfg, db.users)}</p></div>
            {can("report.generate") ? (
              <div className="flex flex-wrap gap-2">
                {can("report.pdf") && <Button size="sm" loading={busy === "PDF"} disabled={!!busy} onClick={() => doExport("PDF")}><FileText size={14} />PDF</Button>}
                {can("report.xlsx") && <Button size="sm" loading={busy === "Excel"} disabled={!!busy} onClick={() => doExport("Excel")}><FileSpreadsheet size={14} />Excel</Button>}
                {can("report.csv") && <Button size="sm" loading={busy === "CSV"} disabled={!!busy} onClick={() => doExport("CSV")}><FileDown size={14} />CSV</Button>}
                {!can("report.pdf") && !can("report.xlsx") && !can("report.csv") && <span className="text-xs text-ink-faint">No export formats permitted</span>}
              </div>
            ) : <span className="text-xs text-ink-faint">Preview only — generating not permitted</span>}
          </div>
          <div className="grid grid-cols-2 gap-3 p-4 md:grid-cols-3 2xl:grid-cols-6">
            {built.summary.map((s) => <div key={s.label} className="rounded-lg border border-line bg-panel p-3"><div className="tnum text-xl font-bold text-ink">{s.value}</div><div className="text-[11px] leading-tight text-ink-soft">{s.label}</div></div>)}
          </div>
          {built.chart && built.rows.length > 0 && (
            <div className="h-56 px-4 pb-4" role="img" aria-label={`${built.chart.label}: ${built.chart.data.map((d) => `${d.name} ${d.value}`).join(", ")}`}>
              <div className="mb-1 text-xs font-semibold text-ink-soft">{built.chart.label}</div>
              <ResponsiveContainer>
                <BarChart data={built.chart.data.slice(0, 10)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f1" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#45566d" }} interval={0} angle={built.chart.data.length > 5 ? -15 : 0} height={40} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#7a889c" }} width={28} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{ fill: "#eef4fc" }} />
                  <Bar dataKey="value" name="Count" fill="#0a4595" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
        {built.groups && <Card><CardHeader title={`Grouped by ${allCols.find((c) => c.key === cfg.groupBy)?.label}`} /><ul className="grid gap-px bg-line sm:grid-cols-2 lg:grid-cols-3">{built.groups.map((g) => <li key={g.key} className="flex justify-between bg-white px-4 py-2 text-sm"><span>{g.key}</span><span className="tnum font-semibold">{g.count}</span></li>)}</ul></Card>}
        <Card>
          <CardHeader title={`Preview · ${built.rows.length} records`} subtitle="Exports include every filtered record, not only this page." />
          {built.rows.length === 0 ? <EmptyState title="No records match the selected period and filters" body="Widen the period or clear a filter. Exports will contain an explicit empty-result notice." /> : (
            <>
              <div className="max-w-full overflow-x-auto" tabIndex={0} role="region" aria-label="Report preview table (scrolls horizontally)">
                <table className="w-full min-w-max text-left text-sm">
                  <thead><tr className="border-b border-line bg-panel text-[11px] font-semibold uppercase tracking-wide text-ink-faint">{built.columns.map((c) => <th key={c.key} scope="col" className="whitespace-nowrap px-3 py-2">{c.label}</th>)}</tr></thead>
                  <tbody>{built.rows.slice(page * PAGE, page * PAGE + PAGE).map((r, i) => <tr key={i} className="border-b border-line last:border-0">{built.columns.map((c) => <td key={c.key} className={`max-w-[280px] truncate whitespace-nowrap px-3 py-2 ${c.type === "number" ? "tnum text-right" : ""}`}>{fmtCell(c.type, r[c.key])}</td>)}</tr>)}</tbody>
                </table>
              </div>
              <div className="flex items-center justify-between border-t border-line px-4 py-2 text-xs text-ink-soft">
                <span>Rows {page * PAGE + 1}–{Math.min(built.rows.length, page * PAGE + PAGE)} of {built.rows.length}</span>
                <div className="flex gap-1"><Button size="sm" variant="ghost" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button><Button size="sm" variant="ghost" disabled={(page + 1) * PAGE >= built.rows.length} onClick={() => setPage(page + 1)}>Next</Button></div>
              </div>
            </>
          )}
        </Card>
        <Card className="p-4">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold"><Info size={14} className="text-slt-blue" />Definitions & population</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm text-ink-soft">{t.definitions.map((d) => <li key={d}>{d}</li>)}<li>Population: records within your record scope ({visibleComplaints.length} cases accessible to you), including archived cases.</li></ul>
        </Card>
        <Notice kind="info">PDF uses standard fonts; Sinhala/Tamil text is marked in PDF and fully preserved in Excel and CSV.</Notice>
      </div>
      {delPreset && <Confirm title="Delete preset?" confirmLabel="Delete preset" variant="danger" onCancel={() => setDelPreset(null)} onConfirm={() => { act.savePreset("reportPresets", { delete: delPreset }); setDelPreset(null); }} consequence="This only removes the saved configuration; no data is affected." />}
    </div>
  );
}

function Generated() {
  const { db, me, can } = useStore();
  const mine = db.reports.filter((r) => r.by === me?.id);
  return (
    <Card>
      <CardHeader title="Your generated reports" subtitle="History is scoped to you. Files are downloaded to your device and not retained by the demo." />
      {mine.length === 0 ? <EmptyState title="No reports generated yet" body="Generate a PDF, Excel or CSV from the builder." action={can("report.generate") ? <Button variant="primary" onClick={() => go("reports/builder")}>Open builder</Button> : undefined} /> : (
        <ul className="divide-y divide-line">
          {mine.map((r) => {
            const valid = r.requiredCaps.every((c) => can(c));
            return (
              <li key={r.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <span className="rounded bg-slt-blue-50 px-2 py-0.5 font-mono text-[11px] font-semibold text-slt-blue">{r.format}</span>
                <div className="min-w-0 flex-1"><div className="text-sm font-medium">{r.title} · {r.rows} records</div><div className="truncate text-xs text-ink-faint">{r.filters}</div></div>
                <span className="text-xs text-ink-faint">{fmtDate(r.ts, true)}</span>
                {!valid && <span className="flex items-center gap-1 rounded bg-st-closed-bg px-2 py-0.5 text-[11px] text-ink-soft"><Lock size={11} />Access changed — regeneration unavailable</span>}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
