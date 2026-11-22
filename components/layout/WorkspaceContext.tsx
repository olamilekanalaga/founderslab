"use client";
import { createContext, useContext, useState, type ReactNode } from "react";
import { formError } from "@/lib/validation/form-errors";
import type { DataState, Viewer, Command } from "@/lib/types";
interface Context {
  state: DataState;
  viewer: Viewer;
  busy: boolean;
  message: string;
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
  const [state, setState] = useState(initialState),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  async function mutate(endpoint: string, payload: unknown, method = "POST") {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": initialViewer.csrf || "",
        },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setState(result.state);
      setMessage("Changes saved.");
      return true;
    } catch (e) {
      setMessage(formError(e, "Unable to save").message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  const commit = (command: Command) => mutate("/api/workspace", command);
  return (
    <Context.Provider
      value={{
        state,
        viewer: initialViewer,
        busy,
        message,
        setMessage,
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
