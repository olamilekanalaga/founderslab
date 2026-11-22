import { redirect, notFound } from "next/navigation";
import { getViewer } from "@/server/auth";
import { loadState } from "@/server/db";
import { scopeState } from "@/lib/domain";
import { SECTIONS, type Section } from "@/lib/types";
import { SECTION_PERMISSIONS } from "@/lib/sections";
import Workspace from "@/components/layout/AdminWorkspace";
import Link from "next/link";
export default async function PrivateWorkspace({
  section,
  id,
}: {
  section: string;
  id?: string;
}) {
  if (
    [
      "research",
      "classification",
      "market-map",
      "opportunities",
      "space-data",
    ].includes(section)
  )
    redirect("/founders");
  if (!SECTIONS.includes(section as Section)) notFound();
  const viewer = await getViewer();
  if (!viewer) redirect("/signin");
  if (!viewer.permissions.includes(SECTION_PERMISSIONS[section as Section]))
    return (
      <main className="auth-page" id="main-content">
        <div className="auth-card">
          <h1>Access is restricted</h1>
          <p>
            Your account does not have permission to view this part of the
            private workspace.
          </p>
          <Link className="button primary" href="/dashboard">
            Back to overview
          </Link>
        </div>
      </main>
    );
  const state = scopeState(await loadState(), viewer.permissions);
  return (
    <Workspace
      initialViewer={viewer}
      initialState={state}
      section={section as Section}
      id={id}
    />
  );
}
