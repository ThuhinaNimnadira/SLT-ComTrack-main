import type { Complaint } from "../lib/types";
import { useStore } from "../store";
import { setParam } from "../nav";
import { feedbackState, fmtDate, ageDays } from "../lib/lifecycle";
import { isArchived, colomboMonthKey } from "../lib/permissions";
import { DataTable, StatusBadge, PriorityBadge, SourceTag, FeedbackBadge, ReviewBadge, OutcomeBadge, Avatar, LocationBadge, type Column } from "./ui";

export default function CaseTable({ rows, empty, archive, caption }: { rows: Complaint[]; empty: React.ReactNode; archive?: boolean; caption: string }) {
  const { db, userName } = useStore();
  const initials = (id: string | null) => (id ? userName(id).split(" ").map((p) => p[0]).join("").slice(0, 2) : null);
  const cols: Column<Complaint>[] = [
    { key: "id", header: "Case", render: (c) => c.id, sortValue: (c) => c.id },
    { key: "customer", header: "Customer / issue", render: (c) => (
      <div className="min-w-0 max-w-[280px]">
        <div className="truncate text-sm font-medium text-ink">{c.customer || <span className="text-ink-faint">Not recorded</span>}</div>
        <div className="truncate text-xs text-ink-faint">{c.issueType} · {c.category}</div>
      </div>
    ), sortValue: (c) => c.customer },
    { key: "source", header: "Source", render: (c) => <SourceTag source={c.source} legacy={c.legacySource} />, priority: 2, sortValue: (c) => c.source },
    { key: "priority", header: "Priority", render: (c) => <PriorityBadge priority={c.priority} />, sortValue: (c) => ["Critical", "High", "Medium", "Low"].indexOf(c.priority) },
    { key: "status", header: "Status", render: (c) => (
      <div className="flex flex-col items-start gap-1">
        <StatusBadge status={c.status} />
        <div className="flex flex-wrap gap-1"><FeedbackBadge state={feedbackState(c, db.requests)} /><ReviewBadge state={c.reviewState} /></div>
      </div>
    ), sortValue: (c) => c.status },
    { key: "outcome", header: "Outcome", render: (c) => <OutcomeBadge outcome={c.outcome} />, priority: 3 },
    { key: "owner", header: "Owner", render: (c) => <span className="flex items-center gap-2 whitespace-nowrap text-sm"><Avatar initials={initials(c.assignedTo)} size={22} />{userName(c.assignedTo)}</span>, priority: 2, sortValue: (c) => userName(c.assignedTo) },
    archive
      ? { key: "closed", header: "Closed / archive", render: (c) => <div className="text-xs"><div>{fmtDate(c.closedAt)}</div><LocationBadge label={c.archived ? "Manual" : colomboMonthKey(c.closedAt!)} /></div>, sortValue: (c) => c.closedAt ?? "" }
      : { key: "received", header: "Received", render: (c) => <div className="whitespace-nowrap text-xs text-ink-soft">{fmtDate(c.receivedAt)}{c.status !== "Closed" && <div className="text-ink-faint">{Math.floor(ageDays(c.receivedAt))} d old</div>}</div>, sortValue: (c) => c.receivedAt, priority: 2 },
  ];
  return (
    <DataTable caption={caption} rows={rows} columns={cols} rowKey={(c) => c.id} onRowClick={(c) => setParam("case", c.id)} rowLabel={(c) => `Open case ${c.id}`} empty={empty}
      card={(c) => (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2"><span className="font-mono text-[13px] font-semibold text-slt-blue">{c.id}</span><PriorityBadge priority={c.priority} /></div>
          <div className="text-sm font-medium text-ink">{c.customer || "Customer not recorded"}</div>
          <div className="text-xs text-ink-faint">{c.issueType} · {c.source} · {fmtDate(c.receivedAt)}</div>
          <div className="flex flex-wrap items-center gap-1.5"><StatusBadge status={c.status} /><FeedbackBadge state={feedbackState(c, db.requests)} /><ReviewBadge state={c.reviewState} />{c.status === "Closed" && isArchived(c) && <LocationBadge label="Archive" />}</div>
          <div className="text-xs text-ink-soft">Owner: {userName(c.assignedTo)}</div>
        </div>
      )} />
  );
}
