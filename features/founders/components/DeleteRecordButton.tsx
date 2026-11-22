"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { useWorkspace } from "@/components/layout/WorkspaceContext";
import { Modal } from "@/components/ui";
export default function DeleteRecordButton({
  kind,
  id,
  name,
  backTo,
}: {
  kind: "founder" | "application";
  id: string;
  name: string;
  backTo?: string;
}) {
  const { viewer, mutate, busy } = useWorkspace();
  const router = useRouter();
  const [open, setOpen] = useState(false),
    [confirmation, setConfirmation] = useState("");
  if (!viewer.permissions.includes("directory.write")) return null;
  return (
    <>
      <button
        className="button"
        onClick={() => {
          setConfirmation("");
          setOpen(true);
        }}
      >
        <Trash2 size={15} />
        Delete permanently
      </button>
      {open && (
        <Modal title={`Delete ${name}?`} close={() => setOpen(false)}>
          <form
            className="stack-form"
            onSubmit={async (e) => {
              e.preventDefault();
              if (
                await mutate(
                  "/api/records",
                  { kind, id, confirmation },
                  "DELETE",
                )
              ) {
                setOpen(false);
                if (backTo) router.push(backTo);
              }
            }}
          >
            <p>
              This permanently removes this record and its owned linked data.
              Shared Spaces are kept. This cannot be undone.
            </p>
            <label>
              Type DELETE to confirm
              <input
                autoComplete="off"
                required
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
              />
            </label>
            <button
              className="button primary"
              disabled={busy || confirmation !== "DELETE"}
            >
              Delete permanently
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
