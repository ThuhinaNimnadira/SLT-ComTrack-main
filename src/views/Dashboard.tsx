import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { FolderOpen, Hourglass, ClipboardCheck, CalendarCheck2, GraduationCap, AlertTriangle, ArrowRight, Send } from "lucide-react";
import { useStore } from "../store";
import { inView, ageDays, isOverdue, fmtDate, relTime } from "../lib/lifecycle";
import { colomboMonthKey, demoNow } from "../lib/permissions";
import { Card, CardHeader, PageHeader, EmptyState, StatusBadge, PriorityBadge } from "../components/ui";
import { go, setParam } from "../nav";

export default function Dashboard() {
  const { visibleComplaints: cs, db, can, me, canSeeTraining } = useStore();
  const training = db.training.filter(canSeeTraining);
  const kpis = [
    { label: "Active", value: cs.filter((c) => inView(c, "active", db.requests)).length, icon: FolderOpen, to: "cases/active", hint: "Open + In Progress" },
    ...(me?.role === "Technical Officer" ? [{ label: "Regional feedback", value: db.requests.filter((r) => r.status === "Pending" && cs.some((x) => x.id === r.complaintId)).length, icon: Send, to: "cases/awaiting", hint: "Regional response pending" }] : []),
    { label: "Pending review", value: cs.filter((c) => c.status === "Resolved").length, icon: ClipboardCheck, to: "cases/review", hint: "Resolved by officer" },
    { label: "Closed this month", value: cs.filter((c) => inView(c, "closedMonth", db.requests)).length, icon: CalendarCheck2, to: "cases/closed-month", hint: "Since 1st, Asia/Colombo" },
    ...(can("train.view") ? [{ label: "Overdue training", value: training.filter(isOverdue).length, icon: GraduationCap, to: "training/all", hint: "Past due date" }] : []),
  ];

  const trend = useMemo(() => {
    const now = demoNow();
    const keys: string[] = [];
    for (let i = 5; i >= 0; i--) { const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 15)); keys.push(d.toISOString().slice(0, 7)); }
    return keys.map((k) => ({
      month: new Date(k + "-15").toLocaleString("en-GB", { month: "short" }),
      Received: cs.filter((c) => colomboMonthKey(c.receivedAt) === k).length,
      Closed: cs.filter((c) => c.closedAt && colomboMonthKey(c.closedAt) === k).length,
    }));
  }, [cs]);
  const bySource = useMemo(() => {
    const m = new Map<string, number>();
    cs.filter((c) => c.status !== "Closed").forEach((c) => m.set(c.source, (m.get(c.source) ?? 0) + 1));
    return Array.from(m, ([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [cs]);
  const aging = cs.filter((c) => c.status !== "Closed").sort((a, b) => a.receivedAt.localeCompare(b.receivedAt)).slice(0, 6);
  const activity = cs.flatMap((c) => c.history.map((h) => ({ ...h, caseId: c.id }))).sort((a, b) => b.ts.localeCompare(a.ts)).slice(0, 8);

  return (
    <>
      <PageHeader crumbs={["Overview", "Dashboard"]} title={`Good morning, ${me?.name.split(" ")[0]}`}
        description={<>Figures are calculated live from the {cs.length} cases in your record scope{me?.role === "Technical Officer" ? " (cases assigned to you unless your scope is wider)" : ""}. As of {fmtDate(demoNow().toISOString(), true)}.</>} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {kpis.map((k) => (
          <button key={k.label} onClick={() => go(k.to)} className="group rounded-[var(--radius-card)] border border-line bg-surface p-4 text-left transition-[box-shadow,border] duration-200 hover:border-slt-blue-100 hover:shadow-[var(--shadow-raised)]">
            <div className="flex items-center justify-between"><k.icon size={18} className="text-slt-blue" aria-hidden /><ArrowRight size={14} className="text-ink-faint opacity-0 transition-opacity group-hover:opacity-100" aria-hidden /></div>
            <div className="tnum mt-3 text-2xl font-bold text-ink">{k.value}</div>
            <div className="text-sm font-medium text-ink">{k.label}</div>
            <div className="text-[11px] text-ink-faint">{k.hint}</div>
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader title="Received vs closed" subtitle="Last six months · by received date and closedAt (Asia/Colombo)" />
          <div className="h-64 p-3" role="img" aria-label={`Bar chart. ${trend.map((t) => `${t.month}: ${t.Received} received, ${t.Closed} closed`).join("; ")}`}>
            <ResponsiveContainer>
              <BarChart data={trend} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f1" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#45566d" }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "#7a889c" }} axisLine={false} tickLine={false} width={28} />
                <Tooltip cursor={{ fill: "#eef4fc" }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Received" fill="#0a4595" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Closed" fill="#58a733" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <CardHeader title="Unfinished cases by source" subtitle="Open, In Progress and Resolved" />
          <div className="p-4">
            {bySource.length ? (
              <ul className="space-y-2.5">
                {bySource.map((s) => (
                  <li key={s.name}>
                    <div className="mb-1 flex justify-between text-sm"><span>{s.name}</span><span className="tnum font-semibold">{s.value}</span></div>
                    <div className="h-2 rounded-full bg-panel"><div className="h-2 rounded-full bg-slt-blue" style={{ width: `${(s.value / bySource[0].value) * 100}%` }} /></div>
                  </li>
                ))}
              </ul>
            ) : <EmptyState title="No unfinished cases" />}
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader title="Oldest unfinished cases" subtitle="Aging from received date" action={<button onClick={() => go("cases/active")} className="text-xs font-semibold text-slt-blue hover:underline">View active</button>} />
          {aging.length ? (
            <ul className="divide-y divide-line">
              {aging.map((c) => (
                <li key={c.id}>
                  <button onClick={() => setParam("case", c.id)} className="flex w-full flex-wrap items-center gap-3 px-5 py-3 text-left hover:bg-panel">
                    <span className="font-mono text-[13px] font-semibold text-slt-blue">{c.id}</span>
                    <span className="min-w-0 flex-1 truncate text-sm">{c.customer || c.issueType}</span>
                    <PriorityBadge priority={c.priority} />
                    <StatusBadge status={c.status} />
                    <span className={`tnum w-14 text-right text-sm font-semibold ${ageDays(c.receivedAt) > 7 ? "text-st-breach" : "text-ink-soft"}`}>{ageDays(c.receivedAt) > 7 && <AlertTriangle size={12} className="mr-1 inline" aria-label="Aging" />}{Math.floor(ageDays(c.receivedAt))} d</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : <EmptyState title="Nothing outstanding" />}
        </Card>
        {can("case.history") && (
          <Card>
            <CardHeader title="Recent activity" subtitle="Latest timeline events in your scope" />
            <ul className="divide-y divide-line">
              {activity.map((a) => (
                <li key={a.id}>
                  <button onClick={() => setParam("case", a.caseId)} className="flex w-full items-start gap-3 px-5 py-2.5 text-left hover:bg-panel">
                    <span className="mt-0.5 font-mono text-xs font-semibold text-slt-blue">{a.caseId}</span>
                    <span className="min-w-0 flex-1 text-sm"><span className="font-medium">{a.action}</span> <span className="text-ink-faint">· {a.actor}</span></span>
                    <span className="whitespace-nowrap text-xs text-ink-faint">{relTime(a.ts)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </>
  );
}
