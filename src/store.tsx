import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type {
  User, Complaint, FeedbackRequest, InboxEmail, AttachmentMeta, TrainingAction, Notification, TechAudit, GeneratedReport,
  ReportPreset, Settings, BusinessLists, Cap, IntakeFields, Employee, NotifEvent, Scope, Role, QueuePreset, RecipientPreset, Source,
} from "./lib/types";
import {
  DEFAULT_TEMPLATES, can as canCap, canDo as canDoCase, canViewCase, canSeeAttachment, canViewTraining, setClockOffset, demoNow,
  type Templates, type CaseAction,
} from "./lib/permissions";
import {
  SEED_USERS, SEED_COMPLAINTS, SEED_REQUESTS, SEED_INBOX, SYNC_POOL, SEED_ATTACHMENTS, SEED_TRAINING, DEFAULT_SETTINGS, DEFAULT_LISTS,
  SEED_NOTIFICATIONS, SEED_AUDIT, SEED_CENTRE_MAP, HEAD_OFFICE_EMPLOYEES, REGIONAL_EMPLOYEES,
} from "./lib/seed";
import { resolveBlockers } from "./lib/lifecycle";
import { putBlob, clearBlobs } from "./lib/files";

// ── Replaceable service layer ─────────────────────────────────────
// All mutations re-check the central permission evaluator against the latest state
// and reject disallowed actions. A production backend must repeat these checks.

export interface DB {
  version: number;
  clockStartReal: number;
  seq: number;
  users: User[];
  templates: Templates;
  centreMap: Record<string, string>;
  complaints: Complaint[];
  requests: FeedbackRequest[];
  inbox: InboxEmail[];
  syncPool: InboxEmail[];
  attachments: AttachmentMeta[];
  training: TrainingAction[];
  notifications: Notification[];
  audit: TechAudit[];
  reports: GeneratedReport[];
  reportPresets: ReportPreset[];
  queuePresets: QueuePreset[];
  recipientPresets: RecipientPreset[];
  settings: Settings;
  lists: BusinessLists;
  prefs: Record<string, { muted: NotifEvent[] }>;
  employees: Employee[];
}

const KEY = "comtrack:db:v3";
const SESSION = "comtrack:session:v2";
const VERSION = 3;

function seed(): DB {
  return {
    version: VERSION, clockStartReal: Date.now(), seq: 100,
    users: SEED_USERS, templates: DEFAULT_TEMPLATES, centreMap: SEED_CENTRE_MAP,
    complaints: SEED_COMPLAINTS, requests: SEED_REQUESTS, inbox: SEED_INBOX, syncPool: SYNC_POOL, attachments: SEED_ATTACHMENTS, training: SEED_TRAINING,
    notifications: SEED_NOTIFICATIONS.map((n, i) => ({ ...n, id: `N-${i + 1}`, read: false, dedupeKey: `seed-${i}` })),
    audit: SEED_AUDIT, reports: [], reportPresets: [], queuePresets: [], recipientPresets: [
      { id: "RP-1", ownerId: "u-mgr1", name: "Monthly management pack", recipients: "head.cc@slt.lk; gm.customerops@slt.lk" },
    ],
    settings: DEFAULT_SETTINGS, lists: DEFAULT_LISTS, prefs: {},
    employees: [...HEAD_OFFICE_EMPLOYEES, ...REGIONAL_EMPLOYEES],
  };
}

function load(): DB {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const db = JSON.parse(raw) as DB;
      if (db.version === VERSION) {
        db.users = db.users.filter((u) => u.id !== "u-mgr2" && u.id !== "u-to3");
        db.users.forEach((u) => {
          if (u.role === "Manager" || u.role === "Technical Officer") u.team = "CC Quality";
        });
        db.complaints.forEach((c) => {
          c.team = "CC Quality";
          if (c.assignedTo === "u-to3") c.assignedTo = "u-to1";
          if (c.registeredBy === "Roshan Jayawardena") c.registeredBy = "Dilrukshi Ranasinghe";
        });
        if (db.templates?.["Technical Officer"]) {
          db.templates["Technical Officer"]["intake.manual"] = true;
          db.templates["Technical Officer"]["intake.email"] = true;
        }
        if (db.templates?.Manager) {
          db.templates.Manager["intake.manual"] = false;
          db.templates.Manager["intake.email"] = true;
          db.templates.Manager.scope = "All";
        }
        if (!db.employees || !Array.isArray(db.employees) || db.employees.length === 0) {
          db.employees = [...HEAD_OFFICE_EMPLOYEES, ...REGIONAL_EMPLOYEES];
        }
        try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { /* ignore */ }
        return db;
      }
    }
  } catch {
    /* fall through */
  }
  return seed();
}

export type Result = { ok: true; id?: string } | { ok: false; error: string };
const fail = (error: string): Result => ({ ok: false, error });

export interface Toast { id: number; kind: "success" | "error" | "info"; text: string }

interface Store {
  db: DB;
  me: User | null;
  sessionNotice: string | null;
  can: (cap: Cap) => boolean;
  canDo: (action: CaseAction, c: Complaint) => { ok: boolean; reason?: string };
  canView: (c: Complaint) => boolean;
  canSeeFile: (a: AttachmentMeta) => boolean;
  canSeeTraining: (t: TrainingAction) => boolean;
  visibleComplaints: Complaint[];
  userName: (id: string | null | undefined) => string;
  login: (userId: string) => void;
  logout: (notice?: string) => void;
  resetDemo: () => Promise<void>;
  toast: (kind: Toast["kind"], text: string) => void;
  toasts: Toast[];
  dismissToast: (id: number) => void;
  act: Actions;
}

type Actions = ReturnType<typeof makeActions>;
const Ctx = createContext<Store | null>(null);

export function nowIso() {
  return new Date().toISOString();
}

function makeActions(get: () => DB, commit: (fn: (d: DB) => void) => void, meRef: () => User | null) {
  const me = () => meRef();
  const T = () => get().templates;
  const id = (prefix: string, d: DB) => `${prefix}-${++d.seq}`;
  const hist = (c: Complaint, d: DB, type: Complaint["history"][number]["type"], action: string, detail?: string, before?: string, after?: string) =>
    c.history.push({ id: id("h", d), ts: nowIso(), actor: me()!.name, type, action, detail, before, after });

  function notify(d: DB, userIds: string[], event: NotifEvent, title: string, target: Notification["target"], dedupeKey: string) {
    const rule = d.settings.notifications[event];
    if (!rule?.enabled || !rule.inApp) return;
    for (const uid of Array.from(new Set(userIds))) {
      if (!uid || uid === me()?.id) continue;
      if (!rule.mandatory && d.prefs[uid]?.muted.includes(event)) continue;
      if (d.notifications.some((n) => n.userId === uid && n.dedupeKey === dedupeKey)) continue; // dedupe one event per recipient
      d.notifications.unshift({ id: id("N", d), userId: uid, event, ts: nowIso(), title, target, read: false, dedupeKey });
    }
  }
  const managersFor = (d: DB, c: Complaint) =>
    d.users.filter((u) => u.role === "Manager" && u.active && canViewCase(u, c, d.templates) && canCap(u, "review.close", d.templates)).map((u) => u.id);

  function guard(action: CaseAction, caseId: string): { c: Complaint; d: DB } | string {
    const d = get();
    const c = d.complaints.find((x) => x.id === caseId);
    if (!c) return "Case not found.";
    const r = canDoCase(me(), action, c, d.templates, d.requests);
    return r.ok ? { c, d } : r.reason ?? "Not permitted.";
  }
  function withCase(action: CaseAction, caseId: string, fn: (c: Complaint, d: DB) => string | void): Result {
    const g = guard(action, caseId);
    if (typeof g === "string") return fail(g);
    const box: { err?: string } = {};
    commit((d) => {
      const c = d.complaints.find((x) => x.id === caseId)!;
      box.err = fn(c, d) || undefined;
    });
    return box.err ? fail(box.err) : { ok: true };
  }
  const audit = (d: DB, category: TechAudit["category"], action: string, detail?: string) =>
    d.audit.unshift({ id: id("TA", d), ts: nowIso(), actor: me()?.name ?? "System", category, action, detail });
  const isAdmin = () => me()?.role === "Admin" && me()!.active;

  return {
    // ── Intake ──
    register(fields: IntakeFields, opts: { assignTo?: string | null; emailId?: string; team: string; files?: File[]; employee?: Employee | null }): Result {
      const d = get();
      const u = me();
      const cap: Cap = opts.emailId ? "intake.email" : "intake.manual";
      if (!u || !canCap(u, cap, d.templates)) return fail("You do not have permission to register complaints.");
      let email: InboxEmail | undefined;
      if (opts.emailId) {
        email = d.inbox.find((e) => e.id === opts.emailId);
        if (!email) return fail("Email no longer available.");
        if (email.processedCaseId || d.complaints.some((c) => c.email?.messageId === email!.messageId))
          return fail(`This message is already registered as ${email.processedCaseId ?? "a complaint"}. Duplicate registration blocked.`);
      }
      const assignTo = u.role === "Technical Officer" ? u.id : (opts.assignTo ?? null);
      if (assignTo) {
        const a = d.users.find((x) => x.id === assignTo);
        if (!a || a.role !== "Technical Officer" || !a.active) return fail("Assignee must be an active Technical Officer.");
      }
      let newId = "";
      commit((d) => {
        const year = new Date(nowIso()).getUTCFullYear();
        const max = Math.max(...d.complaints.map((c) => Number(c.id.split("-")[2]) || 0));
        newId = `CT-${year}-${max + 1}`;
        const ts = nowIso();
        const c: Complaint = {
          ...fields, id: newId, channel: email ? "Email" : "Manual", original: { ...fields }, team: opts.team, registeredBy: u.name, registeredAt: ts,
          assignedTo: assignTo, assignedAt: assignTo ? ts : null, status: "Open", reviewState: "Not Submitted", outcome: "Pending",
          findings: "", observations: "", employee: opts.employee ?? null, actionsTaken: "", responsibleParty: "", managerNotes: "", feedbackRequestIds: [], history: [],
          email: email ? { messageId: email.messageId, mailbox: email.mailbox, from: email.from, fromName: email.fromName, subject: email.subject, receivedAt: email.receivedAt, body: email.body } : undefined,
        };
        if (email) c.history.push({ id: id("h", d), ts: email.receivedAt, actor: "System", type: "intake", action: `Email received in ${email.mailbox === "1212" ? "1212 Mail" : "complaint"} mailbox`, detail: `Message ${email.messageId}` });
        hist(c, d, "register", email ? `Complaint registered from ${email.mailbox === "1212" ? "1212 Mail" : "email"}` : "Complaint registered manually", `Source: ${fields.source}${opts.employee ? ` · Employee: ${opts.employee.name} (${opts.employee.serviceNo})` : ""}`);
        if (assignTo) {
          if (u.role === "Technical Officer" && assignTo === u.id) {
            hist(c, d, "assign", `Auto-assigned to registering officer ${u.name}`);
          } else {
            hist(c, d, "assign", `Assigned to ${d.users.find((x) => x.id === assignTo)!.name}`);
            notify(d, [assignTo], "assignment", `${newId} has been assigned to you.`, { kind: "case", id: newId }, `assign-${newId}-${assignTo}-0`);
          }
        }
        d.complaints.unshift(c);
        if (email) {
          const e = d.inbox.find((x) => x.id === email!.id)!;
          e.processedCaseId = newId;
          e.read = true;
          email.attachments.forEach((a) => d.attachments.push({ id: id("AT", d), complaintId: newId, kind: "intake", name: a.name, type: a.type, size: a.size, uploadedBy: "System", uploadedAt: email!.receivedAt, provenance: `Imported from email ${email!.messageId}`, hasBinary: false }));
        }
      });
      return { ok: true, id: newId };
    },
    correct(caseId: string, patch: Partial<IntakeFields>, reason: string): Result {
      if (!reason.trim()) return fail("A correction reason is required.");
      return withCase("correct", caseId, (c, d) => {
        const keys = (Object.keys(patch) as (keyof IntakeFields)[]).filter((k) => patch[k] !== c[k]);
        if (!keys.length) return "No changes to save.";
        for (const k of keys) {
          hist(c, d, "correction", `Original information corrected: ${k}`, reason, String(c[k] ?? ""), String(patch[k] ?? ""));
          (c as unknown as Record<string, unknown>)[k] = patch[k];
        }
      });
    },
    assign(caseId: string, userId: string): Result {
      const target = get().users.find((x) => x.id === userId);
      if (!target || target.role !== "Technical Officer" || !target.active) return fail("Assignee must be an active Technical Officer.");
      return withCase("assign", caseId, (c, d) => {
        if (c.assignedTo === userId) return "Already assigned to this officer.";
        const prev = c.assignedTo;
        c.assignedTo = userId;
        c.assignedAt = nowIso();
        hist(c, d, "assign", prev ? `Reassigned to ${target.name}` : `Assigned to ${target.name}`, undefined, prev ? d.users.find((x) => x.id === prev)?.name : undefined, target.name);
        notify(d, [userId], "assignment", `${c.id} has been assigned to you.`, { kind: "case", id: c.id }, `assign-${c.id}-${userId}-${c.history.length}`);
      });
    },
    // ── Investigation ──
    start(caseId: string): Result {
      return withCase("start", caseId, (c, d) => {
        c.status = "In Progress";
        c.startedAt = nowIso();
        hist(c, d, "investigation", "Investigation started", "Open → In Progress");
      });
    },
    saveInvestigation(caseId: string, patch: Pick<Complaint, "findings" | "observations" | "employee" | "actionsTaken" | "responsibleParty" | "outcome">): Result {
      return withCase("editInvestigation", caseId, (c, d) => {
        const changed = (Object.keys(patch) as (keyof typeof patch)[]).filter((k) => JSON.stringify(patch[k]) !== JSON.stringify(c[k]));
        if (!changed.length) return;
        Object.assign(c, patch);
        hist(c, d, "investigation", "Investigation updated", `Fields: ${changed.join(", ")}`);
      });
    },
    requestFeedback(caseId: string, r: { centre: string; reason: string; infoRequired: string; context: string; sharedAttachmentIds: string[] }): Result {
      const d0 = get();
      const gm = d0.centreMap[r.centre];
      if (!gm) return fail("No Group Manager is mapped to this centre. Ask an Administrator to configure the mapping.");
      if (!r.reason.trim() || !r.infoRequired.trim() || !r.context.trim()) return fail("Reason, information required and shared context are required.");
      let rid = "";
      const res = withCase("requestFeedback", caseId, (c, d) => {
        if (d.requests.some((x) => x.complaintId === c.id && x.status === "Pending" && x.centre === r.centre)) return "A request to this centre is already pending.";
        rid = `FR-0${++d.seq + 300}`;
        d.requests.unshift({ id: rid, complaintId: c.id, requestedAt: nowIso(), requestedBy: me()!.id, centre: r.centre, groupManagerId: gm, reason: r.reason, infoRequired: r.infoRequired, context: r.context, sharedAttachmentIds: r.sharedAttachmentIds, status: "Pending" });
        r.sharedAttachmentIds.forEach((aid) => { const a = d.attachments.find((x) => x.id === aid); if (a) a.provenance += ` · shared with ${r.centre} (${rid})`; });
        c.feedbackRequestIds.push(rid);
        hist(c, d, "feedback", "Regional feedback requested", `${r.centre} · ${d.users.find((x) => x.id === gm)?.name}`);
        notify(d, [gm], "regional_request", `Regional feedback request ${rid} is awaiting your response.`, { kind: "request", id: rid }, `req-${rid}`);
      });
      return res.ok ? { ok: true, id: rid } : res;
    },
    cancelFeedbackRequest(reqId: string, reason = "Cancelled by investigating officer"): Result {
      const d0 = get();
      const u = me();
      const req = d0.requests.find((x) => x.id === reqId);
      if (!req) return fail("Request not found.");
      if (req.status !== "Pending") return fail("Only pending requests can be cancelled.");
      if (!u || (u.role !== "Technical Officer" && u.role !== "Manager") || !u.active) {
        return fail("Only the investigating officer or a Manager can cancel a regional request.");
      }
      return withCase("requestFeedback", req.complaintId, (c, d) => {
        const r = d.requests.find((x) => x.id === reqId);
        if (!r || r.status !== "Pending") return "Request is no longer pending.";
        r.status = "Cancelled";
        r.cancelled = { by: u.name, at: nowIso(), reason };
        hist(c, d, "feedback", "Regional feedback request cancelled", `${r.centre} · Reason: ${reason}`);
      });
    },
    submitFeedback(reqId: string, employee: Employee, feedback: string, attachmentIds: string[]): Result {
      const d0 = get();
      const u = me();
      const req = d0.requests.find((x) => x.id === reqId);
      if (!u || u.role !== "Group Manager" || !u.active || !req || req.groupManagerId !== u.id) return fail("This request is not assigned to you.");
      if (req.status !== "Pending") return fail("This response was already submitted and is read-only.");
      if (employee.centre !== req.centre) return fail("Select an employee from the request's centre.");
      if (!feedback.trim()) return fail("Feedback is required.");
      commit((d) => {
        const r = d.requests.find((x) => x.id === reqId)!;
        r.status = "Submitted";
        r.response = { employee, feedback, submittedAt: nowIso(), attachmentIds };
        const c = d.complaints.find((x) => x.id === r.complaintId);
        if (c) {
          hist(c, d, "feedback", "Regional feedback submitted", `${r.centre} · Employee: ${employee.name}`);
          notify(d, [r.requestedBy, c.assignedTo ?? ""], "regional_response", `Regional response received for ${c.id}.`, { kind: "case", id: c.id }, `resp-${reqId}`);
        }
      });
      return { ok: true };
    },
    resolve(caseId: string, summary: string): Result {
      const d0 = get();
      const c0 = d0.complaints.find((x) => x.id === caseId);
      if (c0) {
        const b = resolveBlockers(c0, d0.requests);
        if (b.length) return fail(b.join(" "));
      }
      if (!summary.trim()) return fail("A resolution summary is required.");
      return withCase("resolve", caseId, (c, d) => {
        c.status = "Resolved";
        c.reviewState = "Pending Review";
        c.resolution = { summary, by: me()!.name, at: nowIso() };
        hist(c, d, "resolve", "Resolved & sent for Manager review", `Outcome: ${c.outcome}`);
        notify(d, managersFor(d, c), "pending_review", `${c.id} is resolved and awaiting your review.`, { kind: "case", id: c.id }, `review-${c.id}-${c.history.length}`);
      });
    },
    returnCase(caseId: string, reason: string): Result {
      if (!reason.trim()) return fail("A reason is required to return a case.");
      return withCase("return", caseId, (c, d) => {
        c.status = "In Progress";
        c.reviewState = "Returned";
        hist(c, d, "return", "Returned for investigation", reason);
        notify(d, [c.assignedTo ?? ""], "returned", `${c.id} was returned for investigation.`, { kind: "case", id: c.id }, `return-${c.id}-${c.history.length}`);
      });
    },
    close(caseId: string, decision: string, notes: string): Result {
      if (!decision.trim()) return fail("Record the final decision.");
      return withCase("close", caseId, (c, d) => {
        const open = d.training.filter((t) => t.caseIds.includes(c.id) && !["Reviewed", "Rejected"].includes(t.status));
        c.status = "Closed";
        c.reviewState = "Approved";
        c.closedAt = nowIso();
        c.review = { decision, notes, by: me()!.name, at: c.closedAt };
        hist(c, d, "close", "Reviewed & closed", decision + (open.length ? ` · Outstanding training: ${open.map((t) => t.id).join(", ")}` : ""));
        notify(d, [c.assignedTo ?? ""], "closed", `${c.id} has been closed.`, { kind: "case", id: c.id }, `close-${c.id}`);
      });
    },
    archive(caseId: string, reason: string): Result {
      if (!reason.trim()) return fail("An archive reason is required.");
      return withCase("archive", caseId, (c, d) => {
        c.archived = { at: nowIso(), by: me()!.name, reason };
        hist(c, d, "archive", "Archived manually", reason);
      });
    },
    saveNotes(caseId: string, notes: string): Result {
      const g = guard("notes", caseId);
      if (typeof g === "string") return fail(g);
      if (me()?.role !== "Manager") return fail("Only Managers can edit internal notes.");
      if (g.c.status === "Closed") return fail("Closed case content is read-only.");
      commit((d) => { d.complaints.find((x) => x.id === caseId)!.managerNotes = notes; });
      return { ok: true };
    },
    // ── Attachments ──
    async addAttachment(file: File, meta: Omit<AttachmentMeta, "id" | "name" | "type" | "size" | "uploadedBy" | "uploadedAt" | "hasBinary">): Promise<Result> {
      const d = get();
      const u = me();
      if (!u) return fail("Signed out.");
      if (meta.kind === "intake" || meta.kind === "investigation") {
        const c = d.complaints.find((x) => x.id === meta.complaintId);
        if (!c) return fail("Case not found.");
        const r = canDoCase(u, meta.kind === "intake" ? "manageOriginal" : "addEvidence", c, d.templates, d.requests);
        if (!r.ok) return fail(r.reason ?? "Not permitted.");
        const count = d.attachments.filter((a) => a.complaintId === c.id && !a.removed).length;
        if (count >= d.settings.attachment.maxCount) return fail(`Maximum of ${d.settings.attachment.maxCount} attachments per case reached.`);
      } else if (meta.kind === "response") {
        const r = d.requests.find((x) => x.id === meta.requestId);
        if (!r || u.role !== "Group Manager" || r.groupManagerId !== u.id || r.status !== "Pending") return fail("Not permitted.");
      } else if (meta.kind === "training") {
        const t = d.training.find((x) => x.id === meta.trainingId);
        if (!t || t.ownerId !== u.id || !canCap(u, "train.update", d.templates)) return fail("Only the action owner can add completion evidence.");
      }
      const aid = `AT-${Date.now().toString(36)}`;
      try {
        await putBlob(aid, file);
      } catch {
        return fail("Local storage for files is unavailable in this browser. The file was not saved.");
      }
      commit((d) => {
        d.attachments.push({ ...meta, id: aid, name: file.name, type: file.type || "application/octet-stream", size: file.size, uploadedBy: u.name, uploadedAt: nowIso(), hasBinary: true });
        const c = d.complaints.find((x) => x.id === meta.complaintId);
        if (c && (meta.kind === "intake" || meta.kind === "investigation")) hist(c, d, "evidence", meta.kind === "intake" ? "Original attachment added" : "Investigation evidence added", file.name);
      });
      return { ok: true, id: aid };
    },
    removeAttachment(aid: string, reason: string): Result {
      const d = get();
      const a = d.attachments.find((x) => x.id === aid);
      const c = d.complaints.find((x) => x.id === a?.complaintId);
      if (!a || !c) return fail("Attachment not found.");
      const r = canDoCase(me(), a.kind === "intake" ? "manageOriginal" : "addEvidence", c, d.templates, d.requests);
      if (!r.ok || !["intake", "investigation"].includes(a.kind)) return fail(r.reason ?? "Not permitted.");
      if (!reason.trim()) return fail("A reason is required.");
      commit((d) => {
        const x = d.attachments.find((y) => y.id === aid)!;
        x.removed = { by: me()!.name, at: nowIso(), reason };
        hist(d.complaints.find((y) => y.id === c.id)!, d, "evidence", "Attachment withdrawn (retained in history)", `${x.name} — ${reason}`);
      });
      return { ok: true };
    },
    // ── Training & coaching ──
    propose(caseId: string, t: Pick<TrainingAction, "employee" | "gap" | "type" | "objective" | "priority">): Result {
      let tid = "";
      const res = withCase("propose", caseId, (c, d) => {
        tid = `TR-0${++d.seq - 60}`;
        d.training.unshift({ ...t, id: tid, caseIds: [c.id], ownerId: null, dueDate: null, status: "Proposed", proposedBy: me()!.id, proposedAt: nowIso(), evidence: "", reviewNotes: "", followUp: "", history: [{ ts: nowIso(), actor: me()!.name, action: "Proposed from findings", detail: c.id }] });
        hist(c, d, "training", "Training action proposed", tid);
        notify(d, managersFor(d, c), "training_review", `Training action ${tid} was proposed and awaits approval.`, { kind: "training", id: tid }, `tprop-${tid}`);
      });
      return res.ok ? { ok: true, id: tid } : res;
    },
    proposeForEmployee(emp: Employee, t: Pick<TrainingAction, "gap" | "type" | "objective" | "priority">, caseId?: string): Result {
      const u = me();
      const d = get();
      if (!u || !canCap(u, "train.propose", d.templates)) return fail("You do not have permission to propose training actions.");
      let tid = "";
      commit((d) => {
        tid = `TR-0${++d.seq - 60}`;
        d.training.unshift({
          employee: emp,
          gap: t.gap,
          type: t.type,
          objective: t.objective,
          priority: t.priority,
          id: tid,
          caseIds: caseId ? [caseId] : [],
          ownerId: null,
          dueDate: null,
          status: "Proposed",
          proposedBy: u.id,
          proposedAt: nowIso(),
          evidence: "",
          reviewNotes: "",
          followUp: "",
          history: [{ ts: nowIso(), actor: u.name, action: caseId ? "Proposed from findings" : "Proposed coaching action", detail: caseId ?? emp.name }],
        });
        const mgrs = d.users.filter((x) => x.role === "Manager" && x.active).map((x) => x.id);
        notify(d, mgrs, "training_review", `Training action ${tid} was proposed for ${emp.name} and awaits approval.`, { kind: "training", id: tid }, `tprop-${tid}`);
      });
      return { ok: true, id: tid };
    },
    addEmployee(emp: Employee): Result {
      const d = get();
      if (!emp.name.trim()) return fail("Employee name is required.");
      if (!emp.serviceNo.trim()) return fail("Employee ID / Service number is required.");
      const existing = (d.employees || []).find((e) => e.serviceNo.toLowerCase() === emp.serviceNo.trim().toLowerCase());
      if (existing) return fail(`Employee with ID ${emp.serviceNo} already exists (${existing.name}).`);
      commit((d) => {
        if (!d.employees) d.employees = [...HEAD_OFFICE_EMPLOYEES, ...REGIONAL_EMPLOYEES];
        d.employees.unshift({
          name: emp.name.trim(),
          serviceNo: emp.serviceNo.trim().toUpperCase(),
          centre: emp.centre,
          group: emp.group.trim(),
        });
      });
      return { ok: true };
    },
    trainingTransition(tid: string, op: "approve" | "reject" | "start" | "complete" | "review" | "needsChanges" | "remind", data: { ownerId?: string; dueDate?: string; reason?: string; evidence?: string; notes?: string; followUp?: string } = {}): Result {
      const d0 = get();
      const u = me();
      const t0 = d0.training.find((x) => x.id === tid);
      if (!u || !t0 || !canViewTraining(u, t0, d0.templates)) return fail("Training action not available.");
      const needCap: Record<typeof op, Cap> = { approve: "train.approve", reject: "train.approve", remind: "train.approve", start: "train.update", complete: "train.update", review: "train.review", needsChanges: "train.review" };
      if (!canCap(u, needCap[op], d0.templates)) return fail("Not permitted for your account.");
      const allowedFrom: Record<typeof op, string[]> = { approve: ["Proposed"], reject: ["Proposed"], start: ["Approved", "Needs Changes"], complete: ["In Progress"], review: ["Completed"], needsChanges: ["Completed"], remind: ["Approved", "In Progress", "Needs Changes"] };
      if (!allowedFrom[op].includes(t0.status)) return fail(`Cannot ${op} an action that is ${t0.status}.`);
      if ((op === "start" || op === "complete") && t0.ownerId !== u.id) return fail("Only the action owner can update this action.");
      if (op === "approve" && (!data.ownerId || !data.dueDate)) return fail("Choose an owner and due date.");
      if (op === "reject" && !data.reason?.trim()) return fail("A rejection reason is required.");
      if (op === "complete" && !data.evidence?.trim()) return fail("Describe the completion evidence.");
      if ((op === "review" || op === "needsChanges") && !data.notes?.trim()) return fail("Review notes are required.");
      commit((d) => {
        const t = d.training.find((x) => x.id === tid)!;
        const log = (action: string, detail?: string) => t.history.push({ ts: nowIso(), actor: u.name, action, detail });
        if (op === "approve") {
          t.status = "Approved"; t.ownerId = data.ownerId!; t.dueDate = data.dueDate!;
          log("Approved & assigned", `Owner: ${d.users.find((x) => x.id === data.ownerId)?.name}`);
          notify(d, [data.ownerId!], "training_assigned", `Training action ${tid} has been assigned to you.`, { kind: "training", id: tid }, `tassign-${tid}-${data.ownerId}`);
        } else if (op === "reject") { t.status = "Rejected"; t.rejectionReason = data.reason; log("Rejected", data.reason); }
        else if (op === "start") { t.status = "In Progress"; log("Started"); }
        else if (op === "complete") {
          t.status = "Completed"; t.evidence = data.evidence!; log("Marked complete");
          notify(d, d.users.filter((x) => x.role === "Manager" && canCap(x, "train.review", d.templates)).map((x) => x.id), "training_review", `Training action ${tid} is ready for review.`, { kind: "training", id: tid }, `treview-${tid}-${t.history.length}`);
        } else if (op === "review") { t.status = "Reviewed"; t.reviewNotes = data.notes!; t.followUp = data.followUp ?? ""; log("Reviewed", data.followUp); }
        else if (op === "needsChanges") { t.status = "Needs Changes"; t.reviewNotes = data.notes!; log("Needs changes", data.notes); }
        else if (op === "remind") {
          log("Reminder sent");
          notify(d, [t.ownerId ?? ""], "training_reminder", `Reminder: training action ${tid} is due ${new Date(t.dueDate!).toLocaleDateString("en-GB")}.`, { kind: "training", id: tid }, `tremind-${tid}-${t.history.length}`);
        }
        for (const cid of t.caseIds) {
          const c = d.complaints.find((x) => x.id === cid);
          if (c && op !== "remind") hist(c, d, "training", `Training ${tid}: ${t.status}`);
        }
      });
      return { ok: true };
    },
    // ── Mail ──
    markEmailRead(eid: string) {
      const u = me();
      if (!u || !canCap(u, "intake.email", T())) return;
      commit((d) => { const e = d.inbox.find((x) => x.id === eid); if (e) e.read = true; });
    },
    async syncMail(): Promise<Result> {
      const u = me();
      if (!u || !canCap(u, "intake.email", T())) return fail("Not permitted.");
      await new Promise((r) => setTimeout(r, 900));
      const d = get();
      if (d.settings.simulateSyncFailure) {
        commit((d) => { audit(d, "Job", "Mailbox sync failed (simulated)", "Connection timeout"); });
        return fail("Mailbox sync failed (simulated connection timeout). Retry, or ask an Administrator to check the integration.");
      }
      const next = d.syncPool[0];
      commit((d) => {
        d.settings.mailboxes.forEach((m) => (m.lastSync = nowIso()));
        if (next) { d.inbox.unshift({ ...next, receivedAt: nowIso() }); d.syncPool.shift(); }
        audit(d, "Job", "Mailbox sync job completed (simulated)", next ? "1 new message" : "No new messages");
      });
      return { ok: true, id: next ? "1" : "0" };
    },
    // ── Notifications ──
    markRead(nid: string | "all") {
      const u = me();
      if (!u) return;
      commit((d) => d.notifications.forEach((n) => { if (n.userId === u.id && (nid === "all" || n.id === nid)) n.read = true; }));
    },
    setMuted(event: NotifEvent, muted: boolean) {
      const u = me();
      if (!u) return;
      commit((d) => {
        const p = (d.prefs[u.id] ??= { muted: [] });
        p.muted = muted ? Array.from(new Set([...p.muted, event])) : p.muted.filter((e) => e !== event);
      });
    },
    // ── Administration (Admin only) ──
    createUser(x: { name: string; email: string; role: Role; team: string; centre?: string; title: string }): Result {
      if (!isAdmin()) return fail("Administration requires the Admin role.");
      const d = get();
      if (!x.name.trim() || !/^\S+@\S+\.\S+$/.test(x.email)) return fail("Enter a name and valid email.");
      if (d.users.some((u) => u.email.toLowerCase() === x.email.toLowerCase())) return fail("A user with this email already exists.");
      if (x.role === "Group Manager" && !x.centre) return fail("Assign a regional centre to the Group Manager.");
      let nid = "";
      commit((d) => {
        nid = `u-${Date.now().toString(36)}`;
        d.users.push({ id: nid, name: x.name, email: x.email, role: x.role, team: x.role === "Group Manager" ? x.centre! : x.team, centre: x.centre, title: x.title || x.role, initials: x.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase(), active: true, overrides: {}, createdAt: nowIso() });
        audit(d, "Account", "User created", `${x.name} · ${x.role}`);
      });
      return { ok: true, id: nid };
    },
    setUserActive(uid: string, active: boolean): Result {
      if (!isAdmin()) return fail("Administration requires the Admin role.");
      if (uid === me()!.id) return fail("You cannot deactivate your own account.");
      commit((d) => { const u = d.users.find((x) => x.id === uid)!; u.active = active; audit(d, "Account", active ? "User reactivated" : "User deactivated", u.name); });
      return { ok: true };
    },
    updateUserAccess(uid: string, patch: { team?: string; centre?: string; scopeOverride?: Scope | null; override?: { cap: Cap; value: boolean | null } }): Result {
      if (!isAdmin()) return fail("Administration requires the Admin role.");
      commit((d) => {
        const u = d.users.find((x) => x.id === uid)!;
        if (patch.team !== undefined) { audit(d, "Account", "Organisational scope changed", `${u.name}: ${u.team} → ${patch.team}`); u.team = patch.team; }
        if (patch.centre !== undefined && u.role === "Group Manager") { audit(d, "Account", "Centre assignment changed", `${u.name}: ${u.centre} → ${patch.centre}`); u.centre = patch.centre; u.team = patch.centre; }
        if (patch.scopeOverride !== undefined) {
          if (patch.scopeOverride === null) delete u.scopeOverride; else u.scopeOverride = patch.scopeOverride;
          audit(d, "Permission", "Record scope override", `${u.name} → ${patch.scopeOverride ?? "inherit template"}`);
        }
        if (patch.override) {
          if (patch.override.value === null) delete u.overrides[patch.override.cap]; else u.overrides[patch.override.cap] = patch.override.value;
          audit(d, "Permission", "Capability override", `${u.name} · ${patch.override.cap} → ${patch.override.value === null ? "inherit" : patch.override.value ? "Allowed" : "Denied"}`);
        }
      });
      return { ok: true };
    },
    setTemplate(role: "Manager" | "Technical Officer", cap: Cap | "scope", value: boolean | Scope): Result {
      if (!isAdmin()) return fail("Administration requires the Admin role.");
      commit((d) => {
        (d.templates[role] as Record<string, unknown>)[cap] = value;
        audit(d, "Permission", "Template changed", `${role} · ${cap} → ${String(value)}`);
      });
      return { ok: true };
    },
    setCentreMap(centre: string, gmId: string): Result {
      if (!isAdmin()) return fail("Administration requires the Admin role.");
      commit((d) => { d.centreMap[centre] = gmId; audit(d, "Setting", "Centre mapping changed", `${centre} → ${d.users.find((u) => u.id === gmId)?.name}`); });
      return { ok: true };
    },
    updateSettings(fn: (s: Settings) => void, label: string): Result {
      if (!isAdmin()) return fail("Administration requires the Admin role.");
      commit((d) => { fn(d.settings); audit(d, label.startsWith("Integration") ? "Integration" : "Setting", label); });
      return { ok: true };
    },
    setSenderMap(map: { pattern: string; source: Source }[]): Result {
      if (!isAdmin()) return fail("Administration requires the Admin role.");
      commit((d) => { d.settings.senderMap = map; audit(d, "Integration", "Sender/source mapping updated", `${map.length} rules`); });
      return { ok: true };
    },
    // ── Manager configuration ──
    updateLists(fn: (l: BusinessLists) => void, needs: Cap): Result {
      const u = me();
      if (!u || u.role !== "Manager" || !canCap(u, needs, T())) return fail("Requires Manager configuration permission.");
      commit((d) => fn(d.lists));
      return { ok: true };
    },
    savePreset<K extends "queuePresets" | "reportPresets" | "recipientPresets">(kind: K, preset: DB[K][number] | { delete: string }): Result {
      const u = me();
      if (!u || (u.role !== "Manager" && u.role !== "Technical Officer")) return fail("Not permitted.");
      if (kind === "recipientPresets" && !canCap(u, "config.settings", T())) return fail("Requires business settings permission.");
      commit((d) => {
        const list = d[kind] as { id: string; ownerId: string }[];
        if ("delete" in preset) { const i = list.findIndex((p) => p.id === preset.delete && p.ownerId === u.id); if (i >= 0) list.splice(i, 1); }
        else list.push({ ...(preset as { id: string; ownerId: string }), ownerId: u.id });
      });
      return { ok: true };
    },
    recordReport(r: Omit<GeneratedReport, "id" | "ts" | "by">) {
      const u = me();
      if (!u) return;
      commit((d) => d.reports.unshift({ ...r, id: id("GR", d), ts: nowIso(), by: u.id }));
    },
    auditAuth(action: string, detail?: string) {
      commit((d) => audit(d, "Auth", action, detail));
    },
  };
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<DB>(load);
  const dbRef = useRef(db);
  const [meId, setMeId] = useState<string | null>(() => {
    const s = localStorage.getItem(SESSION);
    if (s === "u-mgr2" || s === "u-to3") {
      localStorage.setItem(SESSION, "u-mgr1");
      return "u-mgr1";
    }
    return s;
  });
  const meIdRef = useRef(meId);
  const [sessionNotice, setNotice] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  setClockOffset(Date.now() - db.clockStartReal);

  const commit = useCallback((fn: (d: DB) => void) => {
    const next = structuredClone(dbRef.current);
    fn(next);
    dbRef.current = next;
    setDb(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* storage full — state remains in memory */
    }
  }, []);

  useEffect(() => {
    let changed = false;
    if (db.templates?.["Technical Officer"]) {
      if (!db.templates["Technical Officer"]["intake.manual"]) { db.templates["Technical Officer"]["intake.manual"] = true; changed = true; }
      if (!db.templates["Technical Officer"]["intake.email"]) { db.templates["Technical Officer"]["intake.email"] = true; changed = true; }
    }
    if (db.templates?.Manager) {
      if (db.templates.Manager["intake.manual"]) { db.templates.Manager["intake.manual"] = false; changed = true; }
      if (!db.templates.Manager["intake.email"]) { db.templates.Manager["intake.email"] = true; changed = true; }
    }
    if (changed) {
      commit((d) => {
        if (d.templates?.["Technical Officer"]) {
          d.templates["Technical Officer"]["intake.manual"] = true;
          d.templates["Technical Officer"]["intake.email"] = true;
        }
        if (d.templates?.Manager) {
          d.templates.Manager["intake.manual"] = false;
          d.templates.Manager["intake.email"] = true;
        }
      });
    }
  }, [commit, db.templates]);

  // Cross-tab: permission or data changes in another tab apply immediately.
  useEffect(() => {
    const on = (e: StorageEvent) => {
      if (e.key === KEY && e.newValue) {
        const next = JSON.parse(e.newValue) as DB;
        dbRef.current = next;
        setDb(next);
      }
    };
    window.addEventListener("storage", on);
    return () => window.removeEventListener("storage", on);
  }, []);

  const me = useMemo(() => db.users.find((u) => u.id === meId) ?? null, [db.users, meId]);
  const meRef = useRef(me);
  meRef.current = me;

  const clearScoped = () => {
    Object.keys(sessionStorage).filter((k) => k.startsWith("ct:")).forEach((k) => sessionStorage.removeItem(k));
  };

  const act = useMemo(() => makeActions(() => dbRef.current, commit, () => meRef.current), [commit]);

  const logout = useCallback((notice?: string) => {
    clearScoped();
    localStorage.removeItem(SESSION);
    meIdRef.current = null;
    setMeId(null);
    setNotice(notice ?? null);
  }, []);

  // Deactivated accounts lose their session immediately.
  useEffect(() => {
    if (meId && me && !me.active) logout("Your account has been deactivated by an Administrator. Contact your administrator if this is unexpected.");
    if (meId && !me) logout();
  }, [me, meId, logout]);

  const toast = useCallback((kind: Toast["kind"], text: string) => {
    const tid = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-3), { id: tid, kind, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== tid)), kind === "error" ? 6500 : 3500);
  }, []);

  const value: Store = useMemo(() => {
    const T = db.templates;
    const ctx = { complaints: db.complaints, requests: db.requests, training: db.training };
    return {
      db, me, sessionNotice, toasts, act, toast, logout,
      dismissToast: (tid) => setToasts((t) => t.filter((x) => x.id !== tid)),
      can: (cap) => canCap(me, cap, T),
      canDo: (action, c) => canDoCase(me, action, c, T, db.requests),
      canView: (c) => canViewCase(me, c, T),
      canSeeFile: (a) => canSeeAttachment(me, a, ctx, T),
      canSeeTraining: (t) => canViewTraining(me, t, T),
      visibleComplaints: db.complaints.filter((c) => canViewCase(me, c, T)),
      userName: (id) => (id ? db.users.find((u) => u.id === id)?.name ?? "Unknown user" : "Unassigned"),
      login: (userId) => {
        clearScoped();
        localStorage.setItem(SESSION, userId);
        meIdRef.current = userId;
        setMeId(userId);
        setNotice(null);
        const u = dbRef.current.users.find((x) => x.id === userId);
        commit((d) => d.audit.unshift({ id: `TA-${++d.seq}`, ts: nowIso(), actor: u?.name ?? userId, category: "Auth", action: "Signed in (mock login)" }));
      },
      resetDemo: async () => {
        localStorage.removeItem("comtrack:db:v2");
        localStorage.removeItem("comtrack:db:v3");
        localStorage.removeItem(KEY);
        localStorage.removeItem(SESSION);
        clearScoped();
        await clearBlobs();
        const fresh = seed();
        dbRef.current = fresh;
        setDb(fresh);
        localStorage.setItem(KEY, JSON.stringify(fresh));
        setMeId(null);
        setNotice("Demo data has been reset to the original synthetic records.");
      },
    };
  }, [db, me, sessionNotice, toasts, act, toast, logout, commit]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error("StoreProvider missing");
  return s;
}
