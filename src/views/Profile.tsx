import { useStore } from "../store";
import type { NotifEvent, Cap } from "../lib/types";
import { CAPS, capState, scopeOf } from "../lib/permissions";
import { Card, CardHeader, PageHeader, KV, Avatar, Notice } from "../components/ui";

const EVENTS: { id: NotifEvent; label: string; roles: string[] }[] = [
  { id: "assignment", label: "Case assigned to me", roles: ["Technical Officer"] },
  { id: "regional_request", label: "New regional feedback request", roles: ["Group Manager"] },
  { id: "regional_response", label: "Regional response received", roles: ["Technical Officer"] },
  { id: "pending_review", label: "Case awaiting my review", roles: ["Manager"] },
  { id: "returned", label: "Case returned for investigation", roles: ["Technical Officer"] },
  { id: "closed", label: "Case closed", roles: ["Technical Officer"] },
  { id: "training_assigned", label: "Training action assigned", roles: ["Technical Officer", "Manager"] },
  { id: "training_reminder", label: "Training reminders", roles: ["Technical Officer", "Manager"] },
  { id: "training_review", label: "Training ready for review / approval", roles: ["Manager"] },
  { id: "system", label: "System health events", roles: ["Admin"] },
];

export default function Profile() {
  const { me, db, act, toast } = useStore();
  if (!me) return null;
  const muted = db.prefs[me.id]?.muted ?? [];
  const mine = EVENTS.filter((e) => e.roles.includes(me.role));
  const biz = me.role === "Manager" || me.role === "Technical Officer";
  const effective = biz ? CAPS.filter((c) => capState(me, c.cap as Cap, db.templates).allowed) : [];
  return (
    <>
      <PageHeader crumbs={["Account", "Profile"]} title="Profile & notification preferences" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Account" />
          <div className="flex items-start gap-4 p-5">
            <Avatar initials={me.initials} size={48} />
            <dl className="grid flex-1 gap-3 sm:grid-cols-2">
              <KV label="Name">{me.name}</KV><KV label="Email">{me.email}</KV><KV label="Role">{me.role}</KV>
              <KV label={me.role === "Group Manager" ? "Regional centre" : "Organisational scope"}>{me.role === "Group Manager" ? me.centre : me.team}</KV>
              {biz && <KV label="Record scope">{scopeOf(me, db.templates) === "All" ? "All business records" : scopeOf(me, db.templates) === "Team" ? "Team" : "Assigned to me"}</KV>}
            </dl>
          </div>
          {biz && <div className="border-t border-line px-5 py-4"><h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">Effective permissions ({effective.length})</h3><div className="flex flex-wrap gap-1.5">{effective.map((c) => <span key={c.cap} className="rounded-md bg-slt-blue-50 px-2 py-0.5 text-[11px] text-slt-blue-dark">{c.label}</span>)}</div></div>}
        </Card>
        <Card>
          <CardHeader title="Notification preferences" subtitle="Mandatory events are set by your administrator and cannot be turned off." />
          <ul className="divide-y divide-line">
            {mine.map((e) => {
              const rule = db.settings.notifications[e.id];
              const on = rule.enabled && (rule.mandatory || !muted.includes(e.id));
              return (
                <li key={e.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="flex-1"><div className="text-sm font-medium">{e.label}</div><div className="text-xs text-ink-faint">{!rule.enabled ? "Disabled by administrator" : rule.mandatory ? "Mandatory" : "Optional"} · In-app{rule.email ? " · email (simulated)" : ""}</div></div>
                  <label className="relative inline-flex cursor-pointer items-center">
                    <input type="checkbox" className="peer sr-only" checked={on} disabled={!rule.enabled || rule.mandatory} onChange={(ev) => { act.setMuted(e.id, !ev.target.checked); toast("success", "Preference saved."); }} aria-label={e.label} />
                    <span className="h-5 w-9 rounded-full bg-line-strong transition-colors peer-checked:bg-slt-blue peer-disabled:opacity-50 peer-focus-visible:ring-2 peer-focus-visible:ring-slt-blue peer-focus-visible:ring-offset-1" />
                    <span className="absolute left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
                  </label>
                </li>
              );
            })}
          </ul>
          <div className="p-4"><Notice kind="info">In-app notifications work in this demo. Outbound email and scheduled reminders are simulated until a mail service is connected.</Notice></div>
        </Card>
      </div>
    </>
  );
}
