"use client";
import {
  createContext,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { formError } from "@/lib/validation/form-errors";
import type { DataState, Viewer, Command } from "@/lib/types";
interface Context {
  state: DataState;
  viewer: Viewer;
  busy: boolean;
  message: string;
  feedback: "success" | "error" | null;
  fieldErrors: Record<string, string>;
  lastUpdated: string | null;
  refresh: () => Promise<boolean>;
  setMessage: (s: string) => void;
  commit: (c: Command) => Promise<boolean>;
  mutate: (
    endpoint: string,
    payload: unknown,
    method?: string,
  ) => Promise<boolean>;
  path: (section: string, id?: string) => string;
}
const Context = createContext<Context | null>(null);
export function WorkspaceProvider({
  initialState,
  initialViewer,
  children,
}: {
  initialState: DataState;
  initialViewer: Viewer;
  children: ReactNode;
}) {
  const [snapshot, setSnapshot] = useState({
      source: initialState,
      value: initialState,
    }),
    [viewer, setViewer] = useState(initialViewer),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [feedback, setFeedback] = useState<"success" | "error" | null>(null),
    [fieldErrors, setFieldErrors] = useState<Record<string, string>>({}),
    [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const inFlight = useRef(false);
  if (snapshot.source !== initialState) {
    setSnapshot({ source: initialState, value: initialState });
    setViewer(initialViewer);
  }
  const state = snapshot.value;
  function showMessage(value: string) {
    setMessage(value);
    setFeedback(null);
    if (!value) setFieldErrors({});
  }
  async function refresh() {
    if (inFlight.current) return false;
    inFlight.current = true;
    setBusy(true);
    try {
      const response = await fetch("/api/workspace", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          response.status === 401
            ? "Your session has expired. Sign in again."
            : result.error || "Unable to refresh the workspace.",
        );
      setSnapshot({ source: initialState, value: result.state });
      setViewer(result.viewer);
      setLastUpdated(new Date().toISOString());
      setMessage("Workspace refreshed.");
      setFeedback("success");
      return true;
    } catch (error) {
      setMessage(formError(error, "Unable to refresh. Try again.").message);
      setFeedback("error");
      return false;
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  async function mutate(endpoint: string, payload: unknown, method = "POST") {
    if (inFlight.current) return false;
    inFlight.current = true;
    setBusy(true);
    setMessage("");
    setFieldErrors({});
    try {
      const response = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": viewer.csrf || "",
        },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) {
        const errorMessage =
          response.status === 401
            ? "Your session has expired. Sign in again."
            : result.error || "Unable to save. Try again.";
        const fields: Record<string, string> = {};
        for (const issue of String(errorMessage).split("; ")) {
          const match = issue.match(/^([\w]+)(?:\.[\w.]+)?: (.+)$/);
          if (match) fields[match[1]] = match[2];
        }
        setFieldErrors(fields);
        throw new Error(errorMessage);
      }
      setSnapshot({ source: initialState, value: result.state });
      setLastUpdated(new Date().toISOString());
      setMessage("Changes saved.");
      setFeedback("success");
      return true;
    } catch (e) {
      setMessage(formError(e, "Unable to save").message);
      setFeedback("error");
      return false;
    } finally {
      setBusy(false);
      inFlight.current = false;
    }
  }
  const commit = (command: Command) => mutate("/api/workspace", command);
  return (
    <Context.Provider
      value={{
        state,
        viewer,
        busy,
        message,
        feedback,
        fieldErrors,
        lastUpdated,
        refresh,
        setMessage: showMessage,
        commit,
        mutate,
        path: (section, id) => `/${section}${id ? `/${id}` : ""}`,
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
