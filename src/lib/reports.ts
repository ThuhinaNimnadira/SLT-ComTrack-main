import type { Complaint, FeedbackRequest, TrainingAction, User, ReportConfig } from "./types";
import { feedbackState, returnCount, ageDays, isOverdue, fmtDate } from "./lifecycle";
import { isArchived, demoNow, colomboMonthKey } from "./permissions";

export type ColType = "text" | "date" | "number";
export interface Col { key: string; label: string; type: ColType; restricted?: "notes" | "history" }
export type Row = Record<string, string | number | null>;
export type RowKind = "case" | "request" | "training" | "event";

export interface Template {
  id: string;
  title: string;
  short: string;
  description: string;
  rowKind: RowKind;
  defaultColumns: string[];
  definitions: string[];
}

export const CASE_COLS: Col[] = [
  { key: "id", label: "Case ID", type: "text" },
  { key: "source", label: "Source", type: "text" },
  { key: "sourceRef", label: "Source ref", type: "text" },
  { key: "receivedAt", label: "Received", type: "date" },
  { key: "customer", label: "Customer", type: "text" },
  { key: "sltNumber", label: "Service no.", type: "text" },
  { key: "issueType", label: "Issue", type: "text" },
  { key: "category", label: "Category", type: "text" },
  { key: "priority", label: "Priority", type: "text" },
  { key: "team", label: "Team", type: "text" },
  { key: "officer", label: "Officer", type: "text" },
  { key: "status", label: "Status", type: "text" },
  { key: "feedback", label: "Regional feedback", type: "text" },
  { key: "review", label: "Review state", type: "text" },
  { key: "outcome", label: "Outcome", type: "text" },
  { key: "resolvedAt", label: "Resolved", type: "date" },
  { key: "closedAt", label: "Closed", type: "date" },
  { key: "resolutionDays", label: "Resolution (days)", type: "number" },
  { key: "closureDays", label: "Closure (days)", type: "number" },
  { key: "reviewWaitDays", label: "Avg review wait (days)", type: "number" },
  { key: "returns", label: "Returns", type: "number" },
  { key: "ageDays", label: "Age (days)", type: "number" },
  { key: "location", label: "Location", type: "text" },
  { key: "training", label: "Training actions", type: "text" },
  { key: "managerNotes", label: "Manager notes", type: "text", restricted: "notes" },
];
export const REQUEST_COLS: Col[] = [
  { key: "id", label: "Request", type: "text" },
  { key: "caseId", label: "Case ID", type: "text" },
  { key: "centre", label: "Centre", type: "text" },
  { key: "groupManager", label: "Group Manager", type: "text" },
  { key: "requestedBy", label: "Requested by", type: "text" },
  { key: "requestedAt", label: "Requested", type: "date" },
  { key: "status", label: "Status", type: "text" },
  { key: "submittedAt", label: "Responded", type: "date" },
  { key: "turnaroundDays", label: "Turnaround (days)", type: "number" },
  { key: "pendingDays", label: "Pending for (days)", type: "number" },
  { key: "employee", label: "Employee identified", type: "text" },
];
export const TRAINING_COLS: Col[] = [
  { key: "id", label: "Action", type: "text" },
  { key: "cases", label: "Linked cases", type: "text" },
  { key: "employee", label: "Employee", type: "text" },
  { key: "team", label: "Employee team", type: "text" },
  { key: "type", label: "Type", type: "text" },
  { key: "gap", label: "Finding / gap", type: "text" },
  { key: "owner", label: "Owner", type: "text" },
  { key: "priority", label: "Priority", type: "text" },
  { key: "status", label: "Status", type: "text" },
  { key: "proposedAt", label: "Proposed", type: "date" },
  { key: "dueDate", label: "Due", type: "date" },
  { key: "overdue", label: "Overdue", type: "text" },
  { key: "followUp", label: "Follow-up result", type: "text" },
];
export const EVENT_COLS: Col[] = [
  { key: "caseId", label: "Case ID", type: "text" },
  { key: "ts", label: "Timestamp", type: "date" },
  { key: "actor", label: "Actor", type: "text" },
  { key: "type", label: "Event type", type: "text" },
  { key: "action", label: "Action", type: "text" },
  { key: "detail", label: "Detail", type: "text" },
  { key: "location", label: "Case location", type: "text" },
];
export const COLS: Record<RowKind, Col[]> = { case: CASE_COLS, request: REQUEST_COLS, training: TRAINING_COLS, event: EVENT_COLS };

const DEF_RES = "Resolution time = receipt → latest Technical Officer resolution. Cases without a resolution timestamp are excluded from averages.";
const DEF_CLO = "Closure time = receipt → Manager closure (closedAt).";
const DEF_REV = "Review wait = each 'Resolved & sent for review' event → next Manager decision (return or close). Repeated cycles are each counted from history; open cycles are excluded.";
const DEF_AGE = "Aging uses the as-of time shown in the header and includes only unfinished cases (Open, In Progress, Resolved).";
const DEF_PCT = "Percentages with a zero denominator are shown as '—' (undefined), never 0%.";
const DEF_SLA = "No approved SLA policy is configured, so SLA achievement is not reported.";

export const TEMPLATES: Template[] = [
  { id: "weekly", title: "Weekly operations", short: "Received, started, resolved, closed, outstanding and aging", description: "Operational snapshot of throughput and backlog.", rowKind: "case", defaultColumns: ["id", "source", "receivedAt", "priority", "officer", "status", "feedback", "ageDays"], definitions: [DEF_AGE, DEF_RES, DEF_PCT, DEF_SLA] },
  { id: "monthly", title: "Monthly management", short: "Volume trends, sources, categories, outcomes, backlog, improvement", description: "Management pack for the selected month.", rowKind: "case", defaultColumns: ["id", "source", "category", "receivedAt", "status", "outcome", "closedAt", "location", "training"], definitions: [DEF_CLO, DEF_PCT, DEF_SLA] },
  { id: "performance", title: "Resolution & closure performance", short: "Durations, throughput, review wait, returns", description: "How long work takes end to end.", rowKind: "case", defaultColumns: ["id", "officer", "receivedAt", "resolvedAt", "closedAt", "resolutionDays", "closureDays", "reviewWaitDays", "returns"], definitions: [DEF_RES, DEF_CLO, DEF_REV, DEF_PCT] },
  { id: "workload", title: "Officer & team workload", short: "Assigned, active, resolved and returns per officer", description: "Transparent workload counts — not an individual performance score.", rowKind: "case", defaultColumns: ["id", "team", "officer", "status", "priority", "resolutionDays", "returns"], definitions: ["Workload = cases in the filtered population grouped by assigned officer. Unassigned cases are grouped as 'Unassigned'.", DEF_RES, "Counts describe workload only and must not be read as a disciplinary measure."] },
  { id: "regional", title: "Regional feedback", short: "Requests, pending responses, turnaround", description: "Group Manager request activity by centre.", rowKind: "request", defaultColumns: ["id", "caseId", "centre", "groupManager", "requestedAt", "status", "submittedAt", "turnaroundDays", "pendingDays"], definitions: ["Turnaround = request → Group Manager submission.", "Pending for = request → as-of time for unsubmitted requests.", "Date basis for this report is the request date."] },
  { id: "timeline", title: "Case timeline & archive analysis", short: "Activity history incl. archived cases", description: "Every timestamped event for cases in scope, with archive location.", rowKind: "event", defaultColumns: ["caseId", "ts", "actor", "type", "action", "detail", "location"], definitions: ["Date basis for this report is the event timestamp.", "Archived cases remain Closed and are included."] },
  { id: "training", title: "Training & coaching", short: "Proposed, approved, completed, overdue, follow-up", description: "Development actions linked to findings.", rowKind: "training", defaultColumns: ["id", "cases", "employee", "type", "owner", "status", "dueDate", "overdue", "followUp"], definitions: ["Overdue = due date passed while Approved, In Progress or Needs Changes.", "Date basis for this report is the proposal date.", "Linked case references are hidden where you do not have case access."] },
];

export interface Ctx {
  me: User;
  users: User[];
  complaints: Complaint[]; // already permission-filtered
  requests: FeedbackRequest[];
  training: TrainingAction[]; // already permission-filtered
  canNotes: boolean;
  canHistory: boolean;
}

const days = (a?: string | null, b?: string | null) => (a && b ? Math.round(((new Date(b).getTime() - new Date(a).getTime()) / 86400000) * 10) / 10 : null);
const name = (users: User[], id: string | null | undefined) => (id ? users.find((u) => u.id === id)?.name ?? "Unknown" : "Unassigned");

export function reviewWaits(c: Complaint) {
  const out: number[] = [];
  const ev = [...c.history].sort((a, b) => a.ts.localeCompare(b.ts));
  ev.forEach((e, i) => {
    if (e.type !== "resolve") return;
    const next = ev.slice(i + 1).find((x) => x.type === "return" || x.type === "close");
    if (next) out.push((new Date(next.ts).getTime() - new Date(e.ts).getTime()) / 86400000);
  });
  return out;
}

export function caseRow(c: Complaint, ctx: Ctx): Row {
  const waits = reviewWaits(c);
  return {
    id: c.id, source: c.source, sourceRef: c.sourceRef, receivedAt: c.receivedAt, customer: c.customer, sltNumber: c.sltNumber, issueType: c.issueType,
    category: c.category, priority: c.priority, team: c.team, officer: name(ctx.users, c.assignedTo), status: c.status, feedback: feedbackState(c, ctx.requests),
    review: c.reviewState, outcome: c.outcome === "Pending" ? "Not determined" : c.outcome, resolvedAt: c.resolution?.at ?? null, closedAt: c.closedAt ?? null,
    resolutionDays: days(c.receivedAt, c.resolution?.at), closureDays: days(c.receivedAt, c.closedAt), reviewWaitDays: waits.length ? Math.round((waits.reduce((a, b) => a + b, 0) / waits.length) * 10) / 10 : null,
    returns: returnCount(c), ageDays: c.status === "Closed" ? null : Math.round(ageDays(c.receivedAt) * 10) / 10,
    location: c.status !== "Closed" ? "Active" : isArchived(c) ? (c.archived ? "Archive (manual)" : `Archive · ${colomboMonthKey(c.closedAt!)}`) : "Closed this month",
    training: ctx.training.filter((t) => t.caseIds.includes(c.id)).map((t) => `${t.id} (${t.status})`).join(", "),
    managerNotes: ctx.canNotes ? c.managerNotes : null,
  };
}

function inRange(iso: string | null | undefined, cfg: ReportConfig) {
  if (cfg.range === "all") return true;
  if (!iso) return false;
  const t = new Date(iso).getTime();
  const now = demoNow().getTime();
  if (cfg.range === "week") return t > now - 7 * 86400000 && t <= now;
  if (cfg.range === "month") return colomboMonthKey(iso) === cfg.month;
  const from = cfg.from ? new Date(cfg.from + "T00:00:00+05:30").getTime() : -Infinity;
  const to = cfg.to ? new Date(cfg.to + "T23:59:59+05:30").getTime() : Infinity;
  return t >= from && t <= to;
}

export function periodLabel(cfg: ReportConfig) {
  if (cfg.range === "all") return "All dates";
  if (cfg.range === "week") return `Last 7 days to ${fmtDate(demoNow().toISOString(), true)}`;
  if (cfg.range === "month") {
    const [y, m] = cfg.month.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, 15)).toLocaleString("en-GB", { month: "long", year: "numeric" });
  }
  return `${cfg.from || "start"} to ${cfg.to || "today"}`;
}

export interface Built {
  template: Template;
  columns: Col[];
  rows: Row[];
  summary: { label: string; value: string }[];
  chart: { label: string; data: { name: string; value: number }[] } | null;
  groups: { key: string; count: number }[] | null;
  population: number;
}

const avg = (xs: (number | null)[]) => {
  const v = xs.filter((x): x is number => typeof x === "number");
  return v.length ? (Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10).toString() + " d" : "—";
};
const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : "—");
const countBy = (rows: Row[], key: string) => {
  const m = new Map<string, number>();
  rows.forEach((r) => m.set(String(r[key] ?? "—"), (m.get(String(r[key] ?? "—")) ?? 0) + 1));
  return Array.from(m, ([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
};

export function buildReport(cfg: ReportConfig, ctx: Ctx): Built {
  const template = TEMPLATES.find((t) => t.id === cfg.template) ?? TEMPLATES[0];
  const allCols = COLS[template.rowKind].filter((c) => (c.restricted === "notes" ? ctx.canNotes : true));
  let rows: Row[] = [];
  const f = cfg.filters;
  const caseOk = (c: Complaint) =>
    (!f.source || c.source === f.source) && (!f.category || c.category === f.category) && (!f.priority || c.priority === f.priority) &&
    (!f.officer || c.assignedTo === f.officer) && (!f.team || c.team === f.team) && (!f.status || c.status === f.status) &&
    (!f.outcome || c.outcome === f.outcome) && (!f.issueType || c.issueType === f.issueType);
  const basisDate = (c: Complaint) => (cfg.basis === "resolved" ? c.resolution?.at : cfg.basis === "closed" ? c.closedAt : c.receivedAt);
  const cases = ctx.complaints.filter(caseOk);

  if (template.rowKind === "case") {
    rows = cases.filter((c) => inRange(basisDate(c), cfg)).map((c) => caseRow(c, ctx));
  } else if (template.rowKind === "request") {
    const ids = new Set(cases.map((c) => c.id));
    rows = ctx.requests.filter((r) => ids.has(r.complaintId) && inRange(r.requestedAt, cfg) && (!f.team || true)).map((r) => ({
      id: r.id, caseId: r.complaintId, centre: r.centre, groupManager: name(ctx.users, r.groupManagerId), requestedBy: name(ctx.users, r.requestedBy), requestedAt: r.requestedAt,
      status: r.status, submittedAt: r.response?.submittedAt ?? null, turnaroundDays: days(r.requestedAt, r.response?.submittedAt), pendingDays: r.status === "Pending" ? days(r.requestedAt, demoNow().toISOString()) : null,
      employee: r.response?.employee.name ?? "",
    }));
  } else if (template.rowKind === "training") {
    const visibleIds = new Set(ctx.complaints.map((c) => c.id));
    rows = ctx.training.filter((t) => inRange(t.proposedAt, cfg) && (!f.priority || t.priority === f.priority) && (!f.officer || t.ownerId === f.officer)).map((t) => ({
      id: t.id, cases: t.caseIds.map((id) => (visibleIds.has(id) ? id : "Restricted case")).join(", "), employee: t.employee.name, team: t.employee.group, type: t.type, gap: t.gap,
      owner: name(ctx.users, t.ownerId), priority: t.priority, status: t.status, proposedAt: t.proposedAt, dueDate: t.dueDate, overdue: isOverdue(t) ? "Yes" : "No", followUp: t.followUp,
    }));
  } else if (ctx.canHistory) {
    for (const c of cases)
      for (const h of c.history)
        if (inRange(h.ts, cfg)) rows.push({ caseId: c.id, ts: h.ts, actor: h.actor, type: h.type, action: h.action, detail: h.detail ?? "", location: c.status !== "Closed" ? "Active" : isArchived(c) ? "Archive" : "Closed this month" });
  }

  // sort
  const sk = cfg.sortBy && allCols.some((c) => c.key === cfg.sortBy) ? cfg.sortBy : allCols[0].key;
  rows.sort((a, b) => {
    const x = a[sk] ?? "", y = b[sk] ?? "";
    const r = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y));
    return cfg.sortDir === "desc" ? -r : r;
  });
  const columns = (cfg.columns.length ? cfg.columns : template.defaultColumns).map((k) => allCols.find((c) => c.key === k)).filter((c): c is Col => !!c);

  // summaries computed from the same filtered rows
  let summary: Built["summary"] = [];
  let chart: Built["chart"] = null;
  const n = rows.length;
  if (template.rowKind === "case") {
    const by = (s: string) => rows.filter((r) => r.status === s).length;
    if (template.id === "weekly") {
      const startedIn = cases.filter((c) => inRange(c.startedAt, cfg)).length;
      const resolvedIn = cases.filter((c) => inRange(c.resolution?.at, cfg)).length;
      const closedIn = cases.filter((c) => inRange(c.closedAt, cfg)).length;
      const outstanding = rows.filter((r) => r.status !== "Closed");
      summary = [
        { label: `Cases (${cfg.basis} in period)`, value: String(n) },
        { label: "Started in period", value: String(startedIn) },
        { label: "Resolved in period", value: String(resolvedIn) },
        { label: "Closed in period", value: String(closedIn) },
        { label: "Outstanding (of population)", value: String(outstanding.length) },
        { label: "Average age of outstanding", value: avg(outstanding.map((r) => r.ageDays as number | null)) },
      ];
      chart = { label: "Outstanding cases by age band", data: [["0–2 d", 0, 2], ["3–7 d", 3, 7], ["8–14 d", 8, 14], ["15+ d", 15, 9999]].map(([name, lo, hi]) => ({ name: name as string, value: outstanding.filter((r) => (r.ageDays as number) >= (lo as number) && (r.ageDays as number) < (hi as number) + 1).length })) };
    } else if (template.id === "monthly") {
      summary = [
        { label: "Cases in population", value: String(n) },
        { label: "Closed", value: String(by("Closed")) },
        { label: "Backlog (not closed)", value: String(n - by("Closed")) },
        { label: "Officer's Fault rate (of determined)", value: pct(rows.filter((r) => r.outcome === "Officer's Fault").length, rows.filter((r) => r.outcome !== "Not determined").length) },
        { label: "Linked training actions", value: String(new Set(rows.flatMap((r) => String(r.training || "").split(", ").filter(Boolean))).size) },
        { label: "Archived cases included", value: String(rows.filter((r) => String(r.location).startsWith("Archive")).length) },
      ];
      chart = { label: "Cases by source", data: countBy(rows, "source") };
    } else if (template.id === "performance") {
      summary = [
        { label: "Cases", value: String(n) },
        { label: "Avg resolution time", value: avg(rows.map((r) => r.resolutionDays as number | null)) },
        { label: "Avg closure time", value: avg(rows.map((r) => r.closureDays as number | null)) },
        { label: "Avg Manager review wait", value: avg(rows.map((r) => r.reviewWaitDays as number | null)) },
        { label: "Returns for investigation", value: String(rows.reduce((a, r) => a + (r.returns as number), 0)) },
        { label: "Cases returned at least once", value: pct(rows.filter((r) => (r.returns as number) > 0).length, n) },
      ];
      chart = { label: "Cases by status", data: countBy(rows, "status") };
    } else {
      const g = countBy(rows, "officer");
      summary = [
        { label: "Cases", value: String(n) },
        { label: "Officers with cases", value: String(g.filter((x) => x.name !== "Unassigned").length) },
        { label: "Unassigned", value: String(rows.filter((r) => r.officer === "Unassigned").length) },
        { label: "Active (Open + In Progress)", value: String(by("Open") + by("In Progress")) },
        { label: "Pending Manager review", value: String(by("Resolved")) },
        { label: "Avg resolution time", value: avg(rows.map((r) => r.resolutionDays as number | null)) },
      ];
      chart = { label: "Cases per officer", data: g };
    }
  } else if (template.rowKind === "request") {
    summary = [
      { label: "Requests", value: String(n) },
      { label: "Pending", value: String(rows.filter((r) => r.status === "Pending").length) },
      { label: "Submitted", value: String(rows.filter((r) => r.status === "Submitted").length) },
      { label: "Avg turnaround", value: avg(rows.map((r) => r.turnaroundDays as number | null)) },
    ];
    chart = { label: "Requests by centre", data: countBy(rows, "centre") };
  } else if (template.rowKind === "training") {
    summary = [
      { label: "Actions", value: String(n) },
      { label: "Proposed", value: String(rows.filter((r) => r.status === "Proposed").length) },
      { label: "Approved / In progress", value: String(rows.filter((r) => ["Approved", "In Progress", "Needs Changes"].includes(String(r.status))).length) },
      { label: "Completed / Reviewed", value: String(rows.filter((r) => ["Completed", "Reviewed"].includes(String(r.status))).length) },
      { label: "Overdue", value: String(rows.filter((r) => r.overdue === "Yes").length) },
      { label: "Follow-up recorded", value: String(rows.filter((r) => r.followUp).length) },
    ];
    chart = { label: "Actions by status", data: countBy(rows, "status") };
  } else {
    summary = [
      { label: "Events", value: String(n) },
      { label: "Cases", value: String(new Set(rows.map((r) => r.caseId)).size) },
      { label: "Archive events", value: String(rows.filter((r) => r.location === "Archive").length) },
    ];
    chart = { label: "Events by type", data: countBy(rows, "type") };
  }
  const groups = cfg.groupBy ? countBy(rows, cfg.groupBy).map((g) => ({ key: g.name, count: g.value })) : null;
  return { template, columns, rows, summary, chart, groups, population: n };
}

export function filterSummary(cfg: ReportConfig, users: User[]) {
  const parts = Object.entries(cfg.filters).filter(([, v]) => v).map(([k, v]) => `${k}: ${k === "officer" ? users.find((u) => u.id === v)?.name ?? v : v}`);
  return [`Date basis: ${cfg.basis}`, `Period: ${periodLabel(cfg)}`, ...parts].join(" · ");
}
