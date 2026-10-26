import type { Complaint, FeedbackRequest, FeedbackState, TrainingAction } from "./types";
import { isArchived, demoNow, colomboMonthStart } from "./permissions";

export function feedbackState(c: Complaint, reqs: FeedbackRequest[]): FeedbackState {
  const mine = reqs.filter((r) => c.feedbackRequestIds.includes(r.id));
  if (!mine.length) return "None";
  return mine.some((r) => r.status === "Pending") ? "Awaiting" : "Received";
}

export function resolveBlockers(c: Complaint, reqs: FeedbackRequest[]): string[] {
  const out: string[] = [];
  if (!c.findings.trim()) out.push("Findings are required.");
  if (c.outcome === "Pending") out.push("Determine the investigation outcome.");
  if (!c.actionsTaken.trim()) out.push("Record the actions taken.");
  if (c.outcome !== "Irrelevant" && !c.employee) out.push("Identify the relevant employee (not required for Irrelevant).");
  if (feedbackState(c, reqs) === "Awaiting") out.push("A required regional response is still pending.");
  return out;
}

export type CaseView = "active" | "awaiting" | "review" | "closedMonth" | "archive" | "all";
export function inView(c: Complaint, v: CaseView, reqs: FeedbackRequest[]) {
  const now = demoNow();
  switch (v) {
    case "active": return c.status === "Open" || c.status === "In Progress";
    case "awaiting": return c.status === "In Progress" && feedbackState(c, reqs) === "Awaiting";
    case "review": return c.status === "Resolved";
    case "closedMonth": return c.status === "Closed" && !isArchived(c, now) && !!c.closedAt && new Date(c.closedAt) >= colomboMonthStart(now);
    case "archive": return isArchived(c, now);
    case "all": return true;
  }
}

export function returnCount(c: Complaint) {
  return c.history.filter((h) => h.type === "return").length;
}

export function isOverdue(t: TrainingAction) {
  return !!t.dueDate && ["Approved", "In Progress", "Needs Changes"].includes(t.status) && new Date(t.dueDate) < demoNow();
}

export function ageDays(fromIso: string, to = demoNow()) {
  try {
    const t = new Date(fromIso).getTime();
    if (isNaN(t)) return 0;
    return Math.max(0, (to.getTime() - t) / 86400000);
  } catch {
    return 0;
  }
}

const COLOMBO = "Asia/Colombo";
export function fmtDate(iso: string | null | undefined, withTime = false) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleString("en-GB", withTime
      ? { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: COLOMBO }
      : { day: "2-digit", month: "short", year: "numeric", timeZone: COLOMBO });
  } catch {
    return "—";
  }
}
export function fmtMonth(iso: string) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleString("en-GB", { month: "long", year: "numeric", timeZone: COLOMBO });
  } catch {
    return "—";
  }
}
export function relTime(iso: string) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    const t = d.getTime();
    if (isNaN(t)) return "—";
    // Compare against real wall-clock time
    const diff = Date.now() - t;
    if (diff <= 60000 && diff >= -120000) return "just now";
    const m = Math.round(diff / 60000);
    if (m < 1) return "just now";
    if (m < 60) return `${m} min ago`;
    if (m < 1440) return `${Math.round(m / 60)} h ago`;
    return `${Math.round(m / 1440)} d ago`;
  } catch {
    return "—";
  }
}
