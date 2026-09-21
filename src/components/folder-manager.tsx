"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Overlay } from "./overlay";
import { manageFolder } from "../server/preferences/actions";
import type { LibraryFolder } from "../domain/preferences";
export function FolderManager({
  folders,
  onChanged,
}: {
  folders: LibraryFolder[];
  onChanged: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false),
    [mode, setMode] = useState<"create" | "manage">("create"),
    [name, setName] = useState(""),
    [selected, setSelected] = useState(""),
    [confirmDelete, setConfirmDelete] = useState(false),
    [error, setError] = useState(""),
    [pending, start] = useTransition();
  const folder = folders.find((f) => f.id === selected);
  function launch(next: typeof mode) {
    setMode(next);
    setName("");
    setSelected("");
    setConfirmDelete(false);
    setError("");
    setOpen(true);
  }
  function submit(action: "create" | "rename" | "delete") {
    setError("");
    start(async () => {
      try {
        const r = await manageFolder(
          action === "create"
            ? { action, name }
            : action === "rename"
              ? { action, id: folder?.id, revision: folder?.revision, name }
              : { action, id: folder?.id, revision: folder?.revision },
        );
        if (r.folders) {
          setOpen(false);
          onChanged();
          router.refresh();
        } else setError(r.error ?? "Unable to update folders.");
      } catch {
        setError("Connection interrupted. Reload to check your folders.");
      }
    });
  }
  return (
    <>
      <div className="button-row">
        <button onClick={() => launch("create")}>New folder</button>
        <button className="secondary" onClick={() => launch("manage")}>
          Manage folders
        </button>
      </div>
      <Overlay
        open={open}
        onClose={() => {
          if (!pending) setOpen(false);
        }}
        title={mode === "create" ? "New folder" : "Manage folders"}
      >
        <p>
          Group roadmaps and assessments however you like, such as “Preseason
          ideas” or “Plans to revisit.” Removing a folder keeps its contents in
          Unfiled.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit(mode === "create" ? "create" : "rename");
          }}
        >
          {mode === "manage" && (
            <label>
              Choose folder
              <select
                value={selected}
                disabled={pending}
                onChange={(e) => {
                  setSelected(e.target.value);
                  setName(
                    folders.find((f) => f.id === e.target.value)?.name ?? "",
                  );
                  setConfirmDelete(false);
                  setError("");
                }}
              >
                <option value="">Choose a folder</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {(mode === "create" || folder) && (
            <>
              <label>
                Folder name
                <input
                  required
                  maxLength={60}
                  value={name}
                  disabled={pending}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <div className="button-row">
                <button disabled={pending}>
                  {mode === "create" ? "Create folder" : "Rename folder"}
                </button>
                {folder && (
                  <button
                    className="secondary"
                    type="button"
                    disabled={pending}
                    onClick={() => setConfirmDelete(true)}
                  >
                    Remove folder
                  </button>
                )}
              </div>
            </>
          )}
          {mode === "manage" && !folders.length && (
            <p>
              No folders yet. Close this dialog and choose New folder to create
              one.
            </p>
          )}
          {confirmDelete && folder && (
            <div role="alert" className="row-card">
              <p>
                Remove “{folder.name}”? Its contents will move to Unfiled,
                including archived and trashed items. No saved plans or
                assessments will be deleted.
              </p>
              <div className="button-row">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => submit("delete")}
                >
                  Confirm remove folder
                </button>
                <button
                  type="button"
                  className="secondary"
                  disabled={pending}
                  onClick={() => setConfirmDelete(false)}
                >
                  Keep folder
                </button>
              </div>
            </div>
          )}
          {error && <p role="alert">{error}</p>}
        </form>
      </Overlay>
    </>
  );
}
