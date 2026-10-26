import { useMemo, useState } from "react";
import { AlertTriangle, FilePlus2, Copy } from "lucide-react";
import { useStore } from "../store";
import type { IntakeFields, InboxEmail, Source, Priority, Employee } from "../lib/types";
import { SOURCES, PRIORITIES } from "../lib/types";
import { TEAMS } from "../lib/seed";
import { nowIso } from "../store";
import { Field, inputCls, Button, Notice, Confirm, Card, PageHeader, SourceTag } from "../components/ui";
import { fmtDate } from "../lib/lifecycle";
import { setParam } from "../nav";

export function detectSource(e: InboxEmail, map: { pattern: string; source: Source }[]): { source: Source; certain: boolean; why: string } {
  if (e.mailbox === "1212") return { source: "1212 Mail", certain: true, why: "Received in the configured 1212 mailbox" };
  const m = map.find((x) => e.from.toLowerCase() === x.pattern.toLowerCase());
  return m ? { source: m.source, certain: true, why: `Sender matches mapping ${m.pattern}` } : { source: "Other", certain: false, why: "Sender is not in the approved sender/source mapping" };
}

export function RegisterForm({ email, employee, onDone, onCancel }: { email?: InboxEmail; employee?: Employee | null; onDone: (id: string) => void; onCancel?: () => void }) {
  const { db, me, act, toast, visibleComplaints } = useStore();
  const det = email ? detectSource(email, db.settings.senderMap) : null;
  const [f, setF] = useState<IntakeFields>(() => ({
    source: det?.source ?? "TRC", sourceRef: email?.extracted.sourceRef ?? "", receivedAt: email?.receivedAt ?? nowIso(), sltNumber: email?.extracted.sltNumber ?? "",
    customer: email?.extracted.customer ?? "", contact: email?.extracted.contact ?? "", customerEmail: email?.extracted.customerEmail ?? (email?.mailbox === "1212" ? email.from : ""),
    issueType: email?.extracted.issueType ?? "", category: "", priority: (email?.extracted.priority as Priority) ?? "Medium", details: email?.extracted.details ?? "",
  }));
  const team = me?.team && TEAMS.includes(me.team) ? me.team : TEAMS[0];
  const [touched, setTouched] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof IntakeFields, v: string) => setF((x) => ({ ...x, [k]: v }));
  const errors: Partial<Record<keyof IntakeFields, string>> = {};
  if (!f.sltNumber.trim()) errors.sltNumber = "Service / SLT number is required.";
  if (!f.issueType) errors.issueType = "Choose an issue type.";
  if (!f.category) errors.category = "Choose a category.";
  if (!f.details.trim()) errors.details = "Describe the complaint.";
  if (f.customerEmail && !/^\S+@\S+\.\S+$/.test(f.customerEmail)) errors.customerEmail = "Enter a valid email or leave blank.";
  const missingExtract = email ? (["customer", "sltNumber", "issueType", "details", "sourceRef"] as const).filter((k) => !email.extracted[k]) : [];

  const dups = useMemo(() => {
    const ref = f.sourceRef.trim().toLowerCase();
    const num = f.sltNumber.replace(/\D/g, "");
    return db.complaints.filter((c) => (ref && ref !== "—" && c.sourceRef.toLowerCase() === ref) || (num.length >= 9 && c.sltNumber.replace(/\D/g, "") === num && c.status !== "Closed"));
  }, [f.sourceRef, f.sltNumber, db.complaints]);
  const cats = db.lists.categories.filter((x) => x.active).map((x) => x.label);
  const issues = db.lists.issueTypes.filter((x) => x.active).map((x) => x.label);
  const err = (k: keyof IntakeFields) => (touched ? errors[k] : undefined);

  function submit() {
    setTouched(true);
    if (Object.keys(errors).length) return toast("error", "Fix the highlighted fields before registering.");
    setConfirm(true);
  }
  function doRegister() {
    if (busy) return; // guard repeated submission
    setBusy(true);
    const r = act.register(f, { emailId: email?.id, team, employee: employee ?? undefined });
    setConfirm(false);
    setBusy(false);
    if (r.ok) {
      toast("success", `Registered ${r.id}${employee ? ` for ${employee.name}` : ""}.`);
      onDone(r.id!);
    } else toast("error", r.error);
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); submit(); }} noValidate className="space-y-5">
      {employee && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slt-blue/30 bg-slt-blue-50/60 p-3.5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slt-blue font-bold text-white text-xs">
              {employee.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-ink text-sm">{employee.name}</span>
                <span className="rounded border border-slt-blue/30 bg-white px-2 py-0.5 font-mono text-xs font-semibold text-slt-blue">{employee.serviceNo}</span>
              </div>
              <p className="text-xs text-ink-soft">{employee.group} · {employee.centre}</p>
            </div>
          </div>
          <span className="rounded bg-slt-blue/10 px-2.5 py-1 text-xs font-semibold text-slt-blue">Assigned to Employee</span>
        </div>
      )}
      {det && (
        <Notice kind={det.certain ? "info" : "warn"} title={det.certain ? `Source detected: ${det.source}` : "Source uncertain — please confirm"}>{det.why}. Verify before registering.</Notice>
      )}
      {missingExtract.length > 0 && <Notice kind="warn" title="Some fields could not be extracted">Missing: {missingExtract.join(", ")}. Complete them from the email body.</Notice>}
      {dups.length > 0 && (
        <Notice kind="warn" title={`Possible duplicate${dups.length > 1 ? "s" : ""} found`}>
          <ul className="mt-1 space-y-1">{dups.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center gap-2">
              {visibleComplaints.some((v) => v.id === d.id) ? <button type="button" className="font-mono font-semibold underline" onClick={() => setParam("case", d.id)}>{d.id}</button> : <span className="font-mono">{d.id}</span>}
              <span>· {d.sourceRef} · {d.sltNumber} · {d.status}</span>
            </li>
          ))}</ul>
          <p className="mt-1">Duplicates are never merged automatically. Register only if this is a distinct complaint.</p>
        </Notice>
      )}
      <fieldset className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <legend className="mb-2 text-sm font-semibold text-ink">Source</legend>
        <Field label="Source" required htmlFor="r-source"><select id="r-source" className={inputCls} value={f.source} onChange={(e) => set("source", e.target.value)}>{SOURCES.map((s) => <option key={s}>{s}</option>)}</select></Field>
        <Field label="Source reference" htmlFor="r-ref" hint="Leave blank if none was supplied."><input id="r-ref" className={inputCls} value={f.sourceRef} onChange={(e) => set("sourceRef", e.target.value)} /></Field>
        <Field label="Received" required htmlFor="r-recv" hint={email ? "From email receipt — cannot be changed here." : "Asia/Colombo"}>
          <input
            id="r-recv"
            type="datetime-local"
            readOnly={!!email}
            className={inputCls}
            value={(() => {
              try {
                const d = new Date(new Date(f.receivedAt).getTime() + 330 * 60000);
                return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 16);
              } catch {
                return "";
              }
            })()}
            onChange={(e) => {
              if (e.target.value) {
                try {
                  const d = new Date(e.target.value + ":00+05:30");
                  if (!isNaN(d.getTime())) set("receivedAt", d.toISOString());
                } catch {
                  /* ignore invalid partial date input */
                }
              }
            }}
          />
        </Field>
      </fieldset>
      <fieldset className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <legend className="mb-2 text-sm font-semibold text-ink">Customer & service</legend>
        <Field label="Customer name" htmlFor="r-cust"><input id="r-cust" className={inputCls} value={f.customer} onChange={(e) => set("customer", e.target.value)} /></Field>
        <Field label="Service / SLT number" required htmlFor="r-num" error={err("sltNumber")}><input id="r-num" aria-invalid={!!err("sltNumber")} className={inputCls} value={f.sltNumber} onChange={(e) => set("sltNumber", e.target.value)} /></Field>
        <Field label="Contact number" htmlFor="r-contact"><input id="r-contact" className={inputCls} value={f.contact} onChange={(e) => set("contact", e.target.value)} /></Field>
        <Field label="Customer email" htmlFor="r-email" error={err("customerEmail")}><input id="r-email" type="email" className={inputCls} value={f.customerEmail} onChange={(e) => set("customerEmail", e.target.value)} /></Field>
      </fieldset>
      <fieldset className="grid gap-4 sm:grid-cols-3">
        <legend className="mb-2 text-sm font-semibold text-ink">Complaint</legend>
        <Field label="Issue type" required htmlFor="r-issue" error={err("issueType")}><select id="r-issue" aria-invalid={!!err("issueType")} className={inputCls} value={f.issueType} onChange={(e) => set("issueType", e.target.value)}><option value="">Select…</option>{issues.map((s) => <option key={s}>{s}</option>)}</select></Field>
        <Field label="Category" required htmlFor="r-cat" error={err("category")}><select id="r-cat" aria-invalid={!!err("category")} className={inputCls} value={f.category} onChange={(e) => set("category", e.target.value)}><option value="">Select…</option>{cats.map((s) => <option key={s}>{s}</option>)}</select></Field>
        <Field label="Priority" required htmlFor="r-prio"><select id="r-prio" className={inputCls} value={f.priority} onChange={(e) => set("priority", e.target.value)}>{PRIORITIES.map((s) => <option key={s}>{s}</option>)}</select></Field>
        <div className="sm:col-span-3"><Field label="Original description" required htmlFor="r-det" error={err("details")}><textarea id="r-det" aria-invalid={!!err("details")} rows={4} className={inputCls} value={f.details} onChange={(e) => set("details", e.target.value)} /></Field></div>
      </fieldset>
      <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-4">
        {onCancel && <Button variant="ghost" onClick={onCancel}>Cancel</Button>}
        <Button type="submit" variant="primary"><FilePlus2 size={15} />Review & register</Button>
      </div>
      {confirm && (
        <Confirm title="Register this complaint?" confirmLabel="Register complaint" onCancel={() => setConfirm(false)} onConfirm={doRegister} disabled={busy}
          consequence={<>A new <strong>Open</strong> case will be created from {email ? <>email <span className="font-mono">{email.messageId}</span>, which will be linked and marked processed so it cannot be registered again</> : "manual intake"}. Intake fields become protected after registration.</>}>
          <dl className="grid grid-cols-2 gap-2 rounded-md bg-panel p-3 text-xs">
            <dt className="text-ink-faint">Source</dt><dd><SourceTag source={f.source} /></dd>
            <dt className="text-ink-faint">Service no.</dt><dd>{f.sltNumber}</dd>
            <dt className="text-ink-faint">Issue</dt><dd>{f.issueType} · {f.priority}</dd>
            {employee && (
              <><dt className="text-ink-faint">Employee</dt><dd className="font-semibold text-slt-blue">{employee.name} ({employee.serviceNo})</dd></>
            )}
            {me?.role === "Technical Officer" && (
              <><dt className="text-ink-faint">Assigned</dt><dd>{me.name} (Auto-assigned)</dd></>
            )}
          </dl>
          {dups.length > 0 && <p className="flex items-center gap-1.5 text-xs text-st-progress"><Copy size={12} />{dups.length} possible duplicate(s) noted above.</p>}
        </Confirm>
      )}
    </form>
  );
}

export default function Register() {
  return (
    <>
      <PageHeader crumbs={["Intake", "Register Complaint"]} title="Register complaint" description="Manual intake for complaints received outside the connected mailboxes." />
      <Card className="p-4 sm:p-6"><RegisterForm onDone={(id) => setParam("case", id)} /></Card>
      <p className="mt-3 flex items-center gap-1.5 text-xs text-ink-faint"><AlertTriangle size={12} />Received date is recorded in Asia/Colombo time. {fmtDate(nowIso(), true)} now.</p>
    </>
  );
}
