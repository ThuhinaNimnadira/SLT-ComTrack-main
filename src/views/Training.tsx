import { useMemo, useState } from "react";
import {
  GraduationCap, Bell, Check, X as XIcon, Play, Flag, Undo2, UserCheck, Search,
  UserPlus, FilePlus2, FolderOpen, ArrowRight, Sparkles, Building2, User,
  Plus, History, ExternalLink, ShieldCheck, ChevronRight, CornerDownRight,
} from "lucide-react";
import { useStore } from "../store";
import type { TrainingAction, Complaint, Employee, Priority } from "../lib/types";
import { TRAINING_STATUSES, PRIORITIES } from "../lib/types";
import { HEAD_OFFICE, REGIONAL_CENTRES, HEAD_OFFICE_EMPLOYEES, REGIONAL_EMPLOYEES } from "../lib/seed";
import {
  Card, PageHeader, DataTable, EmptyState, TrainingBadge, PriorityBadge, StatusBadge,
  OutcomeBadge, Dialog, Button, KV, Field, inputCls, Confirm, SectionTitle, type Column, Avatar,
} from "../components/ui";
import { AttachmentList, Uploader, PreviewPanel } from "../components/Attachments";
import { isOverdue, fmtDate } from "../lib/lifecycle";
import { useRoute, setParam } from "../nav";
import type { AttachmentMeta } from "../lib/types";
import { RegisterForm } from "./Register";

export default function Training({
  mine = false,
  initialSub,
  initialTab,
}: {
  mine?: boolean;
  initialSub?: "assign" | "track";
  initialTab?: "complaints" | "register" | "training";
}) {
  const { db, me, can, act, toast, canSeeTraining, userName, visibleComplaints } = useStore();
  const route = useRoute();

  const subFromUrl = (route.params.get("sub") as "assign" | "track" | null);
  const tabFromUrl = (route.params.get("tab") as "complaints" | "register" | "training" | null);
  const empFromUrl = route.params.get("emp");

  const [mode, setMode] = useState<"assign" | "track">(() => {
    if (mine) return "track";
    if (initialSub) return initialSub;
    if (subFromUrl) return subFromUrl;
    return "assign";
  });

  const allEmployees: Employee[] = useMemo(() => {
    return db.employees && db.employees.length > 0
      ? db.employees
      : [...HEAD_OFFICE_EMPLOYEES, ...REGIONAL_EMPLOYEES];
  }, [db.employees]);

  // Selected employee state
  const [selectedEmpId, setSelectedEmpId] = useState<string | null>(() => {
    if (empFromUrl) {
      const match = allEmployees.find(
        (e) => e.serviceNo.toLowerCase() === empFromUrl.toLowerCase() || e.name.toLowerCase() === empFromUrl.toLowerCase()
      );
      if (match) return match.serviceNo;
    }
    // Default to the first employee with cases if in assign mode
    const empWithCases = allEmployees.find((e) =>
      db.complaints.some((c) => c.employee?.serviceNo === e.serviceNo || c.employee?.name === e.name)
    );
    return empWithCases?.serviceNo ?? allEmployees[0]?.serviceNo ?? null;
  });

  const selectedEmployee = useMemo(() => {
    return allEmployees.find((e) => e.serviceNo === selectedEmpId) ?? null;
  }, [allEmployees, selectedEmpId]);

  // Search in Assign Employee
  const [empSearch, setEmpSearch] = useState("");
  const [centreFilter, setCentreFilter] = useState("");

  // Sub-tab inside Assign Employee
  const [assignTab, setAssignTab] = useState<"complaints" | "register" | "training">(() => {
    if (initialTab) return initialTab;
    if (tabFromUrl) return tabFromUrl;
    return "complaints";
  });

  // Modal states
  const [showNewEmpModal, setShowNewEmpModal] = useState(false);
  const [newEmpForm, setNewEmpForm] = useState({
    name: "",
    serviceNo: "",
    centre: HEAD_OFFICE,
    group: "Broadband Team A",
  });
  const [showProposeModal, setShowProposeModal] = useState(false);
  const [proposeForm, setProposeForm] = useState({
    gap: "",
    type: "Coaching",
    objective: "",
    priority: "Medium" as Priority,
  });

  // Filtered employees for search
  const filteredEmployees = useMemo(() => {
    const q = empSearch.trim().toLowerCase();
    return allEmployees.filter((e) => {
      const matchQ =
        !q ||
        e.name.toLowerCase().includes(q) ||
        e.serviceNo.toLowerCase().includes(q) ||
        e.group.toLowerCase().includes(q);
      const matchCentre = !centreFilter || e.centre === centreFilter;
      return matchQ && matchCentre;
    });
  }, [allEmployees, empSearch, centreFilter]);

  // Complaints of selected employee
  const selectedEmpComplaints = useMemo(() => {
    if (!selectedEmployee) return [];
    return db.complaints.filter((c) =>
      c.employee?.serviceNo === selectedEmployee.serviceNo ||
      c.employee?.name?.toLowerCase() === selectedEmployee.name.toLowerCase()
    );
  }, [db.complaints, selectedEmployee]);

  // Training actions of selected employee
  const selectedEmpTraining = useMemo(() => {
    if (!selectedEmployee) return [];
    return db.training.filter((t) =>
      t.employee?.serviceNo === selectedEmployee.serviceNo ||
      t.employee?.name?.toLowerCase() === selectedEmployee.name.toLowerCase()
    );
  }, [db.training, selectedEmployee]);

  // Fault outcomes count
  const faultCount = useMemo(() => {
    return selectedEmpComplaints.filter((c) => c.outcome === "Officer's Fault").length;
  }, [selectedEmpComplaints]);

  // Track Employee state
  const [status, setStatus] = useState("");
  const [overdue, setOverdue] = useState(false);
  const base = db.training.filter((t) => canSeeTraining(t) && (!mine || t.ownerId === me?.id));
  const trackRows = base.filter((t) => (!status || t.status === status) && (!overdue || isOverdue(t))).sort((a, b) => b.proposedAt.localeCompare(a.proposedAt));

  const openId = route.params.get("tr");
  const open = db.training.find((t) => t.id === openId);

  const cols: Column<TrainingAction>[] = [
    { key: "id", header: "Action", render: (t) => t.id, sortValue: (t) => t.id },
    { key: "emp", header: "Employee / gap", render: (t) => <div className="max-w-xs"><div className="text-sm font-medium">{t.employee.name}</div><div className="truncate text-xs text-ink-faint">{t.gap}</div></div> },
    { key: "type", header: "Type", render: (t) => <span className="text-sm">{t.type}</span>, priority: 2 },
    { key: "owner", header: "Owner", render: (t) => <span className="text-sm">{userName(t.ownerId)}</span>, priority: 2 },
    { key: "prio", header: "Priority", render: (t) => <PriorityBadge priority={t.priority} />, priority: 3 },
    { key: "due", header: "Due", render: (t) => <span className="whitespace-nowrap text-sm">{fmtDate(t.dueDate)}</span>, sortValue: (t) => t.dueDate ?? "" },
    { key: "status", header: "Status", render: (t) => <TrainingBadge status={t.status} overdue={isOverdue(t)} />, sortValue: (t) => t.status },
  ];

  // Employee Complaints Columns
  const complaintCols: Column<Complaint>[] = [
    {
      key: "id",
      header: "Case ID",
      render: (c) => (
        <button
          type="button"
          onClick={() => setParam("case", c.id)}
          className="font-mono text-xs font-semibold text-slt-blue underline hover:text-slt-blue-dark"
        >
          {c.id}
        </button>
      ),
      sortValue: (c) => c.id,
    },
    { key: "sltNumber", header: "Service / SLT No.", render: (c) => <span className="font-mono text-xs font-medium">{c.sltNumber}</span> },
    { key: "customer", header: "Customer", render: (c) => <span className="text-sm font-medium text-ink">{c.customer || "—"}</span> },
    {
      key: "issue",
      header: "Issue / Category",
      render: (c) => (
        <div>
          <div className="text-xs font-medium text-ink">{c.issueType}</div>
          <div className="text-[11px] text-ink-faint">{c.category}</div>
        </div>
      ),
    },
    { key: "priority", header: "Priority", render: (c) => <PriorityBadge priority={c.priority} /> },
    { key: "outcome", header: "Outcome", render: (c) => <OutcomeBadge outcome={c.outcome} /> },
    { key: "status", header: "Status", render: (c) => <StatusBadge status={c.status} /> },
    {
      key: "registeredAt",
      header: "Date",
      render: (c) => <span className="whitespace-nowrap text-xs text-ink-soft">{fmtDate(c.registeredAt)}</span>,
      sortValue: (c) => c.registeredAt,
    },
    {
      key: "action",
      header: "Action",
      render: (c) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setParam("case", c.id)}
          className="text-xs"
        >
          <ExternalLink size={13} />
          Open
        </Button>
      ),
    },
  ];

  const handleCreateEmployee = () => {
    if (!newEmpForm.name.trim() || !newEmpForm.serviceNo.trim()) {
      toast("error", "Name and Employee ID / Service number are required.");
      return;
    }
    const r = act.addEmployee({
      name: newEmpForm.name.trim(),
      serviceNo: newEmpForm.serviceNo.trim().toUpperCase(),
      centre: newEmpForm.centre,
      group: newEmpForm.group.trim() || "General",
    });
    if (r.ok) {
      toast("success", `Added employee ${newEmpForm.name} (${newEmpForm.serviceNo.toUpperCase()}).`);
      setSelectedEmpId(newEmpForm.serviceNo.trim().toUpperCase());
      setShowNewEmpModal(false);
      setNewEmpForm({ name: "", serviceNo: "", centre: HEAD_OFFICE, group: "Broadband Team A" });
    } else {
      toast("error", r.error);
    }
  };

  const handleProposeAction = () => {
    if (!selectedEmployee) return;
    if (!proposeForm.gap.trim() || !proposeForm.objective.trim()) {
      toast("error", "Skill gap and objective are required.");
      return;
    }
    const r = act.proposeForEmployee(selectedEmployee, proposeForm);
    if (r.ok) {
      toast("success", `Proposed coaching action ${r.id} for ${selectedEmployee.name}.`);
      setShowProposeModal(false);
      setProposeForm({ gap: "", type: "Coaching", objective: "", priority: "Medium" });
      setAssignTab("training");
    } else {
      toast("error", r.error);
    }
  };

  return (
    <>
      <PageHeader
        crumbs={["Improvement", mine ? "My Assigned Actions" : "Training & Coaching"]}
        title={mine ? "My assigned actions" : "Training & Coaching"}
        description="Employee Coaching, Performance Assignment & Investigation Findings Development Actions."
        actions={
          <div className="flex items-center gap-2">
            {!mine && (
              <Button
                variant="primary"
                onClick={() => {
                  setMode("assign");
                  setShowNewEmpModal(true);
                }}
              >
                <UserPlus size={15} />
                Add New Employee
              </Button>
            )}
          </div>
        }
      />

      {/* Main Mode Switcher: Assign Employee vs Track Employee */}
      {!mine && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface p-1.5 shadow-sm">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                setMode("assign");
                setParam("sub", "assign");
              }}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
                mode === "assign"
                  ? "bg-slt-blue text-white shadow-sm"
                  : "text-ink-soft hover:bg-panel hover:text-ink"
              }`}
            >
              <UserCheck size={16} />
              <span>Assign Employee</span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                mode === "assign" ? "bg-white/20 text-white" : "bg-slt-blue-50 text-slt-blue"
              }`}>
                {allEmployees.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setMode("track");
                setParam("sub", "track");
              }}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
                mode === "track"
                  ? "bg-slt-blue text-white shadow-sm"
                  : "text-ink-soft hover:bg-panel hover:text-ink"
              }`}
            >
              <GraduationCap size={16} />
              <span>Track Employee</span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                mode === "track" ? "bg-white/20 text-white" : "bg-panel text-ink-soft"
              }`}>
                {base.length}
              </span>
            </button>
          </div>

          <div className="pr-2 text-xs text-ink-faint">
            {mode === "assign" ? "Search, view complaints & register cases for employees" : "Monitor coaching actions & lifecycle transitions"}
          </div>
        </div>
      )}

      {/* ── PART 1: ASSIGN EMPLOYEE ─────────────────────────────────── */}
      {mode === "assign" && (
        <div className="space-y-5">
          {/* Employee Search & Quick Directory Bar */}
          <Card className="p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative min-w-[260px] flex-1">
                <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
                <input
                  type="text"
                  value={empSearch}
                  onChange={(e) => setEmpSearch(e.target.value)}
                  placeholder="Search by Employee ID (e.g. SN-104582) or Employee Name..."
                  className={`${inputCls} pl-9 font-medium`}
                />
                {empSearch && (
                  <button
                    type="button"
                    onClick={() => setEmpSearch("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-faint hover:text-ink"
                  >
                    Clear
                  </button>
                )}
              </div>

              <div className="w-auto">
                <select
                  value={centreFilter}
                  onChange={(e) => setCentreFilter(e.target.value)}
                  className={`${inputCls} w-auto`}
                >
                  <option value="">All Centres / Branches</option>
                  <option value={HEAD_OFFICE}>{HEAD_OFFICE}</option>
                  {REGIONAL_CENTRES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <Button variant="secondary" onClick={() => setShowNewEmpModal(true)}>
                <Plus size={15} />
                New Employee
              </Button>
            </div>

            {/* Quick Suggestions list when searching or browsing */}
            {empSearch && (
              <div className="mt-3 max-h-56 overflow-y-auto rounded-lg border border-line bg-panel p-2">
                <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-ink-faint px-2">
                  Search Results ({filteredEmployees.length})
                </div>
                {filteredEmployees.length === 0 ? (
                  <div className="p-3 text-center text-xs text-ink-faint">
                    No employee found matching "{empSearch}".{" "}
                    <button
                      type="button"
                      onClick={() => {
                        setNewEmpForm((f) => ({ ...f, name: empSearch }));
                        setShowNewEmpModal(true);
                      }}
                      className="font-semibold text-slt-blue underline"
                    >
                      Add as new employee
                    </button>
                  </div>
                ) : (
                  <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
                    {filteredEmployees.map((e) => {
                      const cCount = db.complaints.filter(
                        (c) => c.employee?.serviceNo === e.serviceNo || c.employee?.name === e.name
                      ).length;
                      const isSel = selectedEmpId === e.serviceNo;
                      return (
                        <button
                          key={e.serviceNo}
                          type="button"
                          onClick={() => {
                            setSelectedEmpId(e.serviceNo);
                            setEmpSearch("");
                          }}
                          className={`flex items-center gap-2.5 rounded-md p-2 text-left transition-all ${
                            isSel ? "border border-slt-blue bg-slt-blue-50/80 text-slt-blue" : "hover:bg-surface border border-transparent"
                          }`}
                        >
                          <Avatar initials={e.name.split(" ").map((x) => x[0]).slice(0, 2).join("")} size={28} />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-xs font-semibold text-ink">{e.name}</div>
                            <div className="truncate text-[11px] font-mono text-ink-soft">{e.serviceNo} · {e.centre}</div>
                          </div>
                          <span className="rounded bg-panel px-1.5 py-0.5 text-[10px] font-semibold text-ink-soft">
                            {cCount} cases
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </Card>

          {/* Selected Employee Dashboard Card */}
          {selectedEmployee ? (
            <div className="space-y-4">
              {/* Profile Card Header */}
              <div className="relative overflow-hidden rounded-xl border border-line bg-surface p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-slt-blue to-slt-blue-dark text-xl font-bold text-white shadow-md">
                      {selectedEmployee.name.split(" ").map((x) => x[0]).slice(0, 2).join("")}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-bold text-ink">{selectedEmployee.name}</h2>
                        <span className="rounded-md border border-slt-blue/30 bg-slt-blue-50 px-2.5 py-0.5 font-mono text-xs font-bold text-slt-blue">
                          {selectedEmployee.serviceNo}
                        </span>
                        <span className="rounded-md border border-line bg-panel px-2 py-0.5 text-xs font-medium text-ink-soft">
                          {selectedEmployee.centre}
                        </span>
                      </div>
                      <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-soft">
                        <Building2 size={13} className="text-ink-faint" />
                        <span>Department / Team: <strong>{selectedEmployee.group}</strong></span>
                      </p>
                    </div>
                  </div>

                  {/* Summary Metric Counters */}
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="rounded-lg border border-line bg-panel px-3.5 py-2 text-center">
                      <div className="text-xs font-medium text-ink-faint">Total Complaints</div>
                      <div className="text-base font-bold text-ink">{selectedEmpComplaints.length}</div>
                    </div>
                    <div className="rounded-lg border border-line bg-panel px-3.5 py-2 text-center">
                      <div className="text-xs font-medium text-ink-faint">Officer's Fault</div>
                      <div className={`text-base font-bold ${faultCount > 0 ? "text-st-breach" : "text-st-resolved"}`}>
                        {faultCount}
                      </div>
                    </div>
                    <div className="rounded-lg border border-line bg-panel px-3.5 py-2 text-center">
                      <div className="text-xs font-medium text-ink-faint">Coaching Actions</div>
                      <div className="text-base font-bold text-slt-blue">{selectedEmpTraining.length}</div>
                    </div>
                  </div>
                </div>

                {/* Sub-tabs: Complaints vs Register Complaint vs Coaching Actions */}
                <div className="mt-6 flex flex-wrap border-b border-line">
                  <button
                    type="button"
                    onClick={() => setAssignTab("complaints")}
                    className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition-all ${
                      assignTab === "complaints"
                        ? "border-slt-blue text-slt-blue"
                        : "border-transparent text-ink-soft hover:border-line hover:text-ink"
                    }`}
                  >
                    <FolderOpen size={16} />
                    <span>Entire Complaints</span>
                    <span className="rounded-full bg-slt-blue-50 px-2 py-0.5 text-xs font-bold text-slt-blue">
                      {selectedEmpComplaints.length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAssignTab("register")}
                    className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition-all ${
                      assignTab === "register"
                        ? "border-slt-blue text-slt-blue"
                        : "border-transparent text-ink-soft hover:border-line hover:text-ink"
                    }`}
                  >
                    <FilePlus2 size={16} />
                    <span>Register Complaint Portal</span>
                    <span className="rounded-md bg-st-open-bg px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-st-open">
                      Cut & Pasted
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAssignTab("training")}
                    className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition-all ${
                      assignTab === "training"
                        ? "border-slt-blue text-slt-blue"
                        : "border-transparent text-ink-soft hover:border-line hover:text-ink"
                    }`}
                  >
                    <GraduationCap size={16} />
                    <span>Coaching & Training</span>
                    <span className="rounded-full bg-panel px-2 py-0.5 text-xs font-bold text-ink-soft">
                      {selectedEmpTraining.length}
                    </span>
                  </button>

                  <div className="ml-auto flex items-center gap-2 pb-2">
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => setAssignTab("register")}
                    >
                      <FilePlus2 size={14} />
                      + Register Complaint
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setShowProposeModal(true)}
                    >
                      <Sparkles size={14} />
                      Propose Coaching
                    </Button>
                  </div>
                </div>

                {/* Tab 1: Entire Complaints */}
                {assignTab === "complaints" && (
                  <div className="pt-4">
                    <DataTable
                      caption={`All complaints associated with ${selectedEmployee.name}`}
                      rows={selectedEmpComplaints}
                      columns={complaintCols}
                      rowKey={(c) => c.id}
                      onRowClick={(c) => setParam("case", c.id)}
                      rowLabel={(c) => `View complaint ${c.id}`}
                      empty={
                        <EmptyState
                          icon={FolderOpen}
                          title={`No complaints found for ${selectedEmployee.name}`}
                          body="There are currently no recorded complaints assigned or linked to this employee."
                          action={
                            <Button variant="primary" onClick={() => setAssignTab("register")}>
                              <FilePlus2 size={15} />
                              Register Complaint for {selectedEmployee.name}
                            </Button>
                          }
                        />
                      }
                    />
                  </div>
                )}

                {/* Tab 2: Register Complaint Portal (Cut & Pasted here!) */}
                {assignTab === "register" && (
                  <div className="pt-4">
                    <div className="mb-4 rounded-lg border border-slt-blue/30 bg-slt-blue-50/50 p-4">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slt-blue">
                        <FilePlus2 size={17} />
                        <span>Registering Complaint for Employee: {selectedEmployee.name} ({selectedEmployee.serviceNo})</span>
                      </div>
                      <p className="mt-1 text-xs text-ink-soft">
                        This complaint will be registered in the system and automatically mapped to this employee. Once submitted, it will immediately show in the employee's Entire Complaints tab.
                      </p>
                    </div>

                    <RegisterForm
                      employee={selectedEmployee}
                      onDone={(id) => {
                        setAssignTab("complaints");
                        setParam("case", id);
                      }}
                    />
                  </div>
                )}

                {/* Tab 3: Coaching & Training Actions */}
                {assignTab === "training" && (
                  <div className="space-y-4 pt-4">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold text-ink">
                        Assigned Development & Coaching Actions ({selectedEmpTraining.length})
                      </div>
                      <Button size="sm" variant="primary" onClick={() => setShowProposeModal(true)}>
                        <Sparkles size={14} />
                        Propose New Coaching Action
                      </Button>
                    </div>

                    <DataTable
                      caption="Training actions"
                      rows={selectedEmpTraining}
                      columns={cols}
                      rowKey={(t) => t.id}
                      onRowClick={(t) => setParam("tr", t.id)}
                      rowLabel={(t) => `Open action ${t.id}`}
                      empty={
                        <EmptyState
                          icon={GraduationCap}
                          title="No coaching actions recorded"
                          body={`No development or refresher actions are currently proposed for ${selectedEmployee.name}.`}
                          action={
                            <Button variant="primary" onClick={() => setShowProposeModal(true)}>
                              <Sparkles size={14} />
                              Propose Coaching Action
                            </Button>
                          }
                        />
                      }
                    />
                  </div>
                )}
              </div>
            </div>
          ) : (
            <Card className="p-8 text-center">
              <EmptyState
                icon={UserCheck}
                title="Select or Search an Employee"
                body="Use the search bar above or choose an employee from the directory to review their complaints and register new ones."
                action={
                  <Button variant="primary" onClick={() => setShowNewEmpModal(true)}>
                    <UserPlus size={15} />
                    Add New Employee
                  </Button>
                }
              />
            </Card>
          )}

          {/* Directory of All Employees Grid */}
          <div className="mt-8 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-ink">
                All Employees Directory ({filteredEmployees.length})
              </h3>
              <span className="text-xs text-ink-faint">Click any employee to view complaints and manage registration</span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredEmployees.map((e) => {
                const cCount = db.complaints.filter(
                  (c) => c.employee?.serviceNo === e.serviceNo || c.employee?.name === e.name
                ).length;
                const trCount = db.training.filter(
                  (t) => t.employee?.serviceNo === e.serviceNo || t.employee?.name === e.name
                ).length;
                const isSelected = selectedEmpId === e.serviceNo;

                return (
                  <button
                    key={e.serviceNo}
                    type="button"
                    onClick={() => {
                      setSelectedEmpId(e.serviceNo);
                      window.scrollTo({ top: 120, behavior: "smooth" });
                    }}
                    className={`group flex flex-col justify-between rounded-xl border p-4 text-left transition-all ${
                      isSelected
                        ? "border-slt-blue bg-slt-blue-50/50 shadow-sm ring-1 ring-slt-blue/30"
                        : "border-line bg-surface hover:border-slt-blue/40 hover:shadow-sm"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <Avatar initials={e.name.split(" ").map((x) => x[0]).slice(0, 2).join("")} size={32} />
                        <span className="font-mono text-xs font-bold text-slt-blue">
                          {e.serviceNo}
                        </span>
                      </div>
                      <div className="mt-2.5">
                        <h4 className="text-sm font-bold text-ink group-hover:text-slt-blue transition-colors">
                          {e.name}
                        </h4>
                        <p className="truncate text-xs text-ink-soft">{e.group}</p>
                        <p className="text-[11px] text-ink-faint">{e.centre}</p>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t border-line/60 pt-2 text-xs">
                      <span className="flex items-center gap-1 font-medium text-ink-soft">
                        <FolderOpen size={12} />
                        <strong>{cCount}</strong> case{cCount === 1 ? "" : "s"}
                      </span>
                      <span className="flex items-center gap-1 text-[11px] text-ink-faint">
                        <GraduationCap size={12} />
                        {trCount} action{trCount === 1 ? "" : "s"}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── PART 2: TRACK EMPLOYEE ──────────────────────────────────── */}
      {(mode === "track" || mine) && (
        <Card>
          <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
            <label htmlFor="tr-st" className="sr-only">Status</label>
            <select
              id="tr-st"
              className={`${inputCls} w-auto`}
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">All statuses</option>
              {TRAINING_STATUSES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-sm text-ink-soft">
              <input
                type="checkbox"
                checked={overdue}
                onChange={(e) => setOverdue(e.target.checked)}
              />
              Overdue only
            </label>
            <span className="ml-auto text-xs text-ink-faint">
              {trackRows.length} of {base.length}
            </span>
          </div>

          <DataTable
            caption="Training actions"
            rows={trackRows}
            columns={cols}
            rowKey={(t) => t.id}
            onRowClick={(t) => setParam("tr", t.id)}
            rowLabel={(t) => `Open training action ${t.id}`}
            empty={
              <EmptyState
                icon={GraduationCap}
                title="No training actions"
                body="Actions are proposed by Technical Officers from case findings."
              />
            }
            card={(t) => (
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="font-mono text-sm font-semibold text-slt-blue">{t.id}</span>
                  <TrainingBadge status={t.status} overdue={isOverdue(t)} />
                </div>
                <div className="text-sm">{t.type} · {t.employee.name}</div>
                <div className="text-xs text-ink-faint">Owner {userName(t.ownerId)} · due {fmtDate(t.dueDate)}</div>
              </div>
            )}
          />
        </Card>
      )}

      {/* Modal: Add New Employee */}
      {showNewEmpModal && (
        <Dialog
          title="Add New Employee"
          subtitle="Add an employee into the SLT roster for complaint tracking and coaching."
          size="md"
          onClose={() => setShowNewEmpModal(false)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setShowNewEmpModal(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleCreateEmployee}>
                <UserPlus size={15} />
                Save & Select Employee
              </Button>
            </>
          }
        >
          <div className="space-y-4 p-5 sm:p-6">
            <Field label="Employee Full Name" required htmlFor="ne-name">
              <input
                id="ne-name"
                className={inputCls}
                value={newEmpForm.name}
                onChange={(e) => setNewEmpForm({ ...newEmpForm, name: e.target.value })}
                placeholder="e.g. Ruwan Silva"
              />
            </Field>

            <Field
              label="Employee ID / Service Number"
              required
              htmlFor="ne-sno"
              hint="Unique ID used across SLT ComTrack (e.g. SN-108920)"
            >
              <input
                id="ne-sno"
                className={`${inputCls} font-mono`}
                value={newEmpForm.serviceNo}
                onChange={(e) => setNewEmpForm({ ...newEmpForm, serviceNo: e.target.value })}
                placeholder="SN-XXXXXX"
              />
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Regional Centre / Office" required htmlFor="ne-centre">
                <select
                  id="ne-centre"
                  className={inputCls}
                  value={newEmpForm.centre}
                  onChange={(e) => setNewEmpForm({ ...newEmpForm, centre: e.target.value })}
                >
                  <option value={HEAD_OFFICE}>{HEAD_OFFICE}</option>
                  {REGIONAL_CENTRES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </Field>

              <Field label="Team / Group" required htmlFor="ne-grp">
                <input
                  id="ne-grp"
                  className={inputCls}
                  value={newEmpForm.group}
                  onChange={(e) => setNewEmpForm({ ...newEmpForm, group: e.target.value })}
                  placeholder="e.g. Broadband Team B"
                />
              </Field>
            </div>
          </div>
        </Dialog>
      )}

      {/* Modal: Propose Coaching Action */}
      {showProposeModal && selectedEmployee && (
        <Dialog
          title={`Propose Coaching Action for ${selectedEmployee.name}`}
          subtitle={`Employee: ${selectedEmployee.name} (${selectedEmployee.serviceNo} · ${selectedEmployee.group})`}
          size="md"
          onClose={() => setShowProposeModal(false)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setShowProposeModal(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleProposeAction}>
                <Sparkles size={15} />
                Submit Proposal
              </Button>
            </>
          }
        >
          <div className="space-y-4 p-5 sm:p-6">
            <Field label="Action Type" required htmlFor="pr-type">
              <select
                id="pr-type"
                className={inputCls}
                value={proposeForm.type}
                onChange={(e) => setProposeForm({ ...proposeForm, type: e.target.value })}
              >
                {(db.lists.trainingTypes?.filter((x) => x.active).map((x) => x.label) || ["Coaching", "Refresher training", "Process briefing"]).map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </Field>

            <Field label="Skill Gap / Finding" required htmlFor="pr-gap" hint="What skill or process gap was identified?">
              <input
                id="pr-gap"
                className={inputCls}
                value={proposeForm.gap}
                onChange={(e) => setProposeForm({ ...proposeForm, gap: e.target.value })}
                placeholder="e.g. Callback queue routing protocol"
              />
            </Field>

            <Field label="Objective" required htmlFor="pr-obj" hint="Expected learning outcome">
              <textarea
                id="pr-obj"
                rows={3}
                className={inputCls}
                value={proposeForm.objective}
                onChange={(e) => setProposeForm({ ...proposeForm, objective: e.target.value })}
                placeholder="e.g. Officer will accurately classify and route escalation requests within 48h."
              />
            </Field>

            <Field label="Priority" required htmlFor="pr-prio">
              <select
                id="pr-prio"
                className={inputCls}
                value={proposeForm.priority}
                onChange={(e) => setProposeForm({ ...proposeForm, priority: e.target.value as Priority })}
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </Field>
          </div>
        </Dialog>
      )}

      {/* Existing Training Action Detail Dialog */}
      {openId && (open && canSeeTraining(open) ? (
        <TrainingDialog t={open} onClose={() => setParam("tr", null)} />
      ) : (
        <Dialog
          title="Action not available"
          size="sm"
          onClose={() => setParam("tr", null)}
          footer={<Button onClick={() => setParam("tr", null)}>Close</Button>}
        >
          <div className="p-6 text-sm text-ink-soft">
            This training action isn't available with your current access.
          </div>
        </Dialog>
      ))}
    </>
  );
}

function TrainingDialog({ t, onClose }: { t: TrainingAction; onClose: () => void }) {
  const { db, me, can, act, toast, userName, visibleComplaints, canSeeFile } = useStore();
  const [op, setOp] = useState<null | "approve" | "reject" | "complete" | "review" | "needsChanges">(null);
  const [owner, setOwner] = useState(t.ownerId || t.proposedBy || "");
  const [due, setDue] = useState("");
  const [text, setText] = useState("");
  const [follow, setFollow] = useState("");
  const [preview, setPreview] = useState<AttachmentMeta | null>(null);
  const isOwner = t.ownerId === me?.id;
  const run = (o: Parameters<typeof act.trainingTransition>[1], data: Parameters<typeof act.trainingTransition>[2], msg: string) => {
    const r = act.trainingTransition(t.id, o, data);
    r.ok ? toast("success", msg) : toast("error", r.error);
    if (r.ok) { setOp(null); setText(""); }
  };
  const owners = db.users.filter((u) => (u.role === "Technical Officer" || u.role === "Manager") && u.active);
  const files = db.attachments.filter((a) => a.trainingId === t.id && canSeeFile(a));
  const visible = new Set(visibleComplaints.map((c) => c.id));

  const footer = !preview && (
    <>
      {t.status === "Proposed" && can("train.approve") && <><Button onClick={() => setOp("reject")}><XIcon size={15} />Reject</Button><Button variant="primary" onClick={() => setOp("approve")}><Check size={15} />Approve & assign</Button></>}
      {["Approved", "Needs Changes"].includes(t.status) && isOwner && can("train.update") && <Button variant="primary" onClick={() => run("start", {}, "Action started.")}><Play size={15} />Start action</Button>}
      {t.status === "In Progress" && isOwner && can("train.update") && <Button variant="primary" onClick={() => setOp("complete")}><Flag size={15} />Mark complete</Button>}
      {t.status === "Completed" && can("train.review") && <><Button onClick={() => setOp("needsChanges")}><Undo2 size={15} />Needs changes</Button><Button variant="success" onClick={() => setOp("review")}><Check size={15} />Record review</Button></>}
      {["Approved", "In Progress", "Needs Changes"].includes(t.status) && can("train.approve") && <Button variant="ghost" onClick={() => run("remind", {}, "Reminder sent (in-app; email simulated).")}><Bell size={15} />Send reminder</Button>}
    </>
  );

  return (
    <Dialog size="lg" title={<>Training action <span className="font-mono">{t.id}</span></>} subtitle={<span className="inline-flex items-center gap-2"><TrainingBadge status={t.status} overdue={isOverdue(t)} /> {t.type}</span>} onClose={onClose} footer={footer || undefined}>
      {preview ? <div className="h-[70vh]"><PreviewPanel a={preview} onBack={() => setPreview(null)} /></div> : (
        <div className="space-y-5 px-5 py-5 sm:px-6">
          <dl className="grid gap-4 rounded-lg border border-line p-4 sm:grid-cols-2">
            <KV label="Linked complaint(s)">{t.caseIds.length > 0 ? t.caseIds.map((id) => visible.has(id) ? <button key={id} className="mr-2 font-mono font-semibold text-slt-blue underline" onClick={() => { setParam("tr", null); setParam("case", id); }}>{id}</button> : <span key={id} className="mr-2 text-ink-faint">Restricted case</span>) : <span className="text-ink-faint">None linked</span>}</KV>
            <KV label="Employee / team">{t.employee.name} · {t.employee.group}</KV>
            <KV label="Finding / skill gap">{t.gap}</KV>
            <KV label="Objective">{t.objective}</KV>
            <KV label="Owner">{userName(t.ownerId)}</KV>
            <KV label="Due">{fmtDate(t.dueDate)}{isOverdue(t) && " · overdue"}</KV>
            <KV label="Priority"><PriorityBadge priority={t.priority} /></KV>
            <KV label="Proposed by">{userName(t.proposedBy)} · {fmtDate(t.proposedAt)}</KV>
            {t.evidence && <div className="sm:col-span-2"><KV label="Completion evidence">{t.evidence}</KV></div>}
            {t.reviewNotes && <KV label="Review notes">{t.reviewNotes}</KV>}
            {t.followUp && <KV label="Follow-up result">{t.followUp}</KV>}
            {t.rejectionReason && <div className="sm:col-span-2"><KV label="Rejection reason">{t.rejectionReason}</KV></div>}
          </dl>
          {(files.length > 0 || (isOwner && t.status === "In Progress")) && (
            <section className="space-y-2">
              <SectionTitle>Completion evidence files</SectionTitle>
              <AttachmentList items={files} onPreview={setPreview} canPreview={can("att.preview")} canDownload={can("att.download")} emptyText="No files yet." />
              {isOwner && t.status === "In Progress" && <Uploader existingCount={files.length} label="Add evidence file" onUpload={async (f) => { const r = await act.addAttachment(f, { trainingId: t.id, kind: "training", provenance: `Training completion evidence (${t.id})` }); return r.ok ? { ok: true } : { ok: false, error: r.error }; }} />}
            </section>
          )}
          <section>
            <SectionTitle>Action history</SectionTitle>
            <ol className="mt-2 space-y-2 border-l border-line pl-4">
              {[...t.history].reverse().map((h, i) => <li key={i} className="text-sm"><span className="font-medium">{h.action}</span>{h.detail && <span className="text-ink-soft"> — {h.detail}</span>}<div className="text-xs text-ink-faint">{fmtDate(h.ts, true)} · {h.actor}</div></li>)}
            </ol>
          </section>
        </div>
      )}
      {op === "approve" && (
        <Confirm title={`Approve ${t.id}?`} confirmLabel="Approve & assign" disabled={!owner || !due} onCancel={() => setOp(null)} consequence="The owner is notified and becomes responsible for delivering the action by the due date."
          onConfirm={() => run("approve", { ownerId: owner, dueDate: new Date(due + "T17:00:00+05:30").toISOString() }, "Approved and assigned.")}>
          <Field label="Owner" required htmlFor="ap-o"><select id="ap-o" className={inputCls} value={owner} onChange={(e) => setOwner(e.target.value)}><option value="">Select…</option>{owners.map((u) => <option key={u.id} value={u.id}>{u.name} · {u.role}</option>)}</select></Field>
          <Field label="Due date" required htmlFor="ap-d"><input id="ap-d" type="date" className={inputCls} value={due} onChange={(e) => setDue(e.target.value)} /></Field>
        </Confirm>
      )}
      {op === "reject" && <Confirm title={`Reject ${t.id}?`} confirmLabel="Reject proposal" variant="danger" disabled={!text.trim()} onCancel={() => setOp(null)} consequence="The proposer is informed of the reason. The record is kept for traceability." onConfirm={() => run("reject", { reason: text }, "Proposal rejected.")}><Field label="Reason" required htmlFor="rj"><textarea id="rj" className={inputCls} rows={2} value={text} onChange={(e) => setText(e.target.value)} /></Field></Confirm>}
      {op === "complete" && <Confirm title="Mark action complete?" confirmLabel="Submit for review" disabled={!text.trim()} onCancel={() => setOp(null)} consequence="A Manager will review completion and record the follow-up result." onConfirm={() => run("complete", { evidence: text }, "Submitted for review.")}><Field label="Completion evidence" required htmlFor="ce"><textarea id="ce" className={inputCls} rows={3} value={text} onChange={(e) => setText(e.target.value)} /></Field></Confirm>}
      {op === "needsChanges" && <Confirm title="Return for changes?" confirmLabel="Return to owner" variant="danger" disabled={!text.trim()} onCancel={() => setOp(null)} consequence="The action returns to the owner as Needs Changes." onConfirm={() => run("needsChanges", { notes: text }, "Returned to owner.")}><Field label="What needs to change" required htmlFor="nc"><textarea id="nc" className={inputCls} rows={2} value={text} onChange={(e) => setText(e.target.value)} /></Field></Confirm>}
      {op === "review" && (
        <Confirm title="Record review?" confirmLabel="Record review" variant="success" disabled={!text.trim()} onCancel={() => setOp(null)} consequence="The action becomes Reviewed and read-only." onConfirm={() => run("review", { notes: text, followUp: follow }, "Review recorded.")}>
          <Field label="Review notes" required htmlFor="rv"><textarea id="rv" className={inputCls} rows={2} value={text} onChange={(e) => setText(e.target.value)} /></Field>
          <Field label="Follow-up result" htmlFor="fu" hint="e.g. outcome of a later QA sample"><input id="fu" className={inputCls} value={follow} onChange={(e) => setFollow(e.target.value)} /></Field>
        </Confirm>
      )}
    </Dialog>
  );
}
