import { useState } from "react";
import { Lock, Send, Mail, CheckCheck } from "lucide-react";
import { useStore } from "../store";
import type { FeedbackRequest } from "../lib/types";
import { REGIONAL_EMPLOYEES } from "../lib/seed";
import { Card, PageHeader, EmptyState, Dialog, Button, Field, inputCls, Notice, Confirm, KV, SectionTitle } from "../components/ui";
import { AttachmentList, Uploader, PreviewPanel } from "../components/Attachments";
import { fmtDate, relTime } from "../lib/lifecycle";
import { useRoute, setParam } from "../nav";
import type { AttachmentMeta } from "../lib/types";

// Restricted Group Manager workspace: only assigned requests, the deliberately shared
// context, centre employees, shared evidence and their own submissions.
export default function GMWorkspace({ tab }: { tab: "Pending" | "Submitted" }) {
  const { db, me, userName } = useStore();
  const route = useRoute();
  const mine = db.requests.filter((r) => r.groupManagerId === me?.id && r.status === tab).sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
  const openId = route.params.get("req");
  const open = db.requests.find((r) => r.id === openId && r.groupManagerId === me?.id);
  return (
    <>
      <PageHeader crumbs={["Regional Feedback", tab === "Pending" ? "Pending Requests" : "Submitted Responses"]} title={tab === "Pending" ? "Feedback requests for you" : "Your submitted responses"}
        description={<>Requests addressed to you as Group Manager of <strong>{me?.centre}</strong>. You see only the context the Technical Officer chose to share.</>} />
      <Card>
        {mine.length === 0 ? <EmptyState icon={tab === "Pending" ? Mail : CheckCheck} title={tab === "Pending" ? "No pending requests" : "No submissions yet"} body={tab === "Pending" ? "You'll be notified when a Technical Officer needs your input." : undefined} /> : (
          <ul className="divide-y divide-line">
            {mine.map((r) => (
              <li key={r.id}>
                <button onClick={() => setParam("req", r.id)} className="flex w-full flex-wrap items-start gap-3 px-5 py-4 text-left hover:bg-panel">
                  <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${r.status === "Pending" ? "bg-st-hold-bg text-st-hold" : "bg-st-resolved-bg text-st-resolved"}`}>{r.status === "Pending" ? <Mail size={16} /> : <CheckCheck size={16} />}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2"><span className="font-mono text-sm font-semibold text-slt-blue">{r.id}</span><span className="text-xs text-ink-faint">from {userName(r.requestedBy)} · {relTime(r.requestedAt)}</span></span>
                    <span className="mt-1 block text-sm text-ink">{r.infoRequired}</span>
                  </span>
                  <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${r.status === "Pending" ? "bg-st-hold-bg text-st-hold" : "bg-st-resolved-bg text-st-resolved"}`}>{r.status === "Pending" ? "Awaiting your response" : `Submitted ${fmtDate(r.response?.submittedAt)}`}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
      {openId && (open ? <ResponseDialog r={open} onClose={() => setParam("req", null)} /> : (
        <Dialog title="Request not available" size="sm" onClose={() => setParam("req", null)} footer={<Button onClick={() => setParam("req", null)}>Close</Button>}><div className="p-6 text-sm text-ink-soft">This request is not assigned to you.</div></Dialog>
      ))}
    </>
  );
}

function ResponseDialog({ r, onClose }: { r: FeedbackRequest; onClose: () => void }) {
  const { db, act, toast, userName } = useStore();
  const employees = REGIONAL_EMPLOYEES.filter((e) => e.centre === r.centre);
  const [emp, setEmp] = useState("");
  const [fb, setFb] = useState("");
  const [touched, setTouched] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [discard, setDiscard] = useState(false);
  const [preview, setPreview] = useState<AttachmentMeta | null>(null);
  const shared = db.attachments.filter((a) => r.sharedAttachmentIds.includes(a.id));
  const ownFiles = db.attachments.filter((a) => a.requestId === r.id && a.kind === "response");
  const pendingUploads = ownFiles.filter((a) => !r.response).map((a) => a.id);
  const readOnly = r.status === "Submitted";
  const dirty = !readOnly && (!!emp || !!fb);
  const close = () => (dirty ? setDiscard(true) : onClose());

  return (
    <Dialog size="lg" title={<>Regional feedback · <span className="font-mono">{r.id}</span></>} subtitle={`${r.centre} · requested by ${userName(r.requestedBy)} on ${fmtDate(r.requestedAt, true)}`} onClose={close}
      footer={preview ? undefined : readOnly ? <Button onClick={onClose}>Close</Button> : <><Button variant="ghost" onClick={close}>Cancel</Button><Button variant="primary" onClick={() => { setTouched(true); if (emp && fb.trim()) setConfirm(true); }}><Send size={15} />Review & submit</Button></>}>
      {preview ? <div className="h-[70vh]"><PreviewPanel a={preview} onBack={() => setPreview(null)} /></div> : (
        <div className="space-y-5 px-5 py-5 sm:px-6">
          <Notice kind="lock">You are seeing limited shared context only. Investigation findings and internal notes are not available in this workspace.</Notice>
          <section className="grid gap-4 rounded-lg border border-line p-4 sm:grid-cols-2">
            <KV label="Reason for request">{r.reason}</KV>
            <KV label="Information required">{r.infoRequired}</KV>
            <div className="sm:col-span-2"><KV label="Shared context">{r.context}</KV></div>
          </section>
          {shared.length > 0 && <section className="space-y-2"><SectionTitle>Evidence shared with you</SectionTitle><AttachmentList items={shared} onPreview={setPreview} canPreview canDownload={false} /></section>}
          {readOnly && r.response ? (
            <section className="space-y-3 rounded-lg border border-st-resolved/30 bg-st-resolved-bg/40 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-st-resolved"><Lock size={14} />Submitted {fmtDate(r.response.submittedAt, true)} · read-only</div>
              <KV label="Employee identified">{r.response.employee.name} · {r.response.employee.serviceNo} · {r.response.employee.group}</KV>
              <KV label="Your feedback">{r.response.feedback}</KV>
              {ownFiles.length > 0 && <AttachmentList items={ownFiles} onPreview={setPreview} canPreview canDownload />}
            </section>
          ) : (
            <section className="space-y-4">
              <Field label={`Employee at ${r.centre}`} required htmlFor="gm-emp" error={touched && !emp ? "Select the employee who handled the call." : undefined}>
                <select id="gm-emp" className={inputCls} value={emp} onChange={(e) => setEmp(e.target.value)}>
                  <option value="">Select employee…</option>
                  {employees.map((e) => <option key={e.serviceNo} value={e.serviceNo}>{e.name} · {e.serviceNo} · {e.group}</option>)}
                </select>
              </Field>
              <Field label="Feedback" required htmlFor="gm-fb" error={touched && !fb.trim() ? "Feedback is required." : undefined}><textarea id="gm-fb" rows={5} className={inputCls} value={fb} onChange={(e) => setFb(e.target.value)} placeholder="Officer's explanation, what happened, any action taken locally…" /></Field>
              <div>
                <SectionTitle>Supporting attachments (optional)</SectionTitle>
                <div className="mt-2 space-y-2">
                  {ownFiles.length > 0 && <AttachmentList items={ownFiles} onPreview={setPreview} canPreview canDownload />}
                  <Uploader existingCount={ownFiles.length} label="Attach supporting files" onUpload={async (f) => {
                    const res = await act.addAttachment(f, { requestId: r.id, complaintId: r.complaintId, kind: "response", provenance: `Group Manager response attachment (${r.id})` });
                    return res.ok ? { ok: true } : { ok: false, error: res.error };
                  }} />
                </div>
              </div>
            </section>
          )}
        </div>
      )}
      {confirm && (
        <Confirm title="Submit feedback?" confirmLabel="Submit feedback" onCancel={() => setConfirm(false)}
          consequence="Your response is sent to the requesting Technical Officer and becomes read-only. You will not be able to edit it afterwards."
          onConfirm={() => { const e = employees.find((x) => x.serviceNo === emp)!; const res = act.submitFeedback(r.id, e, fb, pendingUploads); setConfirm(false); if (res.ok) { toast("success", "Feedback submitted."); onClose(); } else toast("error", res.error); }} />
      )}
      {discard && <Confirm title="Discard your draft?" confirmLabel="Discard draft" variant="danger" onCancel={() => setDiscard(false)} onConfirm={onClose} consequence="Your unsaved feedback will be lost. Uploaded files stay attached to the draft." />}
    </Dialog>
  );
}
