// ComTrack domain model.
// Lifecycle: Open → In Progress → Resolved → Closed.
// Regional feedback state, Manager review state, investigation outcome and archive
// location are deliberately separate dimensions from lifecycle status.

export type Role = "Admin" | "Manager" | "Technical Officer" | "Group Manager";
export const ROLES: Role[] = ["Admin", "Manager", "Technical Officer", "Group Manager"];

export type Status = "Open" | "In Progress" | "Resolved" | "Closed";
export const STATUSES: Status[] = ["Open", "In Progress", "Resolved", "Closed"];

export type FeedbackState = "None" | "Awaiting" | "Received";
export type ReviewState = "Not Submitted" | "Pending Review" | "Returned" | "Approved";

export type Priority = "Critical" | "High" | "Medium" | "Low";
export const PRIORITIES: Priority[] = ["Critical", "High", "Medium", "Low"];

export type Source = "TRC" | "Chairman's Office" | "CEO's Office" | "CXX / Top Management" | "CRC" | "CQMS" | "1212 Mail" | "Other";
export const SOURCES: Source[] = ["TRC", "Chairman's Office", "CEO's Office", "CXX / Top Management", "CRC", "CQMS", "1212 Mail", "Other"];

export type Outcome = "Pending" | "Officer's Fault" | "Not an Officer's Fault" | "Irrelevant";
export const OUTCOMES: Outcome[] = ["Pending", "Officer's Fault", "Not an Officer's Fault", "Irrelevant"];

export type Scope = "Assigned" | "Team" | "All";

export interface User {
  id: string;
  name: string;
  initials: string;
  email: string;
  role: Role;
  title: string;
  team: string; // organisational scope (business team) or regional centre for GMs
  centre?: string; // Group Manager centre
  active: boolean;
  scopeOverride?: Scope;
  overrides: Partial<Record<Cap, boolean>>;
  createdAt: string;
}

export interface Employee {
  name: string;
  serviceNo: string;
  centre: string;
  group: string;
}

export interface HistoryEvent {
  id: string;
  ts: string;
  actor: string;
  type:
    | "register" | "correction" | "assign" | "investigation" | "evidence" | "feedback"
    | "resolve" | "return" | "close" | "archive" | "training" | "legacy" | "intake";
  action: string;
  detail?: string;
  before?: string;
  after?: string;
}

export interface EmailOrigin {
  messageId: string;
  mailbox: "1212" | "complaints";
  from: string;
  fromName: string;
  subject: string;
  receivedAt: string;
  body: string;
}

export interface IntakeFields {
  source: Source;
  sourceRef: string;
  receivedAt: string;
  sltNumber: string;
  customer: string;
  contact: string;
  customerEmail: string;
  issueType: string;
  category: string;
  priority: Priority;
  details: string;
}
export const PROTECTED_FIELDS: { key: keyof IntakeFields; label: string }[] = [
  { key: "source", label: "Source" },
  { key: "sourceRef", label: "Source reference" },
  { key: "receivedAt", label: "Received date" },
  { key: "customer", label: "Customer name" },
  { key: "sltNumber", label: "Service / SLT number" },
  { key: "contact", label: "Contact number" },
  { key: "customerEmail", label: "Customer email" },
  { key: "issueType", label: "Issue type" },
  { key: "category", label: "Category" },
  { key: "priority", label: "Priority" },
  { key: "details", label: "Original description" },
];

export interface Complaint extends IntakeFields {
  id: string;
  legacySource?: string; // historical label preserved, e.g. "1212- Email"
  channel: "Email" | "Manual";
  email?: EmailOrigin; // captured original, never overwritten
  original: IntakeFields; // snapshot at registration, never overwritten
  team: string;
  registeredBy: string;
  registeredAt: string;
  assignedTo: string | null; // user id
  assignedAt: string | null;
  status: Status;
  reviewState: ReviewState;
  outcome: Outcome;
  findings: string;
  observations: string;
  employee: Employee | null;
  actionsTaken: string;
  responsibleParty: string;
  managerNotes: string; // internal, never shared with GM
  startedAt?: string;
  resolution?: { summary: string; by: string; at: string };
  review?: { decision: string; notes: string; by: string; at: string };
  closedAt?: string;
  archived?: { at: string; by: string; reason: string };
  feedbackRequestIds: string[];
  history: HistoryEvent[];
}

export interface FeedbackRequest {
  id: string;
  complaintId: string;
  requestedAt: string;
  requestedBy: string; // user id
  centre: string;
  groupManagerId: string;
  reason: string;
  infoRequired: string;
  context: string; // deliberately shared context
  sharedAttachmentIds: string[];
  status: "Pending" | "Submitted" | "Cancelled";
  cancelled?: { by: string; at: string; reason: string };
  response?: { employee: Employee; feedback: string; submittedAt: string; attachmentIds: string[] };
}

export interface InboxEmail extends EmailOrigin {
  id: string;
  attachments: { name: string; type: string; size: number }[];
  read: boolean;
  processedCaseId?: string;
  extracted: Partial<IntakeFields>;
}

export type AttachmentKind = "intake" | "investigation" | "shared" | "response" | "training";
export interface AttachmentMeta {
  id: string;
  complaintId?: string;
  requestId?: string;
  trainingId?: string;
  kind: AttachmentKind;
  name: string;
  type: string;
  size: number;
  uploadedBy: string;
  uploadedAt: string;
  provenance: string;
  hasBinary: boolean; // false = synthetic seed metadata only
  removed?: { by: string; at: string; reason: string };
}

export type TrainingStatus = "Proposed" | "Approved" | "In Progress" | "Completed" | "Reviewed" | "Needs Changes" | "Rejected";
export const TRAINING_STATUSES: TrainingStatus[] = ["Proposed", "Approved", "In Progress", "Completed", "Needs Changes", "Reviewed", "Rejected"];
export interface TrainingAction {
  id: string;
  caseIds: string[];
  employee: Employee;
  gap: string;
  type: string;
  objective: string;
  ownerId: string | null;
  dueDate: string | null;
  priority: Priority;
  status: TrainingStatus;
  proposedBy: string;
  proposedAt: string;
  evidence: string;
  reviewNotes: string;
  followUp: string;
  rejectionReason?: string;
  history: { ts: string; actor: string; action: string; detail?: string }[];
}

export type NotifEvent = "assignment" | "regional_request" | "regional_response" | "pending_review" | "returned" | "closed" | "training_assigned" | "training_reminder" | "training_review" | "system";
export interface Notification {
  id: string;
  userId: string;
  event: NotifEvent;
  ts: string;
  title: string;
  target?: { kind: "case" | "request" | "training"; id: string };
  read: boolean;
  dedupeKey: string;
}

export interface TechAudit {
  id: string;
  ts: string;
  actor: string;
  category: "Account" | "Permission" | "Setting" | "Integration" | "Auth" | "Job";
  action: string;
  detail?: string;
}

export interface GeneratedReport {
  id: string;
  title: string;
  format: "PDF" | "Excel" | "CSV";
  ts: string;
  by: string; // user id
  rows: number;
  filters: string;
  requiredCaps: Cap[];
}

export interface ReportPreset {
  id: string;
  ownerId: string;
  name: string;
  config: ReportConfig;
}

export interface ReportConfig {
  template: string;
  basis: "received" | "resolved" | "closed";
  range: "week" | "month" | "custom" | "all";
  month: string; // YYYY-MM
  from: string;
  to: string;
  filters: Partial<Record<"source" | "category" | "priority" | "officer" | "team" | "status" | "outcome" | "issueType", string>>;
  columns: string[];
  groupBy: string;
  sortBy: string;
  sortDir: "asc" | "desc";
}

export interface Settings {
  attachment: { types: string[]; maxMb: number; maxCount: number };
  timezone: string;
  dateFormat: string;
  retentionYears: number;
  mailboxes: { id: "1212" | "complaints"; label: string; address: string; status: "Connected (simulated)" | "Degraded (simulated)" | "Not connected"; lastSync: string; secretMasked: string }[];
  senderMap: { pattern: string; source: Source }[];
  directory: { provider: string; tenant: string; status: string };
  simulateSyncFailure: boolean;
  notifications: Record<NotifEvent, { enabled: boolean; mandatory: boolean; inApp: boolean; email: boolean; recipients: string; template: string }>;
  reminderDays: number;
}

export interface BusinessLists {
  categories: { id: string; label: string; active: boolean }[];
  issueTypes: { id: string; label: string; active: boolean }[];
  correctiveActions: { id: string; label: string; active: boolean }[];
  trainingTypes: { id: string; label: string; active: boolean }[];
}

export interface QueuePreset {
  id: string;
  ownerId: string;
  name: string;
  view: string;
  query: string;
  priority: string;
  source: string;
}

export interface RecipientPreset {
  id: string;
  ownerId: string;
  name: string;
  recipients: string;
}

// ── Capabilities ──────────────────────────────────────────────────
export type Cap =
  | "dashboard.view" | "case.view" | "case.history" | "case.notes" | "archive.view" | "archive.manage"
  | "intake.manual" | "intake.email" | "intake.editOriginal"
  | "case.assign"
  | "inv.start" | "inv.edit" | "inv.evidence" | "inv.requestFeedback" | "inv.resolve"
  | "review.return" | "review.close"
  | "att.view" | "att.preview" | "att.download" | "att.manageOriginal"
  | "train.view" | "train.propose" | "train.approve" | "train.update" | "train.review"
  | "report.view" | "report.generate" | "report.pdf" | "report.xlsx" | "report.csv"
  | "config.categories" | "config.settings";
