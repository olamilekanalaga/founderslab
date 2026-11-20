"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FlaskConical,
  LayoutDashboard,
  Users,
  Building2,
  Mic2,
  NotebookPen,
  Network,
  BriefcaseBusiness,
  ChartNoAxesCombined,
  Award,
  Settings as SettingsIcon,
  Search,
  Menu,
  RotateCcw,
  PlayCircle,
  ChevronRight,
  ArrowUpRight,
  ArrowLeft,
  X,
  LogOut,
  ShieldCheck,
} from "lucide-react";
import type { Section, DataState, Viewer } from "@/lib/types";
import { ROLES } from "@/lib/catalog";
import { SECTION_PERMISSIONS } from "@/lib/sections";
import { WorkspaceProvider, useWorkspace } from "./WorkspaceContext";
import { Modal, Empty } from "./ui";
import RecordEditor, { type Resource } from "./RecordEditor";
import Overview from "./Overview";
import Directory from "./Directory";
import Spaces from "./Spaces";
import Research from "./Research";
import MarketMap from "./MarketMap";
import Opportunities from "./Opportunities";
import Reports from "./Reports";
import Campaigns from "./Campaigns";
import TeamSettings from "./Settings";
const navigation = [
  { id: "dashboard", label: "Overview", icon: LayoutDashboard },
  { id: "founders", label: "Founders", icon: Users },
  { id: "companies", label: "Companies", icon: Building2 },
  { id: "spaces", label: "Founder Spaces", icon: Mic2 },
  { id: "research", label: "Research", icon: NotebookPen },
  { id: "market-map", label: "Market map", icon: Network },
  { id: "opportunities", label: "Opportunities", icon: BriefcaseBusiness },
  { id: "reports", label: "Reports", icon: ChartNoAxesCombined },
  { id: "campaigns", label: "Campaigns & awards", icon: Award },
  { id: "settings", label: "Team & settings", icon: SettingsIcon },
] as const;
export default function Workspace(props: {
  section: Section;
  id?: string;
  demo: boolean;
  initialState?: DataState;
  initialViewer?: Viewer;
}) {
  return (
    <WorkspaceProvider
      demo={props.demo}
      initialState={props.initialState}
      initialViewer={props.initialViewer}
    >
      <Shell section={props.section} id={props.id} />
    </WorkspaceProvider>
  );
}
function Shell({ section, id }: { section: Section; id?: string }) {
  const {
      state: s,
      viewer,
      demo,
      path,
      setRole,
      message,
      setMessage,
      reset,
    } = useWorkspace(),
    router = useRouter();
  const [mobile, setMobile] = useState(false),
    [resetting, setReset] = useState(false),
    [search, setSearch] = useState(""),
    [tour, setTour] = useState<number | null>(null),
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
          {navId === "spaces" &&
            s.applications.some((a) => a.status === "Pending") && (
              <small>
                {s.applications.filter((a) => a.status === "Pending").length}
              </small>
            )}
        </Link>
      ))}
    </nav>
  );
  const campaign = s.campaigns.filter((c) => c.status === "Open").at(-1),
    members = s.campaignParticipants.filter(
      (p) => p.campaignId === campaign?.id,
    ).length;
  const title = navigation.find((n) => n.id === section)?.label;
  const can = viewer.permissions.includes(SECTION_PERMISSIONS[section]);
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand" href={path("dashboard")}>
          <span className="brand-mark">
            <FlaskConical size={21} strokeWidth={1.8} />
          </span>
          <span>
            Founders Lab<small>with Ola_Crrypt</small>
          </span>
        </Link>
        <div className="sidebar-workspace">
          <span className="workspace-dot" />
          <div>
            <b>Founder intelligence</b>
            <small>{demo ? "Demo workspace" : "Private workspace"}</small>
          </div>
          <span className="tiny-lock">
            <ShieldCheck size={14} />
          </span>
        </div>
        <p className="nav-label">WORKSPACE</p>
        {nav()}
        <div className="sidebar-bottom">
          {campaign && (
            <Link className="sidebar-campaign" href={path("campaigns")}>
              <div className="row-between">
                <span className="mini-award">
                  <Award size={17} />
                </span>
                <span>MONTHLY COHORT</span>
              </div>
              <b>{campaign.name}</b>
              <p>
                {members} of {campaign.target} founders
              </p>
              <span className="progress">
                <i
                  style={{
                    width: `${Math.min(100, (100 * members) / campaign.target)}%`,
                  }}
                />
              </span>
              <small>
                {campaign.awardAmount} founder award <ArrowUpRight size={13} />
              </small>
            </Link>
          )}
          <Link className="sidebar-public" href="/">
            Programme website <ArrowUpRight size={14} />
          </Link>
          <div className="sidebar-user">
            <span className="host-avatar">OC</span>
            <div>
              <b>{viewer.name}</b>
              <small>{ROLES[viewer.roleId]?.name}</small>
            </div>
            {!demo && (
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
            )}
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
            {demo && (
              <>
                <button
                  className="button guide-button"
                  onClick={() => {
                    setTour(0);
                    router.push(path("spaces") + "?tab=applications");
                  }}
                  aria-label="Start guided walkthrough"
                >
                  <PlayCircle size={16} />
                  <span>Guided walkthrough</span>
                </button>
                <button
                  className="icon-button"
                  aria-label="Reset demo"
                  onClick={() => setReset(true)}
                >
                  <RotateCcw size={17} />
                </button>
              </>
            )}
            <Link
              href={path("settings")}
              className="host-avatar"
              aria-label="OC — Team and settings"
            >
              OC
            </Link>
          </div>
        </header>
        {(demo || s.fictional) && (
          <div className="demo-banner">
            <div>
              <span className="demo-dot" />
              <b>{demo ? "Fictional demo" : "Fictional seed data"}</b>
              <span className="demo-description">
                {demo
                  ? "Explore freely. Changes stay in this browser."
                  : "Development programme records, not real founders."}
              </span>
            </div>
            {demo && (
              <label>
                Preview as
                <select
                  aria-label="Demo role preview"
                  value={viewer.roleId}
                  onChange={(e) => setRole(e.target.value)}
                >
                  {Object.entries(ROLES).map(([id, r]) => (
                    <option key={id} value={id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        )}
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
          ) : section === "spaces" ? (
            <Spaces id={id} edit={edit} />
          ) : section === "research" ? (
            <Research edit={edit} />
          ) : section === "market-map" ? (
            <MarketMap edit={edit} />
          ) : section === "opportunities" ? (
            <Opportunities edit={edit} />
          ) : section === "reports" ? (
            <Reports />
          ) : section === "campaigns" ? (
            <Campaigns edit={edit} />
          ) : (
            <TeamSettings edit={edit} />
          )}
        </main>
        <footer className="workspace-footer">
          <span>
            Founders Lab <span>with Ola_Crrypt</span>
          </span>
          <span>
            {demo
              ? "Fictional programme data · Demo v1"
              : "Private workspace · Authorised access only"}
          </span>
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
      {resetting && (
        <Modal title="Reset the demo?" close={() => setReset(false)}>
          <p>
            This resets local demo edits to the 50-founder sample. Private
            database records and public applications are untouched.
          </p>
          <div className="form-actions">
            <button className="button" onClick={() => setReset(false)}>
              Keep changes
            </button>
            <button
              className="button primary"
              onClick={() => {
                reset();
                setEditor(null);
                setReset(false);
                router.push("/demo");
              }}
            >
              Reset fictional demo
            </button>
          </div>
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
      {tour !== null && (
        <Tour
          step={tour}
          change={setTour}
          close={() => setTour(null)}
          navigate={(url) => router.push(url)}
          path={path}
        />
      )}
    </div>
  );
}
function Tour({
  step,
  change,
  close,
  navigate,
  path,
}: {
  step: number;
  change: (n: number) => void;
  close: () => void;
  navigate: (url: string) => void;
  path: (s: string) => string;
}) {
  const steps = [
    {
      name: "Review an application",
      url: path("spaces") + "?tab=applications",
      text: "Open a pending application and approve it. Founder and company records will be linked.",
    },
    {
      name: "Assign a Space",
      url: path("spaces") + "?tab=bookings",
      text: "Create a pending booking, then approve it. Capacity is counted per founder project, not per speaker.",
    },
    {
      name: "Capture the interview",
      url: path("research"),
      text: "Add research for that appearance. Edit its Space and paste one shared recording URL.",
    },
    {
      name: "Map a useful connection",
      url: path("market-map"),
      text: "Record a relationship with evidence. Keep it a hypothesis until it is verified.",
    },
    {
      name: "Document an opportunity",
      url: path("opportunities"),
      text: "Connect a documented need to a possible solution, owner and next action.",
    },
    {
      name: "Build a research brief",
      url: path("reports"),
      text: "Filter the records, check sample size and missing data, then export CSV or PDF.",
    },
  ];
  const current = steps[step];
  return (
    <aside className="tour-bar" aria-label="Guided walkthrough">
      <div className="tour-step">
        {step + 1}
        <small>/ 6</small>
      </div>
      <div>
        <b>{current.name}</b>
        <p>{current.text}</p>
      </div>
      <div className="tour-actions">
        <button
          className="icon-button"
          aria-label="Previous tour step"
          disabled={!step}
          onClick={() => {
            change(step - 1);
            navigate(steps[step - 1].url);
          }}
        >
          <ArrowLeft size={16} />
        </button>
        <button
          className="button primary"
          onClick={() => {
            if (step === 5) close();
            else {
              change(step + 1);
              navigate(steps[step + 1].url);
            }
          }}
        >
          {step === 5 ? "Finish" : "Next"}
          <ChevronRight size={14} />
        </button>
        <button
          className="icon-button"
          aria-label="Close guided walkthrough"
          onClick={close}
        >
          <X size={16} />
        </button>
      </div>
    </aside>
  );
}
