import { useMemo, useState } from "react";
import { X, Play, Save, Send, CheckCircle2, Undo2, Lock, UserPlus, Pencil, Archive, Mail, ChevronDown, GraduationCap, AlertTriangle, ShieldOff } from "lucide-react";
import { useStore } from "../store";
import type { Complaint, Employee, IntakeFields, Outcome, AttachmentMeta, Priority } from "../lib/types";
import { PROTECTED_FIELDS, OUTCOMES, PRIORITIES, SOURCES } from "../lib/types";
import { feedbackState, resolveBlockers, fmtDate, returnCount, isOverdue } from "../lib/lifecycle";
import { isArchived, colomboMonthKey } from "../lib/permissions";
import { HEAD_OFFICE, HEAD_OFFICE_EMPLOYEES, REGIONAL_EMPLOYEES, REGIONAL_CENTRES } from "../lib/seed";
import {
  Dialog, Button, StatusBadge, PriorityBadge, SourceTag, FeedbackBadge, ReviewBadge, OutcomeBadge, Avatar, Tabs, KV, Field, inputCls, Notice,
  Confirm, SaveState, SectionTitle, LocationBadge, TrainingBadge, EmptyState,
} from "./ui";
import { AttachmentList, Uploader, PreviewPanel } from "./Attachments";

type Tab = "overview" | "investigation" | "attachments" | "regional" | "activity" | "training";
type Inv = Pick<Complaint, "findings" | "observations" | "employee" | "actionsTaken" | "responsibleParty" | "outcome">;

const STEPS = ["Open", "In Progress", "Resolved", "Closed"] as const;

export default function CaseWorkspace({ id, onClose }: { id: string; onClose: () => void }) {
  const { db, me, canView, canDo, can, canSeeFile, canSeeTraining, userName, act, toast } = useStore();
  const c = db.complaints.find((x) => x.id === id);
  const [tab, setTab] = useState<Tab>("overview");
  const [preview, setPreview] = useState<AttachmentMeta | null>(null);
  const [inv, setInv] = useState<Inv | null>(null);
  const [correction, setCorrection] = useState<Partial<IntakeFields> | null>(null);
  const [pendingLeave, setPendingLeave] = useState<null | (() => void)>(null);
  const [dlg, setDlg] = useState<null | "assign" | "resolve" | "return" | "close" | "archive" | "correct" | "start">(null);

  // Access is re-evaluated on every render: revoked access closes content immediately.
  if (!c || !me || !canView(c)) {
    return (
      <Dialog title="Case not available" onClose={onClose} size="sm" footer={<Button variant="primary" onClick={onClose}>Close</Button>}>
        <div className="px-6 py-5"><EmptyState icon={ShieldOff} title="This case isn't available with your current access" body="It may be outside your record scope, or your permissions may have changed. Any unsaved edits were not saved." /></div>
      </Dialog>
    );
  }

  const dirty = !!inv || !!correction;
  const guardLeave = (fn: () => void) => (dirty ? setPendingLeave(() => fn) : fn());
  const fstate = feedbackState(c, db.requests);
  const readOnly = c.status === "Closed";
  const canEditInv = canDo("editInvestigation", c).ok;
  const files = db.attachments.filter((a) => (a.complaintId === c.id || db.requests.some((r) => r.id === a.requestId && r.complaintId === c.id)) && canSeeFile(a));
  const linkedTraining = db.training.filter((t) => t.caseIds.includes(c.id) && canSeeTraining(t));
  const caseReqs = db.requests.filter((r) => r.complaintId === c.id);

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "overview", label: "Overview" },
    { id: "investigation", label: "Investigation" },
    ...(can("att.view") ? [{ id: "attachments" as Tab, label: "Attachments", count: files.filter((f) => !f.removed).length }] : []),
    ...(caseReqs.length || canDo("requestFeedback", c).ok ? [{ id: "regional" as Tab, label: "Regional Feedback", count: caseReqs.length }] : []),
    ...(can("case.history") ? [{ id: "activity" as Tab, label: "Activity", count: c.history.length }] : []),
    ...(can("train.view") ? [{ id: "training" as Tab, label: "Training & Coaching", count: linkedTraining.length }] : []),
  ];
  const save = (r: { ok: boolean; error?: string } | { ok: false; error: string }, msg: string, after?: () => void) => {
    if (r.ok) { toast("success", msg); after?.(); } else toast("error", (r as { error: string }).error);
  };
  const saveState = readOnly ? "readonly" : c.status === "Resolved" ? "pending" : dirty ? "dirty" : "saved";
  const stepIdx = STEPS.indexOf(c.status);

  const header = (
    <div className="sticky top-0 z-10 border-b border-line bg-white">
      <div className="flex items-start gap-3 px-4 pb-3 pt-4 sm:px-6">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="case-title" className="font-mono text-lg font-bold text-ink">{c.id}</h2>
            <SourceTag source={c.source} legacy={c.legacySource} />
            <StatusBadge status={c.status} />
            <FeedbackBadge state={fstate} />
            <ReviewBadge state={c.reviewState} />
            {c.status === "Closed" && <LocationBadge label={isArchived(c) ? `Archive · ${colomboMonthKey(c.closedAt!)}` : "Closed this month"} />}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-soft">
            <span className="truncate">{c.customer || "Customer not recorded"} · {c.sltNumber}</span>
            <PriorityBadge priority={c.priority} />
            <span className="flex items-center gap-1.5">Owner: <Avatar initials={c.assignedTo ? userName(c.assignedTo).split(" ").map((p) => p[0]).join("").slice(0, 2) : null} size={18} /> <strong className="font-semibold text-ink">{userName(c.assignedTo)}</strong></span>
            <span>Team: {c.team}</span>
          </div>
        </div>
        <SaveState state={saveState} />
        <button onClick={() => guardLeave(onClose)} aria-label="Close case workspace" className="rounded-md p-1.5 text-ink-faint hover:bg-panel hover:text-ink"><X size={18} /></button>
      </div>
      <ol className="flex items-center gap-1 px-4 pb-3 sm:px-6" aria-label="Case progress">
        {STEPS.map((s, i) => (
          <li key={s} className="flex flex-1 items-center gap-1" aria-current={i === stepIdx ? "step" : undefined}>
            <span className={`h-1.5 flex-1 rounded-full ${i <= stepIdx ? (i === stepIdx ? "bg-slt-blue" : "bg-slt-green") : "bg-line"}`} />
            <span className={`hidden whitespace-nowrap text-[11px] sm:inline ${i === stepIdx ? "font-semibold text-slt-blue" : i < stepIdx ? "text-slt-green-dark" : "text-ink-faint"}`}>{i < stepIdx ? "✓ " : ""}{s}</span>
          </li>
        ))}
      </ol>
      {!preview && <div className="px-2 sm:px-4"><Tabs label="Case sections" tabs={tabs} value={tab} onChange={(t) => guardLeave(() => { setTab(t); setInv(null); setCorrection(null); })} /></div>}
    </div>
  );

  const footer = !preview && (
    <>
      {c.status === "Resolved" && me.role === "Technical Officer" && <span className="mr-auto flex items-center gap-1.5 text-xs text-ink-soft"><Lock size={13} />Investigation locked while pending Manager review.</span>}
      {readOnly && <span className="mr-auto flex items-center gap-1.5 text-xs text-ink-soft"><Lock size={13} />Closed case — content is read-only.</span>}
      {canDo("assign", c).ok && <Button onClick={() => setDlg("assign")}><UserPlus size={15} />{c.assignedTo ? "Reassign" : "Assign"}</Button>}
      {canDo("archive", c).ok && !isArchived(c) && <Button onClick={() => setDlg("archive")}><Archive size={15} />Archive</Button>}
      {canDo("start", c).ok && <Button variant="primary" onClick={() => setDlg("start")}><Play size={15} />Start investigation</Button>}
      {canDo("return", c).ok && <Button onClick={() => setDlg("return")}><Undo2 size={15} />Return for investigation</Button>}
      {canDo("close", c).ok && <Button variant="success" onClick={() => setDlg("close")}><CheckCircle2 size={15} />Review & close</Button>}
      {c.status === "In Progress" && me.role === "Technical Officer" && canEditInv && can("inv.resolve") && (
        <Button variant="primary" onClick={() => { if (inv) return toast("error", "Save your investigation changes first."); setDlg("resolve"); }}><Send size={15} />Resolve & send for review</Button>
      )}
    </>
  );

  return (
    <Dialog size="xl" onClose={() => guardLeave(onClose)} labelledBy="case-title" header={header} footer={footer || undefined}>
      {preview ? <PreviewPanel a={preview} onBack={() => setPreview(null)} /> : (
        <div className="px-4 py-5 sm:px-6" role="tabpanel">
          {tab === "overview" && <Overview c={c} correction={correction} setCorrection={setCorrection} onCorrect={() => setDlg("correct")} />}
          {tab === "investigation" && <Investigation c={c} inv={inv} setInv={setInv} onGoToRegional={() => setTab("regional")} />}
          {tab === "attachments" && <AttachTab c={c} files={files} onPreview={setPreview} />}
          {tab === "regional" && <Regional c={c} files={files} />}
          {tab === "activity" && <Activity c={c} />}
          {tab === "training" && <TrainingTab c={c} />}
        </div>
      )}

      {pendingLeave && (
        <Confirm title="Discard unsaved changes?" confirmLabel="Discard changes" variant="danger" onCancel={() => setPendingLeave(null)}
          onConfirm={() => { const fn = pendingLeave; setPendingLeave(null); setInv(null); setCorrection(null); fn(); }}
          consequence="Your edits on this case have not been saved and will be lost." />
      )}
      {dlg === "start" && <Confirm title="Start investigation?" confirmLabel="Start investigation" onCancel={() => setDlg(null)}
        consequence={<>{c.id} moves from <strong>Open</strong> to <strong>In Progress</strong> and you become the investigating officer of record.</>}
        onConfirm={() => save(act.start(c.id), "Investigation started.", () => { setDlg(null); setTab("investigation"); })} />}
      {dlg === "assign" && <AssignDialog c={c} onDone={() => setDlg(null)} />}
      {dlg === "resolve" && <ResolveDialog c={c} onDone={() => setDlg(null)} />}
      {dlg === "return" && <ReturnDialog c={c} onDone={() => setDlg(null)} />}
      {dlg === "close" && <CloseDialog c={c} onDone={() => setDlg(null)} />}
      {dlg === "archive" && <ArchiveDialog c={c} onDone={() => setDlg(null)} />}
      {dlg === "correct" && correction && <CorrectDialog c={c} patch={correction} onDone={(ok) => { setDlg(null); if (ok) setCorrection(null); }} />}
    </Dialog>
  );
}

// ── Overview ──
function Overview({ c, correction, setCorrection, onCorrect }: { c: Complaint; correction: Partial<IntakeFields> | null; setCorrection: (p: Partial<IntakeFields> | null) => void; onCorrect: () => void }) {
  const { canDo, can, db, userName, act, toast, me } = useStore();
  const [showEmail, setShowEmail] = useState(false);
  const [notes, setNotes] = useState<string | null>(null);
  const canCorrect = canDo("correct", c).ok;
  const edit = correction;
  const val = <K extends keyof IntakeFields>(k: K) => (edit && k in edit ? edit[k] : c[k]) as IntakeFields[K];
  const set = (k: keyof IntakeFields, v: string) => setCorrection({ ...(edit ?? {}), [k]: v });
  const cats = db.lists.categories.filter((x) => x.active || x.label === c.category).map((x) => x.label);
  const issues = db.lists.issueTypes.filter((x) => x.active || x.label === c.issueType).map((x) => x.label);
  const corrected = new Set(c.history.filter((h) => h.type === "correction").map((h) => h.action.split(": ")[1]));
  const openTraining = db.training.filter((t) => t.caseIds.includes(c.id) && !["Reviewed", "Rejected"].includes(t.status));

  const input = (k: keyof IntakeFields) => {
    if (!edit) return null;
    if (k === "source") return <select className={inputCls} value={val("source")} onChange={(e) => set(k, e.target.value)}>{SOURCES.map((s) => <option key={s}>{s}</option>)}</select>;
    if (k === "priority") return <select className={inputCls} value={val("priority")} onChange={(e) => set(k, e.target.value)}>{PRIORITIES.map((s) => <option key={s}>{s}</option>)}</select>;
    if (k === "category") return <select className={inputCls} value={val("category")} onChange={(e) => set(k, e.target.value)}>{cats.map((s) => <option key={s}>{s}</option>)}</select>;
    if (k === "issueType") return <select className={inputCls} value={val("issueType")} onChange={(e) => set(k, e.target.value)}>{issues.map((s) => <option key={s}>{s}</option>)}</select>;
    if (k === "receivedAt") return <input type="datetime-local" className={inputCls} value={toLocalInput(val("receivedAt"))} onChange={(e) => set(k, fromLocalInput(e.target.value))} />;
    if (k === "details") return <textarea rows={3} className={inputCls} value={val("details")} onChange={(e) => set(k, e.target.value)} />;
    return <input className={inputCls} value={String(val(k) ?? "")} onChange={(e) => set(k, e.target.value)} />;
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="space-y-6">
        {c.status === "Resolved" && me?.role === "Manager" && (
          <Notice kind="warn" title="Manager review required">
            {userName(c.assignedTo)} resolved this case {fmtDate(c.resolution?.at, true)}. Review findings and actions in the Investigation tab, then <strong>Review & close</strong> or <strong>Return for investigation</strong>.
          </Notice>
        )}
        <section aria-labelledby="intake-h">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 id="intake-h" className="flex items-center gap-2 text-sm font-semibold text-ink"><Lock size={14} className="text-ink-faint" aria-hidden />Registered intake information <span className="text-xs font-normal text-ink-faint">(protected)</span></h3>
            {canCorrect && !edit && <Button size="sm" onClick={() => setCorrection({})}><Pencil size={13} />Correct original information</Button>}
            {edit && (
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => setCorrection(null)}>Cancel</Button>
                <Button size="sm" variant="primary" disabled={!Object.keys(edit).length} onClick={onCorrect}>Review correction…</Button>
              </div>
            )}
          </div>
          {edit && <div className="mb-3"><Notice kind="info">Corrections are recorded with before/after values and a reason. The captured original email and receipt timestamps are never overwritten.</Notice></div>}
          <dl className="grid gap-x-6 gap-y-4 rounded-lg border border-line p-4 sm:grid-cols-2">
            {PROTECTED_FIELDS.map(({ key, label }) => (
              <div key={key} className={key === "details" ? "sm:col-span-2" : ""}>
                {edit ? <Field label={label} htmlFor={`f-${key}`}>{input(key)}</Field> : (
                  <KV label={label + (corrected.has(key) ? " · corrected" : "")} mono={key === "sourceRef" || key === "sltNumber"}>
                    {key === "receivedAt" ? fmtDate(c.receivedAt, true) : key === "priority" ? <PriorityBadge priority={c.priority} /> : key === "source" ? <><SourceTag source={c.source} />{c.legacySource && <span className="ml-2 text-xs text-ink-faint">historical label “{c.legacySource}”</span>}</> : String(c[key] ?? "")}
                  </KV>
                )}
              </div>
            ))}
          </dl>
        </section>

        {c.email && (
          <section className="rounded-lg border border-line">
            <button onClick={() => setShowEmail((s) => !s)} aria-expanded={showEmail} className="flex w-full items-center gap-2 px-4 py-3 text-left">
              <Mail size={15} className="text-slt-blue" aria-hidden />
              <span className="flex-1 text-sm font-semibold">Original email evidence <span className="font-normal text-ink-faint">— immutable capture</span></span>
              <ChevronDown size={15} className={`transition-transform duration-200 ${showEmail ? "rotate-180" : ""}`} aria-hidden />
            </button>
            {showEmail && (
              <div className="border-t border-line px-4 py-3 text-sm">
                <dl className="mb-3 grid gap-2 text-xs sm:grid-cols-2">
                  <KV label="Mailbox">{c.email.mailbox === "1212" ? "1212 Mail" : "Other complaint email"}</KV>
                  <KV label="Message ID" mono>{c.email.messageId}</KV>
                  <KV label="From">{c.email.fromName} &lt;{c.email.from}&gt;</KV>
                  <KV label="Received">{fmtDate(c.email.receivedAt, true)}</KV>
                  <div className="sm:col-span-2"><KV label="Subject">{c.email.subject}</KV></div>
                </dl>
                <pre className="whitespace-pre-wrap rounded-md bg-panel p-3 font-sans text-[13px] leading-relaxed text-ink-soft">{c.email.body}</pre>
              </div>
            )}
          </section>
        )}

        {can("case.notes") && (
          <section>
            <div className="mb-2 flex items-center justify-between"><SectionTitle>Internal Manager notes</SectionTitle><span className="text-[11px] text-ink-faint">Never shared with Group Managers</span></div>
            {me?.role === "Manager" && c.status !== "Closed" ? (
              <div className="space-y-2">
                <textarea aria-label="Internal Manager notes" rows={3} className={inputCls} value={notes ?? c.managerNotes} onChange={(e) => setNotes(e.target.value)} />
                {notes !== null && notes !== c.managerNotes && <div className="flex justify-end gap-2"><Button size="sm" variant="ghost" onClick={() => setNotes(null)}>Cancel</Button><Button size="sm" variant="primary" onClick={() => { const r = act.saveNotes(c.id, notes); r.ok ? (toast("success", "Notes saved."), setNotes(null)) : toast("error", r.error); }}><Save size={13} />Save notes</Button></div>}
              </div>
            ) : <p className="rounded-md bg-panel px-3 py-2 text-sm text-ink-soft">{c.managerNotes || "No notes."}</p>}
          </section>
        )}
      </div>

      <aside className="space-y-4">
        <div className="rounded-lg border border-line p-4">
          <SectionTitle>Ownership & lifecycle</SectionTitle>
          <dl className="mt-3 space-y-3">
            <KV label="Registered">{c.registeredBy} · {fmtDate(c.registeredAt, true)}</KV>
            <KV label="Assigned officer">{userName(c.assignedTo)}{c.assignedAt && ` · ${fmtDate(c.assignedAt)}`}</KV>
            <KV label="Investigation started">{fmtDate(c.startedAt, true)}</KV>
            <KV label="Outcome"><OutcomeBadge outcome={c.outcome} /></KV>
            <KV label="Returns for investigation">{String(returnCount(c))}</KV>
          </dl>
        </div>
        {c.resolution && (
          <div className="rounded-lg border border-line p-4">
            <SectionTitle>Resolution</SectionTitle>
            <p className="mt-2 text-sm text-ink">{c.resolution.summary}</p>
            <p className="mt-1 text-xs text-ink-faint">{c.resolution.by} · {fmtDate(c.resolution.at, true)}</p>
          </div>
        )}
        {c.review && (
          <div className="rounded-lg border border-st-resolved/30 bg-st-resolved-bg/40 p-4">
            <SectionTitle>Manager decision</SectionTitle>
            <p className="mt-2 text-sm font-medium text-ink">{c.review.decision}</p>
            {c.review.notes && <p className="mt-1 text-sm text-ink-soft">{c.review.notes}</p>}
            <p className="mt-1 text-xs text-ink-faint">{c.review.by} · closed {fmtDate(c.closedAt, true)}</p>
          </div>
        )}
        {c.archived && <Notice kind="lock" title={`Archived manually · ${fmtDate(c.archived.at)}`}>{c.archived.reason} — {c.archived.by}</Notice>}
        {openTraining.length > 0 && <Notice kind="info" title="Open training actions">{openTraining.length} linked development action(s) remain open. A case may close before training completes.</Notice>}
      </aside>
    </div>
  );
}

const toLocalInput = (iso: string) => {
  if (!iso) return "";
  try {
    const d = new Date(new Date(iso).getTime() + 330 * 60000);
    return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 16);
  } catch {
    return "";
  }
};
const fromLocalInput = (v: string) => {
  if (!v) return new Date().toISOString();
  try {
    const d = new Date(v + ":00+05:30");
    return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
  } catch {
    return new Date().toISOString();
  }
};

// ── Investigation ──
function Investigation({ c, inv, setInv, onGoToRegional }: { c: Complaint; inv: Inv | null; setInv: (v: Inv | null) => void; onGoToRegional?: () => void }) {
  const { canDo, db, act, toast, me, userName } = useStore();
  const editable = canDo("editInvestigation", c).ok;
  const v: Inv = inv ?? { findings: c.findings, observations: c.observations, employee: c.employee, actionsTaken: c.actionsTaken, responsibleParty: c.responsibleParty, outcome: c.outcome };
  const set = (p: Partial<Inv>) => setInv({ ...v, ...p });
  const [branch, setBranch] = useState<"ho" | "regional">(v.employee && v.employee.centre !== HEAD_OFFICE ? "regional" : "ho");
  const [centre, setCentre] = useState(v.employee && v.employee.centre !== HEAD_OFFICE ? v.employee.centre : REGIONAL_CENTRES[0]);
  const blockers = resolveBlockers({ ...c, ...v }, db.requests);
  const allEmployees = db.employees ?? [...HEAD_OFFICE_EMPLOYEES, ...REGIONAL_EMPLOYEES];
  const employees = branch === "ho" ? allEmployees.filter((e) => e.centre === HEAD_OFFICE) : allEmployees.filter((e) => e.centre === centre);
  const ca = db.lists.correctiveActions.filter((x) => x.active).map((x) => x.label);
  const isRegional = branch === "regional";
  const hasPendingReq = db.requests.some((r) => r.complaintId === c.id && r.centre === centre && r.status === "Pending");
  const hasSubmittedReq = db.requests.some((r) => r.complaintId === c.id && r.centre === centre && r.status === "Submitted");
  const canSendReq = isRegional && canDo("requestFeedback", c).ok && !hasPendingReq;

  const handleSave = () => {
    const r = act.saveInvestigation(c.id, v);
    if (!r.ok) {
      toast("error", r.error);
      return;
    }
    setInv(null);

    if (canSendReq) {
      const empName = v.employee ? `${v.employee.name} (${v.employee.serviceNo})` : "regional staff";
      const reasonText = `Assigned regional officer: ${empName} at ${centre}`;
      const infoRequired = `Please review and provide feedback regarding ${empName}'s handling of this complaint.`;
      const context = `Complaint: ${c.details}\nService No: ${c.sltNumber}\nCustomer: ${c.customer}`;
      const res = act.requestFeedback(c.id, {
        centre,
        reason: reasonText,
        infoRequired,
        context,
        sharedAttachmentIds: [],
      });
      if (res.ok) {
        toast("success", `Investigation saved & feedback request sent to ${userName(db.centreMap[centre])} (${centre}).`);
        onGoToRegional?.();
      } else {
        toast("error", res.error);
      }
    } else {
      toast("success", "Investigation saved.");
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        {!editable && <Notice kind="lock">{me?.role === "Manager" ? "Investigation is completed by the assigned Technical Officer. Managers review it here." : reason}</Notice>}
        {c.reviewState === "Returned" && <Notice kind="warn" title="Returned for investigation">{[...c.history].reverse().find((h) => h.type === "return")?.detail}</Notice>}
        <Field label="Findings" required htmlFor="inv-findings">
          <textarea id="inv-findings" rows={4} className={inputCls} value={v.findings} readOnly={!editable} onChange={(e) => set({ findings: e.target.value })} />
        </Field>
        <Field label="Observations" htmlFor="inv-obs"><textarea id="inv-obs" rows={2} className={inputCls} value={v.observations} readOnly={!editable} onChange={(e) => set({ observations: e.target.value })} /></Field>

        <fieldset className="rounded-lg border border-line p-4">
          <legend className="px-1 text-xs font-medium text-ink-soft">Relevant employee {v.outcome !== "Irrelevant" && <span className="text-st-breach">*</span>}</legend>
          {editable && (
            <div className="mb-3 flex flex-wrap gap-2" role="radiogroup" aria-label="Employee branch">
              {(["ho", "regional"] as const).map((b) => (
                <button key={b} role="radio" aria-checked={branch === b} onClick={() => { setBranch(b); set({ employee: null }); }} className={`rounded-md border px-3 py-1.5 text-sm ${branch === b ? "border-slt-blue bg-slt-blue-50 font-semibold text-slt-blue" : "border-line-strong text-ink-soft"}`}>
                  {b === "ho" ? "Head Office employee" : "Regional employee"}
                </button>
              ))}
            </div>
          )}
          {editable ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {branch === "regional" && <Field label="Regional centre" htmlFor="inv-centre"><select id="inv-centre" className={inputCls} value={centre} onChange={(e) => { setCentre(e.target.value); set({ employee: null }); }}>{REGIONAL_CENTRES.map((r) => <option key={r}>{r}</option>)}</select></Field>}
              <Field label="Employee" htmlFor="inv-emp" hint={branch === "regional" ? "If unknown, request regional feedback — the Group Manager can identify the employee." : undefined}>
                <select id="inv-emp" className={inputCls} value={v.employee?.serviceNo ?? ""} onChange={(e) => set({ employee: allEmployees.find((x) => x.serviceNo === e.target.value) ?? null })}>
                  <option value="">Select employee…</option>
                  {employees.map((e) => <option key={e.serviceNo} value={e.serviceNo}>{e.name} · {e.serviceNo} · {e.group}</option>)}
                </select>
              </Field>
            </div>
          ) : <p className="text-sm">{v.employee ? `${v.employee.name} · ${v.employee.serviceNo} · ${v.employee.group} · ${v.employee.centre}` : "Not identified"}</p>}

          {editable && branch === "regional" && (
            <div className="mt-3 rounded-md border border-slt-blue-100 bg-slt-blue-50/50 p-3">
              <div>
                <div className="text-xs font-semibold text-ink">
                  Regional Manager: {db.centreMap[centre] ? userName(db.centreMap[centre]) : "Unmapped"} ({centre})
                </div>
                <div className="text-xs text-ink-soft">
                  {hasPendingReq
                    ? "⏳ A regional feedback request is already pending with this manager."
                    : hasSubmittedReq
                    ? "✓ Regional feedback received from this manager."
                    : `Saving the investigation below will automatically dispatch a feedback request to ${db.centreMap[centre] ? userName(db.centreMap[centre]) : "the regional manager"}.`}
                </div>
              </div>
            </div>
          )}
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Investigation outcome" required htmlFor="inv-outcome" hint="Classification only — separate from case status.">
            <select id="inv-outcome" className={inputCls} value={v.outcome} disabled={!editable} onChange={(e) => set({ outcome: e.target.value as Outcome })}>
              {OUTCOMES.map((o) => <option key={o} value={o}>{o === "Pending" ? "Not determined" : o}</option>)}
            </select>
          </Field>
          <Field label="Responsible party" htmlFor="inv-resp"><input id="inv-resp" className={inputCls} value={v.responsibleParty} readOnly={!editable} onChange={(e) => set({ responsibleParty: e.target.value })} /></Field>
        </div>
        <Field label="Actions taken" required htmlFor="inv-actions">
          <textarea id="inv-actions" rows={3} className={inputCls} value={v.actionsTaken} readOnly={!editable} onChange={(e) => set({ actionsTaken: e.target.value })} />
        </Field>
        {editable && <div className="flex flex-wrap gap-1.5" aria-label="Quick add corrective action">{ca.map((x) => <button key={x} onClick={() => set({ actionsTaken: v.actionsTaken ? `${v.actionsTaken}; ${x}` : x })} className="rounded-full border border-line-strong px-2.5 py-1 text-xs text-ink-soft hover:border-slt-blue hover:text-slt-blue">+ {x}</button>)}</div>}

        {editable && (
          <div className="flex items-center justify-end gap-2 border-t border-line pt-4">
            {inv && <Button variant="ghost" onClick={() => setInv(null)}>Discard</Button>}
            <Button
              variant="primary"
              disabled={!inv && !canSendReq}
              onClick={handleSave}
            >
              {canSendReq ? <Send size={15} /> : <Save size={15} />}
              {canSendReq ? `Save investigation & send request to ${centre} Manager` : "Save investigation"}
            </Button>
          </div>
        )}
      </div>
      <aside className="space-y-3">
        <div className="rounded-lg border border-line p-4">
          <SectionTitle>Ready to resolve?</SectionTitle>
          {c.status !== "In Progress" ? <p className="mt-2 text-sm text-ink-soft">{c.status === "Open" ? "Start the investigation first." : c.status === "Resolved" ? "Submitted — pending Manager review." : "Closed."}</p> :
            blockers.length ? <ul className="mt-2 space-y-1.5">{blockers.map((b) => <li key={b} className="flex gap-2 text-sm text-st-breach"><AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden />{b}</li>)}</ul> :
              <p className="mt-2 flex items-center gap-2 text-sm text-st-resolved"><CheckCircle2 size={15} />All resolution requirements met{inv ? " (save first)" : ""}.</p>}
        </div>
      </aside>
    </div>
  );
}

// ── Attachments tab ──
function AttachTab({ c, files, onPreview }: { c: Complaint; files: AttachmentMeta[]; onPreview: (a: AttachmentMeta) => void }) {
  const { can, canDo, act, toast } = useStore();
  const groups: { kind: AttachmentMeta["kind"][]; title: string; up?: "intake" | "investigation" }[] = [
    { kind: ["intake"], title: "Original intake attachments", up: canDo("manageOriginal", c).ok ? "intake" : undefined },
    { kind: ["investigation"], title: "Investigation evidence", up: canDo("addEvidence", c).ok ? "investigation" : undefined },
    { kind: ["shared"], title: "Shared with regional centre" },
    { kind: ["response"], title: "Regional response attachments" },
  ];
  const count = files.filter((f) => !f.removed).length;
  return (
    <div className="space-y-6">
      {groups.map((g) => {
        const items = files.filter((f) => g.kind.includes(f.kind));
        if (!items.length && !g.up && (g.kind[0] === "shared" || g.kind[0] === "response")) return null;
        return (
          <section key={g.title} className="space-y-2">
            <SectionTitle>{g.title}</SectionTitle>
            <AttachmentList items={items} onPreview={onPreview} canPreview={can("att.preview")} canDownload={can("att.download")}
              onRemove={(a) => (a.kind === "intake" ? canDo("manageOriginal", c).ok : a.kind === "investigation" ? canDo("addEvidence", c).ok : false)} emptyText="None yet." />
            {g.up && <Uploader existingCount={count} label={g.up === "intake" ? "Add original attachment" : "Add investigation evidence"} onUpload={async (f) => {
              const r = await act.addAttachment(f, { complaintId: c.id, kind: g.up!, provenance: g.up === "intake" ? "Added by Manager to original intake" : "Uploaded by investigating officer" });
              if (r.ok) toast("success", `${f.name} uploaded.`);
              return r.ok ? { ok: true } : { ok: false, error: r.error };
            }} />}
          </section>
        );
      })}
    </div>
  );
}

// ── Regional feedback ──
function Regional({ c, files }: { c: Complaint; files: AttachmentMeta[] }) {
  const { db, canDo, act, toast, userName } = useStore();
  const reqs = db.requests.filter((r) => r.complaintId === c.id);
  const canReq = canDo("requestFeedback", c).ok;
  const pendingReq = reqs.find((r) => r.status === "Pending");

  return (
    <div className="space-y-5">
      {pendingReq && (
        <Notice kind="info" title="Regional feedback request pending response">
          Request <span className="font-mono font-semibold">{pendingReq.id}</span> has been dispatched to <strong>{userName(pendingReq.groupManagerId)} ({pendingReq.centre})</strong> and is currently awaiting their response.
        </Notice>
      )}
      {reqs.length === 0 && (
        <EmptyState
          title="No regional feedback requested"
          body="To request regional feedback, select a Regional employee and centre in the Investigation tab and save."
        />
      )}
      {reqs.map((r) => (
        <article key={r.id} className="rounded-lg border border-line">
          <header className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2.5">
            <span className="font-mono text-sm font-semibold">{r.id}</span>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${r.status === "Pending" ? "bg-st-hold-bg text-st-hold" : r.status === "Cancelled" ? "bg-panel text-ink-faint" : "bg-st-resolved-bg text-st-resolved"}`}>
              {r.status === "Pending" ? "⏳ Awaiting response" : r.status === "Cancelled" ? "✕ Cancelled" : "↩ Response received"}
            </span>
            <span className="text-xs text-ink-soft">{r.centre} · {userName(r.groupManagerId)} · requested by {userName(r.requestedBy)} {fmtDate(r.requestedAt, true)}</span>
            {r.status === "Pending" && canReq && (
              <button
                type="button"
                onClick={() => {
                  const res = act.cancelFeedbackRequest(r.id, "Withdrawn by officer");
                  if (res.ok) toast("success", `Request ${r.id} cancelled.`);
                  else toast("error", res.error);
                }}
                className="ml-auto text-xs text-st-breach underline hover:opacity-80"
              >
                Cancel request
              </button>
            )}
          </header>
          <div className="grid gap-4 p-4 sm:grid-cols-2">
            <KV label="Reason">{r.reason}</KV>
            <KV label="Information required">{r.infoRequired}</KV>
            <div className="sm:col-span-2"><KV label="Context shared with Group Manager">{r.context}</KV></div>
            {r.status === "Cancelled" && r.cancelled && (
              <div className="rounded-md bg-panel p-3 text-xs text-ink-faint sm:col-span-2">
                Cancelled by {r.cancelled.by} ({fmtDate(r.cancelled.at, true)}) — {r.cancelled.reason}
              </div>
            )}
            {r.response && (
              <div className="rounded-md bg-st-resolved-bg/50 p-3 sm:col-span-2">
                <div className="text-xs font-semibold text-st-resolved">Response · {fmtDate(r.response.submittedAt, true)} · read-only</div>
                <p className="mt-1 text-sm"><strong>Employee:</strong> {r.response.employee.name} · {r.response.employee.serviceNo} · {r.response.employee.group}</p>
                <p className="mt-1 text-sm">{r.response.feedback}</p>
              </div>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}

// ── Activity timeline ──
function Activity({ c }: { c: Complaint }) {
  const items = [...c.history].sort((a, b) => b.ts.localeCompare(a.ts));
  const dot: Record<string, string> = { register: "bg-slt-blue", intake: "bg-slt-cyan", correction: "bg-st-progress", assign: "bg-st-hold", investigation: "bg-st-open", evidence: "bg-ink-faint", feedback: "bg-st-hold", resolve: "bg-st-resolved", return: "bg-st-breach", close: "bg-ink", archive: "bg-ink-soft", training: "bg-slt-green", legacy: "bg-line-strong" };
  return (
    <ol className="relative ml-2 border-l border-line">
      {items.map((h) => (
        <li key={h.id} className="mb-5 ml-5">
          <span aria-hidden className={`absolute -left-[6px] mt-1.5 h-3 w-3 rounded-full ring-4 ring-white ${dot[h.type] ?? "bg-ink-faint"}`} />
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-sm font-semibold text-ink">{h.action}</span>
            <span className="rounded bg-panel px-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-faint">{h.type}</span>
          </div>
          <div className="text-xs text-ink-faint"><time dateTime={h.ts}>{fmtDate(h.ts, true)}</time> · {h.actor}</div>
          {h.detail && <p className="mt-1 text-sm text-ink-soft">{h.detail}</p>}
          {(h.before !== undefined || h.after !== undefined) && (
            <div className="mt-1.5 grid gap-1 rounded-md border border-line bg-panel p-2 text-xs sm:grid-cols-2">
              <div><span className="font-semibold text-ink-faint">Before: </span><span className="line-through decoration-st-breach/50">{h.before || "—"}</span></div>
              <div><span className="font-semibold text-ink-faint">After: </span>{h.after || "—"}</div>
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}

// ── Training ──
function TrainingTab({ c }: { c: Complaint }) {
  const { db, canDo, canSeeTraining, act, toast, userName } = useStore();
  const items = db.training.filter((t) => t.caseIds.includes(c.id) && canSeeTraining(t));
  const canPropose = canDo("propose", c).ok;
  const [form, setForm] = useState<null | { gap: string; type: string; objective: string; priority: Priority }>(null);
  const types = db.lists.trainingTypes.filter((x) => x.active).map((x) => x.label);
  return (
    <div className="space-y-4">
      <Notice kind="info">Development actions turn findings into traceable coaching. They are not disciplinary decisions.</Notice>
      {items.length === 0 && !form && <EmptyState icon={GraduationCap} title="No linked training actions" body={canPropose ? "Propose an action from the findings." : undefined} />}
      {items.map((t) => (
        <div key={t.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-line px-4 py-3">
          <span className="font-mono text-sm font-semibold">{t.id}</span>
          <TrainingBadge status={t.status} overdue={isOverdue(t)} />
          <span className="min-w-0 flex-1 text-sm">{t.type} · {t.employee.name} — {t.gap}</span>
          <span className="text-xs text-ink-faint">Owner: {userName(t.ownerId)}{t.dueDate && ` · due ${fmtDate(t.dueDate)}`}</span>
        </div>
      ))}
      {canPropose && !c.employee && <Notice kind="warn">Identify the relevant employee in the Investigation tab before proposing a coaching action.</Notice>}
      {canPropose && c.employee && !form && <Button variant="primary" onClick={() => setForm({ gap: "", type: types[0] ?? "Coaching", objective: "", priority: "Medium" })}><GraduationCap size={15} />Propose training action</Button>}
      {form && c.employee && (
        <section className="space-y-3 rounded-lg border border-line p-4">
          <p className="text-sm">Employee: <strong>{c.employee.name}</strong> · {c.employee.group}</p>
          <Field label="Finding / skill gap" required htmlFor="tr-gap"><input id="tr-gap" className={inputCls} value={form.gap} onChange={(e) => setForm({ ...form, gap: e.target.value })} /></Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Action type" htmlFor="tr-type"><select id="tr-type" className={inputCls} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>{types.map((x) => <option key={x}>{x}</option>)}</select></Field>
            <Field label="Priority" htmlFor="tr-prio"><select id="tr-prio" className={inputCls} value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as Priority })}>{PRIORITIES.map((x) => <option key={x}>{x}</option>)}</select></Field>
          </div>
          <Field label="Objective" required htmlFor="tr-obj"><textarea id="tr-obj" rows={2} className={inputCls} value={form.objective} onChange={(e) => setForm({ ...form, objective: e.target.value })} /></Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setForm(null)}>Cancel</Button>
            <Button variant="primary" disabled={!form.gap.trim() || !form.objective.trim()} onClick={() => { const r = act.propose(c.id, { ...form, employee: c.employee as Employee }); if (r.ok) { toast("success", `Proposed ${r.id} for Manager approval.`); setForm(null); } else toast("error", r.error); }}>Submit proposal</Button>
          </div>
        </section>
      )}
    </div>
  );
}

// ── Action dialogs ──
function AssignDialog({ c, onDone }: { c: Complaint; onDone: () => void }) {
  const { db, act, toast, userName } = useStore();
  const officers = db.users.filter((u) => u.role === "Technical Officer" && u.active);
  const [to, setTo] = useState(c.assignedTo ?? "");
  return (
    <Confirm title={c.assignedTo ? `Reassign ${c.id}?` : `Assign ${c.id}`} confirmLabel={c.assignedTo ? "Confirm reassignment" : "Assign officer"} disabled={!to || to === c.assignedTo} onCancel={onDone}
      consequence={c.assignedTo ? <>Ownership moves from <strong>{userName(c.assignedTo)}</strong> to the selected officer. They will be notified; the previous officer loses edit access unless their scope allows it.</> : "The selected officer is notified and becomes responsible for the investigation."}
      onConfirm={() => { const r = act.assign(c.id, to); r.ok ? toast("success", `Assigned to ${userName(to)}.`) : toast("error", r.error); onDone(); }}>
      <Field label="Technical Officer" required htmlFor="as-to">
        <select id="as-to" className={inputCls} value={to} onChange={(e) => setTo(e.target.value)}>
          <option value="">Select officer…</option>
          {officers.map((u) => <option key={u.id} value={u.id}>{u.name} · {u.team} · {db.complaints.filter((x) => x.assignedTo === u.id && x.status !== "Closed").length} open</option>)}
        </select>
      </Field>
    </Confirm>
  );
}

function ResolveDialog({ c, onDone }: { c: Complaint; onDone: () => void }) {
  const { db, act, toast } = useStore();
  const [summary, setSummary] = useState("");
  const blockers = resolveBlockers(c, db.requests);
  return (
    <Confirm title="Resolve & send for Manager review?" confirmLabel="Resolve & send for review" disabled={!!blockers.length || !summary.trim()} onCancel={onDone}
      consequence={<>{c.id} moves to <strong>Resolved</strong> with Manager review <strong>Pending</strong>. Investigation editing locks until a Manager closes or returns it.</>}
      onConfirm={() => { const r = act.resolve(c.id, summary); r.ok ? toast("success", "Resolved and sent for Manager review.") : toast("error", r.error); onDone(); }}>
      {blockers.length > 0 && <Notice kind="error" title="Resolution is blocked"><ul className="list-disc pl-4">{blockers.map((b) => <li key={b}>{b}</li>)}</ul></Notice>}
      <Field label="Resolution summary" required htmlFor="rs-sum"><textarea id="rs-sum" rows={3} className={inputCls} value={summary} onChange={(e) => setSummary(e.target.value)} /></Field>
    </Confirm>
  );
}

function ReturnDialog({ c, onDone }: { c: Complaint; onDone: () => void }) {
  const { act, toast, userName } = useStore();
  const [reason, setReason] = useState("");
  return (
    <Confirm title="Return for investigation?" confirmLabel="Return to officer" variant="danger" disabled={!reason.trim()} onCancel={onDone}
      consequence={<>{c.id} goes back to <strong>In Progress</strong> and {userName(c.assignedTo)} can edit the investigation again. The reason is recorded in the timeline and sent to the officer.</>}
      onConfirm={() => { const r = act.returnCase(c.id, reason); r.ok ? toast("success", "Returned for investigation.") : toast("error", r.error); onDone(); }}>
      <Field label="Reason for return" required htmlFor="rt-r" error={!reason.trim() ? "A reason is required." : undefined}><textarea id="rt-r" rows={3} className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
    </Confirm>
  );
}

function CloseDialog({ c, onDone }: { c: Complaint; onDone: () => void }) {
  const { db, act, toast } = useStore();
  const [decision, setDecision] = useState("Closed — findings accepted");
  const [notes, setNotes] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const open = db.training.filter((t) => t.caseIds.includes(c.id) && !["Reviewed", "Rejected"].includes(t.status));
  return (
    <Confirm title={`Close ${c.id}?`} confirmLabel="Confirm closure" variant="success" disabled={!reviewed || !decision.trim()} onCancel={onDone}
      consequence={<>The case becomes <strong>Closed</strong> and all content becomes read-only. Closure time and your decision are recorded. Closed cases move to Archive after this month ends.</>}
      onConfirm={() => { const r = act.close(c.id, decision, notes); r.ok ? toast("success", `${c.id} closed.`) : toast("error", r.error); onDone(); }}>
      <div className="rounded-md bg-panel p-3 text-sm">
        <div className="text-xs font-semibold text-ink-faint">RESOLUTION</div>
        <p>{c.resolution?.summary}</p>
        <div className="mt-2 text-xs font-semibold text-ink-faint">OUTCOME · ACTIONS</div>
        <p><OutcomeBadge outcome={c.outcome} /> {c.actionsTaken}</p>
      </div>
      {open.length > 0 && <Notice kind="warn" title="Outstanding training actions">{open.map((t) => `${t.id} (${t.status})`).join(", ")} will remain open after closure.</Notice>}
      <Field label="Final decision" required htmlFor="cl-d"><input id="cl-d" className={inputCls} value={decision} onChange={(e) => setDecision(e.target.value)} /></Field>
      <Field label="Review notes" htmlFor="cl-n"><textarea id="cl-n" rows={2} className={inputCls} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={reviewed} onChange={(e) => setReviewed(e.target.checked)} className="mt-1" />I have reviewed the findings, outcome and actions taken.</label>
    </Confirm>
  );
}

function ArchiveDialog({ c, onDone }: { c: Complaint; onDone: () => void }) {
  const { act, toast } = useStore();
  const [reason, setReason] = useState("");
  return (
    <Confirm title={`Archive ${c.id}?`} confirmLabel="Move to archive" disabled={!reason.trim()} onCancel={onDone}
      consequence="The case stays Closed with its ID, history, evidence and training links. It moves from Closed This Month to Archive and remains in searches and reports. Nothing is deleted."
      onConfirm={() => { const r = act.archive(c.id, reason); r.ok ? toast("success", "Moved to archive.") : toast("error", r.error); onDone(); }}>
      <Field label="Archive reason" required htmlFor="ar-r"><input id="ar-r" className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
    </Confirm>
  );
}

function CorrectDialog({ c, patch, onDone }: { c: Complaint; patch: Partial<IntakeFields>; onDone: (ok: boolean) => void }) {
  const { act, toast } = useStore();
  const [reason, setReason] = useState("");
  const changes = useMemo(() => (Object.keys(patch) as (keyof IntakeFields)[]).filter((k) => patch[k] !== c[k]), [patch, c]);
  const label = (k: keyof IntakeFields) => PROTECTED_FIELDS.find((f) => f.key === k)?.label ?? k;
  const show = (k: keyof IntakeFields, v: unknown) => (k === "receivedAt" ? fmtDate(String(v), true) : String(v ?? ""));
  return (
    <Confirm title="Confirm correction to original information" confirmLabel="Save correction" disabled={!reason.trim() || !changes.length} onCancel={() => onDone(false)}
      consequence="Each change is recorded with before/after values, your name and the reason. The captured original email and receipt evidence remain unchanged."
      onConfirm={() => { const r = act.correct(c.id, patch, reason); if (r.ok) toast("success", "Correction saved with history."); else toast("error", r.error); onDone(r.ok); }}>
      <ul className="space-y-1.5 text-sm">{changes.map((k) => <li key={k} className="rounded-md bg-panel px-3 py-2"><strong>{label(k)}:</strong> <span className="line-through text-ink-faint">{show(k, c[k])}</span> → {show(k, patch[k])}</li>)}</ul>
      <Field label="Reason for correction" required htmlFor="co-r"><textarea id="co-r" rows={2} className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
    </Confirm>
  );
}
