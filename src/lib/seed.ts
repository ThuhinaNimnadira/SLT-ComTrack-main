import type {
  Complaint, FeedbackRequest, InboxEmail, User, Employee, TrainingAction, AttachmentMeta, Settings, BusinessLists,
  HistoryEvent, IntakeFields, Source, Priority, Outcome, Status, ReviewState, NotifEvent, TechAudit,
} from "./types";
import { DEMO_ANCHOR } from "./permissions";

const D = 1440;
export const ago = (mins: number) => new Date(Date.now() - mins * 60000).toISOString();
export const daysAgo = (d: number, m = 0) => ago(d * D + m);

export const HEAD_OFFICE = "Colombo Head Office";
export const REGIONAL_CENTRES = ["Kandy RCC", "Galle RCC", "Kurunegala RCC", "Jaffna RCC", "Anuradhapura RCC", "Ratnapura RCC"];
export const TEAM_MAIN = "CC Quality";
export const TEAM_A = TEAM_MAIN;
export const TEAM_B = TEAM_MAIN;
export const TEAMS = [TEAM_MAIN];

const u = (id: string, name: string, role: User["role"], title: string, team: string, extra: Partial<User> = {}): User => ({
  id, name, role, title, team, email: name.split(" ")[0].toLowerCase() + "." + name.split(" ").slice(-1)[0][0].toLowerCase() + "@slt.lk",
  initials: name.split(" ").map((p) => p[0]).slice(0, 2).join(""), active: true, overrides: {}, createdAt: daysAgo(400), ...extra,
});

export const SEED_USERS: User[] = [
  u("u-admin", "Ayesha Karunaratne", "Admin", "System Administrator · IT Operations", "IT Operations"),
  u("u-mgr1", "Dilrukshi Ranasinghe", "Manager", "Manager · Call Centre Quality", TEAM_MAIN, { scopeOverride: "All" }),
  u("u-to1", "Kasun Fernando", "Technical Officer", "Technical Officer", TEAM_MAIN),
  u("u-to2", "Nadeesha Perera", "Technical Officer", "Technical Officer", TEAM_MAIN),
  u("u-gm-kandy", "Chaminda Herath", "Group Manager", "Group Manager · Kandy RCC", "Kandy RCC", { centre: "Kandy RCC" }),
  u("u-gm-galle", "Sanjeewa Wijesekara", "Group Manager", "Group Manager · Galle RCC", "Galle RCC", { centre: "Galle RCC" }),
  u("u-gm-kuru", "Priyanka Dissanayake", "Group Manager", "Group Manager · Kurunegala RCC", "Kurunegala RCC", { centre: "Kurunegala RCC" }),
  u("u-gm-jaffna", "Thevarasa Kumaran", "Group Manager", "Group Manager · Jaffna RCC", "Jaffna RCC", { centre: "Jaffna RCC" }),
  u("u-gm-anu", "Lalith Gunasekara", "Group Manager", "Group Manager · Anuradhapura RCC", "Anuradhapura RCC", { centre: "Anuradhapura RCC" }),
  u("u-gm-ratna", "Menaka Abeysinghe", "Group Manager", "Group Manager · Ratnapura RCC", "Ratnapura RCC", { centre: "Ratnapura RCC" }),
];
export const SEED_CENTRE_MAP: Record<string, string> = Object.fromEntries(SEED_USERS.filter((x) => x.centre).map((x) => [x.centre!, x.id]));

export const HEAD_OFFICE_EMPLOYEES: Employee[] = [
  { name: "Hasini Jayasuriya", serviceNo: "SN-104582", centre: HEAD_OFFICE, group: "Broadband Team B" },
  { name: "Ravindu Mendis", serviceNo: "SN-103917", centre: HEAD_OFFICE, group: "Billing Desk" },
  { name: "Shehani Peris", serviceNo: "SN-105230", centre: HEAD_OFFICE, group: "PEO TV Team" },
  { name: "Dinuka Alwis", serviceNo: "SN-102774", centre: HEAD_OFFICE, group: "Mobile Team A" },
];
export const REGIONAL_EMPLOYEES: Employee[] = [
  { name: "Nirosha Bandara", serviceNo: "SN-208411", centre: "Kandy RCC", group: "Group K1 · Broadband" },
  { name: "Asanka Rathnayake", serviceNo: "SN-208562", centre: "Kandy RCC", group: "Group K1 · Broadband" },
  { name: "Thilini Ekanayake", serviceNo: "SN-208190", centre: "Kandy RCC", group: "Group K2 · Billing" },
  { name: "Mahesh Senanayake", serviceNo: "SN-208733", centre: "Kandy RCC", group: "Group K2 · Billing" },
  { name: "Sachini Kulathunga", serviceNo: "SN-208845", centre: "Kandy RCC", group: "Group K3 · Mobile" },
  { name: "Ruwan Wijeratne", serviceNo: "SN-208027", centre: "Kandy RCC", group: "Group K3 · Mobile" },
  { name: "Kavindi Samarakoon", serviceNo: "SN-311204", centre: "Galle RCC", group: "Group G1 · Broadband" },
  { name: "Pradeep Liyanage", serviceNo: "SN-311388", centre: "Galle RCC", group: "Group G2 · Billing" },
  { name: "Gayan Herath", serviceNo: "SN-415019", centre: "Kurunegala RCC", group: "Group KU1 · General" },
  { name: "Sivakumar Rajan", serviceNo: "SN-512230", centre: "Jaffna RCC", group: "Group J1 · General" },
];
const emp = (name: string) => [...HEAD_OFFICE_EMPLOYEES, ...REGIONAL_EMPLOYEES].find((e) => e.name === name)!;

let hid = 0;
const h = (ts: string, actor: string, type: HistoryEvent["type"], action: string, detail?: string): HistoryEvent => ({ id: `h${++hid}`, ts, actor, type, action, detail });

interface Mk extends Partial<Complaint> {
  id: string; source: Source; sourceRef: string; receivedAt: string; customer: string; sltNumber: string; issueType: string; category: string; priority: Priority; details: string;
  status: Status; team: string;
}
function mk(x: Mk): Complaint {
  const intake: IntakeFields = {
    source: x.source, sourceRef: x.sourceRef, receivedAt: x.receivedAt, sltNumber: x.sltNumber, customer: x.customer, contact: x.contact ?? "",
    customerEmail: x.customerEmail ?? "", issueType: x.issueType, category: x.category, priority: x.priority, details: x.details,
  };
  return {
    channel: "Email", registeredBy: "Dilrukshi Ranasinghe", registeredAt: x.receivedAt, assignedTo: null, assignedAt: null,
    reviewState: "Not Submitted" as ReviewState, outcome: "Pending" as Outcome, findings: "", observations: "", employee: null, actionsTaken: "",
    responsibleParty: "", managerNotes: "", feedbackRequestIds: [], history: [], contact: "", customerEmail: "",
    ...x, original: { ...intake },
  } as Complaint;
}

const mail = (messageId: string, mailbox: "1212" | "complaints", from: string, fromName: string, subject: string, receivedAt: string, body: string) => ({ messageId, mailbox, from, fromName, subject, receivedAt, body });

export const SEED_COMPLAINTS: Complaint[] = [
  mk({
    id: "CT-2026-1184", source: "TRC", sourceRef: "TRC/CC/2026/3317", receivedAt: daysAgo(5, 120), team: TEAM_A,
    email: mail("<3317.trc@trc.gov.lk>", "complaints", "complaints@trc.gov.lk", "TRC Consumer Affairs", "Ref TRC/CC/2026/3317 – Complaint against SLT call centre officer", daysAgo(5, 120),
      "Dear Sir/Madam,\n\nThe Commission has received a complaint from Mr. W. A. Senarath (SLT No. 081-2234567) stating that a call centre officer abruptly ended his call on 29 September while he was reporting a broadband fault, and that no follow-up call was received as promised.\n\nKindly investigate and submit your findings within 14 days.\n\nTelecommunications Regulatory Commission"),
    sltNumber: "081-2234567", customer: "W. A. Senarath", contact: "077 418 2290", customerEmail: "wasenarath@gmail.com", issueType: "Officer Behaviour", category: "Officer Conduct", priority: "High",
    details: "Customer states a call centre officer abruptly ended his call on 29 Sep while he was reporting a broadband fault. Promised callback was never received.",
    assignedTo: "u-to1", assignedAt: daysAgo(5), status: "In Progress", startedAt: daysAgo(4, 600), registeredBy: "Kasun Fernando",
    findings: "Call recording for 29 Sep 14:12 retrieved. Call was routed to Kandy RCC via overflow. Call disconnected at 03:41 from agent side while customer was still speaking.",
    observations: "No callback task was created in the CRM after the disconnection.", employee: emp("Nirosha Bandara"), feedbackRequestIds: ["FR-0412"],
    managerNotes: "Regulator deadline 14 days from receipt — prioritise.",
    history: [
      h(daysAgo(5, 120), "System", "legacy", "Email fetched from Outlook", "Source identified as TRC"),
      h(daysAgo(5, 90), "Kasun Fernando", "legacy", "Complaint registered", "Legacy record — registered before Manager-only intake policy"),
      h(daysAgo(5), "Dilrukshi Ranasinghe", "assign", "Assigned to Kasun Fernando"),
      h(daysAgo(3), "Kasun Fernando", "investigation", "Findings recorded", "Call routed to Kandy RCC"),
      h(daysAgo(2, 300), "Kasun Fernando", "feedback", "Regional feedback requested", "Kandy RCC · Chaminda Herath"),
    ],
  }),
  mk({
    id: "CT-2026-1191", source: "Chairman's Office", sourceRef: "CHO/2026/0921", receivedAt: daysAgo(4, 60), team: TEAM_A,
    email: mail("<0921@chairman.slt.lk>", "complaints", "chairman.office@slt.lk", "Office of the Chairman", "Customer complaint forwarded – incorrect information on PEO TV package", daysAgo(4, 60),
      "Please look into the attached complaint received by the Chairman. Customer was told by the hotline that the PEO TV Silver upgrade is free for 6 months, but has been billed from the first month."),
    sltNumber: "011-2785412", customer: "Mrs. K. P. Gunawardena", contact: "071 552 0198", customerEmail: "kpgunawardena@yahoo.com", issueType: "Wrong Information Given", category: "Service Quality", priority: "Critical",
    details: "Customer was told by the hotline that the PEO TV Silver upgrade is free for six months, but was billed from the first month.",
    assignedTo: "u-to1", assignedAt: daysAgo(4), status: "Resolved", reviewState: "Pending Review", startedAt: daysAgo(3, 900),
    findings: "Recording of 17 Sep confirms the officer stated the upgrade was free for 6 months. Promotion ended 31 Aug; script was not updated.",
    observations: "Officer used an outdated promotion sheet. Two similar calls found on the same day.", employee: emp("Shehani Peris"),
    actionsTaken: "Billing adjustment of LKR 2,850 raised. Officer coached. Promotion sheets withdrawn from PEO TV team.", responsibleParty: "Call Centre – PEO TV Team",
    outcome: "Officer's Fault", resolution: { summary: "Officer gave outdated promotion information. Customer credited; promotion sheets withdrawn.", by: "Kasun Fernando", at: ago(260) },
    history: [
      h(daysAgo(4, 60), "System", "legacy", "Email fetched from Outlook", "Source identified as Chairman's Office"),
      h(daysAgo(4, 30), "Dilrukshi Ranasinghe", "register", "Complaint registered"),
      h(daysAgo(4), "Dilrukshi Ranasinghe", "assign", "Assigned to Kasun Fernando"),
      h(daysAgo(3, 900), "Kasun Fernando", "investigation", "Investigation started"),
      h(daysAgo(2), "Kasun Fernando", "investigation", "Findings recorded", "Head Office employee identified"),
      h(ago(260), "Kasun Fernando", "resolve", "Resolved & sent for Manager review", "Outcome: Officer's Fault"),
    ],
  }),
  mk({
    id: "CT-2026-1196", source: "CRC", sourceRef: "CRC-77214", receivedAt: daysAgo(3, 200), team: TEAM_A,
    email: mail("<77214@crc.slt.lk>", "complaints", "crc@slt.lk", "CRC Desk", "CRC-77214 – No callback for billing dispute", daysAgo(3, 200), "Customer called 1212 three times regarding a disputed bill; callback promised each time, none received."),
    sltNumber: "091-2245781", customer: "S. M. Ariyaratne", contact: "076 330 9921", customerEmail: "smariyaratne@gmail.com", issueType: "No Callback", category: "Process Gap", priority: "Medium",
    details: "Customer called 1212 three times regarding a disputed bill; a callback was promised each time but never received.",
    assignedTo: "u-to2", assignedAt: daysAgo(3), status: "In Progress", startedAt: daysAgo(2, 800), registeredBy: "Nadeesha Perera",
    findings: "Two of the three calls were handled by Galle RCC.", employee: emp("Pradeep Liyanage"), feedbackRequestIds: ["FR-0409"],
    history: [
      h(daysAgo(3, 200), "System", "legacy", "Email fetched from Outlook", "Source identified as CRC"),
      h(daysAgo(3, 180), "Nadeesha Perera", "legacy", "Complaint registered", "Legacy record"),
      h(daysAgo(2), "Nadeesha Perera", "feedback", "Regional feedback requested", "Galle RCC · Sanjeewa Wijesekara"),
      h(daysAgo(1), "Sanjeewa Wijesekara", "feedback", "Regional feedback submitted", "Employee: Pradeep Liyanage"),
    ],
  }),
  mk({
    id: "CT-2026-1202", source: "CEO's Office", sourceRef: "CEO/ESC/0388", receivedAt: daysAgo(2, 30), team: TEAM_A,
    email: mail("<0388@ceo.slt.lk>", "complaints", "ceo.office@slt.lk", "Office of the CEO", "Escalation – rude behaviour at hotline", daysAgo(2, 30), "Customer has written to the CEO complaining that the hotline officer was rude and refused to escalate a fibre fault."),
    sltNumber: "011-2591034", customer: "Dr. R. Wickremasinghe", contact: "077 901 2234", customerEmail: "rwickremasinghe@sjp.ac.lk", issueType: "Officer Behaviour", category: "Officer Conduct", priority: "Critical",
    details: "Customer complains that the hotline officer was rude and refused to escalate a fibre fault that had been open for 5 days.",
    assignedTo: "u-to1", assignedAt: daysAgo(2), status: "In Progress", startedAt: daysAgo(1, 900),
    history: [
      h(daysAgo(2, 30), "System", "legacy", "Email fetched from Outlook", "Source identified as CEO's Office"),
      h(daysAgo(2, 10), "Dilrukshi Ranasinghe", "register", "Complaint registered"),
      h(daysAgo(2), "Dilrukshi Ranasinghe", "assign", "Assigned to Kasun Fernando"),
      h(daysAgo(1, 900), "Kasun Fernando", "investigation", "Investigation started"),
    ],
  }),
  mk({
    id: "CT-2026-1205", source: "CQMS", sourceRef: "CQMS-2026-5512", receivedAt: daysAgo(1, 90), team: TEAM_MAIN,
    email: mail("<5512@cqms.slt.lk>", "complaints", "cqms-alerts@slt.lk", "CQMS Notifications", "CQMS-2026-5512 – Long hold time", daysAgo(1, 90), "Quality monitoring flagged a call with 18 minutes hold time without customer update."),
    sltNumber: "037-2223190", customer: "H. M. Jayalath", contact: "070 221 4471", issueType: "Call Handling Delay", category: "Service Quality", priority: "Medium",
    details: "Quality monitoring flagged a call with 18 minutes on hold without any customer update.", status: "Open", registeredBy: "Dilrukshi Ranasinghe",
    history: [h(daysAgo(1, 90), "System", "legacy", "Email fetched from Outlook", "Source identified as CQMS"), h(daysAgo(1, 60), "Dilrukshi Ranasinghe", "register", "Complaint registered")],
  }),
  mk({
    id: "CT-2026-1207", source: "CXX / Top Management", sourceRef: "CXX-1027", receivedAt: ago(700), team: TEAM_MAIN,
    email: mail("<1027@cxx.slt.lk>", "complaints", "cxx-escalations@slt.lk", "CXX Escalations", "Customer escalation – repeated fault follow-up", ago(700), "Customer reports four calls to hotline on the same ADSL fault with conflicting information each time."),
    sltNumber: "025-2236612", customer: "A. Thurairajah", contact: "077 640 1180", customerEmail: "athurairajah@gmail.com", issueType: "Fault Follow-up", category: "Technical Follow-up", priority: "High",
    details: "Customer reports four hotline calls on the same ADSL fault, receiving conflicting information each time.", assignedTo: "u-to1", assignedAt: ago(600), status: "Open",
    history: [h(ago(700), "System", "legacy", "Email fetched from Outlook", "Source identified as CXX / Top Management"), h(ago(680), "Dilrukshi Ranasinghe", "register", "Complaint registered"), h(ago(600), "Dilrukshi Ranasinghe", "assign", "Assigned to Kasun Fernando")],
  }),
  mk({
    id: "CT-2026-1170", source: "TRC", sourceRef: "TRC/CC/2026/3240", receivedAt: daysAgo(9), team: TEAM_MAIN,
    email: mail("<3240.trc@trc.gov.lk>", "complaints", "complaints@trc.gov.lk", "TRC Consumer Affairs", "Ref TRC/CC/2026/3240 – Billing explanation", daysAgo(9), "Customer alleges the call centre could not explain an international roaming charge."),
    sltNumber: "071-8834210", customer: "M. F. Rizwan", contact: "071 883 4210", customerEmail: "mfrizwan@outlook.com", issueType: "Billing Explanation", category: "Billing", priority: "Medium",
    details: "Customer alleges the call centre could not explain an international roaming charge of LKR 6,420.", assignedTo: "u-to1", assignedAt: daysAgo(9), status: "Closed", reviewState: "Approved", startedAt: daysAgo(8, 600), registeredBy: "Kasun Fernando",
    findings: "Officer explained the roaming charge correctly per the recording. Customer disputed the tariff itself.", observations: "Tariff was published and customer was notified by SMS on activation.",
    employee: emp("Ravindu Mendis"), actionsTaken: "Detailed written explanation sent to TRC and customer.", responsibleParty: "Mobile Billing", outcome: "Not an Officer's Fault",
    managerNotes: "Response sent to TRC on 05 Oct.", resolution: { summary: "Correct information given; tariff dispute only.", by: "Kasun Fernando", at: daysAgo(5) },
    review: { decision: "Closed — findings accepted", notes: "Response sent to TRC.", by: "Dilrukshi Ranasinghe", at: daysAgo(3) }, closedAt: daysAgo(3),
    history: [
      h(daysAgo(9), "System", "legacy", "Email fetched from Outlook", "Source identified as TRC"),
      h(daysAgo(9, -30), "Kasun Fernando", "legacy", "Complaint registered", "Legacy record"),
      h(daysAgo(5), "Kasun Fernando", "resolve", "Resolved & sent for Manager review"),
      h(daysAgo(3), "Dilrukshi Ranasinghe", "close", "Case closed", "Outcome: Not an Officer's Fault"),
    ],
  }),
  mk({
    id: "CT-2026-1162", source: "Other", sourceRef: "—", receivedAt: daysAgo(12), team: TEAM_MAIN, channel: "Manual",
    sltNumber: "011-2433109", customer: "P. L. de Silva", contact: "077 115 6602", issueType: "Package / Promotion", category: "General", priority: "Low",
    details: "Walk-in complaint forwarded by Teleshop Bambalapitiya regarding a package change request.", assignedTo: "u-to2", assignedAt: daysAgo(12), status: "Closed", reviewState: "Approved", registeredBy: "Nadeesha Perera",
    findings: "Request concerns Teleshop process, not call centre handling.", actionsTaken: "Forwarded to Teleshop Operations.", responsibleParty: "Teleshop Operations", outcome: "Irrelevant",
    resolution: { summary: "Unrelated to call centre operations.", by: "Nadeesha Perera", at: daysAgo(9) }, review: { decision: "Closed — irrelevant", notes: "", by: "Dilrukshi Ranasinghe", at: daysAgo(8) }, closedAt: daysAgo(8),
    history: [h(daysAgo(12), "Nadeesha Perera", "legacy", "Complaint registered manually", "Legacy record"), h(daysAgo(8), "Dilrukshi Ranasinghe", "close", "Case closed", "Outcome: Irrelevant")],
  }),
  mk({
    id: "CT-2026-1199", source: "CRC", sourceRef: "CRC-77290", receivedAt: daysAgo(3), team: TEAM_MAIN,
    email: mail("<77290@crc.slt.lk>", "complaints", "crc@slt.lk", "CRC Desk", "CRC-77290 – Officer gave wrong reconnection date", daysAgo(3), "Customer was told service would reconnect within 2 hours after payment; took 2 days."),
    sltNumber: "081-2387745", customer: "B. G. Kumari", contact: "075 662 0913", issueType: "Wrong Information Given", category: "Service Quality", priority: "Medium",
    details: "Customer was told service would reconnect within 2 hours after payment; it took 2 days.", assignedTo: "u-to1", assignedAt: daysAgo(3, -60), status: "In Progress", startedAt: daysAgo(2), registeredBy: "Kasun Fernando",
    findings: "Call handled by Kandy RCC (Group K2).", employee: emp("Thilini Ekanayake"), feedbackRequestIds: ["FR-0415"],
    history: [h(daysAgo(3), "System", "legacy", "Email fetched from Outlook", "Source identified as CRC"), h(daysAgo(3, -30), "Kasun Fernando", "legacy", "Complaint registered", "Legacy record"), h(daysAgo(1), "Kasun Fernando", "feedback", "Regional feedback requested", "Kandy RCC · Chaminda Herath")],
  }),
  mk({
    id: "CT-2026-1140", source: "CQMS", sourceRef: "CQMS-2026-5301", receivedAt: daysAgo(19), team: TEAM_MAIN,
    sltNumber: "081-2201178", customer: "R. M. Tennakoon", contact: "077 220 1178", issueType: "Officer Behaviour", category: "Officer Conduct", priority: "Medium",
    details: "Quality monitoring flagged a call where the closing script was not followed.", assignedTo: "u-to2", assignedAt: daysAgo(18), status: "Closed", reviewState: "Approved", startedAt: daysAgo(18),
    findings: "Kandy RCC officer skipped closing script during an outage surge.", employee: emp("Sachini Kulathunga"), actionsTaken: "Refresher on closing script.", outcome: "Officer's Fault", responsibleParty: "Kandy RCC",
    feedbackRequestIds: ["FR-0398"], resolution: { summary: "Script deviation during outage; refresher completed.", by: "Nadeesha Perera", at: daysAgo(13) },
    review: { decision: "Closed — findings accepted", notes: "", by: "Dilrukshi Ranasinghe", at: daysAgo(12) }, closedAt: daysAgo(12),
    history: [h(daysAgo(19), "Dilrukshi Ranasinghe", "register", "Complaint registered"), h(daysAgo(16), "Nadeesha Perera", "feedback", "Regional feedback requested", "Kandy RCC"), h(daysAgo(14), "Chaminda Herath", "feedback", "Regional feedback submitted"), h(daysAgo(13), "Nadeesha Perera", "resolve", "Resolved & sent for Manager review"), h(daysAgo(12), "Dilrukshi Ranasinghe", "close", "Case closed")],
  }),
  mk({
    id: "CT-2026-1120", source: "1212 Mail", legacySource: "1212- Email", sourceRef: "1212-MAIL-20260818-044", receivedAt: "2026-08-18T05:10:00Z", team: TEAM_A,
    email: mail("<a91f@gmail.com>", "1212", "nimal.w1980@gmail.com", "Nimal Wickramasinghe", "Complaint – billing call disconnected", "2026-08-18T05:10:00Z", "I contacted 1212 about my bill and the call was disconnected twice."),
    sltNumber: "011-2698810", customer: "Nimal Wickramasinghe", customerEmail: "nimal.w1980@gmail.com", issueType: "Call Handling Delay", category: "Service Quality", priority: "Low",
    details: "Customer contacted 1212 about a bill; the call was disconnected twice.", assignedTo: "u-to2", assignedAt: "2026-08-18T08:00:00Z", status: "Closed", reviewState: "Approved", startedAt: "2026-08-19T04:00:00Z",
    findings: "Telephony fault on 18 Aug; disconnections not agent-initiated.", actionsTaken: "Callback made; IT ticket referenced.", outcome: "Not an Officer's Fault", employee: emp("Dinuka Alwis"), responsibleParty: "IT Telephony",
    resolution: { summary: "System fault; no officer fault.", by: "Nadeesha Perera", at: "2026-08-22T07:00:00Z" }, review: { decision: "Closed — findings accepted", notes: "", by: "Dilrukshi Ranasinghe", at: "2026-08-25T06:00:00Z" }, closedAt: "2026-08-25T06:00:00Z",
    history: [h("2026-08-18T05:10:00Z", "System", "legacy", "Email received in 1212 mailbox", "Historical source label: 1212- Email"), h("2026-08-25T06:00:00Z", "Dilrukshi Ranasinghe", "close", "Case closed")],
  }),
  mk({
    id: "CT-2026-1098", source: "TRC", sourceRef: "TRC/CC/2026/2988", receivedAt: "2026-07-07T04:30:00Z", team: TEAM_A,
    sltNumber: "033-2241190", customer: "K. A. Premadasa", issueType: "Wrong Information Given", category: "Service Quality", priority: "High",
    details: "Customer was given a wrong relocation fee estimate.", assignedTo: "u-to1", assignedAt: "2026-07-07T07:00:00Z", status: "Closed", reviewState: "Approved", startedAt: "2026-07-08T04:00:00Z",
    findings: "Officer quoted the 2025 fee table.", actionsTaken: "Fee corrected; officer briefed.", outcome: "Officer's Fault", employee: emp("Hasini Jayasuriya"),
    resolution: { summary: "Outdated fee table used.", by: "Kasun Fernando", at: "2026-07-15T06:00:00Z" }, review: { decision: "Closed — findings accepted", notes: "", by: "Dilrukshi Ranasinghe", at: "2026-07-18T06:00:00Z" }, closedAt: "2026-07-18T06:00:00Z",
    history: [h("2026-07-07T04:30:00Z", "Dilrukshi Ranasinghe", "register", "Complaint registered"), h("2026-07-15T06:00:00Z", "Kasun Fernando", "resolve", "Resolved & sent for Manager review"), h("2026-07-18T06:00:00Z", "Dilrukshi Ranasinghe", "close", "Case closed")],
  }),
  mk({
    id: "CT-2026-1130", source: "CEO's Office", sourceRef: "CEO/ESC/0351", receivedAt: "2026-09-02T05:00:00Z", team: TEAM_A,
    sltNumber: "011-2577213", customer: "G. Seneviratne", issueType: "No Callback", category: "Process Gap", priority: "High",
    details: "Promised supervisor callback never happened.", assignedTo: "u-to2", assignedAt: "2026-09-02T07:00:00Z", status: "Closed", reviewState: "Approved", startedAt: "2026-09-03T04:00:00Z",
    findings: "Supervisor callback queue misrouted.", actionsTaken: "Queue rule fixed.", outcome: "Not an Officer's Fault", employee: emp("Dinuka Alwis"),
    resolution: { summary: "Routing rule error.", by: "Nadeesha Perera", at: "2026-09-09T06:00:00Z" }, review: { decision: "Closed — findings accepted", notes: "", by: "Dilrukshi Ranasinghe", at: "2026-09-12T06:00:00Z" }, closedAt: "2026-09-12T06:00:00Z",
    history: [h("2026-09-02T05:00:00Z", "Dilrukshi Ranasinghe", "register", "Complaint registered"), h("2026-09-09T06:00:00Z", "Nadeesha Perera", "resolve", "Resolved & sent for Manager review"), h("2026-09-12T06:00:00Z", "Dilrukshi Ranasinghe", "close", "Case closed")],
  }),
  // Month-boundary pair (Asia/Colombo = UTC+05:30)
  mk({
    id: "CT-2026-1150", source: "CRC", sourceRef: "CRC-76980", receivedAt: "2026-09-21T04:00:00Z", team: TEAM_A,
    sltNumber: "091-2233400", customer: "D. N. Pathirana", issueType: "Billing Explanation", category: "Billing", priority: "Medium",
    details: "Customer not told about late-payment surcharge.", assignedTo: "u-to1", assignedAt: "2026-09-21T06:00:00Z", status: "Closed", reviewState: "Approved", startedAt: "2026-09-22T04:00:00Z",
    findings: "Surcharge was explained; customer misheard.", actionsTaken: "Written explanation sent.", outcome: "Not an Officer's Fault", employee: emp("Ravindu Mendis"),
    resolution: { summary: "Explained correctly.", by: "Kasun Fernando", at: "2026-09-28T06:00:00Z" }, review: { decision: "Closed — findings accepted", notes: "Boundary demo: closed 30 Sep 23:50 Colombo time.", by: "Dilrukshi Ranasinghe", at: "2026-09-30T18:20:00Z" }, closedAt: "2026-09-30T18:20:00Z",
    history: [h("2026-09-21T04:00:00Z", "Dilrukshi Ranasinghe", "register", "Complaint registered"), h("2026-09-30T18:20:00Z", "Dilrukshi Ranasinghe", "close", "Case closed", "30 Sep 23:50 (Asia/Colombo)")],
  }),
  mk({
    id: "CT-2026-1151", source: "Chairman's Office", sourceRef: "CHO/2026/0899", receivedAt: "2026-09-22T04:00:00Z", team: TEAM_A,
    sltNumber: "011-2512290", customer: "F. Mohamed", issueType: "Officer Behaviour", category: "Officer Conduct", priority: "High",
    details: "Officer interrupted customer repeatedly.", assignedTo: "u-to2", assignedAt: "2026-09-22T06:00:00Z", status: "Closed", reviewState: "Approved", startedAt: "2026-09-23T04:00:00Z",
    findings: "Recording confirms interruptions.", actionsTaken: "Officer coached on active listening.", outcome: "Officer's Fault", employee: emp("Hasini Jayasuriya"),
    resolution: { summary: "Behavioural lapse; coached.", by: "Nadeesha Perera", at: "2026-09-29T06:00:00Z" }, review: { decision: "Closed — findings accepted", notes: "Boundary demo: closed 1 Oct 00:10 Colombo time.", by: "Dilrukshi Ranasinghe", at: "2026-09-30T18:40:00Z" }, closedAt: "2026-09-30T18:40:00Z",
    history: [h("2026-09-22T04:00:00Z", "Dilrukshi Ranasinghe", "register", "Complaint registered"), h("2026-09-30T18:40:00Z", "Dilrukshi Ranasinghe", "close", "Case closed", "1 Oct 00:10 (Asia/Colombo)")],
  }),
  mk({
    id: "CT-2026-1158", source: "TRC", sourceRef: "TRC/CC/2026/3201", receivedAt: "2026-09-25T04:00:00Z", team: TEAM_A,
    sltNumber: "045-2290012", customer: "J. P. Kodituwakku", issueType: "Fault Follow-up", category: "Technical Follow-up", priority: "Medium",
    details: "Fault reference not given to the customer.", assignedTo: "u-to1", assignedAt: "2026-09-25T06:00:00Z", status: "Closed", reviewState: "Approved", startedAt: "2026-09-26T04:00:00Z",
    findings: "Officer did not read out the fault reference.", actionsTaken: "Process briefing to team.", outcome: "Officer's Fault", employee: emp("Hasini Jayasuriya"),
    resolution: { summary: "Fault ref omitted.", by: "Kasun Fernando", at: "2026-09-30T06:00:00Z" }, review: { decision: "Closed — findings accepted", notes: "", by: "Dilrukshi Ranasinghe", at: "2026-10-02T06:00:00Z" }, closedAt: "2026-10-02T06:00:00Z",
    archived: { at: daysAgo(2), by: "Dilrukshi Ranasinghe", reason: "Regulator response filed — moved to archive with TRC batch." },
    history: [h("2026-09-25T04:00:00Z", "Dilrukshi Ranasinghe", "register", "Complaint registered"), h("2026-10-02T06:00:00Z", "Dilrukshi Ranasinghe", "close", "Case closed"), h(daysAgo(2), "Dilrukshi Ranasinghe", "archive", "Archived manually", "Regulator response filed — moved to archive with TRC batch.")],
  }),
  mk({
    id: "CT-2026-1175", source: "CRC", sourceRef: "CRC-77102", receivedAt: daysAgo(7), team: TEAM_A,
    sltNumber: "011-2734456", customer: "U. S. Kariyawasam", contact: "071 900 4456", issueType: "Wrong Information Given", category: "Service Quality", priority: "High",
    details: "Customer told roaming was activated, but it was not; charged for SMS fallback.", assignedTo: "u-to2", assignedAt: daysAgo(7), status: "In Progress", reviewState: "Returned", startedAt: daysAgo(6),
    findings: "Roaming activation ticket was created but failed provisioning.", actionsTaken: "", outcome: "Pending", employee: emp("Dinuka Alwis"),
    history: [
      h(daysAgo(7), "Dilrukshi Ranasinghe", "register", "Complaint registered"), h(daysAgo(7), "Dilrukshi Ranasinghe", "assign", "Assigned to Nadeesha Perera"),
      h(daysAgo(6), "Nadeesha Perera", "investigation", "Investigation started"), h(daysAgo(3), "Nadeesha Perera", "resolve", "Resolved & sent for Manager review", "Outcome: Not an Officer's Fault"),
      h(daysAgo(2), "Dilrukshi Ranasinghe", "return", "Returned for investigation", "Verify whether officer confirmed provisioning before informing customer."),
    ],
  }),
  mk({
    id: "CT-2026-1210", source: "1212 Mail", sourceRef: "1212-MAIL-20261008-003", receivedAt: ago(300), team: TEAM_A,
    email: mail("<CAF8812@mail.gmail.com>", "1212", "tharindu.jay@gmail.com", "Tharindu Jayasekara", "Fibre fault – officer said ticket closed", ago(300), "Hi, I called 1212 on 6 Oct. Officer said my fibre fault ticket was closed but no one visited. SLT No 011-2810045. Contact 077 811 0045."),
    sltNumber: "011-2810045", customer: "Tharindu Jayasekara", contact: "077 811 0045", customerEmail: "tharindu.jay@gmail.com", issueType: "Fault Follow-up", category: "Technical Follow-up", priority: "Medium",
    details: "Officer said the fibre fault ticket was closed but no technician visited.", status: "Open", registeredAt: ago(240),
    history: [h(ago(300), "System", "intake", "Email received in 1212 mailbox", "Message <CAF8812@mail.gmail.com>"), h(ago(240), "Dilrukshi Ranasinghe", "register", "Complaint registered from 1212 Mail")],
  }),
  mk({
    id: "CT-2026-1188", source: "CXX / Top Management", sourceRef: "CXX-1019", receivedAt: daysAgo(6), team: TEAM_A,
    sltNumber: "091-2276650", customer: "W. Liyanage", contact: "077 301 6650", issueType: "No Callback", category: "Process Gap", priority: "High",
    details: "Escalated by CXX: customer waited 4 days for a promised callback from Galle.", assignedTo: "u-to2", assignedAt: daysAgo(6), status: "Resolved", reviewState: "Pending Review", startedAt: daysAgo(5, 500),
    findings: "Galle RCC officer logged callback in wrong queue (same pattern as CRC-77214).", observations: "Recurring Galle queue issue.", employee: emp("Kavindi Samarakoon"),
    actionsTaken: "Callback completed; Galle team briefed on queue selection.", responsibleParty: "Galle RCC", outcome: "Officer's Fault", feedbackRequestIds: ["FR-0405"],
    resolution: { summary: "Callback queue error at Galle RCC; corrected and briefed.", by: "Nadeesha Perera", at: daysAgo(1, 200) },
    history: [
      h(daysAgo(6), "Dilrukshi Ranasinghe", "register", "Complaint registered"), h(daysAgo(6), "Dilrukshi Ranasinghe", "assign", "Assigned to Nadeesha Perera"), h(daysAgo(5, 500), "Nadeesha Perera", "investigation", "Investigation started"),
      h(daysAgo(4), "Nadeesha Perera", "feedback", "Regional feedback requested", "Galle RCC · Sanjeewa Wijesekara"), h(daysAgo(3), "Sanjeewa Wijesekara", "feedback", "Regional feedback submitted"),
      h(daysAgo(1, 200), "Nadeesha Perera", "resolve", "Resolved & sent for Manager review", "Outcome: Officer's Fault"),
    ],
  }),
  mk({
    id: "CT-2026-1165", source: "TRC", sourceRef: "TRC/CC/2026/3255", receivedAt: daysAgo(14), team: TEAM_A,
    sltNumber: "011-2655019", customer: "C. de Mel", issueType: "Officer Behaviour", category: "Officer Conduct", priority: "High",
    details: "Officer used dismissive language when customer asked for escalation.", assignedTo: "u-to1", assignedAt: daysAgo(14), status: "Closed", reviewState: "Approved", startedAt: daysAgo(13),
    findings: "Recording confirms dismissive tone; officer had 3 similar QA flags.", actionsTaken: "Apology call; coaching proposed.", outcome: "Officer's Fault", employee: emp("Hasini Jayasuriya"), responsibleParty: "Broadband Team B",
    resolution: { summary: "Behavioural issue confirmed; coaching action linked.", by: "Kasun Fernando", at: daysAgo(7) }, review: { decision: "Closed — findings accepted", notes: "Coaching TR-028 to continue after closure.", by: "Dilrukshi Ranasinghe", at: daysAgo(5) }, closedAt: daysAgo(5),
    history: [
      h(daysAgo(14), "Dilrukshi Ranasinghe", "register", "Complaint registered"), h(daysAgo(13), "Kasun Fernando", "investigation", "Investigation started"), h(daysAgo(10), "Kasun Fernando", "resolve", "Resolved & sent for Manager review"),
      h(daysAgo(9), "Dilrukshi Ranasinghe", "return", "Returned for investigation", "Check prior QA flags for this officer."), h(daysAgo(7), "Kasun Fernando", "resolve", "Resolved & sent for Manager review", "Outcome: Officer's Fault"),
      h(daysAgo(7), "Kasun Fernando", "training", "Coaching proposed", "TR-028"), h(daysAgo(5), "Dilrukshi Ranasinghe", "close", "Case closed", "Outstanding training action disclosed: TR-028"),
    ],
  }),
  mk({
    id: "CT-2026-1212", source: "1212 Mail", sourceRef: "1212-MAIL-20261007-011", receivedAt: daysAgo(1, 300), team: TEAM_MAIN,
    sltNumber: "037-2290817", customer: "එච්. එම්. බණ්ඩාර (H. M. Bandara)", contact: "070 229 0817", issueType: "Package / Promotion", category: "General", priority: "Low",
    details: "පැකේජය ගැන වැරදි තොරතුරු — customer says package price quoted differently on two calls.", assignedTo: "u-to1", assignedAt: daysAgo(1), status: "Open", registeredBy: "Dilrukshi Ranasinghe",
    history: [h(daysAgo(1, 300), "System", "intake", "Email received in 1212 mailbox"), h(daysAgo(1, 280), "Dilrukshi Ranasinghe", "register", "Complaint registered from 1212 Mail"), h(daysAgo(1), "Dilrukshi Ranasinghe", "assign", "Assigned to Kasun Fernando")],
  }),
  mk({
    id: "CT-2026-1178", source: "CRC", sourceRef: "CRC-77150", receivedAt: daysAgo(6, 400), team: TEAM_MAIN,
    sltNumber: "021-2223344", customer: "S. Ganeshan", issueType: "Call Handling Delay", category: "Service Quality", priority: "Medium",
    details: "Call transferred five times before reaching billing.", assignedTo: "u-to2", assignedAt: daysAgo(6), status: "In Progress", startedAt: daysAgo(5),
    findings: "IVR route loops when Tamil language selected.", employee: null,
    history: [h(daysAgo(6, 400), "Dilrukshi Ranasinghe", "register", "Complaint registered"), h(daysAgo(6), "Dilrukshi Ranasinghe", "assign", "Assigned to Nadeesha Perera"), h(daysAgo(5), "Nadeesha Perera", "investigation", "Investigation started")],
  }),
];

export const SEED_REQUESTS: FeedbackRequest[] = [
  { id: "FR-0412", complaintId: "CT-2026-1184", requestedAt: daysAgo(2, 300), requestedBy: "u-to1", centre: "Kandy RCC", groupManagerId: "u-gm-kandy",
    reason: "Call was routed to Kandy RCC via overflow and disconnected from the agent side.", infoRequired: "Confirm the officer who handled the call on 29 Sep at 14:12 and obtain their explanation for the disconnection and missing callback.",
    context: "Customer (Broadband, Kandy) reports a call about a broadband fault was ended abruptly on 29 Sep around 14:12 and a promised callback was not received.", sharedAttachmentIds: ["AT-003"], status: "Pending" },
  { id: "FR-0415", complaintId: "CT-2026-1199", requestedAt: daysAgo(1), requestedBy: "u-to1", centre: "Kandy RCC", groupManagerId: "u-gm-kandy",
    reason: "Call handled by Kandy RCC Billing group.", infoRequired: "Identify the officer and confirm what reconnection timeline was communicated.",
    context: "Customer reports being told service would reconnect within 2 hours after payment on 30 Sep; reconnection took 2 days.", sharedAttachmentIds: [], status: "Pending" },
  { id: "FR-0409", complaintId: "CT-2026-1196", requestedAt: daysAgo(2), requestedBy: "u-to2", centre: "Galle RCC", groupManagerId: "u-gm-galle",
    reason: "Two of three calls handled by Galle RCC.", infoRequired: "Confirm why callbacks were not completed.", context: "Customer called the hotline three times about a disputed bill; callbacks were promised but not received.", sharedAttachmentIds: [], status: "Submitted",
    response: { employee: emp("Pradeep Liyanage"), feedback: "Officer logged callback requests but they were placed in the general queue instead of the billing callback queue. Officer has been briefed on the correct procedure.", submittedAt: daysAgo(1), attachmentIds: ["AT-004"] } },
  { id: "FR-0405", complaintId: "CT-2026-1188", requestedAt: daysAgo(4), requestedBy: "u-to2", centre: "Galle RCC", groupManagerId: "u-gm-galle",
    reason: "Callback logged by Galle RCC.", infoRequired: "Officer explanation for queue selection.", context: "Customer waited 4 days for a promised callback.", sharedAttachmentIds: [], status: "Submitted",
    response: { employee: emp("Kavindi Samarakoon"), feedback: "Officer selected general queue by mistake; refresher done.", submittedAt: daysAgo(3), attachmentIds: [] } },
  { id: "FR-0398", complaintId: "CT-2026-1140", requestedAt: daysAgo(16), requestedBy: "u-to2", centre: "Kandy RCC", groupManagerId: "u-gm-kandy",
    reason: "Quality flag on Kandy RCC call.", infoRequired: "Officer explanation for script deviation.", context: "Quality monitoring flagged a call where the closing script was not followed.", sharedAttachmentIds: [], status: "Submitted",
    response: { employee: emp("Sachini Kulathunga"), feedback: "Officer was handling a system outage at the time. Refresher completed.", submittedAt: daysAgo(14), attachmentIds: [] } },
];

export const SEED_ATTACHMENTS: AttachmentMeta[] = [
  { id: "AT-001", complaintId: "CT-2026-1184", kind: "intake", name: "TRC_letter_3317.pdf", type: "application/pdf", size: 184320, uploadedBy: "System", uploadedAt: daysAgo(5, 120), provenance: "Imported from email <3317.trc@trc.gov.lk>", hasBinary: false },
  { id: "AT-002", complaintId: "CT-2026-1184", kind: "investigation", name: "call_29sep_1412.mp3", type: "audio/mpeg", size: 1843200, uploadedBy: "Kasun Fernando", uploadedAt: daysAgo(3), provenance: "Uploaded by investigating officer", hasBinary: false },
  { id: "AT-003", complaintId: "CT-2026-1184", kind: "shared", name: "routing_extract.png", type: "image/png", size: 92160, uploadedBy: "Kasun Fernando", uploadedAt: daysAgo(2, 300), provenance: "Explicitly shared with Kandy RCC (FR-0412)", hasBinary: false },
  { id: "AT-004", requestId: "FR-0409", complaintId: "CT-2026-1196", kind: "response", name: "callback_log.png", type: "image/png", size: 64512, uploadedBy: "Sanjeewa Wijesekara", uploadedAt: daysAgo(1), provenance: "Group Manager response attachment", hasBinary: false },
  { id: "AT-005", complaintId: "CT-2026-1191", kind: "intake", name: "chairman_forward.pdf", type: "application/pdf", size: 120320, uploadedBy: "System", uploadedAt: daysAgo(4, 60), provenance: "Imported from email <0921@chairman.slt.lk>", hasBinary: false },
];

export const SEED_TRAINING: TrainingAction[] = [
  { id: "TR-031", caseIds: ["CT-2026-1191"], employee: emp("Shehani Peris"), gap: "Used withdrawn promotion information", type: "Refresher training", objective: "Officer can locate and verify current promotions in the knowledge base before quoting.", ownerId: null, dueDate: null, priority: "High", status: "Proposed", proposedBy: "u-to1", proposedAt: ago(250), evidence: "", reviewNotes: "", followUp: "", history: [{ ts: ago(250), actor: "Kasun Fernando", action: "Proposed from findings", detail: "CT-2026-1191" }] },
  { id: "TR-028", caseIds: ["CT-2026-1165"], employee: emp("Hasini Jayasuriya"), gap: "Dismissive tone during escalation requests", type: "Coaching", objective: "Demonstrate empathetic escalation language in 5 monitored calls.", ownerId: "u-to1", dueDate: daysAgo(3), priority: "High", status: "In Progress", proposedBy: "u-to1", proposedAt: daysAgo(7), evidence: "2 of 5 monitored calls completed.", reviewNotes: "", followUp: "", history: [{ ts: daysAgo(7), actor: "Kasun Fernando", action: "Proposed from findings" }, { ts: daysAgo(6), actor: "Dilrukshi Ranasinghe", action: "Approved & assigned", detail: "Owner: Kasun Fernando" }, { ts: daysAgo(4), actor: "Kasun Fernando", action: "Started" }] },
  { id: "TR-025", caseIds: ["CT-2026-1140"], employee: emp("Sachini Kulathunga"), gap: "Closing script skipped under load", type: "Process briefing", objective: "Re-brief on closing script during outage surges.", ownerId: "u-to2", dueDate: daysAgo(5), priority: "Medium", status: "Completed", proposedBy: "u-to2", proposedAt: daysAgo(13), evidence: "Briefing delivered 06 Oct; attendance sheet recorded.", reviewNotes: "", followUp: "", history: [{ ts: daysAgo(13), actor: "Nadeesha Perera", action: "Proposed" }, { ts: daysAgo(12), actor: "Dilrukshi Ranasinghe", action: "Approved & assigned" }, { ts: daysAgo(2), actor: "Nadeesha Perera", action: "Marked complete" }] },
  { id: "TR-020", caseIds: ["CT-2026-1098"], employee: emp("Hasini Jayasuriya"), gap: "Outdated fee table", type: "Refresher training", objective: "Use the current relocation fee table.", ownerId: "u-to1", dueDate: "2026-07-31T12:00:00Z", priority: "Medium", status: "Reviewed", proposedBy: "u-to1", proposedAt: "2026-07-15T06:00:00Z", evidence: "Refresher quiz 9/10.", reviewNotes: "Satisfactory.", followUp: "No repeat errors in 30-day QA sample.", history: [{ ts: "2026-07-15T06:00:00Z", actor: "Kasun Fernando", action: "Proposed" }, { ts: "2026-08-05T06:00:00Z", actor: "Dilrukshi Ranasinghe", action: "Reviewed", detail: "Effective" }] },
  { id: "TR-033", caseIds: ["CT-2026-1175"], employee: emp("Dinuka Alwis"), gap: "Confirmed activation before provisioning completed", type: "Process briefing", objective: "Verify provisioning status before confirming activation.", ownerId: "u-to2", dueDate: daysAgo(-6), priority: "Medium", status: "Needs Changes", proposedBy: "u-to2", proposedAt: daysAgo(3), evidence: "Briefing notes drafted.", reviewNotes: "Add the provisioning-status screen steps to the briefing.", followUp: "", history: [{ ts: daysAgo(3), actor: "Nadeesha Perera", action: "Proposed" }, { ts: daysAgo(2), actor: "Dilrukshi Ranasinghe", action: "Approved & assigned" }, { ts: daysAgo(1), actor: "Dilrukshi Ranasinghe", action: "Needs changes", detail: "Add provisioning steps" }] },
  { id: "TR-019", caseIds: ["CT-2026-1170"], employee: emp("Ravindu Mendis"), gap: "Roaming tariff explanation", type: "Coaching", objective: "Coaching on roaming tariffs.", ownerId: null, dueDate: null, priority: "Low", status: "Rejected", proposedBy: "u-to1", proposedAt: daysAgo(5), evidence: "", reviewNotes: "", followUp: "", rejectionReason: "Findings show correct information was given; no skill gap.", history: [{ ts: daysAgo(5), actor: "Kasun Fernando", action: "Proposed" }, { ts: daysAgo(4), actor: "Dilrukshi Ranasinghe", action: "Rejected", detail: "No skill gap" }] },
];

const im = (id: string, mailbox: "1212" | "complaints", from: string, fromName: string, subject: string, mins: number, body: string, extracted: Partial<IntakeFields>, extra: Partial<InboxEmail> = {}): InboxEmail => ({
  id, messageId: `<${id.toLowerCase()}@mail.demo>`, mailbox, from, fromName, subject, receivedAt: ago(mins), body, attachments: [], read: false, extracted, ...extra,
});

export const SEED_INBOX: InboxEmail[] = [
  im("EM-88213", "complaints", "complaints@trc.gov.lk", "TRC Consumer Affairs", "Ref TRC/CC/2026/3361 – Hotline officer refused to log fault", 42,
    "Dear Sir/Madam,\n\nThe Commission has received a complaint from Mr. N. K. Rajapaksha, SLT No. 033-2287410 (contact 077 302 1188), stating that a hotline officer refused to log a fibre fault on 6 October and asked him to call again the following day.\n\nRef: TRC/CC/2026/3361",
    { customer: "N. K. Rajapaksha", sltNumber: "033-2287410", contact: "077 302 1188", issueType: "Officer Behaviour", priority: "High", details: "Hotline officer refused to log a fibre fault on 6 October and asked the customer to call again the following day.", sourceRef: "TRC/CC/2026/3361" },
    { attachments: [{ name: "TRC_3361.pdf", type: "application/pdf", size: 201000 }] }),
  im("EM-88207", "complaints", "chairman.office@slt.lk", "Office of the Chairman", "FW: Complaint regarding misleading package information", 130,
    "Forwarded for necessary action. Customer Ms. A. Fernando (SLT No. 011-2867341, a.fernando82@gmail.com) states she was told her Fibre Unlimited package had no FUP, but speed is being throttled after 200GB.",
    { customer: "Ms. A. Fernando", sltNumber: "011-2867341", customerEmail: "a.fernando82@gmail.com", issueType: "Wrong Information Given", priority: "Critical", details: "Customer was told her Fibre Unlimited package had no fair-usage policy, but speed is throttled after 200GB.", sourceRef: "CHO/2026/0957" }),
  im("EM-88202", "complaints", "complaints@trc.gov.lk", "TRC Consumer Affairs", "RE: Ref TRC/CC/2026/3317 – reminder", 200,
    "Reminder regarding Ref TRC/CC/2026/3317 — Mr. W. A. Senarath, SLT No. 081-2234567. Please provide your findings.",
    { customer: "W. A. Senarath", sltNumber: "081-2234567", issueType: "Officer Behaviour", priority: "High", details: "Reminder from TRC on existing complaint.", sourceRef: "TRC/CC/2026/3317" }),
  im("EM-88199", "complaints", "cqms-alerts@slt.lk", "CQMS Notifications", "CQMS-2026-5590 – Call abandoned during transfer", 260,
    "Call from 045-2231876 was abandoned during transfer to the billing desk after 9 minutes.",
    { sltNumber: "045-2231876", issueType: "Call Handling Delay", priority: "Medium", details: "Call was abandoned during transfer to the billing desk after 9 minutes.", sourceRef: "CQMS-2026-5590" }, { read: true }),
  im("EM-88195", "complaints", "regional.ops@slt.lk", "Regional Operations", "Customer letter received at Matara office", 320,
    "Please register: customer at Matara says hotline officer gave wrong bill due date. SLT 041-2223319.",
    { sltNumber: "041-2223319", issueType: "Wrong Information Given", details: "Hotline officer gave the wrong bill due date.", sourceRef: "" }),
  im("EM-91022", "1212", "s.perera@lankamail.lk", "Suresh Perera", "Complaint about call centre", 380,
    "I called 1212 yesterday about my PEO TV and the officer said a technician would come today. Nobody came. My number is 011-2754490.",
    { customer: "Suresh Perera", sltNumber: "011-2754490", customerEmail: "s.perera@lankamail.lk", issueType: "Fault Follow-up", priority: "Low", details: "Officer said a technician would visit today for a PEO TV fault; no technician arrived." }),
  im("EM-91019", "1212", "kumari.r@yahoo.com", "Kumari Rathnayake", "Very rude officer!!", 520,
    "The lady who answered 1212 at 7.40pm shouted at me when I asked about my bill. SLT 081-2290034. Please take action. Voice note attached.",
    { customer: "Kumari Rathnayake", sltNumber: "081-2290034", customerEmail: "kumari.r@yahoo.com", issueType: "Officer Behaviour", priority: "Medium", details: "Officer shouted at the customer during a billing enquiry at 7.40pm." },
    { attachments: [{ name: "voice_note.m4a", type: "audio/mp4", size: 412000 }] }),
  im("EM-91011", "1212", "no-reply@mailer.example", "Unknown sender", "(no subject)", 900, "Please call me back.", {}, { read: true }),
  im("EM-91004", "1212", "tharindu.jay@gmail.com", "Tharindu Jayasekara", "Fibre fault – officer said ticket closed", 300,
    "Hi, I called 1212 on 6 Oct. Officer said my fibre fault ticket was closed but no one visited. SLT No 011-2810045. Contact 077 811 0045.",
    { customer: "Tharindu Jayasekara", sltNumber: "011-2810045" }, { messageId: "<CAF8812@mail.gmail.com>", processedCaseId: "CT-2026-1210", read: true }),
];

// Emails delivered by the next simulated sync
export const SYNC_POOL: InboxEmail[] = [
  im("EM-91031", "1212", "dilan.p@gmail.com", "Dilan Peiris", "Wrong data package activated", 5,
    "Officer activated a 40GB package instead of the 100GB I asked for. SLT 011-2988123, contact 076 552 1212.",
    { customer: "Dilan Peiris", sltNumber: "011-2988123", contact: "076 552 1212", customerEmail: "dilan.p@gmail.com", issueType: "Package / Promotion", priority: "Medium", details: "Officer activated a 40GB package instead of the requested 100GB." },
    { attachments: [{ name: "sms_screenshot.jpg", type: "image/jpeg", size: 88000 }] }),
  im("EM-88220", "complaints", "crc@slt.lk", "CRC Desk", "CRC-77355 – Long IVR loop", 3,
    "Customer S. Kandiah (021-2245567) reports IVR looped 4 times on Tamil option.",
    { customer: "S. Kandiah", sltNumber: "021-2245567", issueType: "Call Handling Delay", priority: "Medium", details: "IVR looped four times on the Tamil language option.", sourceRef: "CRC-77355" }),
];

export const DEFAULT_SENDER_MAP: { pattern: string; source: Source }[] = [
  { pattern: "complaints@trc.gov.lk", source: "TRC" },
  { pattern: "chairman.office@slt.lk", source: "Chairman's Office" },
  { pattern: "ceo.office@slt.lk", source: "CEO's Office" },
  { pattern: "cxx-escalations@slt.lk", source: "CXX / Top Management" },
  { pattern: "crc@slt.lk", source: "CRC" },
  { pattern: "cqms-alerts@slt.lk", source: "CQMS" },
];

const ne = (enabled: boolean, mandatory: boolean, recipients: string, template: string, email = false) => ({ enabled, mandatory, inApp: true, email, recipients, template });
export const DEFAULT_SETTINGS: Settings = {
  attachment: { types: ["pdf", "png", "jpg", "jpeg", "gif", "webp", "mp3", "m4a", "wav", "ogg", "docx", "xlsx", "txt", "msg", "eml"], maxMb: 15, maxCount: 10 },
  timezone: "Asia/Colombo",
  dateFormat: "DD MMM YYYY",
  retentionYears: 7,
  mailboxes: [
    { id: "1212", label: "1212 Mail", address: "1212@slt.lk", status: "Connected (simulated)", lastSync: ago(2), secretMasked: "••••••••••••a91f" },
    { id: "complaints", label: "Other complaint email", address: "cc-complaints@slt.lk", status: "Connected (simulated)", lastSync: ago(2), secretMasked: "••••••••••••77c2" },
  ],
  senderMap: DEFAULT_SENDER_MAP,
  directory: { provider: "Microsoft Entra ID (not connected)", tenant: "slt.lk", status: "Integration hook only — demo uses mock login" },
  simulateSyncFailure: false,
  reminderDays: 2,
  notifications: {
    assignment: ne(true, true, "Assigned Technical Officer", "{{caseRef}} has been assigned to you by {{actor}}."),
    regional_request: ne(true, true, "Mapped Group Manager", "A regional feedback request {{requestRef}} is awaiting your response.", true),
    regional_response: ne(true, true, "Requesting Technical Officer", "Regional response received for {{caseRef}}."),
    pending_review: ne(true, true, "Managers in scope", "{{caseRef}} is resolved and awaiting your review."),
    returned: ne(true, true, "Investigating officer", "{{caseRef}} was returned for investigation."),
    closed: ne(true, false, "Investigating officer", "{{caseRef}} has been closed."),
    training_assigned: ne(true, true, "Action owner", "Training action {{actionRef}} has been assigned to you."),
    training_reminder: ne(true, false, "Action owner", "Training action {{actionRef}} is due {{dueDate}}."),
    training_review: ne(true, false, "Managers", "Training action {{actionRef}} is ready for review."),
    system: ne(true, true, "Administrators", "System event: {{event}}."),
  },
};

const li = (labels: string[], prefix: string) => labels.map((label, i) => ({ id: `${prefix}${i + 1}`, label, active: true }));
export const DEFAULT_LISTS: BusinessLists = {
  categories: li(["Service Quality", "Officer Conduct", "Process Gap", "Billing", "Technical Follow-up", "General"], "cat"),
  issueTypes: li(["Officer Behaviour", "Wrong Information Given", "No Callback", "Call Handling Delay", "Billing Explanation", "Fault Follow-up", "Package / Promotion", "Other"], "iss"),
  correctiveActions: li(["Officer coached", "Billing adjustment", "Process corrected", "Written explanation sent", "Referred to other unit"], "ca"),
  trainingTypes: li(["Coaching", "Refresher training", "Process briefing"], "tt"),
};

export const SEED_NOTIFICATIONS: { userId: string; event: NotifEvent; ts: string; title: string; target?: { kind: "case" | "request" | "training"; id: string } }[] = [
  { userId: "u-mgr1", event: "pending_review", ts: ago(260), title: "CT-2026-1191 is resolved and awaiting your review.", target: { kind: "case", id: "CT-2026-1191" } },
  { userId: "u-mgr1", event: "pending_review", ts: daysAgo(1, 200), title: "CT-2026-1188 is resolved and awaiting your review.", target: { kind: "case", id: "CT-2026-1188" } },
  { userId: "u-mgr1", event: "training_review", ts: daysAgo(2), title: "Training action TR-025 is ready for review.", target: { kind: "training", id: "TR-025" } },
  { userId: "u-to1", event: "assignment", ts: ago(600), title: "CT-2026-1207 has been assigned to you.", target: { kind: "case", id: "CT-2026-1207" } },
  { userId: "u-to1", event: "training_reminder", ts: daysAgo(1), title: "Training action TR-028 is overdue.", target: { kind: "training", id: "TR-028" } },
  { userId: "u-to2", event: "regional_response", ts: daysAgo(1), title: "Regional response received for CT-2026-1196.", target: { kind: "case", id: "CT-2026-1196" } },
  { userId: "u-to2", event: "returned", ts: daysAgo(2), title: "CT-2026-1175 was returned for investigation.", target: { kind: "case", id: "CT-2026-1175" } },
  { userId: "u-gm-kandy", event: "regional_request", ts: daysAgo(1), title: "Regional feedback request FR-0415 is awaiting your response.", target: { kind: "request", id: "FR-0415" } },
  { userId: "u-gm-kandy", event: "regional_request", ts: daysAgo(2, 300), title: "Regional feedback request FR-0412 is awaiting your response.", target: { kind: "request", id: "FR-0412" } },
  { userId: "u-admin", event: "system", ts: ago(90), title: "Notification delivery: 2 simulated email retries succeeded." },
];

export const SEED_AUDIT: TechAudit[] = [
  { id: "TA-1", ts: daysAgo(30), actor: "Ayesha Karunaratne", category: "Permission", action: "Scope override granted", detail: "Dilrukshi Ranasinghe → All Business Records" },
  { id: "TA-2", ts: daysAgo(20), actor: "Ayesha Karunaratne", category: "Permission", action: "Role update", detail: "Dilrukshi Ranasinghe confirmed as Lead Quality Manager" },
  { id: "TA-3", ts: daysAgo(1), actor: "System", category: "Job", action: "Mailbox sync job completed (simulated)", detail: "2 mailboxes" },
  { id: "TA-4", ts: ago(120), actor: "Dilrukshi Ranasinghe", category: "Auth", action: "Signed in (mock)" },
];
