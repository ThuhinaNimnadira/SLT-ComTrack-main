import { useEffect, useState } from "react";
import {
  LayoutDashboard, ListChecks, FolderOpen, Hourglass, ClipboardCheck, CalendarCheck2, Archive, FilePlus2, Mail, MailQuestion,
  Send, CheckCheck, GraduationCap, UserCheck, Library, Wrench, FileClock, Tags, SlidersHorizontal, Activity, Users, Grid3x3,
  Settings2, Plug, BellRing, ScrollText, UserCircle, type LucideIcon,
} from "lucide-react";
import type { Cap, User, Complaint, FeedbackRequest, TrainingAction, InboxEmail } from "./lib/types";
import { can, canViewCase, canViewTraining, type Templates } from "./lib/permissions";
import { inView, isOverdue } from "./lib/lifecycle";

export type RouteKey =
  | "dashboard" | "my-work" | "cases/active" | "cases/awaiting" | "cases/review" | "cases/closed-month" | "cases/archive"
  | "intake/register" | "intake/1212" | "intake/other" | "feedback/pending" | "feedback/submitted"
  | "training/all" | "training/mine" | "reports/library" | "reports/builder" | "reports/generated"
  | "config/categories" | "config/settings"
  | "gm/pending" | "gm/submitted"
  | "admin/overview" | "admin/users" | "admin/matrix" | "admin/settings" | "admin/integrations" | "admin/notifications" | "admin/audit"
  | "profile";

export interface NavItem { key: RouteKey; label: string; icon: LucideIcon; caps?: Cap[]; roles: ("Manager" | "Technical Officer" | "Admin" | "Group Manager")[]; count?: (c: CountCtx) => number }
export interface NavGroup { id: string; label: string; icon: LucideIcon; items: NavItem[] }

export interface CountCtx { me: User; complaints: Complaint[]; requests: FeedbackRequest[]; training: TrainingAction[]; inbox: InboxEmail[]; templates: Templates }
const BIZ = ["Manager", "Technical Officer"] as ("Manager" | "Technical Officer")[];
const vis = (c: CountCtx) => c.complaints.filter((x) => canViewCase(c.me, x, c.templates));

export const NAV: NavGroup[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard, items: [
    { key: "dashboard", label: "Dashboard", icon: LayoutDashboard, caps: ["dashboard.view"], roles: BIZ },
    { key: "my-work", label: "My Work", icon: ListChecks, caps: ["case.view"], roles: BIZ, count: (c) => myWorkCount(c) },
  ] },
  { id: "intake", label: "Intake", icon: FilePlus2, items: [
    { key: "intake/1212", label: "1212 Mail", icon: Mail, caps: ["intake.email"], roles: BIZ, count: (c) => c.inbox.filter((e) => e.mailbox === "1212" && !e.processedCaseId && !e.read).length },
    { key: "intake/other", label: "Other Complaint Email", icon: MailQuestion, caps: ["intake.email"], roles: BIZ, count: (c) => c.inbox.filter((e) => e.mailbox === "complaints" && !e.processedCaseId && !e.read).length },
  ] },
  { id: "complaints", label: "Complaints", icon: FolderOpen, items: [
    { key: "cases/active", label: "Active", icon: FolderOpen, caps: ["case.view"], roles: BIZ, count: (c) => vis(c).filter((x) => inView(x, "active", c.requests)).length },
    { key: "cases/awaiting", label: "Regional Feedback", icon: Send, caps: ["case.view"], roles: ["Technical Officer"], count: (c) => c.requests.filter((r) => r.status === "Pending" && vis(c).some((x) => x.id === r.complaintId)).length },
    { key: "cases/review", label: "Pending Review", icon: ClipboardCheck, caps: ["case.view"], roles: BIZ, count: (c) => vis(c).filter((x) => inView(x, "review", c.requests)).length },
    { key: "cases/closed-month", label: "Closed This Month", icon: CalendarCheck2, caps: ["case.view"], roles: BIZ },
    { key: "cases/archive", label: "Archive", icon: Archive, caps: ["case.view", "archive.view"], roles: BIZ },
  ] },
  { id: "regional", label: "Regional Feedback", icon: Send, items: [
    { key: "gm/pending", label: "Pending Requests", icon: Send, roles: ["Group Manager"], count: (c) => c.requests.filter((r) => r.status === "Pending" && r.groupManagerId === c.me.id).length },
    { key: "gm/submitted", label: "Submitted Responses", icon: CheckCheck, roles: ["Group Manager"] },
  ] },
  { id: "improvement", label: "Improvement", icon: GraduationCap, items: [
    { key: "training/all", label: "Training & Coaching", icon: GraduationCap, caps: ["train.view"], roles: BIZ, count: (c) => c.me.role === "Manager" ? c.training.filter((t) => ["Proposed", "Completed"].includes(t.status)).length : 0 },
    { key: "training/mine", label: "My Assigned Actions", icon: UserCheck, caps: ["train.view", "train.update"], roles: BIZ, count: (c) => c.training.filter((t) => t.ownerId === c.me.id && ["Approved", "In Progress", "Needs Changes"].includes(t.status)).length },
  ] },
  { id: "reports", label: "Reports", icon: Library, items: [
    { key: "reports/library", label: "Reports", icon: Library, caps: ["report.view"], roles: BIZ },
  ] },
  { id: "config", label: "Manager Configuration", icon: Tags, items: [
    { key: "config/categories", label: "Complaint Categories", icon: Tags, caps: ["config.categories"], roles: ["Manager"] },
    { key: "config/settings", label: "Business Settings", icon: SlidersHorizontal, caps: ["config.settings"], roles: ["Manager"] },
  ] },
  { id: "admin", label: "Administration", icon: Settings2, items: [
    { key: "admin/overview", label: "System Overview", icon: Activity, roles: ["Admin"] },
    { key: "admin/users", label: "Users & Access", icon: Users, roles: ["Admin"] },
    { key: "admin/matrix", label: "Permission Matrix", icon: Grid3x3, roles: ["Admin"] },
    { key: "admin/settings", label: "System Settings", icon: Settings2, roles: ["Admin"] },
    { key: "admin/integrations", label: "Integrations", icon: Plug, roles: ["Admin"] },
    { key: "admin/notifications", label: "Notification Settings", icon: BellRing, roles: ["Admin"] },
    { key: "admin/audit", label: "Technical Audit", icon: ScrollText, roles: ["Admin"] },
  ] },
];
export const PROFILE_ITEM: NavItem = { key: "profile", label: "Profile & Notifications", icon: UserCircle, roles: ["Manager", "Technical Officer", "Admin", "Group Manager"] };

function myWorkCount(c: CountCtx) {
  const v = vis(c);
  if (c.me.role === "Technical Officer") return v.filter((x) => x.assignedTo === c.me.id && (x.status === "Open" || x.status === "In Progress")).length;
  return v.filter((x) => x.status === "Resolved").length + v.filter((x) => x.status === "Open" && !x.assignedTo).length;
}

export function itemAllowed(item: NavItem, me: User | null, templates: Templates) {
  if (!me || !me.active) return false;
  if (!item.roles.includes(me.role)) return false;
  return (item.caps ?? []).every((cap) => can(me, cap, templates));
}

export function navFor(me: User | null, templates: Templates): NavGroup[] {
  return NAV.map((g) => ({ ...g, items: g.items.filter((i) => itemAllowed(i, me, templates)) })).filter((g) => g.items.length);
}

export const EXTRA_ITEMS: NavItem[] = [
  { key: "intake/register", label: "Register Complaint", icon: FilePlus2, roles: BIZ },
  { key: "reports/builder", label: "Report Builder", icon: Library, caps: ["report.view", "report.generate"], roles: BIZ },
  { key: "reports/generated", label: "Generated Reports", icon: Library, caps: ["report.view"], roles: BIZ },
  PROFILE_ITEM,
];

export function allItems() {
  return [...NAV.flatMap((g) => g.items), ...EXTRA_ITEMS];
}

export function firstRoute(me: User | null, templates: Templates): RouteKey | null {
  return navFor(me, templates)[0]?.items[0]?.key ?? null;
}

export function canTraining(me: User, t: TrainingAction, templates: Templates) {
  return canViewTraining(me, t, templates);
}
export { isOverdue };

// ── Hash router ──
export interface Route { key: string; params: URLSearchParams }
function parse(): Route {
  const h = window.location.hash.replace(/^#\/?/, "");
  const [path, qs] = h.split("?");
  return { key: path || "", params: new URLSearchParams(qs ?? "") };
}
export function useRoute() {
  const [r, setR] = useState<Route>(parse);
  useEffect(() => {
    const on = () => setR(parse());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return r;
}
export function go(key: string, params?: Record<string, string | undefined>) {
  const p = new URLSearchParams();
  Object.entries(params ?? {}).forEach(([k, v]) => v && p.set(k, v));
  const s = p.toString();
  window.location.hash = `/${key}${s ? `?${s}` : ""}`;
}
// Update query params on the current route without a navigation (keeps page state).
export function setParam(name: string, value: string | null) {
  const r = parse();
  if (value) r.params.set(name, value); else r.params.delete(name);
  const s = r.params.toString();
  const next = `#/${r.key}${s ? `?${s}` : ""}`;
  if (window.location.hash !== next) window.location.hash = next;
}
