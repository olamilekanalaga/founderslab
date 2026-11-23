"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import BrandMark from "@/components/shared/BrandMark";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Building2,
  Mic2,
  ChartNoAxesCombined,
  Search,
  Menu,
  ChevronRight,
  ArrowUpRight,
  X,
  LogOut,
  ShieldCheck,
} from "lucide-react";
import type { Section, DataState, Viewer } from "@/lib/types";
import { ROLES } from "@/lib/catalog";
import { SECTION_PERMISSIONS } from "@/lib/sections";
import {
  WorkspaceProvider,
  useWorkspace,
} from "@/components/layout/WorkspaceContext";
import { Modal, Empty } from "@/components/ui";
import RecordEditor, { type Resource } from "@/components/shared/RecordEditor";
import Operations from "@/features/bd-partners/Operations";
import Overview from "@/features/programme/components/Overview";
import Directory from "@/features/directory/components/Directory";
import Spaces from "@/features/spaces/components/Spaces";
import Reports from "@/features/reports/components/Reports";
import Campaigns from "@/features/campaigns/components/MonthlyWinner";
import TeamSettings from "@/features/settings/components/Settings";
const navigation = [
  { id: "dashboard", label: "Overview", icon: LayoutDashboard },
  { id: "founders", label: "Founders", icon: Users },
  { id: "companies", label: "Companies", icon: Building2 },
  { id: "operations", label: "Admin operations", icon: Mic2 },
  { id: "reports", label: "Reports", icon: ChartNoAxesCombined },
] as const;
export default function Workspace(props: {
  section: Section;
  id?: string;
  initialState: DataState;
  initialViewer: Viewer;
}) {
  return (
    <WorkspaceProvider
      initialState={props.initialState}
      initialViewer={props.initialViewer}
    >
      <Shell section={props.section} id={props.id} />
    </WorkspaceProvider>
  );
}
function Shell({ section, id }: { section: Section; id?: string }) {
  const { state: s, viewer, path, message, setMessage } = useWorkspace(),
    router = useRouter();
  const [mobile, setMobile] = useState(false),
    [search, setSearch] = useState(""),
    [editor, setEditor] = useState<{
      resource: Resource;
      record?: Record<string, unknown>;
    } | null>(null);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [section, id]);
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(""), 6000);
    return () => clearTimeout(timer);
  }, [message, setMessage]);
  const edit = (resource: Resource, record?: Record<string, unknown>) => {
    setMessage("");
    setEditor({ resource, record });
  };
  const visible = navigation.filter((n) =>
    viewer.permissions.includes(SECTION_PERMISSIONS[n.id]),
  );
  const nav = (mobile = false) => (
    <nav aria-label={mobile ? "Mobile navigation" : "Workspace navigation"}>
      {visible.map(({ id: navId, label, icon: Icon }, i) => (
        <Link
          className={`${navId === section ? "active" : ""} ${i === visible.length - 1 ? "last-nav" : ""}`}
          key={navId}
          href={path(navId)}
          onClick={() => setMobile(false)}
        >
          <Icon size={18} strokeWidth={1.7} />
          <span>{label}</span>
          {navId === "operations" &&
            s.applications.some((a) => a.status === "Pending") && (
              <small>
                {s.applications.filter((a) => a.status === "Pending").length}
              </small>
            )}
        </Link>
      ))}
    </nav>
  );
  const title =
    section === "campaigns"
      ? "Founder award archive"
      : section === "settings"
        ? "Settings"
        : section === "spaces"
          ? "Founder Spaces"
          : navigation.find((n) => n.id === section)?.label;
  const can = viewer.permissions.includes(SECTION_PERMISSIONS[section]);
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand" href={path("dashboard")}>
          <span className="brand-mark">
            <BrandMark />
          </span>
          <span>
            Founders Lab<small>with ⭕️La_Crrypt💰₿</small>
          </span>
        </Link>
        <div className="sidebar-workspace">
          <span className="workspace-dot" />
          <div>
            <b>Founder intelligence</b>
            <small>Private workspace</small>
          </div>
          <span className="tiny-lock">
            <ShieldCheck size={14} />
          </span>
        </div>
        <p className="nav-label">WORKSPACE</p>
        {nav()}
        <div className="sidebar-bottom">
          <Link className="sidebar-public" href="/">
            Programme website <ArrowUpRight size={14} />
          </Link>
          <div className="sidebar-user">
            <span className="host-avatar">OC</span>
            <div>
              <b>{viewer.name}</b>
              <small>{ROLES[viewer.roleId]?.name}</small>
            </div>
            {
              <button
                aria-label="Sign out"
                className="icon-button"
                onClick={async () => {
                  await fetch("/api/auth/logout", {
                    method: "POST",
                    headers: { "X-CSRF-Token": viewer.csrf || "" },
                  });
                  router.push("/signin");
                  router.refresh();
                }}
              >
                <LogOut size={16} />
              </button>
            }
          </div>
        </div>
      </aside>
      <div className="main-column">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              onClick={() => setMobile(true)}
            >
              <Menu size={21} />
            </button>
            <span className="desktop-only">Workspace</span>
            <ChevronRight size={13} className="desktop-only" />
            <b>{title}</b>
          </div>
          <form
            className="global-search"
            onSubmit={(e) => {
              e.preventDefault();
              router.push(
                path("founders") + "?q=" + encodeURIComponent(search),
              );
              setSearch("");
            }}
          >
            <Search size={15} />
            <input
              aria-label="Global founder search"
              placeholder="Find a founder or company…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <kbd>↵</kbd>
          </form>
          <div className="topbar-actions">
            <Link
              href={path("settings")}
              className="host-avatar"
              aria-label="OC — Team and settings"
            >
              OC
            </Link>
          </div>
        </header>
        <main className="workspace-main" id="main-content">
          {!can ? (
            <Empty>
              This role does not have access to {title}. Choose an available
              section from navigation.
            </Empty>
          ) : section === "dashboard" ? (
            <Overview addFounder={() => edit("founder")} />
          ) : section === "founders" || section === "companies" ? (
            <Directory kind={section} id={id} edit={edit} />
          ) : section === "operations" ? (
            <Operations edit={edit} />
          ) : section === "spaces" ? (
            <Spaces id={id} edit={edit} />
          ) : section === "reports" ? (
            <Reports />
          ) : section === "campaigns" ? (
            <Campaigns />
          ) : (
            <TeamSettings edit={edit} />
          )}
        </main>
        <footer className="workspace-footer">
          <span>
            Founders Lab <span>with ⭕️La_Crrypt💰₿</span>
          </span>
          <span>Private workspace · Authorised access only</span>
        </footer>
      </div>
      {mobile && (
        <Modal title="Founders Lab" close={() => setMobile(false)}>
          <div className="mobile-nav">{nav(true)}</div>
          <Link className="text-link" href="/">
            Public programme <ArrowUpRight size={14} />
          </Link>
        </Modal>
      )}
      {editor && (
        <RecordEditor
          key={editor.resource + String(editor.record?.id || "new")}
          resource={editor.resource}
          record={editor.record}
          close={() => setEditor(null)}
        />
      )}
      {message && (
        <div className="toast" role="status">
          <span>{message}</span>
          <button
            className="icon-button"
            aria-label="Dismiss notification"
            onClick={() => setMessage("")}
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
