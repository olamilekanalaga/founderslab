"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import BrandMark from "@/components/shared/BrandMark";
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
  RefreshCw,
  CheckCircle2,
  CircleAlert,
  Archive,
  Settings as SettingsIcon,
} from "lucide-react";
import type { Section, DataState, Viewer } from "@/lib/types";
import { ROLES } from "@/lib/catalog";
import { SECTION_PERMISSIONS } from "@/lib/sections";
import {
  WorkspaceProvider,
  useWorkspace,
} from "@/components/layout/WorkspaceContext";
import { Modal, Empty, Avatar } from "@/components/ui";
import RecordEditor, { type Resource } from "@/components/shared/RecordEditor";
import Operations from "@/features/bd-partners/Operations";
import Overview from "@/features/programme/components/Overview";
import Directory from "@/features/directory/components/Directory";
import Spaces from "@/features/spaces/components/Spaces";
import Reports from "@/features/reports/components/Reports";
import Campaigns from "@/features/campaigns/components/MonthlyWinner";
import SpaceManagersSettings from "@/features/space-managers/components/SpaceManagersSettings";
import TeamSettings from "@/features/settings/components/Settings";
const navigation = [
  { id: "dashboard", label: "Overview", icon: LayoutDashboard },
  { id: "founders", label: "Founders", icon: Users },
  { id: "companies", label: "Companies", icon: Building2 },
  { id: "operations", label: "Admin operations", icon: Mic2 },
  { id: "owner-invitations", label: "Owner invitations", icon: ShieldCheck },
  { id: "reports", label: "Reports", icon: ChartNoAxesCombined },
  { id: "campaigns", label: "Award archive", icon: Archive },
  { id: "settings", label: "Settings", icon: SettingsIcon },
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
  const {
      state: s,
      viewer,
      path,
      message,
      feedback,
      setMessage,
      refresh,
      busy,
      lastUpdated,
    } = useWorkspace(),
    router = useRouter();
  const [mobile, setMobile] = useState(false),
    [searchOpen, setSearchOpen] = useState(false),
    [accountOpen, setAccountOpen] = useState(false),
    [search, setSearch] = useState(""),
    [signingOut, setSigningOut] = useState(false),
    [editor, setEditor] = useState<{
      resource: Resource;
      record?: Record<string, unknown>;
    } | null>(null);
  const [effects, setEffects] = useState<"glass" | "system" | "reduced">(
    "glass",
  );
  useEffect(() => {
    try {
      const saved = localStorage.getItem("founderslab-appearance");
      if (saved === "glass" || saved === "system" || saved === "reduced")
        setEffects(saved);
    } catch {}
  }, []);
  const appearance = (value: "glass" | "system" | "reduced") => {
    setEffects(value);
    try {
      localStorage.setItem("founderslab-appearance", value);
    } catch {}
  };
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [section, id]);
  useEffect(() => {
    if (!message || feedback !== "success") return;
    const timer = setTimeout(() => setMessage(""), 5000);
    return () => clearTimeout(timer);
  }, [message, feedback, setMessage]);
  const edit = (resource: Resource, record?: Record<string, unknown>) => {
    setMessage("");
    setEditor({ resource, record });
  };
  async function signOut() {
    setSigningOut(true);
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        headers: { "X-CSRF-Token": viewer.csrf || "" },
      });
      if (!response.ok) throw new Error("Sign-out failed. Please try again.");
      router.push("/signin");
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Sign-out failed. Please try again.",
      );
      setSigningOut(false);
    }
  }
  const visible = navigation.filter((n) =>
    viewer.permissions.includes(SECTION_PERMISSIONS[n.id]),
  );
  const pending = s.applications.filter((a) => a.status === "Pending").length;
  const nav = (isMobile = false) => (
    <nav aria-label={isMobile ? "Mobile navigation" : "Workspace navigation"}>
      {visible.map(({ id: navId, label, icon: Icon }) => (
        <Link
          className={
            navId === section ||
            (navId === "operations" && section === "spaces")
              ? "active"
              : ""
          }
          aria-current={
            navId === section ||
            (navId === "operations" && section === "spaces")
              ? "page"
              : undefined
          }
          key={navId}
          href={path(navId)}
          onClick={() => setMobile(false)}
        >
          <Icon size={19} strokeWidth={1.7} />
          <span>{label}</span>
          {navId === "operations" && pending > 0 && <small>{pending}</small>}
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
  const role = ROLES[viewer.roleId]?.name || viewer.roleId;
  const logout = (
    <button
      aria-label="Sign out"
      className="button account-signout"
      onClick={() => void signOut()}
      disabled={signingOut}
    >
      <LogOut size={17} />
      {signingOut ? "Signing out…" : "Sign out"}
    </button>
  );
  const needle = search.trim().toLowerCase();
  const matches = needle
    ? s.founders
        .filter((f) => `${f.name} ${f.xHandle}`.toLowerCase().includes(needle))
        .slice(0, 5)
    : [];
  const companies = needle
    ? s.companies
        .filter((c) =>
          `${c.name} ${c.xHandle || ""} ${c.description}`
            .toLowerCase()
            .includes(needle),
        )
        .slice(0, 5)
    : [];
  return (
    <div
      className="app-shell admin-experience admin-studio admin-desk"
      data-visual-effects={effects}
    >
      <aside className="sidebar">
        <Link
          className="brand"
          href={path("dashboard")}
          aria-label="Founders Lab overview"
        >
          <span className="brand-mark">
            <BrandMark />
          </span>
          <span>
            Founders Lab<small>Programme workspace</small>
          </span>
        </Link>
        <div className="sidebar-workspace">
          <span className="workspace-dot" />
          <div>
            <b>Programme workspace</b>
            <small>People. Projects. Spaces.</small>
          </div>
          <ShieldCheck size={16} />
        </div>
        <p className="nav-label">Workspace</p>
        {nav()}
        <div className="sidebar-bottom">
          <Link className="sidebar-public" href="/">
            Programme website
            <ArrowUpRight size={15} />
          </Link>
          <div className="sidebar-user">
            <Avatar name={viewer.name} />
            <div>
              <b title={viewer.name}>{viewer.name}</b>
              <small>{role}</small>
            </div>
          </div>
          {logout}
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
              <Menu size={22} />
            </button>
            <span className="desktop-only">Workspace</span>
            <ChevronRight size={14} className="desktop-only" />
            <b>{title}</b>
          </div>
          {viewer.permissions.includes("directory.read") && (
            <button
              className="global-search"
              aria-label="Search workspace"
              onClick={() => {
                setSearch("");
                setSearchOpen(true);
              }}
            >
              <Search size={18} />
              <span>Search founders and companies</span>
              <kbd>Search</kbd>
            </button>
          )}
          <div className="topbar-actions">
            {lastUpdated && (
              <span className="workspace-freshness" role="status">
                Updated{" "}
                {new Intl.DateTimeFormat("en-GB", {
                  hour: "2-digit",
                  minute: "2-digit",
                }).format(new Date(lastUpdated))}
              </span>
            )}
            <button
              className={`icon-button ${busy ? "refreshing" : ""}`}
              aria-label="Refresh workspace"
              title={
                lastUpdated
                  ? `Last updated ${new Date(lastUpdated).toLocaleTimeString()}`
                  : "Refresh workspace data"
              }
              onClick={() => void refresh()}
              disabled={busy}
            >
              <RefreshCw size={18} />
            </button>
            <button
              className="account-trigger"
              aria-label={`Open account menu for ${viewer.name}`}
              onClick={() => setAccountOpen(true)}
            >
              <Avatar name={viewer.name} />
            </button>
          </div>
        </header>
        <main className="workspace-main" id="main-content">
          {!can ? (
            <Empty title="Access is restricted">
              Choose an available section from navigation.
            </Empty>
          ) : section === "dashboard" ? (
            <Overview addFounder={() => edit("founder")} />
          ) : section === "founders" || section === "companies" ? (
            <Directory kind={section} id={id} edit={edit} />
          ) : section === "owner-invitations" ? (
            <>
              <div className="page-heading">
                <div>
                  <h1>Owner invitations</h1>
                  <p>Manage reporting access to assigned Spaces.</p>
                </div>
              </div>
              <SpaceManagersSettings />
            </>
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
            Founders Lab <span>· Programme workspace</span>
          </span>
          <span>
            <ShieldCheck size={13} /> Authorised access only
          </span>
        </footer>
      </div>
      {mobile && (
        <Modal
          title="Your workspace"
          close={() => setMobile(false)}
          className="navigation-dialog"
        >
          <div className="mobile-nav">{nav(true)}</div>
          <div className="mobile-account">
            <Avatar name={viewer.name} />
            <div>
              <b>{viewer.name}</b>
              <small>{role}</small>
            </div>
          </div>
          <Link className="button" href="/">
            Programme website
            <ArrowUpRight size={16} />
          </Link>
          {logout}
        </Modal>
      )}
      {accountOpen && (
        <Modal
          title="Your account"
          close={() => setAccountOpen(false)}
          className="account-dialog"
        >
          <div className="account-detail">
            <Avatar name={viewer.name} />
            <h3>{viewer.name}</h3>
            <p>{viewer.email}</p>
            <span className="small-tag">{role}</span>
          </div>
          <fieldset className="studio-appearance">
            <legend>Appearance</legend>
            <div>
              {(["glass", "system", "reduced"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={effects === value}
                  onClick={() => appearance(value)}
                >
                  {value === "glass"
                    ? "Glass"
                    : value === "system"
                      ? "System"
                      : "Reduced effects"}
                </button>
              ))}
            </div>
            <p className="studio-appearance-note" aria-live="polite">
              {effects === "glass"
                ? "Translucent panels and a frosted account sheet."
                : effects === "system"
                  ? "Follows your device’s motion and transparency preferences."
                  : "Solid panels with blur and animations turned off."}
            </p>
          </fieldset>
          {viewer.permissions.includes("team.manage") && (
            <Link
              className="button"
              href={path("settings")}
              onClick={() => setAccountOpen(false)}
            >
              <SettingsIcon size={17} />
              Team and settings
            </Link>
          )}
          {logout}
        </Modal>
      )}
      {searchOpen && (
        <Modal
          title="Search workspace"
          close={() => setSearchOpen(false)}
          className="search-dialog"
        >
          <label className="search-input">
            <Search size={20} />
            <input
              autoFocus
              aria-label="Search founders and companies"
              placeholder="Name, X handle or company…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          {needle ? (
            <>
              <div className="search-results">
                <h3>Founders</h3>
                {matches.map((f) => (
                  <Link
                    key={f.id}
                    href={path("founders", f.id)}
                    onClick={() => setSearchOpen(false)}
                  >
                    <Avatar name={f.name} />
                    <span>
                      <b>{f.name}</b>
                      <small>
                        @{f.xHandle} · {f.country}
                      </small>
                    </span>
                    <ArrowUpRight size={16} />
                  </Link>
                ))}
                {!matches.length && <p>No matching founders.</p>}
                <h3>Companies</h3>
                {companies.map((c) => (
                  <Link
                    key={c.id}
                    href={path("companies", c.id)}
                    onClick={() => setSearchOpen(false)}
                  >
                    <Avatar name={c.name} />
                    <span>
                      <b>{c.name}</b>
                      <small>
                        {c.sector} · {c.country}
                      </small>
                    </span>
                    <ArrowUpRight size={16} />
                  </Link>
                ))}
                {!companies.length && <p>No matching companies.</p>}
              </div>
              <div className="search-all">
                <Link
                  className="button"
                  href={`${path("founders")}?q=${encodeURIComponent(search)}`}
                  onClick={() => setSearchOpen(false)}
                >
                  Search all founders
                </Link>
                <Link
                  className="button"
                  href={`${path("companies")}?q=${encodeURIComponent(search)}`}
                  onClick={() => setSearchOpen(false)}
                >
                  Search all companies
                </Link>
              </div>
            </>
          ) : (
            <Empty title="Find a person or a project">
              Search your programme records by name, handle or company.
            </Empty>
          )}
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
        <div
          className={`toast ${feedback || "notice"}`}
          role={feedback === "error" ? "alert" : "status"}
        >
          {feedback === "error" ? (
            <CircleAlert size={19} />
          ) : (
            <CheckCircle2 size={19} />
          )}
          <span>
            {message}
            {message.includes("Sign in again") && (
              <Link href="/signin">Sign in again</Link>
            )}
          </span>
          <button
            className="icon-button"
            aria-label="Dismiss notification"
            onClick={() => setMessage("")}
          >
            <X size={18} />
          </button>
        </div>
      )}
    </div>
  );
}
