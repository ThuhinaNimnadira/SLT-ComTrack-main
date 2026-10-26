import { useState, useMemo } from "react";
import { useStore } from "../store";
import { Card, PageHeader, EmptyState, inputCls, Button, TrainingBadge } from "../components/ui";
import CaseTable from "../components/CaseTable";
import { isOverdue, fmtDate } from "../lib/lifecycle";
import { go } from "../nav";
import { Search, X, CheckCircle2, AlertTriangle, Clock, ClipboardCheck, UserCheck, Flame } from "lucide-react";
import { OUTCOMES, PRIORITIES } from "../lib/types";

type TOStatusTab = "all" | "returned" | "active" | "resolved" | "closed";
type MgrStatusTab = "pendingReview" | "critical" | "returned" | "all";

export default function MyWork() {
  const { visibleComplaints: cs, me, db, canSeeTraining } = useStore();
  const isTO = me?.role === "Technical Officer";

  const [q, setQ] = useState("");
  const [toTab, setToTab] = useState<TOStatusTab>("all");
  const [mgrTab, setMgrTab] = useState<MgrStatusTab>("pendingReview");
  const [outcome, setOutcome] = useState<string>("");
  const [priority, setPriority] = useState<string>("");

  // ── Technical Officer Personal Scope ──────────────────────────────────────────
  const toCases = useMemo(() => {
    if (!me) return [];
    return cs.filter(
      (c) =>
        c.assignedTo === me.id ||
        c.registeredBy === me.name ||
        c.history.some((h) => h.actor === me.name)
    );
  }, [cs, me]);

  const toCounts = useMemo(() => {
    return {
      all: toCases.length,
      returned: toCases.filter((c) => c.reviewState === "Returned" && c.status === "In Progress").length,
      active: toCases.filter((c) => c.status === "Open" || c.status === "In Progress").length,
      resolved: toCases.filter((c) => c.status === "Resolved").length,
      closed: toCases.filter((c) => c.status === "Closed").length,
    };
  }, [toCases]);

  // ── Manager Decision Scope ───────────────────────────────────────────────────
  const mgrCounts = useMemo(() => {
    return {
      pendingReview: cs.filter((c) => c.status === "Resolved").length,
      critical: cs.filter((c) => c.status === "In Progress" && (c.priority === "Critical" || c.priority === "High")).length,
      returned: cs.filter((c) => c.reviewState === "Returned" && c.status === "In Progress").length,
      all: cs.length,
    };
  }, [cs]);

  // ── Filtered Rows ────────────────────────────────────────────────────────────
  const rows = useMemo(() => {
    if (isTO) {
      return toCases.filter((c) => {
        if (toTab === "active" && c.status !== "Open" && c.status !== "In Progress") return false;
        if (toTab === "returned" && !(c.reviewState === "Returned" && c.status === "In Progress")) return false;
        if (toTab === "resolved" && c.status !== "Resolved") return false;
        if (toTab === "closed" && c.status !== "Closed") return false;

        if (outcome && c.outcome !== outcome) return false;
        if (priority && c.priority !== priority) return false;

        if (q.trim()) {
          const s = q.toLowerCase();
          const match =
            c.id.toLowerCase().includes(s) ||
            c.customer.toLowerCase().includes(s) ||
            c.sltNumber.toLowerCase().includes(s) ||
            c.issueType.toLowerCase().includes(s) ||
            (c.employee?.name && c.employee.name.toLowerCase().includes(s));
          if (!match) return false;
        }

        return true;
      }).sort((a, b) => {
        if (a.reviewState === "Returned" && b.reviewState !== "Returned") return -1;
        if (b.reviewState === "Returned" && a.reviewState !== "Returned") return 1;
        return (b.closedAt ?? b.receivedAt).localeCompare(a.closedAt ?? a.receivedAt);
      });
    }

    // Manager View
    return cs.filter((c) => {
      if (mgrTab === "pendingReview" && c.status !== "Resolved") return false;
      if (mgrTab === "critical" && !(c.status === "In Progress" && (c.priority === "Critical" || c.priority === "High"))) return false;
      if (mgrTab === "returned" && !(c.reviewState === "Returned" && c.status === "In Progress")) return false;

      if (outcome && c.outcome !== outcome) return false;
      if (priority && c.priority !== priority) return false;

      if (q.trim()) {
        const s = q.toLowerCase();
        const match =
          c.id.toLowerCase().includes(s) ||
          c.customer.toLowerCase().includes(s) ||
          c.sltNumber.toLowerCase().includes(s) ||
          c.issueType.toLowerCase().includes(s) ||
          (c.employee?.name && c.employee.name.toLowerCase().includes(s));
        if (!match) return false;
      }

      return true;
    }).sort((a, b) => {
      if (a.priority === "Critical" && b.priority !== "Critical") return -1;
      if (b.priority === "Critical" && a.priority !== "Critical") return 1;
      return (b.closedAt ?? b.receivedAt).localeCompare(a.closedAt ?? a.receivedAt);
    });
  }, [cs, toCases, isTO, toTab, mgrTab, outcome, priority, q]);

  // Training items
  const tr = db.training.filter(
    (t) =>
      canSeeTraining(t) &&
      (isTO
        ? t.ownerId === me!.id && ["Approved", "In Progress", "Needs Changes"].includes(t.status)
        : ["Proposed", "Completed"].includes(t.status))
  );

  const isFiltered = q.trim() || outcome || priority || (isTO ? toTab !== "all" : mgrTab !== "pendingReview");

  return (
    <>
      <PageHeader
        crumbs={["Overview", "My Work"]}
        title="My work"
        description={
          isTO
            ? "Your complete personal workspace — complaints assigned to you, returned cases, and already completed investigations."
            : "Manager action desk — cases submitted for your review, high-priority investigations, and training approvals."
        }
      />

      {/* Role-Personalized Quick Filter Tabs */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {isTO ? (
          <>
            <button
              onClick={() => setToTab("all")}
              className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors ${
                toTab === "all"
                  ? "bg-slt-blue text-white shadow-sm"
                  : "border border-line bg-surface text-ink-soft hover:bg-panel hover:text-ink"
              }`}
            >
              All my cases
              <span className={`rounded-full px-2 py-0.5 text-[11px] ${toTab === "all" ? "bg-white/20 text-white" : "bg-panel text-ink"}`}>
                {toCounts.all}
              </span>
            </button>

            {toCounts.returned > 0 && (
              <button
                onClick={() => setToTab("returned")}
                className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors ${
                  toTab === "returned"
                    ? "bg-st-breach text-white shadow-sm"
                    : "border border-st-breach/30 bg-st-breach-bg/30 text-st-breach hover:bg-st-breach-bg"
                }`}
              >
                <AlertTriangle size={13} />
                Returned by Manager
                <span className="rounded-full bg-st-breach px-2 py-0.5 text-[11px] text-white">
                  {toCounts.returned}
                </span>
              </button>
            )}

            <button
              onClick={() => setToTab("active")}
              className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors ${
                toTab === "active"
                  ? "bg-slt-blue text-white shadow-sm"
                  : "border border-line bg-surface text-ink-soft hover:bg-panel hover:text-ink"
              }`}
            >
              <Clock size={13} />
              In Progress / Active
              <span className={`rounded-full px-2 py-0.5 text-[11px] ${toTab === "active" ? "bg-white/20 text-white" : "bg-panel text-ink"}`}>
                {toCounts.active}
              </span>
            </button>

            <button
              onClick={() => setToTab("resolved")}
              className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors ${
                toTab === "resolved"
                  ? "bg-slt-blue text-white shadow-sm"
                  : "border border-line bg-surface text-ink-soft hover:bg-panel hover:text-ink"
              }`}
            >
              Pending Review
              <span className={`rounded-full px-2 py-0.5 text-[11px] ${toTab === "resolved" ? "bg-white/20 text-white" : "bg-panel text-ink"}`}>
                {toCounts.resolved}
              </span>
            </button>

            <button
              onClick={() => setToTab("closed")}
              className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors ${
                toTab === "closed"
                  ? "bg-slt-blue text-white shadow-sm"
                  : "border border-line bg-surface text-ink-soft hover:bg-panel hover:text-ink"
              }`}
            >
              <CheckCircle2 size={13} />
              Completed & Closed
              <span className={`rounded-full px-2 py-0.5 text-[11px] ${toTab === "closed" ? "bg-white/20 text-white" : "bg-panel text-ink"}`}>
                {toCounts.closed}
              </span>
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => setMgrTab("pendingReview")}
              className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors ${
                mgrTab === "pendingReview"
                  ? "bg-slt-blue text-white shadow-sm"
                  : "border border-line bg-surface text-ink-soft hover:bg-panel hover:text-ink"
              }`}
            >
              <ClipboardCheck size={13} />
              Pending Your Review
              <span className={`rounded-full px-2 py-0.5 text-[11px] ${mgrTab === "pendingReview" ? "bg-white/20 text-white" : "bg-panel text-ink"}`}>
                {mgrCounts.pendingReview}
              </span>
            </button>

            <button
              onClick={() => setMgrTab("critical")}
              className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors ${
                mgrTab === "critical"
                  ? "bg-slt-blue text-white shadow-sm"
                  : "border border-line bg-surface text-ink-soft hover:bg-panel hover:text-ink"
              }`}
            >
              <Flame size={13} />
              Critical & High In Progress
              <span className={`rounded-full px-2 py-0.5 text-[11px] ${mgrTab === "critical" ? "bg-white/20 text-white" : "bg-panel text-ink"}`}>
                {mgrCounts.critical}
              </span>
            </button>

            {mgrCounts.returned > 0 && (
              <button
                onClick={() => setMgrTab("returned")}
                className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors ${
                  mgrTab === "returned"
                    ? "bg-slt-blue text-white shadow-sm"
                    : "border border-line bg-surface text-ink-soft hover:bg-panel hover:text-ink"
                }`}
              >
                <AlertTriangle size={13} />
                Returned to Officers
                <span className={`rounded-full px-2 py-0.5 text-[11px] ${mgrTab === "returned" ? "bg-white/20 text-white" : "bg-panel text-ink"}`}>
                  {mgrCounts.returned}
                </span>
              </button>
            )}

            <button
              onClick={() => setMgrTab("all")}
              className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors ${
                mgrTab === "all"
                  ? "bg-slt-blue text-white shadow-sm"
                  : "border border-line bg-surface text-ink-soft hover:bg-panel hover:text-ink"
              }`}
            >
              All complaints
              <span className={`rounded-full px-2 py-0.5 text-[11px] ${mgrTab === "all" ? "bg-white/20 text-white" : "bg-panel text-ink"}`}>
                {mgrCounts.all}
              </span>
            </button>
          </>
        )}
      </div>

      <div className="space-y-4">
        {/* Main Work Table Card with Integrated Search & Filter Controls */}
        <Card>
          <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
            <div className="relative min-w-[220px] flex-1">
              <label htmlFor="mywork-q" className="sr-only">Filter cases</label>
              <Search size={15} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
              <input
                id="mywork-q"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by case ID, customer, SLT number, employee…"
                className={`${inputCls} pl-9`}
              />
            </div>

            <label htmlFor="mywork-priority" className="sr-only">Priority</label>
            <select
              id="mywork-priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className={`${inputCls} w-auto`}
            >
              <option value="">All priorities</option>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>

            <label htmlFor="mywork-outcome" className="sr-only">Outcome</label>
            <select
              id="mywork-outcome"
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
              className={`${inputCls} w-auto`}
            >
              <option value="">All outcomes</option>
              {OUTCOMES.map((o) => (
                <option key={o} value={o}>{o === "Pending" ? "Pending outcome" : o}</option>
              ))}
            </select>

            {isFiltered && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setQ("");
                  if (isTO) setToTab("all"); else setMgrTab("pendingReview");
                  setOutcome("");
                  setPriority("");
                }}
              >
                <X size={14} /> Clear filters
              </Button>
            )}

            <span className="ml-auto text-xs text-ink-faint">
              Showing {rows.length} of {isTO ? toCases.length : cs.length}
            </span>
          </div>

          <CaseTable
            caption={isTO ? "My Work" : "Manager Work"}
            rows={rows}
            empty={
              <EmptyState
                icon={CheckCircle2}
                title={isFiltered ? "No matching cases found" : "Nothing waiting here"}
                body={isFiltered ? "Try resetting your search or tab filters." : undefined}
              />
            }
          />
        </Card>

        {/* Training Actions Card */}
        <Card>
          <div className="flex items-center justify-between border-b border-line p-4">
            <h2 className="text-sm font-semibold text-ink">
              {isTO ? "My training & coaching actions" : "Training awaiting approval or review"}
            </h2>
            <button
              onClick={() => go(isTO ? "training/mine" : "training/all")}
              className="text-xs font-semibold text-slt-blue hover:underline"
            >
              Open Improvement
            </button>
          </div>
          {tr.length ? (
            <ul className="divide-y divide-line">
              {tr.map((t) => (
                <li key={t.id}>
                  <button
                    onClick={() => go(isTO ? "training/mine" : "training/all", { tr: t.id })}
                    className="flex w-full flex-wrap items-center gap-3 px-5 py-3 text-left hover:bg-panel"
                  >
                    <span className="font-mono text-[13px] font-semibold text-slt-blue">{t.id}</span>
                    <span className="min-w-0 flex-1 text-sm">{t.type} · {t.employee.name}</span>
                    <TrainingBadge status={t.status} overdue={isOverdue(t)} />
                    <span className="text-xs text-ink-faint">
                      {t.dueDate ? `Due ${fmtDate(t.dueDate)}` : "No due date"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-4 text-center text-xs text-ink-faint">
              {isTO ? "No training actions assigned to you." : "No training actions awaiting your approval or review."}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
