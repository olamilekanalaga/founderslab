"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { DataState, Viewer, Command } from "@/lib/types";
import {
  getSnapshot,
  getServerSnapshot,
  subscribe,
  hydrateDemo,
  saveDemo,
  getSnapshot as demoCurrent,
  resetDemo,
  getReadySnapshot,
  getServerReadySnapshot,
  getRoleSnapshot,
  getServerRoleSnapshot,
  setDemoRole,
} from "@/lib/demo-store";
import { applyCommand, demoViewer, scopeState } from "@/lib/domain";
interface Context {
  state: DataState;
  viewer: Viewer;
  demo: boolean;
  busy: boolean;
  message: string;
  setMessage: (s: string) => void;
  setRole: (s: string) => void;
  commit: (c: Command) => Promise<boolean>;
  reset: () => void;
  invitationPath: string;
  path: (section: string, id?: string) => string;
}
const Context = createContext<Context | null>(null);
export function WorkspaceProvider({
  demo,
  initialState,
  initialViewer,
  children,
}: {
  demo: boolean;
  initialState?: DataState;
  initialViewer?: Viewer;
  children: ReactNode;
}) {
  const ready = useSyncExternalStore(
    subscribe,
    getReadySnapshot,
    getServerReadySnapshot,
  );
  const saved = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const role = useSyncExternalStore(
    subscribe,
    getRoleSnapshot,
    getServerRoleSnapshot,
  );
  const setRole = setDemoRole;
  const [privateState, setPrivateState] = useState(initialState),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [invitationPath, setInvitationPath] = useState("");
  useEffect(() => {
    if (demo) hydrateDemo();
  }, [demo]);
  const viewer = demo ? demoViewer(role) : initialViewer!;
  const state = demo ? scopeState(saved, viewer.permissions) : privateState!;
  async function commit(command: Command) {
    setBusy(true);
    setMessage("");
    try {
      if (demo) {
        saveDemo(applyCommand(demoCurrent(), command, viewer));
        if (command.type === "invite.create")
          setMessage("Fictional invitation recorded. No email sent.");
        else setMessage("Demo changes saved in this browser.");
      } else {
        const response = await fetch("/api/workspace", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": viewer.csrf || "",
          },
          body: JSON.stringify(command),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        setPrivateState(result.state);
        setInvitationPath(result.invitationPath || "");
        setMessage(
          result.invitationPath
            ? "Invitation created. Share the one-time link securely; no email was sent."
            : "Changes saved.",
        );
      }
      return true;
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Unable to save");
      return false;
    } finally {
      setBusy(false);
    }
  }
  if (demo && !ready)
    return (
      <main className="public-page">
        <p role="status">Opening the fictional workspace…</p>
      </main>
    );
  return (
    <Context.Provider
      value={{
        state,
        viewer,
        demo,
        busy,
        message,
        setMessage,
        setRole,
        commit,
        invitationPath,
        reset: () => {
          resetDemo();
          setRole("admin");
          setMessage("Demo reset to 50 fictional founders.");
        },
        path: (section, id) =>
          `${demo ? "/demo" : ""}/${section === "dashboard" && demo ? "" : section}${id ? `/${id}` : ""}`.replace(
            /\/$/,
            "",
          ) || "/demo",
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useWorkspace() {
  const ctx = useContext(Context);
  if (!ctx) throw new Error("Workspace provider missing");
  return ctx;
}
