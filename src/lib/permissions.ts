import type { Cap, Complaint, Role, Scope, User, FeedbackRequest, TrainingAction, AttachmentMeta } from "./types";

// One central policy for navigation, routes, selectors, counts, dialogs, fields,
// actions, search, notifications and exports. Prototype-only: a production backend
// must repeat every check server-side.

export interface CapDef {
  cap: Cap;
  label: string;
  area: string;
  eligible: Role[]; // hard boundary — can never be granted outside these roles
  help?: string;
}

const M: Role[] = ["Manager"];
const T: Role[] = ["Technical Officer"];
const MT: Role[] = ["Manager", "Technical Officer"];

export const CAPS: CapDef[] = [
  { cap: "dashboard.view", label: "Dashboard", area: "Visibility", eligible: MT },
  { cap: "case.view", label: "Complaint list & detail", area: "Visibility", eligible: MT },
  { cap: "case.history", label: "Complaint history / timeline", area: "Visibility", eligible: MT },
  { cap: "case.notes", label: "Internal Manager notes", area: "Visibility", eligible: MT },
  { cap: "archive.view", label: "Archive", area: "Visibility", eligible: MT },
  { cap: "intake.manual", label: "Manual registration", area: "Intake", eligible: T, help: "Technical Officers only" },
  { cap: "intake.email", label: "Register from email (1212 / complaint mail)", area: "Intake", eligible: MT, help: "Managers and Technical Officers" },
  { cap: "intake.editOriginal", label: "Correct original information", area: "Intake", eligible: M, help: "Managers only, non-Closed cases" },
  { cap: "case.assign", label: "Assign / reassign", area: "Ownership", eligible: M, help: "Managers only" },
  { cap: "inv.start", label: "Start investigation", area: "Investigation", eligible: T, help: "Technical Officers only" },
  { cap: "inv.edit", label: "Edit findings", area: "Investigation", eligible: T },
  { cap: "inv.evidence", label: "Append investigation evidence", area: "Investigation", eligible: T },
  { cap: "inv.requestFeedback", label: "Request regional feedback", area: "Investigation", eligible: T },
  { cap: "inv.resolve", label: "Resolve & send for review", area: "Investigation", eligible: T },
  { cap: "review.return", label: "Return for investigation", area: "Review", eligible: M, help: "Managers only" },
  { cap: "review.close", label: "Review & close", area: "Review", eligible: M, help: "Managers only" },
  { cap: "archive.manage", label: "Archive closed cases", area: "Review", eligible: M },
  { cap: "att.view", label: "View attachment list", area: "Attachments", eligible: MT },
  { cap: "att.preview", label: "Preview attachments", area: "Attachments", eligible: MT },
  { cap: "att.download", label: "Download attachments", area: "Attachments", eligible: MT },
  { cap: "att.manageOriginal", label: "Manage original intake attachments", area: "Attachments", eligible: M },
  { cap: "train.view", label: "View training & coaching", area: "Improvement", eligible: MT },
  { cap: "train.propose", label: "Propose action from findings", area: "Improvement", eligible: T },
  { cap: "train.approve", label: "Approve / assign action", area: "Improvement", eligible: M },
  { cap: "train.update", label: "Update own assigned action", area: "Improvement", eligible: MT },
  { cap: "train.review", label: "Review completion", area: "Improvement", eligible: M },
  { cap: "report.view", label: "View reports", area: "Reports", eligible: MT },
  { cap: "report.generate", label: "Generate reports", area: "Reports", eligible: MT },
  { cap: "report.pdf", label: "Export PDF", area: "Reports", eligible: MT },
  { cap: "report.xlsx", label: "Export Excel", area: "Reports", eligible: MT },
  { cap: "report.csv", label: "Export CSV", area: "Reports", eligible: MT },
  { cap: "config.categories", label: "Category management", area: "Configuration", eligible: M },
  { cap: "config.settings", label: "Approved business settings", area: "Configuration", eligible: M },
];
export const CAP_AREAS = Array.from(new Set(CAPS.map((c) => c.area)));
const capDef = (c: Cap) => CAPS.find((d) => d.cap === c)!;

export type Templates = Record<"Manager" | "Technical Officer", Record<Cap, boolean> & { scope: Scope }>;

function tpl(role: "Manager" | "Technical Officer", off: Cap[] = []): Record<Cap, boolean> {
  const o = {} as Record<Cap, boolean>;
  for (const d of CAPS) o[d.cap] = d.eligible.includes(role) && !off.includes(d.cap);
  return o;
}
export const DEFAULT_TEMPLATES: Templates = {
  Manager: { ...tpl("Manager"), scope: "All" },
  "Technical Officer": { ...tpl("Technical Officer", ["case.notes"]), scope: "Assigned" },
};

export type CapState = { allowed: boolean; source: "template" | "override" | "ineligible" | "fixed" | "inactive" };

export function capState(user: User | null, cap: Cap, templates: Templates): CapState {
  if (!user) return { allowed: false, source: "inactive" };
  if (user.role === "Admin" || user.role === "Group Manager") return { allowed: false, source: "fixed" };
  if (!capDef(cap).eligible.includes(user.role)) return { allowed: false, source: "ineligible" };
  if (!user.active) return { allowed: false, source: "inactive" };
  const ov = user.overrides[cap];
  if (ov !== undefined) return { allowed: ov, source: "override" };
  const fromTpl = templates?.[user.role]?.[cap];
  if (fromTpl !== undefined && (fromTpl || !DEFAULT_TEMPLATES[user.role]?.[cap])) {
    return { allowed: fromTpl, source: "template" };
  }
  return { allowed: DEFAULT_TEMPLATES[user.role]?.[cap] ?? false, source: "template" };
}

export function can(user: User | null, cap: Cap, templates: Templates) {
  return capState(user, cap, templates).allowed;
}

export function scopeOf(user: User, templates: Templates): Scope {
  if (user.role !== "Manager" && user.role !== "Technical Officer") return "Assigned";
  const s = user.scopeOverride ?? templates[user.role].scope;
  return user.role === "Manager" && s === "Assigned" ? "Team" : s;
}

export function inScope(user: User, c: Complaint, templates: Templates) {
  const s = scopeOf(user, templates);
  if (s === "All") return true;
  if (s === "Team") return c.team === user.team;
  return c.assignedTo === user.id;
}

export function canViewCase(user: User | null, c: Complaint, templates: Templates) {
  if (!user || !user.active) return false;
  if (user.role !== "Manager" && user.role !== "Technical Officer") return false;
  if (!can(user, "case.view", templates) || !inScope(user, c, templates)) return false;
  if (isArchived(c) && !can(user, "archive.view", templates)) return false;
  return true;
}

// Archive designation: Closed before the start of the current Colombo month, or manually archived.
export function isArchived(c: Complaint, now = demoNow()) {
  if (c.status !== "Closed" || !c.closedAt) return false;
  return !!c.archived || new Date(c.closedAt).getTime() < colomboMonthStart(now).getTime();
}

export type CaseAction =
  | "start" | "editInvestigation" | "addEvidence" | "requestFeedback" | "resolve"
  | "return" | "close" | "assign" | "correct" | "manageOriginal" | "archive" | "propose" | "notes";

// Capability + record scope + lifecycle in one place.
export function canDo(user: User | null, action: CaseAction, c: Complaint, templates: Templates, reqs: FeedbackRequest[] = []): { ok: boolean; reason?: string } {
  if (!user || !canViewCase(user, c, templates)) return { ok: false, reason: "You do not have access to this case." };
  const need = (cap: Cap) => can(user, cap, templates);
  const isOwnerOrScoped = user.role === "Technical Officer" && (c.assignedTo === user.id || scopeOf(user, templates) !== "Assigned");
  const pending = reqs.some((r) => c.feedbackRequestIds.includes(r.id) && r.status === "Pending");
  switch (action) {
    case "start":
      if (!need("inv.start")) return { ok: false, reason: "Requires the Start investigation permission." };
      if (!isOwnerOrScoped) return { ok: false, reason: "Only the assigned officer can start this investigation." };
      return c.status === "Open" ? { ok: true } : { ok: false, reason: "Only Open cases can be started." };
    case "editInvestigation":
    case "addEvidence":
    case "requestFeedback":
    case "propose": {
      const cap: Cap = action === "editInvestigation" ? "inv.edit" : action === "addEvidence" ? "inv.evidence" : action === "requestFeedback" ? "inv.requestFeedback" : "train.propose";
      if (!need(cap)) return { ok: false, reason: "Not permitted for your account." };
      if (!isOwnerOrScoped) return { ok: false, reason: "Only the assigned officer can work on this case." };
      if (action === "propose") return c.status === "Closed" || c.status === "In Progress" || c.status === "Resolved" ? { ok: true } : { ok: false, reason: "Start the investigation first." };
      return c.status === "In Progress" ? { ok: true } : { ok: false, reason: c.status === "Resolved" ? "Locked while pending Manager review." : c.status === "Closed" ? "Closed cases are read-only." : "Start the investigation first." };
    }
    case "resolve":
      if (!need("inv.resolve") || !isOwnerOrScoped) return { ok: false, reason: "Only the authorised investigating officer can resolve." };
      if (c.status !== "In Progress") return { ok: false, reason: "Only In Progress cases can be resolved." };
      if (pending) return { ok: false, reason: "A regional response is still pending." };
      return { ok: true };
    case "return":
    case "close":
      if (!need(action === "return" ? "review.return" : "review.close")) return { ok: false, reason: "Requires the Manager review permission." };
      return c.status === "Resolved" ? { ok: true } : { ok: false, reason: "Only Resolved cases awaiting review can be " + (action === "close" ? "closed." : "returned.") };
    case "assign":
      if (!need("case.assign")) return { ok: false, reason: "Requires the Assign permission." };
      return c.status === "Open" || c.status === "In Progress" ? { ok: true } : { ok: false, reason: "Assignment is fixed once resolved." };
    case "correct":
      if (!need("intake.editOriginal")) return { ok: false, reason: "Requires the Correct original information permission." };
      return c.status !== "Closed" ? { ok: true } : { ok: false, reason: "Closed case content is read-only." };
    case "manageOriginal":
      if (!need("att.manageOriginal")) return { ok: false, reason: "Not permitted." };
      return c.status !== "Closed" ? { ok: true } : { ok: false, reason: "Closed case content is read-only." };
    case "archive":
      if (!need("archive.manage")) return { ok: false, reason: "Not permitted." };
      return c.status === "Closed" && !c.archived ? { ok: true } : { ok: false, reason: "Only Closed cases can be archived." };
    case "notes":
      return need("case.notes") ? { ok: true } : { ok: false, reason: "Not permitted." };
  }
}

export function canSeeAttachment(user: User | null, a: AttachmentMeta, ctx: { complaints: Complaint[]; requests: FeedbackRequest[]; training: TrainingAction[] }, templates: Templates) {
  if (!user || !user.active || user.role === "Admin") return false;
  if (user.role === "Group Manager") {
    const req = ctx.requests.find((r) => r.groupManagerId === user.id && (r.sharedAttachmentIds.includes(a.id) || r.response?.attachmentIds.includes(a.id)));
    return !!req;
  }
  if (!can(user, "att.view", templates)) return false;
  if (a.kind === "training") {
    const t = ctx.training.find((x) => x.id === a.trainingId);
    return !!t && canViewTraining(user, t, templates);
  }
  const cid = a.complaintId ?? ctx.requests.find((r) => r.id === a.requestId)?.complaintId;
  const c = ctx.complaints.find((x) => x.id === cid);
  return !!c && canViewCase(user, c, templates);
}

export function canViewTraining(user: User | null, t: TrainingAction, templates: Templates) {
  if (!user || !can(user, "train.view", templates)) return false;
  if (user.role === "Manager") return true;
  return t.ownerId === user.id || t.proposedBy === user.id;
}

// ── Clock (uses current real time, aligned to Asia/Colombo) ──
export const DEMO_ANCHOR = Date.now();
let clockOffset = 0;
export function setClockOffset(ms: number) { clockOffset = ms; }
export function demoNow() { return new Date(Date.now() + clockOffset); }

const COLOMBO_OFFSET = 330 * 60000;
export function colomboMonthStart(d: Date) {
  const local = new Date(d.getTime() + COLOMBO_OFFSET);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1) - COLOMBO_OFFSET);
}
export function colomboMonthKey(iso: string) {
  const local = new Date(new Date(iso).getTime() + COLOMBO_OFFSET);
  return `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, "0")}`;
}
