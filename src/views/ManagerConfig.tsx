import { useState } from "react";
import { ArrowUp, ArrowDown, Plus, Pencil, Check, X, Trash2, Info } from "lucide-react";
import { useStore } from "../store";
import type { BusinessLists, Cap } from "../lib/types";
import { Card, CardHeader, PageHeader, Button, inputCls, Notice, Confirm, Field } from "../components/ui";
import { go } from "../nav";

type ListKey = keyof BusinessLists;

function ListEditor({ list, title, desc, cap, refField }: { list: ListKey; title: string; desc: string; cap: Cap; refField?: (label: string) => number }) {
  const { db, act, toast } = useStore();
  const items = db.lists[list];
  const [edit, setEdit] = useState<{ id: string; label: string } | null>(null);
  const [add, setAdd] = useState("");
  const [confirm, setConfirm] = useState<null | { kind: "deactivate" | "delete" | "rename"; id: string; label?: string }>(null);
  const apply = (fn: (l: BusinessLists) => void, msg: string) => { const r = act.updateLists(fn, cap); r.ok ? toast("success", msg) : toast("error", r.error); };
  const move = (i: number, d: -1 | 1) => apply((l) => { const a = l[list]; [a[i], a[i + d]] = [a[i + d], a[i]]; }, "Order updated.");
  const dup = (label: string, id?: string) => items.some((x) => x.label.toLowerCase() === label.trim().toLowerCase() && x.id !== id);

  return (
    <Card>
      <CardHeader title={title} subtitle={desc} />
      <ul className="divide-y divide-line">
        {items.map((it, i) => {
          const refs = refField?.(it.label) ?? 0;
          return (
            <li key={it.id} className="flex flex-wrap items-center gap-2 px-4 py-2.5">
              <div className="flex flex-col">
                <button aria-label={`Move ${it.label} up`} disabled={i === 0} onClick={() => move(i, -1)} className="text-ink-faint hover:text-ink disabled:opacity-30"><ArrowUp size={13} /></button>
                <button aria-label={`Move ${it.label} down`} disabled={i === items.length - 1} onClick={() => move(i, 1)} className="text-ink-faint hover:text-ink disabled:opacity-30"><ArrowDown size={13} /></button>
              </div>
              {edit?.id === it.id ? (
                <>
                  <label htmlFor={`ed-${it.id}`} className="sr-only">Rename {it.label}</label>
                  <input id={`ed-${it.id}`} className={`${inputCls} max-w-xs py-1.5`} value={edit.label} onChange={(e) => setEdit({ ...edit, label: e.target.value })} autoFocus />
                  <Button size="sm" variant="primary" disabled={!edit.label.trim() || dup(edit.label, it.id)} onClick={() => setConfirm({ kind: "rename", id: it.id, label: edit.label })} aria-label="Save name"><Check size={14} /></Button>
                  <Button size="sm" variant="ghost" onClick={() => setEdit(null)} aria-label="Cancel rename"><X size={14} /></Button>
                  {dup(edit.label, it.id) && <span className="text-xs text-st-breach">Label already exists.</span>}
                </>
              ) : (
                <>
                  <span className={`flex-1 text-sm ${it.active ? "text-ink" : "text-ink-faint line-through"}`}>{it.label}</span>
                  {!it.active && <span className="rounded bg-st-closed-bg px-1.5 text-[11px] text-ink-soft">Inactive — kept for history</span>}
                  {refField && <span className="text-xs text-ink-faint">{refs} case{refs === 1 ? "" : "s"}</span>}
                  <Button size="sm" variant="ghost" onClick={() => setEdit({ id: it.id, label: it.label })} aria-label={`Rename ${it.label}`}><Pencil size={13} /></Button>
                  <Button size="sm" variant="ghost" onClick={() => it.active ? setConfirm({ kind: "deactivate", id: it.id }) : apply((l) => { l[list].find((x) => x.id === it.id)!.active = true; }, "Reactivated.")}>{it.active ? "Deactivate" : "Reactivate"}</Button>
                  {refs === 0 && refField && <Button size="sm" variant="ghost" onClick={() => setConfirm({ kind: "delete", id: it.id })} aria-label={`Delete ${it.label}`}><Trash2 size={13} /></Button>}
                </>
              )}
            </li>
          );
        })}
      </ul>
      <form className="flex gap-2 border-t border-line p-3" onSubmit={(e) => { e.preventDefault(); if (!add.trim() || dup(add)) return; apply((l) => { l[list].push({ id: `${list}-${Date.now()}`, label: add.trim(), active: true }); }, "Label added."); setAdd(""); }}>
        <label htmlFor={`add-${list}`} className="sr-only">New label</label>
        <input id={`add-${list}`} className={`${inputCls} py-1.5`} placeholder="New label" value={add} onChange={(e) => setAdd(e.target.value)} />
        <Button type="submit" size="sm" variant="primary" disabled={!add.trim() || dup(add)}><Plus size={14} />Add</Button>
      </form>
      {confirm?.kind === "rename" && (() => {
        const old = items.find((x) => x.id === confirm.id)!;
        const refs = refField?.(old.label) ?? 0;
        return <Confirm title="Rename label?" confirmLabel="Rename label" onCancel={() => setConfirm(null)}
          consequence={<>“{old.label}” becomes “{confirm.label}” for new records. {refs ? `${refs} existing case(s) keep their recorded value “${old.label}” so historical meaning is preserved.` : ""}</>}
          onConfirm={() => { apply((l) => { l[list].find((x) => x.id === confirm.id)!.label = confirm.label!.trim(); }, "Label renamed."); setConfirm(null); setEdit(null); }} />;
      })()}
      {confirm?.kind === "deactivate" && <Confirm title="Deactivate label?" confirmLabel="Deactivate" onCancel={() => setConfirm(null)} consequence="It will no longer be offered for new records. Existing records keep it and reports still show it." onConfirm={() => { apply((l) => { l[list].find((x) => x.id === confirm.id)!.active = false; }, "Deactivated."); setConfirm(null); }} />}
      {confirm?.kind === "delete" && <Confirm title="Delete unused label?" confirmLabel="Delete label" variant="danger" onCancel={() => setConfirm(null)} consequence="This label is not referenced by any case, so it can be removed." onConfirm={() => { apply((l) => { l[list] = l[list].filter((x) => x.id !== confirm.id); }, "Deleted."); setConfirm(null); }} />}
    </Card>
  );
}

export default function ManagerConfig({ tab }: { tab: "categories" | "settings" }) {
  const { db, me, can, act, toast } = useStore();
  const [rp, setRp] = useState({ name: "", recipients: "" });
  const countBy = (field: "category" | "issueType") => (label: string) => db.complaints.filter((c) => c[field] === label || c.original[field] === label).length;
  if (tab === "categories") {
    return (
      <>
        <PageHeader crumbs={["Manager Configuration", "Complaint Categories"]} title="Complaint categories" description="Only Managers can change category labels. Referenced labels cannot be deleted — deactivate them instead so historical records keep their meaning." />
        <div className="max-w-3xl"><ListEditor list="categories" title="Categories" desc="Order is used in registration forms and reports." cap="config.categories" refField={countBy("category")} /></div>
      </>
    );
  }
  const myPresets = db.queuePresets.filter((p) => p.ownerId === me?.id);
  const myRecipients = db.recipientPresets.filter((p) => p.ownerId === me?.id);
  return (
    <>
      <PageHeader crumbs={["Manager Configuration", "Business Settings"]} title="Business settings" description="Approved business lists and your presets. Technical, user, integration and global notification settings are managed by Administration." />
      <div className="mb-4"><Notice kind="info">Separation of duties: Managers maintain business vocabulary here; Administrators manage users, permissions, mailboxes, attachment limits and mandatory notification rules.</Notice></div>
      <div className="grid gap-4 xl:grid-cols-2">
        <ListEditor list="issueTypes" title="Issue labels" desc="Offered at registration." cap="config.settings" refField={countBy("issueType")} />
        <ListEditor list="correctiveActions" title="Resolution / corrective-action labels" desc="Quick-add options in investigations." cap="config.settings" />
        <ListEditor list="trainingTypes" title="Training action types" desc="Used when proposing development actions." cap="config.settings" />
        <Card>
          <CardHeader title="Presets" subtitle="Personal queue presets and report-recipient presets" />
          <div className="space-y-4 p-4">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Queue presets</h3>
              {myPresets.length ? <ul className="mt-2 space-y-1">{myPresets.map((p) => <li key={p.id} className="flex items-center gap-2 text-sm"><span className="flex-1">{p.name} <span className="text-xs text-ink-faint">({p.view})</span></span><button aria-label={`Delete ${p.name}`} onClick={() => act.savePreset("queuePresets", { delete: p.id })} className="text-ink-faint hover:text-st-breach"><Trash2 size={13} /></button></li>)}</ul> : <p className="mt-1 text-sm text-ink-faint">Save presets from any complaint list using its filters.</p>}
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Report recipient presets</h3>
              <ul className="mt-2 space-y-1">{myRecipients.map((p) => <li key={p.id} className="flex items-center gap-2 text-sm"><span className="flex-1"><strong>{p.name}</strong> — <span className="text-ink-soft">{p.recipients}</span></span><button aria-label={`Delete ${p.name}`} onClick={() => act.savePreset("recipientPresets", { delete: p.id })} className="text-ink-faint hover:text-st-breach"><Trash2 size={13} /></button></li>)}</ul>
              {can("config.settings") && (
                <form className="mt-2 grid gap-2 sm:grid-cols-[1fr_2fr_auto]" onSubmit={(e) => { e.preventDefault(); const r = act.savePreset("recipientPresets", { id: `RP-${Date.now()}`, ownerId: me!.id, ...rp }); r.ok ? toast("success", "Recipient preset saved.") : toast("error", r.error); setRp({ name: "", recipients: "" }); }}>
                  <Field label="Name" htmlFor="rp-name"><input id="rp-name" className={inputCls} value={rp.name} onChange={(e) => setRp({ ...rp, name: e.target.value })} /></Field>
                  <Field label="Recipients" htmlFor="rp-rec" hint="Semicolon-separated. Email delivery is simulated."><input id="rp-rec" className={inputCls} value={rp.recipients} onChange={(e) => setRp({ ...rp, recipients: e.target.value })} /></Field>
                  <div className="self-start pt-6"><Button type="submit" size="sm" variant="primary" disabled={!rp.name.trim() || !rp.recipients.trim()}>Add</Button></div>
                </form>
              )}
            </div>
            <button onClick={() => go("profile")} className="flex items-center gap-1.5 text-sm font-semibold text-slt-blue hover:underline"><Info size={14} />Personal notification preferences</button>
          </div>
        </Card>
      </div>
    </>
  );
}
