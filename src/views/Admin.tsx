import { useMemo, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { UserPlus, Search, Lock, ShieldCheck, Activity, Server, Mail, HardDrive, KeyRound, Plug, Eye, Plus, Trash2, RefreshCw } from "lucide-react";
import { useStore } from "../store";
import type { User, Role, Cap, Scope, Settings, NotifEvent, Source } from "../lib/types";
import { SOURCES } from "../lib/types";
import { CAPS, CAP_AREAS, capState, scopeOf, type Templates } from "../lib/permissions";
import { TEAMS, REGIONAL_CENTRES } from "../lib/seed";
import { navFor } from "../nav";
import { fmtDate, relTime } from "../lib/lifecycle";
import { Card, CardHeader, PageHeader, Button, DataTable, Dialog, Field, inputCls, Notice, Confirm, Avatar, DemoTag, EmptyState, KV, type Column } from "../components/ui";

const TITLES: Record<string, [string, string]> = {
  overview: ["System Overview", "Service health, integrations and account statistics. Telemetry is simulated until monitoring is connected; no complaint or customer data is shown here."],
  users: ["Users & Access", "Create and deactivate accounts, assign one role and organisational scope, and set explicit per-user overrides."],
  matrix: ["Permission Matrix", "Editable templates for Manager and Technical Officer. Group Manager and Admin policies are fixed. Hard role boundaries cannot be overridden."],
  settings: ["System Settings", "Attachment limits, regional centre mappings, time zone, date defaults and retention policy display."],
  integrations: ["Integrations", "Mailbox connections, sender/source mappings and identity directory metadata. Secrets are never displayed."],
  notifications: ["Notification Settings", "Event enablement, mandatory rules, recipients, channels, templates and reminder schedules."],
  audit: ["Technical Audit", "Account, permission, setting, integration, authentication and job events. Business case values are excluded."],
};

export default function Admin({ tab }: { tab: string }) {
  const [t, d] = TITLES[tab] ?? ["Administration", ""];
  return (
    <>
      <PageHeader crumbs={["Administration", t]} title={t} description={d} />
      {tab === "overview" && <Overview />}
      {tab === "users" && <Users />}
      {tab === "matrix" && <Matrix />}
      {tab === "settings" && <SystemSettings />}
      {tab === "integrations" && <Integrations />}
      {tab === "notifications" && <NotificationSettings />}
      {tab === "audit" && <Audit />}
    </>
  );
}

// ── Overview (simulated telemetry) ──
function series(seed: number, base: number, amp: number) {
  let x = seed;
  return Array.from({ length: 24 }, (_, i) => { x = (x * 9301 + 49297) % 233280; return { h: `${String(i).padStart(2, "0")}:00`, v: Math.round((base + (x / 233280 - 0.5) * amp) * 10) / 10 }; });
}
function Overview() {
  const { db } = useStore();
  const latency = useMemo(() => series(7, 180, 90), []);
  const errors = useMemo(() => series(13, 0.4, 0.6).map((p) => ({ ...p, v: Math.max(0, p.v) })), []);
  const bytes = (() => { try { return (localStorage.getItem("comtrack:db:v2") ?? "").length * 2; } catch { return 0; } })();
  const byRole = (["Admin", "Manager", "Technical Officer", "Group Manager"] as Role[]).map((r) => ({ r, active: db.users.filter((u) => u.role === r && u.active).length, inactive: db.users.filter((u) => u.role === r && !u.active).length }));
  const signins = db.audit.filter((a) => a.category === "Auth" && a.action.startsWith("Signed in")).length;
  const jobs = db.audit.filter((a) => a.category === "Job");
  const failedJobs = jobs.filter((j) => j.action.includes("failed")).length;
  const cards = [
    { icon: Server, label: "Service availability", value: "99.95%", note: "30-day, simulated" },
    { icon: Activity, label: "API p95 latency", value: `${Math.max(...latency.map((p) => p.v))} ms`, note: "24 h, simulated" },
    { icon: ShieldCheck, label: "Error rate", value: `${(errors.reduce((a, b) => a + b.v, 0) / errors.length).toFixed(2)}%`, note: "24 h, simulated" },
    { icon: RefreshCw, label: "Job health", value: failedJobs ? `${failedJobs} failed` : "Healthy", note: `${jobs.length} job runs logged` },
    { icon: Mail, label: "Notification delivery", value: "In-app OK", note: "Email delivery simulated" },
    { icon: HardDrive, label: "Local demo storage", value: `${(bytes / 1024).toFixed(0)} KB`, note: "Browser localStorage (metadata)" },
  ];
  return (
    <div className="space-y-4">
      <Notice kind="info" title="Simulated telemetry"><DemoTag>Demo</DemoTag> These metrics are generated for the prototype. Connect APM / monitoring via the backend integration hooks to show real values.</Notice>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {cards.map((c) => <Card key={c.label} className="p-4"><c.icon size={17} className="text-slt-blue" aria-hidden /><div className="tnum mt-2 text-xl font-bold">{c.value}</div><div className="text-sm font-medium">{c.label}</div><div className="text-[11px] text-ink-faint">{c.note}</div></Card>)}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        {[{ t: "API latency (ms)", d: latency, c: "#0a4595" }, { t: "Error rate (%)", d: errors, c: "#c02525" }].map((g) => (
          <Card key={g.t}><CardHeader title={g.t} subtitle="Last 24 hours · simulated" />
            <div className="h-52 p-3" role="img" aria-label={`${g.t} line chart, simulated`}><ResponsiveContainer><LineChart data={g.d}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f1" vertical={false} /><XAxis dataKey="h" tick={{ fontSize: 10 }} interval={3} /><YAxis tick={{ fontSize: 10 }} width={36} /><Tooltip /><Line dataKey="v" stroke={g.c} dot={false} strokeWidth={2} /></LineChart></ResponsiveContainer></div>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card><CardHeader title="Integration state" />
          <ul className="divide-y divide-line">
            {db.settings.mailboxes.map((m) => <li key={m.id} className="flex items-center gap-3 px-5 py-3 text-sm"><Mail size={15} className="text-ink-faint" /><span className="flex-1">{m.label} · <span className="font-mono text-xs">{m.address}</span></span><StatusPill ok={m.status.startsWith("Connected") && !db.settings.simulateSyncFailure} text={db.settings.simulateSyncFailure ? "Failing (simulated)" : m.status} /></li>)}
            <li className="flex items-center gap-3 px-5 py-3 text-sm"><KeyRound size={15} className="text-ink-faint" /><span className="flex-1">Identity directory</span><StatusPill ok={false} text="Not connected — mock login" /></li>
          </ul>
        </Card>
        <Card><CardHeader title="Authentication & accounts" subtitle={`${signins} sign-in events recorded`} />
          <table className="w-full text-sm"><caption className="sr-only">Accounts by role</caption><thead><tr className="border-b border-line bg-panel text-left text-[11px] uppercase text-ink-faint"><th className="px-5 py-2">Role</th><th className="px-5 py-2">Active</th><th className="px-5 py-2">Inactive</th></tr></thead>
            <tbody>{byRole.map((r) => <tr key={r.r} className="border-b border-line last:border-0"><td className="px-5 py-2">{r.r}</td><td className="tnum px-5 py-2">{r.active}</td><td className="tnum px-5 py-2">{r.inactive}</td></tr>)}</tbody></table>
        </Card>
      </div>
    </div>
  );
}
function StatusPill({ ok, text }: { ok: boolean; text: string }) {
  return <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${ok ? "bg-st-resolved-bg text-st-resolved" : "bg-st-progress-bg text-st-progress"}`}>{ok ? "●" : "▲"} {text}</span>;
}

// ── Users & Access ──
function Users() {
  const { db, me } = useStore();
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const rows = db.users.filter((u) => (!role || u.role === role) && (!q || (u.name + u.email).toLowerCase().includes(q.toLowerCase())));
  const cols: Column<User>[] = [
    { key: "name", header: "User", render: (u) => u.name, sortValue: (u) => u.name },
    { key: "email", header: "Email", render: (u) => <span className="text-sm text-ink-soft">{u.email}</span>, priority: 2 },
    { key: "role", header: "Role", render: (u) => <span className="text-sm">{u.role}</span>, sortValue: (u) => u.role },
    { key: "scope", header: "Scope / centre", render: (u) => <span className="text-sm">{u.role === "Group Manager" ? u.centre : u.team}{(u.role === "Manager" || u.role === "Technical Officer") && <span className="text-xs text-ink-faint"> · {scopeOf(u, db.templates)}{u.scopeOverride ? " (override)" : ""}</span>}</span>, priority: 2 },
    { key: "ov", header: "Overrides", render: (u) => <span className="text-sm">{Object.keys(u.overrides).length || "—"}</span>, priority: 3 },
    { key: "status", header: "Status", render: (u) => <StatusPill ok={u.active} text={u.active ? "Active" : "Deactivated"} />, sortValue: (u) => (u.active ? 0 : 1) },
  ];
  return (
    <>
      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
          <div className="relative min-w-[200px] flex-1"><label htmlFor="u-q" className="sr-only">Search users</label><Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" aria-hidden /><input id="u-q" className={`${inputCls} pl-9`} placeholder="Search name or email" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <label htmlFor="u-role" className="sr-only">Role</label>
          <select id="u-role" className={`${inputCls} w-auto`} value={role} onChange={(e) => setRole(e.target.value)}><option value="">All roles</option>{["Admin", "Manager", "Technical Officer", "Group Manager"].map((r) => <option key={r}>{r}</option>)}</select>
          <Button variant="primary" onClick={() => setCreating(true)}><UserPlus size={15} />Create user</Button>
        </div>
        <DataTable caption="Users" rows={rows} columns={cols} rowKey={(u) => u.id} onRowClick={(u) => setOpenId(u.id)} rowLabel={(u) => `Manage ${u.name}`} empty={<EmptyState title="No users match" />}
          card={(u) => <div className="flex items-center gap-3"><Avatar initials={u.initials} size={30} /><div className="min-w-0 flex-1"><div className="text-sm font-medium">{u.name}{u.id === me?.id && " (you)"}</div><div className="text-xs text-ink-faint">{u.role} · {u.role === "Group Manager" ? u.centre : u.team}</div></div><StatusPill ok={u.active} text={u.active ? "Active" : "Off"} /></div>} />
      </Card>
      {creating && <CreateUser onClose={() => setCreating(false)} onCreated={(id) => { setCreating(false); setOpenId(id); }} />}
      {openId && <UserDialog id={openId} onClose={() => setOpenId(null)} />}
    </>
  );
}

function CreateUser({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const { act, toast } = useStore();
  const [f, setF] = useState({ name: "", email: "", role: "Technical Officer" as Role, team: TEAMS[0], centre: REGIONAL_CENTRES[0], title: "" });
  const [confirm, setConfirm] = useState(false);
  const valid = f.name.trim() && /^\S+@\S+\.\S+$/.test(f.email);
  return (
    <Dialog title="Create user" onClose={onClose} footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!valid} onClick={() => setConfirm(true)}>Review account…</Button></>}>
      <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
        <Field label="Full name" required htmlFor="cu-n"><input id="cu-n" className={inputCls} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="SLT email" required htmlFor="cu-e" error={f.email && !/^\S+@\S+\.\S+$/.test(f.email) ? "Enter a valid email." : undefined}><input id="cu-e" type="email" className={inputCls} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        <Field label="Role (exactly one)" required htmlFor="cu-r"><select id="cu-r" className={inputCls} value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as Role })}>{["Manager", "Technical Officer", "Group Manager", "Admin"].map((r) => <option key={r}>{r}</option>)}</select></Field>
        {f.role === "Group Manager" ? <Field label="Regional centre" required htmlFor="cu-c"><select id="cu-c" className={inputCls} value={f.centre} onChange={(e) => setF({ ...f, centre: e.target.value })}>{REGIONAL_CENTRES.map((r) => <option key={r}>{r}</option>)}</select></Field>
          : f.role !== "Admin" ? <Field label="Organisational scope (team)" required htmlFor="cu-t"><select id="cu-t" className={inputCls} value={f.team} onChange={(e) => setF({ ...f, team: e.target.value })}>{TEAMS.map((r) => <option key={r}>{r}</option>)}</select></Field> : <div />}
        <Field label="Job title" htmlFor="cu-ti"><input id="cu-ti" className={inputCls} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
        <div className="sm:col-span-2"><Notice kind="info">{f.role === "Group Manager" ? "Group Managers use a fixed restricted policy: assigned regional requests only. No permission matrix applies." : f.role === "Admin" ? "Admins manage system settings only and can never access complaint content." : `Inherits the ${f.role} template (default scope: ${f.role === "Manager" ? "Team" : "Assigned"}). Overrides can be added after creation.`}</Notice></div>
      </div>
      {confirm && <Confirm title="Create this account?" confirmLabel="Create account" onCancel={() => setConfirm(false)} consequence={<>{f.name} ({f.email}) will be able to sign in as <strong>{f.role}</strong>. Identity provisioning in a real directory requires backend integration.</>}
        onConfirm={() => { const r = act.createUser({ ...f, team: f.role === "Admin" ? "IT Operations" : f.team, centre: f.role === "Group Manager" ? f.centre : undefined }); setConfirm(false); if (r.ok) { toast("success", "Account created."); onCreated(r.id!); } else toast("error", r.error); }} />}
    </Dialog>
  );
}

function UserDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const { db, me, act, toast } = useStore();
  const u = db.users.find((x) => x.id === id)!;
  const [deact, setDeact] = useState(false);
  const [pending, setPending] = useState<null | { label: string; run: () => void }>(null);
  const biz = u.role === "Manager" || u.role === "Technical Officer";
  const apply = (label: string, patch: Parameters<typeof act.updateUserAccess>[1]) => setPending({ label, run: () => { const r = act.updateUserAccess(u.id, patch); r.ok ? toast("success", "Access updated. Takes effect immediately.") : toast("error", r.error); } });
  return (
    <Dialog size="lg" title={u.name} subtitle={`${u.role} · ${u.email}`} onClose={onClose}
      footer={<>{u.id !== me?.id && <Button variant={u.active ? "danger" : "success"} onClick={() => setDeact(true)}>{u.active ? "Deactivate account" : "Reactivate account"}</Button>}<Button onClick={onClose}>Done</Button></>}>
      <div className="space-y-5 px-6 py-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <KV label="Role">{u.role} <span className="text-xs text-ink-faint">(fixed after creation)</span></KV>
          {u.role === "Group Manager"
            ? <Field label="Regional centre" htmlFor="ud-c"><select id="ud-c" className={inputCls} value={u.centre} onChange={(e) => apply(`Move ${u.name} to ${e.target.value}`, { centre: e.target.value })}>{REGIONAL_CENTRES.map((r) => <option key={r}>{r}</option>)}</select></Field>
            : biz ? <Field label="Organisational scope" htmlFor="ud-t"><select id="ud-t" className={inputCls} value={u.team} onChange={(e) => apply(`Change ${u.name}'s team to ${e.target.value}`, { team: e.target.value })}>{TEAMS.map((r) => <option key={r}>{r}</option>)}</select></Field> : <KV label="Scope">System administration</KV>}
          {biz && (
            <Field label="Record scope" htmlFor="ud-s" hint={`Template default: ${db.templates[u.role as "Manager"].scope}`}>
              <select id="ud-s" className={inputCls} value={u.scopeOverride ?? ""} onChange={(e) => apply(`Set ${u.name}'s record scope to ${e.target.value || "template default"}`, { scopeOverride: (e.target.value || null) as Scope | null })}>
                <option value="">Inherit template</option>{u.role === "Technical Officer" && <option value="Assigned">Assigned (override)</option>}<option value="Team">Team (override)</option><option value="All">All business records (explicit grant)</option>
              </select>
            </Field>
          )}
        </div>
        {!biz ? <Notice kind="lock" title="Fixed policy">{u.role === "Group Manager" ? "Group Managers see only their assigned requests, limited shared context, employees from that centre and their own submissions. This policy is not editable." : "Admins manage users, permissions and system settings. Separation from complaint content is fixed."}</Notice> : (
          <section>
            <h3 className="mb-2 text-sm font-semibold">Capabilities</h3>
            <p className="mb-3 text-xs text-ink-faint">Inherited values come from the {u.role} template. Overrides apply to this user only and are audited.</p>
            <div className="max-h-[42vh] overflow-y-auto rounded-lg border border-line">
              {CAP_AREAS.map((area) => (
                <div key={area}>
                  <div className="sticky top-0 bg-panel px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">{area}</div>
                  {CAPS.filter((c) => c.area === area).map((c) => {
                    const st = capState(u, c.cap, db.templates);
                    const ov = u.overrides[c.cap];
                    return (
                      <div key={c.cap} className="flex flex-wrap items-center gap-2 border-t border-line px-3 py-2">
                        <span className="min-w-0 flex-1 text-sm">{c.label}</span>
                        {st.source === "ineligible" ? <span className="flex items-center gap-1 text-xs text-ink-faint"><Lock size={11} />Unavailable for {u.role}</span> : (
                          <>
                            <span className={`text-xs font-semibold ${st.allowed ? "text-st-resolved" : "text-st-breach"}`}>{st.allowed ? "✓ Allowed" : "✕ Denied"}</span>
                            <span className="text-[11px] text-ink-faint">{st.source === "override" ? "override" : "inherited"}</span>
                            <label className="sr-only" htmlFor={`ov-${c.cap}`}>Override for {c.label}</label>
                            <select id={`ov-${c.cap}`} className={`${inputCls} w-28 py-1 text-xs`} value={ov === undefined ? "" : ov ? "allow" : "deny"} onChange={(e) => apply(`${c.label} → ${e.target.value || "inherit"} for ${u.name}`, { override: { cap: c.cap, value: e.target.value === "" ? null : e.target.value === "allow" } })}>
                              <option value="">Inherit</option><option value="allow">Allow</option><option value="deny">Deny</option>
                            </select>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </section>
        )}
        <UIPreview user={u} templates={db.templates} />
      </div>
      {deact && <Confirm title={u.active ? `Deactivate ${u.name}?` : `Reactivate ${u.name}?`} confirmLabel={u.active ? "Deactivate account" : "Reactivate account"} variant={u.active ? "danger" : "success"} onCancel={() => setDeact(false)}
        consequence={u.active ? "They are signed out immediately and cannot sign in. Their records, history and assignments are preserved." : "They can sign in again with their existing role and scope."}
        onConfirm={() => { const r = act.setUserActive(u.id, !u.active); setDeact(false); r.ok ? toast("success", u.active ? "Account deactivated." : "Account reactivated.") : toast("error", r.error); }} />}
      {pending && <Confirm title="Apply access change?" confirmLabel="Apply change" onCancel={() => setPending(null)} onConfirm={() => { pending.run(); setPending(null); }} consequence={<>{pending.label}. Navigation, open dialogs, actions, notifications and exports update immediately for this user.</>} />}
    </Dialog>
  );
}

// Preview the sidebar and actions a user/template would get — no complaint data involved.
function UIPreview({ user, templates }: { user: User; templates: Templates }) {
  const groups = navFor(user, templates);
  const actions = (user.role === "Manager" || user.role === "Technical Officer") ? CAPS.filter((c) => capState(user, c.cap, templates).allowed && ["Intake", "Ownership", "Investigation", "Review", "Improvement", "Reports"].includes(c.area)) : [];
  return (
    <section className="rounded-lg border border-dashed border-line-strong bg-panel p-4">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold"><Eye size={14} className="text-slt-blue" />Resulting UI preview <span className="text-xs font-normal text-ink-faint">— structure only, no records</span></h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <div className="mb-1 text-[11px] font-semibold uppercase text-ink-faint">Sidebar</div>
          {groups.length ? groups.map((g) => <div key={g.id} className="mb-2"><div className="text-xs font-semibold text-ink-soft">{g.label}</div><ul className="ml-3 text-sm">{g.items.map((i) => <li key={i.key} className="flex items-center gap-1.5"><i.icon size={12} className="text-ink-faint" />{i.label}</li>)}</ul></div>) : <p className="text-sm text-ink-faint">No modules — user sees a “no access” page.</p>}
        </div>
        <div>
          <div className="mb-1 text-[11px] font-semibold uppercase text-ink-faint">Available actions</div>
          {actions.length ? <ul className="space-y-0.5 text-sm">{actions.map((a) => <li key={a.cap}>✓ {a.label}</li>)}</ul> : <p className="text-sm text-ink-faint">{user.role === "Group Manager" ? "Submit feedback on assigned requests." : user.role === "Admin" ? "Administration only." : "None."}</p>}
          {(user.role === "Manager" || user.role === "Technical Officer") && <p className="mt-2 text-xs text-ink-faint">Record scope: {scopeOf(user, templates)}. Actions also require lifecycle state and scope.</p>}
        </div>
      </div>
    </section>
  );
}

// ── Permission matrix (staged edits + confirmation) ──
function Matrix() {
  const { db, act, toast } = useStore();
  const [staged, setStaged] = useState<Templates>(() => structuredClone(db.templates));
  const [confirm, setConfirm] = useState(false);
  const [previewRole, setPreviewRole] = useState<"Manager" | "Technical Officer">("Technical Officer");
  const roles = ["Manager", "Technical Officer"] as const;
  const changes: { role: (typeof roles)[number]; cap: Cap | "scope"; value: boolean | Scope }[] = [];
  roles.forEach((r) => {
    CAPS.forEach((c) => { if (staged[r][c.cap] !== db.templates[r][c.cap]) changes.push({ role: r, cap: c.cap, value: staged[r][c.cap] }); });
    if (staged[r].scope !== db.templates[r].scope) changes.push({ role: r, cap: "scope", value: staged[r].scope });
  });
  const previewUser: User = { id: "preview", name: "Preview", initials: "PV", email: "", role: previewRole, title: "", team: TEAMS[0], active: true, overrides: {}, createdAt: "" };
  return (
    <div className="grid gap-4 2xl:grid-cols-[1fr_380px]">
      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-3">
          <div className="flex-1 text-sm text-ink-soft">{changes.length ? <strong className="text-st-progress">● {changes.length} unsaved change(s)</strong> : "✓ Templates saved"}</div>
          {changes.length > 0 && <><Button variant="ghost" onClick={() => setStaged(structuredClone(db.templates))}>Discard</Button><Button variant="primary" onClick={() => setConfirm(true)}>Review & apply…</Button></>}
        </div>
        <div className="max-w-full overflow-x-auto" role="region" aria-label="Permission matrix (scrolls horizontally)" tabIndex={0}>
          <table className="w-full min-w-[720px] text-sm">
            <caption className="sr-only">Permission templates by role</caption>
            <thead><tr className="border-b border-line bg-panel text-left text-[11px] uppercase tracking-wide text-ink-faint"><th className="px-4 py-2.5" scope="col">Capability</th><th className="px-3 py-2.5" scope="col">Manager</th><th className="px-3 py-2.5" scope="col">Technical Officer</th><th className="px-3 py-2.5" scope="col">Group Manager</th><th className="px-3 py-2.5" scope="col">Admin</th></tr></thead>
            <tbody>
              <tr className="border-b border-line bg-slt-blue-50/40">
                <td className="px-4 py-2 font-medium">Default record scope</td>
                {roles.map((r) => (
                  <td key={r} className="px-3 py-2"><label className="sr-only" htmlFor={`sc-${r}`}>{r} default scope</label>
                    <select id={`sc-${r}`} className={`${inputCls} w-36 py-1 text-xs`} value={staged[r].scope} onChange={(e) => setStaged({ ...staged, [r]: { ...staged[r], scope: e.target.value as Scope } })}>
                      {r === "Technical Officer" && <option value="Assigned">Assigned</option>}<option value="Team">Team</option><option value="All">All business records</option>
                    </select>
                  </td>
                ))}
                <td className="px-3 py-2 text-xs text-ink-faint">Assigned requests</td><td className="px-3 py-2 text-xs text-ink-faint">None</td>
              </tr>
              {CAP_AREAS.map((area) => [
                <tr key={area}><th colSpan={5} scope="colgroup" className="bg-panel px-4 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wide text-ink-faint">{area}</th></tr>,
                ...CAPS.filter((c) => c.area === area).map((c) => (
                  <tr key={c.cap} className="border-b border-line">
                    <td className="px-4 py-2">{c.label}{c.help && <span className="block text-[11px] text-ink-faint">{c.help}</span>}</td>
                    {roles.map((r) => (
                      <td key={r} className="px-3 py-2">
                        {c.eligible.includes(r) ? (
                          <label className="inline-flex items-center gap-2">
                            <input type="checkbox" checked={staged[r][c.cap]} onChange={(e) => setStaged({ ...staged, [r]: { ...staged[r], [c.cap]: e.target.checked } })} className="h-4 w-4 accent-[#0a4595]" />
                            <span className={`text-xs ${staged[r][c.cap] !== db.templates[r][c.cap] ? "font-semibold text-st-progress" : "text-ink-faint"}`}>{staged[r][c.cap] ? "On" : "Off"}{staged[r][c.cap] !== db.templates[r][c.cap] ? " · changed" : ""}</span>
                          </label>
                        ) : <span className="flex items-center gap-1 text-xs text-ink-faint" title="Hard role boundary"><Lock size={11} />Unavailable</span>}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-xs text-ink-faint">Fixed</td><td className="px-3 py-2 text-xs text-ink-faint">Fixed · none</td>
                  </tr>
                )),
              ])}
            </tbody>
          </table>
        </div>
      </Card>
      <div className="space-y-3">
        <div className="flex gap-2" role="radiogroup" aria-label="Preview role">{(["Manager", "Technical Officer"] as const).map((r) => <button key={r} role="radio" aria-checked={previewRole === r} onClick={() => setPreviewRole(r)} className={`rounded-md border px-3 py-1.5 text-sm ${previewRole === r ? "border-slt-blue bg-slt-blue-50 font-semibold text-slt-blue" : "border-line-strong"}`}>{r}</button>)}</div>
        <UIPreview user={previewUser} templates={staged} />
        <Notice kind="lock" title="Non-overridable boundaries">Only Managers register, correct originals, assign, return and close. Only Technical Officers investigate and resolve. Admin never accesses complaint content. Group Manager policy is fixed.</Notice>
      </div>
      {confirm && (
        <Confirm title="Apply permission template changes?" confirmLabel={`Apply ${changes.length} change(s)`} onCancel={() => setConfirm(false)}
          consequence="Every user inheriting these templates is affected immediately — navigation, open dialogs, data lists, notifications and exports. Per-user overrides still take precedence."
          onConfirm={() => { changes.forEach((c) => act.setTemplate(c.role, c.cap, c.value)); setConfirm(false); toast("success", "Templates updated."); }}>
          <ul className="max-h-48 space-y-1 overflow-y-auto text-sm">{changes.map((c, i) => <li key={i} className="rounded bg-panel px-2 py-1">{c.role}: {c.cap === "scope" ? "Default scope" : CAPS.find((x) => x.cap === c.cap)?.label} → <strong>{String(c.value === true ? "On" : c.value === false ? "Off" : c.value)}</strong></li>)}</ul>
        </Confirm>
      )}
    </div>
  );
}

// ── System settings ──
function SystemSettings() {
  const { db, act, toast } = useStore();
  const [s, setS] = useState(() => structuredClone(db.settings));
  const [types, setTypes] = useState(db.settings.attachment.types.join(", "));
  const [confirm, setConfirm] = useState(false);
  const [map, setMap] = useState<Record<string, string>>(() => ({ ...db.centreMap }));
  const gms = db.users.filter((u) => u.role === "Group Manager" && u.active);
  const dirty = JSON.stringify({ ...s.attachment, types: types.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean) }) !== JSON.stringify(db.settings.attachment) || s.dateFormat !== db.settings.dateFormat || JSON.stringify(map) !== JSON.stringify(db.centreMap);
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card><CardHeader title="Attachment limits" subtitle="Configurable demo limits — applied to every upload" />
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <div className="sm:col-span-2"><Field label="Allowed file extensions" htmlFor="ss-t" hint="Comma-separated. Executable and HTML/SVG types are always blocked."><input id="ss-t" className={inputCls} value={types} onChange={(e) => setTypes(e.target.value)} /></Field></div>
          <Field label="Maximum file size (MB)" htmlFor="ss-m"><input id="ss-m" type="number" min={1} max={100} className={inputCls} value={s.attachment.maxMb} onChange={(e) => setS({ ...s, attachment: { ...s.attachment, maxMb: Number(e.target.value) } })} /></Field>
          <Field label="Maximum files per record" htmlFor="ss-c"><input id="ss-c" type="number" min={1} max={50} className={inputCls} value={s.attachment.maxCount} onChange={(e) => setS({ ...s, attachment: { ...s.attachment, maxCount: Number(e.target.value) } })} /></Field>
        </div>
      </Card>
      <Card><CardHeader title="Time, dates & retention" />
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="Time zone" htmlFor="ss-tz" hint="Archive month boundaries use this zone."><input id="ss-tz" readOnly className={inputCls} value={s.timezone} /></Field>
          <Field label="Date format" htmlFor="ss-df"><select id="ss-df" className={inputCls} value={s.dateFormat} onChange={(e) => setS({ ...s, dateFormat: e.target.value })}><option>DD MMM YYYY</option><option>YYYY-MM-DD</option><option>DD/MM/YYYY</option></select></Field>
          <div className="sm:col-span-2"><Notice kind="lock" title={`Retention policy: ${s.retentionYears} years (display only)`}>Archive is a view designation. No automated deletion is implemented — permanent deletion requires an approved records policy and backend job.</Notice></div>
        </div>
      </Card>
      <Card className="xl:col-span-2"><CardHeader title="Regional centre → Group Manager mapping" subtitle="Used to route regional feedback requests. One Group Manager per centre." />
        <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">
          {REGIONAL_CENTRES.map((c) => <Field key={c} label={c} htmlFor={`cm-${c}`}><select id={`cm-${c}`} className={inputCls} value={map[c] ?? ""} onChange={(e) => setMap({ ...map, [c]: e.target.value })}><option value="">Unmapped</option>{gms.map((g) => <option key={g.id} value={g.id}>{g.name} ({g.centre})</option>)}</select></Field>)}
        </div>
      </Card>
      <div className="flex justify-end gap-2 xl:col-span-2">
        <Button variant="ghost" disabled={!dirty} onClick={() => { setS(structuredClone(db.settings)); setTypes(db.settings.attachment.types.join(", ")); setMap({ ...db.centreMap }); }}>Discard</Button>
        <Button variant="primary" disabled={!dirty} onClick={() => setConfirm(true)}>Save settings…</Button>
      </div>
      {confirm && <Confirm title="Save system settings?" confirmLabel="Save settings" onCancel={() => setConfirm(false)} consequence="New limits apply to future uploads; existing files are unaffected. Mapping changes route future regional requests only."
        onConfirm={() => {
          const t = types.split(",").map((x) => x.trim().toLowerCase().replace(/^\./, "")).filter(Boolean);
          act.updateSettings((x) => { x.attachment = { ...s.attachment, types: t }; x.dateFormat = s.dateFormat; }, "System settings changed");
          Object.entries(map).forEach(([c, g]) => { if (g && g !== db.centreMap[c]) act.setCentreMap(c, g); });
          setConfirm(false); toast("success", "Settings saved.");
        }} />}
    </div>
  );
}

// ── Integrations ──
function Integrations() {
  const { db, act, toast } = useStore();
  const [map, setMap] = useState(() => [...db.settings.senderMap]);
  const [add, setAdd] = useState<{ pattern: string; source: Source }>({ pattern: "", source: "TRC" });
  const [confirm, setConfirm] = useState<null | "map" | "fail">(null);
  const [testing, setTesting] = useState<string | null>(null);
  const dirty = JSON.stringify(map) !== JSON.stringify(db.settings.senderMap);
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        {db.settings.mailboxes.map((m) => (
          <Card key={m.id} className="p-5">
            <div className="flex items-start gap-3"><Mail size={18} className="mt-0.5 text-slt-blue" /><div className="flex-1"><h2 className="text-sm font-semibold">{m.label}</h2><p className="font-mono text-xs text-ink-soft">{m.address}</p></div><StatusPill ok={!db.settings.simulateSyncFailure} text={db.settings.simulateSyncFailure ? "Failing (simulated)" : m.status} /></div>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm"><KV label="Protocol">Microsoft Graph (hook)</KV><KV label="Client secret" mono>{m.secretMasked}</KV><KV label="Last sync">{relTime(m.lastSync)}</KV><KV label="Source rule">{m.id === "1212" ? "Mailbox origin → 1212 Mail" : "Sender mapping"}</KV></dl>
            <div className="mt-4 flex gap-2"><Button size="sm" loading={testing === m.id} onClick={() => { setTesting(m.id); setTimeout(() => { setTesting(null); toast(db.settings.simulateSyncFailure ? "error" : "success", db.settings.simulateSyncFailure ? "Connection test failed (simulated)." : "Connection test passed (simulated)."); }, 800); }}><Plug size={13} />Test connection</Button><DemoTag>Simulated</DemoTag></div>
          </Card>
        ))}
      </div>
      <Card className="p-5">
        <div className="flex flex-wrap items-center gap-3"><div className="flex-1"><h2 className="text-sm font-semibold">Failure simulation</h2><p className="text-xs text-ink-soft">Demo control: makes mailbox sync fail so Managers can see error and retry handling.</p></div>
          <Button variant={db.settings.simulateSyncFailure ? "success" : "danger"} onClick={() => setConfirm("fail")}>{db.settings.simulateSyncFailure ? "Restore healthy sync" : "Simulate sync failure"}</Button></div>
      </Card>
      <Card>
        <CardHeader title="Sender → source mapping" subtitle="Applies to the Other complaint mailbox. Messages in the 1212 mailbox are always 1212 Mail." action={dirty ? <Button size="sm" variant="primary" onClick={() => setConfirm("map")}>Save mapping…</Button> : undefined} />
        <ul className="divide-y divide-line">{map.map((m, i) => <li key={i} className="flex items-center gap-3 px-5 py-2.5 text-sm"><span className="flex-1 font-mono text-xs">{m.pattern}</span><span className="rounded bg-slt-blue-50 px-2 py-0.5 text-xs text-slt-blue-dark">{m.source}</span><button aria-label={`Remove ${m.pattern}`} onClick={() => setMap(map.filter((_, j) => j !== i))} className="text-ink-faint hover:text-st-breach"><Trash2 size={14} /></button></li>)}</ul>
        <form className="flex flex-wrap gap-2 border-t border-line p-3" onSubmit={(e) => { e.preventDefault(); if (!/^\S+@\S+$/.test(add.pattern)) return toast("error", "Enter a sender address."); setMap([...map, add]); setAdd({ pattern: "", source: "TRC" }); }}>
          <label htmlFor="sm-p" className="sr-only">Sender address</label><input id="sm-p" className={`${inputCls} max-w-xs`} placeholder="sender@domain" value={add.pattern} onChange={(e) => setAdd({ ...add, pattern: e.target.value })} />
          <label htmlFor="sm-s" className="sr-only">Source</label><select id="sm-s" className={`${inputCls} w-auto`} value={add.source} onChange={(e) => setAdd({ ...add, source: e.target.value as Source })}>{SOURCES.filter((s) => s !== "1212 Mail").map((s) => <option key={s}>{s}</option>)}</select>
          <Button type="submit" size="sm"><Plus size={14} />Add rule</Button>
        </form>
      </Card>
      <Card className="p-5">
        <h2 className="text-sm font-semibold">Identity directory & backend hooks</h2>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3"><KV label="Provider">{db.settings.directory.provider}</KV><KV label="Tenant">{db.settings.directory.tenant}</KV><KV label="Status">{db.settings.directory.status}</KV></dl>
        <ul className="mt-4 list-disc space-y-1 pl-5 text-xs text-ink-soft">
          <li>Auth: OIDC sign-in + server-side session; every service mutation must re-check the permission evaluator.</li>
          <li>Mail: Graph subscription per mailbox; persist messageId uniquely to prevent duplicate registration.</li>
          <li>Files: object storage + malware scanning before attachments become previewable.</li>
          <li>Notifications: server-side event bus with dedupe key per (event, recipient) and a scheduler for reminders.</li>
        </ul>
      </Card>
      {confirm === "map" && <Confirm title="Save sender mapping?" confirmLabel="Save mapping" onCancel={() => setConfirm(null)} consequence="Source detection for future emails in the Other complaint mailbox will use these rules. Existing cases are unaffected." onConfirm={() => { act.setSenderMap(map); setConfirm(null); toast("success", "Mapping saved."); }} />}
      {confirm === "fail" && <Confirm title={db.settings.simulateSyncFailure ? "Restore healthy sync?" : "Simulate sync failure?"} confirmLabel={db.settings.simulateSyncFailure ? "Restore" : "Simulate failure"} onCancel={() => setConfirm(null)} consequence="Demo-only control affecting the simulated mailbox sync for all Managers." onConfirm={() => { act.updateSettings((s) => { s.simulateSyncFailure = !s.simulateSyncFailure; }, "Integration: sync failure simulation toggled"); setConfirm(null); }} />}
    </div>
  );
}

// ── Notification settings ──
const EV_LABEL: Record<NotifEvent, string> = { assignment: "Case assigned", regional_request: "Regional request sent", regional_response: "Regional response received", pending_review: "Resolved — pending review", returned: "Returned for investigation", closed: "Case closed", training_assigned: "Training assigned", training_reminder: "Training reminder", training_review: "Training ready for review", system: "System health (admin)" };
const SAMPLE: Record<string, string> = { caseRef: "CT-0000-0000", requestRef: "FR-0000", actionRef: "TR-000", actor: "Sample User", dueDate: "01 Jan 2030", event: "Sample event" };
function NotificationSettings() {
  const { db, act, toast } = useStore();
  const [s, setS] = useState<Settings["notifications"]>(() => structuredClone(db.settings.notifications));
  const [rem, setRem] = useState(db.settings.reminderDays);
  const [prev, setPrev] = useState<NotifEvent | null>(null);
  const [confirm, setConfirm] = useState(false);
  const dirty = JSON.stringify(s) !== JSON.stringify(db.settings.notifications) || rem !== db.settings.reminderDays;
  const render = (t: string) => t.replace(/\{\{(\w+)\}\}/g, (_, k) => SAMPLE[k] ?? `{{${k}}}`);
  return (
    <div className="space-y-4">
      <Notice kind="info">In-app delivery is live in the demo. Email channel and scheduled reminders are simulated. Backend handoff: dedupe on (event, entity, recipient, cycle); reminders run on a server scheduler at the configured interval.</Notice>
      <Card>
        <div className="max-w-full overflow-x-auto" role="region" aria-label="Notification rules" tabIndex={0}>
          <table className="w-full min-w-[900px] text-sm">
            <caption className="sr-only">Notification rules</caption>
            <thead><tr className="border-b border-line bg-panel text-left text-[11px] uppercase tracking-wide text-ink-faint"><th className="px-4 py-2.5">Event</th><th className="px-3">Enabled</th><th className="px-3">Mandatory</th><th className="px-3">In-app</th><th className="px-3">Email (sim.)</th><th className="px-3">Recipients</th><th className="px-3">Template</th></tr></thead>
            <tbody>
              {(Object.keys(s) as NotifEvent[]).map((e) => (
                <tr key={e} className="border-b border-line align-top">
                  <td className="px-4 py-2.5 font-medium">{EV_LABEL[e]}{e === "system" && <span className="block text-[11px] font-normal text-ink-faint">Separate from business notifications</span>}</td>
                  {(["enabled", "mandatory", "inApp", "email"] as const).map((k) => <td key={k} className="px-3 py-2.5"><input type="checkbox" aria-label={`${EV_LABEL[e]} ${k}`} checked={s[e][k]} onChange={(ev) => setS({ ...s, [e]: { ...s[e], [k]: ev.target.checked } })} className="h-4 w-4 accent-[#0a4595]" /></td>)}
                  <td className="px-3 py-2.5"><label className="sr-only" htmlFor={`rc-${e}`}>Recipients</label><input id={`rc-${e}`} className={`${inputCls} py-1 text-xs`} value={s[e].recipients} onChange={(ev) => setS({ ...s, [e]: { ...s[e], recipients: ev.target.value } })} /></td>
                  <td className="px-3 py-2.5"><div className="flex gap-1"><label className="sr-only" htmlFor={`tp-${e}`}>Template</label><input id={`tp-${e}`} className={`${inputCls} py-1 text-xs`} value={s[e].template} onChange={(ev) => setS({ ...s, [e]: { ...s[e], template: ev.target.value } })} /><Button size="sm" variant="ghost" aria-label={`Preview ${EV_LABEL[e]}`} onClick={() => setPrev(e)}><Eye size={13} /></Button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-end gap-3 border-t border-line p-4">
          <Field label="Training reminder lead time (days before due)" htmlFor="ns-r"><input id="ns-r" type="number" min={0} max={30} className={`${inputCls} w-32`} value={rem} onChange={(e) => setRem(Number(e.target.value))} /></Field>
          <p className="text-xs text-ink-faint">Placeholders: {Object.keys(SAMPLE).map((k) => `{{${k}}}`).join(" ")}</p>
          <div className="ml-auto flex gap-2"><Button variant="ghost" disabled={!dirty} onClick={() => { setS(structuredClone(db.settings.notifications)); setRem(db.settings.reminderDays); }}>Discard</Button><Button variant="primary" disabled={!dirty} onClick={() => setConfirm(true)}>Save rules…</Button></div>
        </div>
      </Card>
      {prev && <Dialog title={`Template preview · ${EV_LABEL[prev]}`} size="sm" onClose={() => setPrev(null)} footer={<Button onClick={() => setPrev(null)}>Close</Button>}><div className="space-y-2 px-6 py-5"><p className="text-xs text-ink-faint">Rendered with synthetic placeholder values only.</p><div className="rounded-md border border-line bg-panel p-3 text-sm">{render(s[prev].template)}</div></div></Dialog>}
      {confirm && <Confirm title="Save notification rules?" confirmLabel="Save rules" onCancel={() => setConfirm(false)} consequence="Rules apply to future events. Mandatory events cannot be muted by users." onConfirm={() => { act.updateSettings((x) => { x.notifications = s; x.reminderDays = rem; }, "Notification rules changed"); setConfirm(false); toast("success", "Notification rules saved."); }} />}
    </div>
  );
}

// ── Technical audit ──
function Audit() {
  const { db } = useStore();
  const [cat, setCat] = useState("");
  const rows = db.audit.filter((a) => !cat || a.category === cat);
  return (
    <Card>
      <div className="flex items-center gap-2 border-b border-line p-3"><label htmlFor="au-c" className="sr-only">Category</label><select id="au-c" className={`${inputCls} w-auto`} value={cat} onChange={(e) => setCat(e.target.value)}><option value="">All categories</option>{["Account", "Permission", "Setting", "Integration", "Auth", "Job"].map((c) => <option key={c}>{c}</option>)}</select><span className="ml-auto text-xs text-ink-faint">{rows.length} events · business values excluded</span></div>
      <DataTable caption="Technical audit" rows={rows} rowKey={(a) => a.id} empty={<EmptyState title="No events" />}
        columns={[
          { key: "ts", header: "Time", render: (a) => <span className="whitespace-nowrap text-xs">{fmtDate(a.ts, true)}</span>, sortValue: (a) => a.ts },
          { key: "cat", header: "Category", render: (a) => <span className="rounded bg-panel px-1.5 py-0.5 text-[11px] font-semibold ring-1 ring-line">{a.category}</span> },
          { key: "actor", header: "Actor", render: (a) => <span className="text-sm">{a.actor}</span> },
          { key: "action", header: "Action", render: (a) => <span className="text-sm">{a.action}</span> },
          { key: "detail", header: "Detail", render: (a) => <span className="text-sm text-ink-soft">{a.detail ?? "—"}</span>, priority: 2 },
        ]} />
    </Card>
  );
}
