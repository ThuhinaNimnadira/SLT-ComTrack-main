import { useState } from "react";
import { useStore } from "../store";
import type { FeedbackRequest } from "../lib/types";
import { Card, PageHeader, DataTable, EmptyState, type Column } from "../components/ui";
import { fmtDate, ageDays } from "../lib/lifecycle";
import { setParam } from "../nav";
import { Send, CheckCheck, Clock } from "lucide-react";

export default function RegionalFeedback() {
  const { db, visibleComplaints, userName } = useStore();
  const [tab, setTab] = useState<"Pending" | "Submitted">("Pending");

  const ids = new Set(visibleComplaints.map((c) => c.id));
  const pendingRows = db.requests.filter((r) => ids.has(r.complaintId) && r.status === "Pending").sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
  const submittedRows = db.requests.filter((r) => ids.has(r.complaintId) && r.status === "Submitted").sort((a, b) => (b.response?.submittedAt ?? b.requestedAt).localeCompare(a.response?.submittedAt ?? a.requestedAt));

  const rows = tab === "Pending" ? pendingRows : submittedRows;

  const cols: Column<FeedbackRequest>[] = [
    { key: "case", header: "Case", render: (r) => <span className="font-mono font-semibold text-slt-blue">{r.complaintId}</span>, sortValue: (r) => r.complaintId },
    { key: "id", header: "Request ID", render: (r) => <span className="font-mono text-xs text-ink-faint">{r.id}</span> },
    {
      key: "centre",
      header: "Regional Centre / RCC Manager",
      render: (r) => (
        <div>
          <div className="text-sm font-medium text-ink">{r.centre}</div>
          <div className="text-xs text-ink-faint">{userName(r.groupManagerId)}</div>
        </div>
      ),
      sortValue: (r) => r.centre,
    },
    { key: "by", header: "Requested by", render: (r) => <span className="text-sm">{userName(r.requestedBy)}</span>, priority: 2 },
    {
      key: "when",
      header: tab === "Pending" ? "Waiting" : "Responded",
      render: (r) =>
        tab === "Pending" ? (
          <span className={`text-sm font-semibold ${ageDays(r.requestedAt) > 2 ? "text-st-breach" : "text-ink-soft"}`}>
            {ageDays(r.requestedAt).toFixed(1)} d
          </span>
        ) : (
          <span className="text-sm text-st-resolved font-medium">{fmtDate(r.response?.submittedAt, true)}</span>
        ),
      sortValue: (r) => r.requestedAt,
    },
    {
      key: "info",
      header: tab === "Pending" ? "Information required" : "Response summary",
      render: (r) => (
        <span className="line-clamp-2 max-w-sm text-sm text-ink-soft">
          {tab === "Pending" ? r.infoRequired : (r.response?.feedback || r.infoRequired)}
        </span>
      ),
      priority: 3,
    },
  ];

  return (
    <>
      <PageHeader
        crumbs={["Complaints", "Regional Feedback"]}
        title="Regional Feedback"
        description="Monitor feedback requests sent to RCC Regional Managers. Select any request to view its case workspace."
      />

      {/* Side-by-side selection tabs */}
      <div className="mb-4 flex items-center gap-2 border-b border-line pb-2">
        <button
          onClick={() => setTab("Pending")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            tab === "Pending"
              ? "bg-slt-blue text-white shadow-sm"
              : "bg-surface text-ink-soft hover:bg-panel hover:text-ink border border-line"
          }`}
        >
          <Clock size={15} />
          <span>Pending Requests</span>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
              tab === "Pending" ? "bg-white/20 text-white" : "bg-panel text-ink"
            }`}
          >
            {pendingRows.length}
          </span>
        </button>

        <button
          onClick={() => setTab("Submitted")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            tab === "Submitted"
              ? "bg-slt-blue text-white shadow-sm"
              : "bg-surface text-ink-soft hover:bg-panel hover:text-ink border border-line"
          }`}
        >
          <CheckCheck size={15} />
          <span>Submitted Responses</span>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
              tab === "Submitted" ? "bg-white/20 text-white" : "bg-panel text-ink"
            }`}
          >
            {submittedRows.length}
          </span>
        </button>
      </div>

      <Card>
        <DataTable
          caption="Regional feedback requests"
          rows={rows}
          columns={cols}
          rowKey={(r) => r.id}
          onRowClick={(r) => setParam("case", r.complaintId)}
          rowLabel={(r) => `Open case ${r.complaintId}`}
          empty={
            <EmptyState
              icon={tab === "Pending" ? Send : CheckCheck}
              title={tab === "Pending" ? "No pending regional requests" : "No submitted regional responses yet"}
              body={
                tab === "Pending"
                  ? "When an investigation requires regional assistance, the request will appear here."
                  : undefined
              }
            />
          }
          card={(r) => (
            <div>
              <div className="flex justify-between">
                <span className="font-mono text-sm font-semibold text-slt-blue">{r.complaintId}</span>
                <span className="text-xs text-ink-faint">{r.id}</span>
              </div>
              <div className="text-sm text-ink">{r.centre} · {userName(r.groupManagerId)}</div>
              <div className="text-xs text-ink-faint">
                {tab === "Pending"
                  ? `Requested ${fmtDate(r.requestedAt, true)}`
                  : `Responded ${fmtDate(r.response?.submittedAt, true)}`}
              </div>
            </div>
          )}
        />
      </Card>
    </>
  );
}
