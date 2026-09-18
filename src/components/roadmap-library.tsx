"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FolderManager } from "./folder-manager";
import type { LibraryItem, LibraryFolder } from "../domain/preferences";
import { saveLibraryItem } from "../server/preferences/actions";
import { Overlay } from "./overlay";
import { useDateFormat } from "./preferences-provider";
export function LibraryDetails({
  initial,
  folders = [],
}: {
  initial: LibraryItem;
  folders?: string[];
}) {
  const router = useRouter();
  const [item, setItem] = useState(initial),
    [draft, setDraft] = useState(initial),
    [open, setOpen] = useState(false),
    [error, setError] = useState(""),
    [pending, start] = useTransition();
  return (
    <div>
      <h2>{item.name}</h2>
      <p className="small">
        {item.folder || "Unfiled"} ·{" "}
        {item.isCurrent ? "Active roadmap" : item.state}
      </p>
      <div className="button-row">
        <button
          className="secondary"
          onClick={() => {
            setDraft(item);
            setError("");
            setOpen(true);
          }}
        >
          Name & organize
        </button>
        <button
          className="secondary"
          disabled={pending}
          onClick={() => {
            setDraft({
              ...item,
              state: item.state === "trash" ? "active" : "trash",
            });
            setError("");
            setOpen(true);
          }}
        >
          {item.state === "trash" ? "Restore" : "Delete"}
        </button>
      </div>
      <Overlay
        open={open}
        onClose={() => {
          if (!pending) setOpen(false);
        }}
        title="Roadmap details"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              try {
                const r = await saveLibraryItem(item.id, {
                  name: draft.name,
                  folder: draft.folder,
                  state: draft.state,
                  revision: draft.revision,
                });
                if (r.item) {
                  setItem(r.item);
                  setOpen(false);
                  router.refresh();
                } else setError(r.error ?? "Unable to save.");
              } catch {
                setError(
                  "Connection interrupted. Reload to check your saved details.",
                );
              }
            });
          }}
        >
          <label>
            Name
            <input
              required
              maxLength={100}
              value={draft.name}
              disabled={pending}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </label>
          <label>
            Folder (optional)
            <input
              maxLength={60}
              list={"folders-" + item.id}
              value={draft.folder}
              disabled={pending}
              onChange={(e) => setDraft({ ...draft, folder: e.target.value })}
            />
            <datalist id={"folders-" + item.id}>
              {folders.map((f) => (
                <option key={f} value={f} />
              ))}
            </datalist>
          </label>
          <p className="small">
            Type a new folder name or choose an existing one.
          </p>
          <label>
            Location
            <select
              value={draft.state}
              disabled={pending || item.isCurrent}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  state: e.target.value as LibraryItem["state"],
                })
              }
            >
              <option value="active">Library</option>
              <option value="archived">Archive</option>
              <option value="trash">Trash</option>
            </select>
          </label>
          {item.isCurrent && (
            <p>
              Accept a replacement roadmap before archiving or deleting this
              active roadmap.
            </p>
          )}
          {draft.state === "trash" && (
            <p role="alert">
              Moving “{draft.name}” to Trash removes it from your library and
              closes its pending review. You can restore it from Trash. Saved
              history is retained.
            </p>
          )}
          {error && <p role="alert">{error}</p>}
          <button
            disabled={pending || (item.isCurrent && draft.state !== "active")}
          >
            {pending
              ? "Saving…"
              : draft.state === "trash"
                ? "Move to Trash"
                : "Save details"}
          </button>
        </form>
      </Overlay>
    </div>
  );
}
export function RoadmapLibrary({
  items,
  folders: savedFolders,
}: {
  items: LibraryItem[];
  folders: LibraryFolder[];
}) {
  const date = useDateFormat();
  const [state, setState] = useState("active"),
    [folder, setFolder] = useState("");
  const folders = [
    ...new Set([
      ...savedFolders.map((f) => f.name),
      ...items.map((x) => x.folder).filter(Boolean),
    ]),
  ].sort();
  const shown = items.filter(
    (x) => x.state === state && (!folder || x.folder === folder),
  );
  return (
    <section className="draft-history">
      <h2>Your roadmap library</h2>
      <p>
        Create folders to organize this library. Delete moves a roadmap to
        recoverable Trash.
      </p>
      <FolderManager folders={savedFolders} onChanged={() => setFolder("")} />
      <div className="library-tools">
        <label>
          Show
          <select value={state} onChange={(e) => setState(e.target.value)}>
            <option value="active">Library</option>
            <option value="archived">Archive</option>
            <option value="trash">Trash</option>
          </select>
        </label>
        <label>
          Folder
          <select value={folder} onChange={(e) => setFolder(e.target.value)}>
            <option value="">All folders</option>
            {folders.map((f) => (
              <option key={f}>{f}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="library-grid">
        {shown.map((item) => (
          <article
            className="card row-card"
            key={item.id + ":" + item.revision}
          >
            <LibraryDetails initial={item} folders={folders} />
            <p>
              {item.status === "succeeded" ? "Saved" : item.status} ·{" "}
              {date(item.created)}
            </p>
            {item.state !== "trash" && (
              <Link
                href={
                  (item.planId ? "/roadmaps/" : "/drafts/") +
                  (item.planId ?? item.id)
                }
              >
                Open {item.action === "draftRoadmap" ? "roadmap" : "assessment"}{" "}
                →
              </Link>
            )}
          </article>
        ))}
      </div>
      {!shown.length && <p>No items here yet.</p>}
    </section>
  );
}
