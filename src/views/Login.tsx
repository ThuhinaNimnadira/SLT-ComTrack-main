import { useState } from "react";
import { ShieldCheck, Lock, User as UserIcon, ArrowRight, FlaskConical, Info } from "lucide-react";
import logo from "../assets/slt-logo.png";
import { Button, Field, inputCls, Avatar, DemoTag, Notice } from "../components/ui";
import { useStore } from "../store";
import type { Role } from "../lib/types";

const ROLE_BLURB: Record<Role, string> = {
  Admin: "Users, permissions, integrations — no complaint data",
  Manager: "Registration, assignment, review & closure",
  "Technical Officer": "Investigation, regional requests, resolution",
  "Group Manager": "Restricted regional feedback workspace",
};

export default function Login() {
  const { db, login, sessionNotice } = useStore();
  const [email, setEmail] = useState("dilrukshi.r@slt.lk");
  const [pw, setPw] = useState("demo");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const demo = db.users.filter((u) => u.role !== "Group Manager" || !u.id.startsWith("u-gm") || ["u-gm-kandy", "u-gm-galle"].includes(u.id));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const u = db.users.find((x) => x.email.toLowerCase() === email.trim().toLowerCase());
    if (!email.trim() || !pw) return setErr("Enter your SLT email and password.");
    if (!u) return setErr("No demo account matches that email. Choose one of the demo accounts.");
    if (!u.active) return setErr("This account is deactivated. Contact your administrator.");
    setErr("");
    setLoading(true);
    setTimeout(() => login(u.id), 450);
  }

  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[1fr_1.1fr]">
      <div className="relative hidden overflow-hidden bg-slt-blue lg:flex lg:flex-col lg:justify-between lg:p-12 lg:text-white">
        <div className="pointer-events-none absolute inset-0 opacity-[0.16]" style={{ backgroundImage: "radial-gradient(circle at 15% 20%, #0aa5e0 0, transparent 42%), radial-gradient(circle at 85% 75%, #58a733 0, transparent 45%)" }} />
        <div className="pointer-events-none absolute inset-0 opacity-[0.06]" style={{ backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)", backgroundSize: "44px 44px" }} />
        <div className="relative inline-flex w-fit rounded-lg bg-white px-3 py-2"><img src={logo} alt="SLT Mobitel" className="h-7 w-auto" /></div>
        <div className="relative max-w-md">
          <div className="mb-3 font-mono text-xs uppercase tracking-[0.2em] text-white/60">ComTrack · Contact Centre</div>
          <h1 className="text-3xl font-bold leading-tight xl:text-4xl">Complaint Management &amp; Tracking</h1>
          <p className="mt-4 text-[15px] leading-relaxed text-white/80">
            One accountable record from regulator, executive and 1212 Mail intake through investigation, regional feedback, Manager review and archive — replacing the spreadsheet.
          </p>
          <ol className="mt-8 flex flex-wrap items-center gap-2 text-xs font-semibold">
            {["Open", "In Progress", "Resolved", "Closed"].map((s, i) => (
              <li key={s} className="flex items-center gap-2">
                <span className="rounded-full bg-white/12 px-3 py-1.5 ring-1 ring-white/20">{s}</span>
                {i < 3 && <ArrowRight size={14} className="text-white/50" aria-hidden />}
              </li>
            ))}
          </ol>
        </div>
        <div className="relative flex items-center gap-2 text-[12px] text-white/70"><ShieldCheck size={15} aria-hidden /> Authorised SLT personnel only · access events are audited</div>
      </div>

      <div className="flex items-center justify-center bg-ground p-5 sm:p-10">
        <div className="w-full max-w-lg">
          <div className="mb-6 flex justify-center lg:hidden"><img src={logo} alt="SLT Mobitel" className="h-9 w-auto" /></div>
          <h2 className="text-xl font-bold text-ink">Sign in to ComTrack</h2>
          <p className="mt-1 text-sm text-ink-soft">Use your SLT enterprise account.</p>
          {sessionNotice && <div className="mt-4"><Notice kind="info">{sessionNotice}</Notice></div>}

          <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
            <Field label="SLT email" required htmlFor="login-email">
              <div className="relative">
                <UserIcon size={16} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
                <input id="login-email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} className={`${inputCls} pl-9`} />
              </div>
            </Field>
            <Field label="Password" required htmlFor="login-pw" hint="Demo: any non-empty password is accepted.">
              <div className="relative">
                <Lock size={16} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
                <input id="login-pw" type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} className={`${inputCls} pl-9`} />
              </div>
            </Field>
            {err && <Notice kind="error">{err}</Notice>}
            <Button type="submit" variant="primary" className="w-full" loading={loading}>{loading ? "Signing in…" : <>Sign in <ArrowRight size={16} /></>}</Button>
          </form>

          <div className="mt-7 rounded-xl border border-line bg-white">
            <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-ink"><FlaskConical size={15} className="text-st-progress" aria-hidden />Demo accounts</div>
              <DemoTag>Mock login</DemoTag>
            </div>
            <ul className="grid max-h-[340px] grid-cols-1 overflow-y-auto sm:grid-cols-2">
              {demo.map((u) => (
                <li key={u.id} className="border-b border-line sm:odd:border-r">
                  <button disabled={!u.active} onClick={() => login(u.id)} className="flex w-full items-start gap-2.5 px-4 py-3 text-left transition-colors hover:bg-slt-blue-50/60 disabled:opacity-50">
                    <Avatar initials={u.initials} size={30} />
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-semibold text-ink">{u.name}{!u.active && " (inactive)"}</span>
                      <span className="block text-[11px] font-medium text-slt-blue">{u.role}{u.id === "u-mgr1" ? " · All records scope" : ""}</span>
                      <span className="block text-[11px] leading-snug text-ink-faint">{u.role === "Group Manager" ? u.centre : u.team} — {ROLE_BLURB[u.role]}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div className="mt-4 flex items-start gap-2 rounded-md bg-slt-blue-50 px-3 py-2.5 text-[11px] leading-relaxed text-slt-blue-dark">
            <Info size={14} className="mt-0.5 shrink-0" aria-hidden />
            Prototype: identity, server-side authorisation and SSO require backend integration. Frontend permission checks here demonstrate behaviour only.
          </div>
        </div>
      </div>
    </div>
  );
}
