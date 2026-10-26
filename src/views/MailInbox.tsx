import { useMemo, useState } from "react";
import { RefreshCw, Paperclip, Search, MailOpen, CheckCircle2, ArrowLeft, FilePlus2, Inbox, WifiOff } from "lucide-react";
import { useStore } from "../store";
import type { InboxEmail } from "../lib/types";
import { Card, PageHeader, Button, EmptyState, Notice, inputCls, Dialog, SourceTag, DemoTag } from "../components/ui";
import { RegisterForm, detectSource } from "./Register";
import { fmtDate, relTime } from "../lib/lifecycle";
import { fmtSize } from "../lib/files";
import { setParam } from "../nav";
import { demoNow } from "../lib/permissions";

export default function MailInbox({ mailbox }: { mailbox: "1212" | "complaints" }) {
  const { db, act, toast, visibleComplaints } = useStore();
  const mb = db.settings.mailboxes.find((m) => m.id === mailbox)!;
  const [sel, setSel] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [state, setState] = useState<"all" | "unread" | "unprocessed" | "processed">("unprocessed");
  const [range, setRange] = useState<"all" | "today" | "7d">("all");
  const [src, setSrc] = useState("");
  const [sync, setSync] = useState<"idle" | "syncing" | "error">("idle");
  const [syncErr, setSyncErr] = useState("");
  const [registering, setRegistering] = useState<InboxEmail | null>(null);

  const all = db.inbox.filter((e) => e.mailbox === mailbox);
  const rows = useMemo(() => all.filter((e) => {
    const s = q.trim().toLowerCase();
    const t = new Date(e.receivedAt).getTime();
    const now = demoNow().getTime();
    return (!s || [e.from, e.fromName, e.subject, e.body].some((v) => v.toLowerCase().includes(s)))
      && (state === "all" || (state === "unread" && !e.read) || (state === "unprocessed" && !e.processedCaseId) || (state === "processed" && !!e.processedCaseId))
      && (range === "all" || (range === "today" && now - t < 86400000) || (range === "7d" && now - t < 7 * 86400000))
      && (!src || detectSource(e, db.settings.senderMap).source === src);
  }).sort((a, b) => b.receivedAt.localeCompare(a.receivedAt)), [all, q, state, range, src, db.settings.senderMap]);
  const cur = all.find((e) => e.id === sel) ?? null;

  async function refresh() {
    setSync("syncing");
    const r = await act.syncMail();
    if (r.ok) { setSync("idle"); setSyncErr(""); toast(r.id === "1" ? "success" : "info", r.id === "1" ? "1 new message synced (simulated)." : "No new messages."); }
    else { setSync("error"); setSyncErr(r.error); }
  }
  function open(e: InboxEmail) { setSel(e.id); if (!e.read) act.markEmailRead(e.id); }

  const title = mailbox === "1212" ? "1212 Mail" : "Other complaint email";
  return (
    <>
      <PageHeader crumbs={["Intake", title]} title={title}
        description={<>Messages in <span className="font-mono">{mb.address}</span>. {mailbox === "1212" ? "Anything arriving in this mailbox is sourced as 1212 Mail regardless of sender." : "Source is detected from the approved sender mapping; unknown senders need confirmation."} An email becomes a case only when a Manager completes registration.</>}
        actions={<><DemoTag>Simulated sync</DemoTag><span className="text-xs text-ink-faint">Last sync {relTime(mb.lastSync)}</span><Button onClick={refresh} loading={sync === "syncing"}><RefreshCw size={15} />{sync === "syncing" ? "Syncing…" : "Refresh"}</Button></>} />
      {sync === "error" && <div className="mb-3"><Notice kind="error" title="Sync failed">{syncErr} <button className="ml-1 font-semibold underline" onClick={refresh}>Retry now</button></Notice></div>}
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
          <div className="relative min-w-[180px] flex-1">
            <label htmlFor="mail-q" className="sr-only">Search mail</label>
            <Search size={15} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
            <input id="mail-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search sender, subject, body…" className={`${inputCls} pl-9`} />
          </div>
          <label htmlFor="mail-state" className="sr-only">State</label>
          <select id="mail-state" className={`${inputCls} w-auto`} value={state} onChange={(e) => setState(e.target.value as typeof state)}>
            <option value="unprocessed">Not yet registered</option><option value="unread">Unread</option><option value="processed">Processed</option><option value="all">All messages</option>
          </select>
          <label htmlFor="mail-range" className="sr-only">Received</label>
          <select id="mail-range" className={`${inputCls} w-auto`} value={range} onChange={(e) => setRange(e.target.value as typeof range)}>
            <option value="all">Any date</option><option value="today">Last 24 h</option><option value="7d">Last 7 days</option>
          </select>
          {mailbox === "complaints" && <><label htmlFor="mail-src" className="sr-only">Detected source</label><select id="mail-src" className={`${inputCls} w-auto`} value={src} onChange={(e) => setSrc(e.target.value)}><option value="">All sources</option>{Array.from(new Set(all.map((e) => detectSource(e, db.settings.senderMap).source))).map((s) => <option key={s}>{s}</option>)}</select></>}
        </div>
        <div className="grid min-h-[480px] md:grid-cols-[minmax(280px,380px)_1fr]">
          <ul className={`divide-y divide-line border-line md:border-r ${cur ? "hidden md:block" : ""}`} aria-label="Messages">
            {sync === "syncing" && all.length === 0 && <li className="p-4"><div className="skeleton h-14 rounded" /></li>}
            {rows.length === 0 && <li><EmptyState icon={Inbox} title={all.length ? "No messages match" : "Inbox is empty"} body={all.length ? "Adjust the filters above." : "New messages appear after the next sync."} /></li>}
            {rows.map((e) => {
              const d = detectSource(e, db.settings.senderMap);
              return (
                <li key={e.id}>
                  <button onClick={() => open(e)} aria-current={sel === e.id} className={`block w-full px-4 py-3 text-left transition-colors ${sel === e.id ? "bg-slt-blue-50" : "hover:bg-panel"}`}>
                    <div className="flex items-center gap-2">
                      {!e.read && <span className="h-2 w-2 shrink-0 rounded-full bg-slt-blue" aria-label="Unread" />}
                      <span className={`min-w-0 flex-1 truncate text-sm ${e.read ? "text-ink-soft" : "font-semibold text-ink"}`}>{e.fromName}</span>
                      <span className="whitespace-nowrap text-[11px] text-ink-faint">{relTime(e.receivedAt)}</span>
                    </div>
                    <div className="mt-0.5 truncate text-sm text-ink">{e.subject}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <SourceTag source={d.source} />
                      {!d.certain && <span className="rounded bg-st-progress-bg px-1.5 text-[10px] font-semibold text-st-progress">Uncertain</span>}
                      {e.attachments.length > 0 && <span className="flex items-center gap-0.5 text-[11px] text-ink-faint"><Paperclip size={11} aria-hidden />{e.attachments.length}<span className="sr-only"> attachments</span></span>}
                      {e.processedCaseId && <span className="flex items-center gap-1 text-[11px] font-semibold text-st-resolved"><CheckCircle2 size={11} aria-hidden />{e.processedCaseId}</span>}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
          <div className={`${cur ? "" : "hidden md:block"} min-w-0`}>
            {!cur ? <EmptyState icon={MailOpen} title="Select a message to preview" body="Preview the original email, then register it as a complaint." /> : (
              <article className="flex h-full flex-col">
                <header className="space-y-2 border-b border-line p-4 sm:p-5">
                  <button className="mb-1 flex items-center gap-1 text-xs font-semibold text-slt-blue md:hidden" onClick={() => setSel(null)}><ArrowLeft size={13} />Back to messages</button>
                  <h2 className="text-base font-semibold text-ink">{cur.subject}</h2>
                  <div className="text-sm text-ink-soft">{cur.fromName} &lt;{cur.from}&gt;</div>
                  <div className="flex flex-wrap gap-x-4 text-xs text-ink-faint"><span>Received {fmtDate(cur.receivedAt, true)}</span><span className="font-mono">{cur.messageId}</span></div>
                  {(() => { const d = detectSource(cur, db.settings.senderMap); return <div className="text-xs"><SourceTag source={d.source} /> <span className="text-ink-faint">— {d.why}</span></div>; })()}
                </header>
                <pre className="flex-1 whitespace-pre-wrap p-4 font-sans text-sm leading-relaxed text-ink sm:p-5">{cur.body}</pre>
                {cur.attachments.length > 0 && (
                  <div className="border-t border-line px-5 py-3">
                    <div className="mb-1 text-xs font-semibold text-ink-faint">ATTACHMENTS (imported with provenance on registration)</div>
                    {cur.attachments.map((a) => <div key={a.name} className="flex items-center gap-2 text-sm"><Paperclip size={13} aria-hidden />{a.name} · {fmtSize(a.size)}</div>)}
                  </div>
                )}
                <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-panel px-5 py-3">
                  {cur.processedCaseId ? (
                    <>
                      <span className="mr-auto flex items-center gap-1.5 text-sm text-st-resolved"><CheckCircle2 size={15} />Registered as {cur.processedCaseId} — cannot be registered again.</span>
                      {visibleComplaints.some((c) => c.id === cur.processedCaseId) && <Button onClick={() => setParam("case", cur.processedCaseId!)}>Open case</Button>}
                    </>
                  ) : <Button variant="primary" onClick={() => setRegistering(cur)}><FilePlus2 size={15} />Register complaint</Button>}
                </footer>
              </article>
            )}
          </div>
        </div>
      </Card>
      {db.settings.mailboxes.find((m) => m.id === mailbox)?.status !== "Connected (simulated)" && <div className="mt-3"><Notice kind="warn"><WifiOff size={13} className="inline" /> Mailbox integration is not healthy. Contact your administrator.</Notice></div>}
      {registering && (
        <Dialog size="lg" title="Register complaint from email" subtitle={<>From {registering.fromName} · <span className="font-mono">{registering.messageId}</span></>} onClose={() => setRegistering(null)}>
          <div className="px-5 py-5 sm:px-6">
            <details className="mb-4 rounded-md border border-line bg-panel px-3 py-2 text-sm"><summary className="cursor-pointer font-medium">Original email</summary><pre className="mt-2 whitespace-pre-wrap font-sans text-[13px] text-ink-soft">{registering.body}</pre></details>
            <RegisterForm email={registering} onCancel={() => setRegistering(null)} onDone={(id) => { setRegistering(null); setParam("case", id); }} />
          </div>
        </Dialog>
      )}
    </>
  );
}
