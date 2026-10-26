import { useEffect, useState } from "react";
import { ShieldOff } from "lucide-react";
import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";
import Toasts from "./components/Toasts";
import { Card, EmptyState, Button } from "./components/ui";
import CaseWorkspace from "./components/CaseWorkspace";
import { StoreProvider, useStore } from "./store";
import { useRoute, allItems, itemAllowed, firstRoute, go, setParam } from "./nav";
import Login from "./views/Login";
import Dashboard from "./views/Dashboard";
import MyWork from "./views/MyWork";
import CaseList from "./views/CaseList";
import Register from "./views/Register";
import MailInbox from "./views/MailInbox";
import FeedbackList from "./views/FeedbackList";
import GMWorkspace from "./views/GMWorkspace";
import Training from "./views/Training";
import Reports from "./views/Reports";
import ManagerConfig from "./views/ManagerConfig";
import Admin from "./views/Admin";
import Profile from "./views/Profile";

function Shell() {
  const { me, db, logout } = useStore();
  const route = useRoute();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("comtrack:collapsed") === "1");
  const [mobileNav, setMobileNav] = useState(false);
  useEffect(() => { localStorage.setItem("comtrack:collapsed", collapsed ? "1" : "0"); }, [collapsed]);

  const first = firstRoute(me, db.templates);
  const item = allItems().find((i) => i.key === route.key);
  const allowed = !!item && itemAllowed(item, me, db.templates);

  useEffect(() => {
    if (me && !route.key && first) go(first);
  }, [me, route.key, first]);

  if (!me) return null;

  if (!first) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ground p-6">
        <Card className="max-w-md">
          <EmptyState icon={ShieldOff} title="No modules are available for your account" body="Your account is active but has no permitted modules. Contact your administrator to review your access."
            action={<Button onClick={() => logout()}>Sign out</Button>} />
        </Card>
      </div>
    );
  }

  const k = route.key;
  const caseId = route.params.get("case");
  const view = () => {
    if (!allowed) {
      return (
        <Card><EmptyState icon={ShieldOff} title="This page isn't available with your current access" body="Your permissions may have changed, or the link points to a module outside your role."
          action={<Button variant="primary" onClick={() => go(first)}>Go to {allItems().find((i) => i.key === first)?.label}</Button>} /></Card>
      );
    }
    if (k === "dashboard") return <Dashboard />;
    if (k === "my-work") return <MyWork />;
    if (k === "cases/awaiting") return <FeedbackList />;
    if (k.startsWith("cases/")) return <CaseList key={k} view={k} />;
    if (k === "intake/register") return <Training key="training/all" mine={false} initialSub="assign" initialTab="register" />;
    if (k === "intake/1212") return <MailInbox key="1212" mailbox="1212" />;
    if (k === "intake/other") return <MailInbox key="complaints" mailbox="complaints" />;
    if (k === "feedback/pending" || k === "feedback/submitted") return <FeedbackList />;
    if (k === "gm/pending" || k === "gm/submitted") return <GMWorkspace key={k} tab={k === "gm/pending" ? "Pending" : "Submitted"} />;
    if (k === "training/all" || k === "training/mine") return <Training key={k} mine={k === "training/mine"} />;
    if (k.startsWith("reports/")) return <Reports key={k} tab={k.split("/")[1] as "library" | "builder" | "generated"} />;
    if (k.startsWith("config/")) return <ManagerConfig key={k} tab={k.split("/")[1] as "categories" | "settings"} />;
    if (k.startsWith("admin/")) return <Admin key={k} tab={k.split("/")[1]} />;
    if (k === "profile") return <Profile />;
    return null;
  };

  return (
    <div className="flex h-screen overflow-hidden bg-ground">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[70] focus:rounded focus:bg-white focus:px-3 focus:py-2 focus:shadow">Skip to content</a>
      <Sidebar active={k} collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} mobileOpen={mobileNav} onCloseMobile={() => setMobileNav(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar routeKey={k} onMenu={() => setMobileNav(true)} />
        <main id="main" tabIndex={-1} className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-3 outline-none sm:p-6">
          <div key={k} className="animate-fade mx-auto max-w-[1600px]">{view()}</div>
        </main>
      </div>
      {caseId && (me.role === "Manager" || me.role === "Technical Officer") && <CaseWorkspace key={caseId} id={caseId} onClose={() => setParam("case", null)} />}
      <Toasts />
    </div>
  );
}

function Root() {
  const { me } = useStore();
  return me ? <Shell key={me.id} /> : <><Login /><Toasts /></>;
}

export default function App() {
  return (
    <StoreProvider>
      <Root />
    </StoreProvider>
  );
}
