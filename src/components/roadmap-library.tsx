"use client";
import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FolderManager } from "./folder-manager";
import type { LibraryItem, LibraryFolder } from "../domain/preferences";
import { libraryStatus, type LibrarySelection } from "../domain/preferences";
import {
  saveLibraryItem,
  moveLibraryItems,
} from "../server/preferences/actions";
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
        {item.state === "active"
          ? libraryStatus(item)
          : item.state === "trash"
            ? "Trash"
            : "Archived"}
      </p>
      {item.isCurrent && item.latestPlanStatus === "draft" && (
        <p className="small">
          An earlier version is in use. These latest changes still need your
          review and acceptance.
        </p>
      )}
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
  const date = useDateFormat(),
    router = useRouter();
  const [state, setState] = useState("active"),
    [folder, setFolder] = useState(""),
    [selection, setSelection] = useState<LibrarySelection>([]),
    [destination, setDestination] = useState(""),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [pending, start] = useTransition(),
    [dragging, setDragging] = useState(false);
  const drag = useRef<LibrarySelection>([]);
  const folders = [
    ...new Set([
      ...savedFolders.map((f) => f.name),
      ...items.map((i) => i.folder).filter(Boolean),
    ]),
  ].sort();
  const shown = items.filter(
    (i) =>
      i.state === state &&
      (folder === "" ||
        (folder === "__unfiled"
          ? i.folder === ""
          : i.folder === savedFolders.find((f) => f.id === folder)?.name)),
  );
  const selected = new Set(selection.map((i) => i.id));
  function reset() {
    setSelection([]);
    setMessage("");
    setError("");
    drag.current = [];
    setDragging(false);
  }
  function move(target: LibraryFolder | null, chosen = selection) {
    if (pending || !chosen.length) return;
    setError("");
    setMessage("");
    start(async () => {
      try {
        const r = await moveLibraryItems({
          items: chosen,
          folder: target ? { id: target.id, revision: target.revision } : null,
        });
        if (r.moved) {
          setSelection([]);
          setMessage(
            `Moved ${r.moved.count} ${r.moved.count === 1 ? "item" : "items"} to ${r.moved.folder || "Unfiled"}.`,
          );
          router.refresh();
        } else setError(r.error ?? "Unable to move items.");
      } catch {
        setError(
          "Connection interrupted. Reload to check item locations before trying again.",
        );
      }
    });
  }
  function folderCard(
    name: string,
    key: string,
    target: LibraryFolder | null | undefined,
  ) {
    const count = items.filter(
      (i) =>
        i.state === state &&
        (key === "" ||
          (key === "__unfiled" ? i.folder === "" : i.folder === name)),
    ).length;
    return (
      <button
        key={key}
        type="button"
        className={
          "folder-card" +
          (folder === key ? " selected" : "") +
          (dragging && target !== undefined ? " drop-ready" : "")
        }
        aria-label={`Folder: ${name}`}
        aria-pressed={folder === key}
        disabled={pending}
        onClick={() => {
          reset();
          setFolder(key);
        }}
        onDragOver={(e) => {
          if (target !== undefined && drag.current.length && !pending) {
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
          }
        }}
        onDrop={(e) => {
          e.preventDefault();
          const chosen = drag.current;
          drag.current = [];
          setDragging(false);
          if (target !== undefined) move(target, chosen);
        }}
      >
        <span aria-hidden="true">▱</span>
        <strong>{name}</strong>
        <span className="small">
          {count} {count === 1 ? "item" : "items"}
        </span>
      </button>
    );
  }
  return (
    <section className="draft-history" aria-label="Roadmap library">
      <h2>Your planning library</h2>
      <p>
        Assessments explain team needs; roadmaps organize teaching over time.
        Folders organize these saved items without changing the plan you use.
      </p>
      <FolderManager
        folders={savedFolders}
        onChanged={() => {
          reset();
          setFolder("");
        }}
      />
      <div className="folder-grid" aria-label="Library folders">
        {folderCard("All items", "", undefined)}
        {folderCard("Unfiled", "__unfiled", null)}
        {savedFolders.map((f) => folderCard(f.name, f.id, f))}
      </div>
      <p className="small">
        Select items, then choose Move to folder. On desktop, drag a card or
        your selected cards onto a folder above.
      </p>
      <div className="library-tools">
        <label>
          Show
          <select
            value={state}
            disabled={pending}
            onChange={(e) => {
              reset();
              setState(e.target.value);
            }}
          >
            <option value="active">Library</option>
            <option value="archived">Archive</option>
            <option value="trash">Trash</option>
          </select>
        </label>
        <label>
          Folder
          <select
            value={folder}
            disabled={pending}
            onChange={(e) => {
              reset();
              setFolder(e.target.value);
            }}
          >
            <option value="">All folders</option>
            <option value="__unfiled">Unfiled</option>
            {savedFolders.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="library-selection">
        <label className="check">
          <input
            type="checkbox"
            checked={shown.length > 0 && shown.every((i) => selected.has(i.id))}
            disabled={pending || !shown.length}
            onChange={(e) =>
              setSelection(
                e.target.checked
                  ? shown.map((i) => ({ id: i.id, revision: i.revision }))
                  : [],
              )
            }
          />
          Select all shown
        </label>
        <span>{selection.length} selected</span>
        <label>
          Move to folder
          <select
            value={destination}
            disabled={pending}
            onChange={(e) => setDestination(e.target.value)}
          >
            <option value="">Unfiled</option>
            {savedFolders.map((f) => (
              <option value={f.id} key={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </label>
        <button
          disabled={pending || !selection.length}
          onClick={() => {
            const target = savedFolders.find((f) => f.id === destination);
            if (destination && !target) {
              setError(
                "That folder is no longer available. Choose another folder.",
              );
              return;
            }
            move(target ?? null);
          }}
        >
          {pending ? "Moving…" : "Move selected"}
        </button>
        {selection.length > 0 && (
          <button className="secondary" disabled={pending} onClick={reset}>
            Clear selection
          </button>
        )}
      </div>
      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}
      <div className="library-grid">
        {shown.map((item) => (
          <article
            className={
              "card row-card library-item" +
              (selected.has(item.id) ? " selected" : "")
            }
            key={item.id + ":" + item.revision}
            draggable={!pending}
            onDragStart={(e) => {
              if (
                (e.target as HTMLElement).closest(
                  "button,input,a,select,textarea",
                )
              ) {
                e.preventDefault();
                return;
              }
              if (pending) {
                e.preventDefault();
                return;
              }
              const chosen = selected.has(item.id)
                ? selection
                : [{ id: item.id, revision: item.revision }];
              drag.current = chosen;
              setSelection(chosen);
              setDragging(true);
              e.dataTransfer.effectAllowed = "move";
              e.dataTransfer.setData("text/plain", "Planning library items");
            }}
            onDragEnd={() => {
              drag.current = [];
              setDragging(false);
            }}
          >
            <div className="library-card-tools">
              <label className="check">
                <input
                  type="checkbox"
                  aria-label={`Select ${item.name}`}
                  checked={selected.has(item.id)}
                  disabled={pending}
                  onChange={(e) =>
                    setSelection(
                      e.target.checked
                        ? [
                            ...selection,
                            { id: item.id, revision: item.revision },
                          ]
                        : selection.filter((x) => x.id !== item.id),
                    )
                  }
                />
                Select
              </label>
              <span
                className="drag-handle"
                draggable={!pending}
                aria-label={`Drag ${item.name}`}
                title="Drag into a folder"
              >
                ⠿ Drag
              </span>
            </div>
            <p className="item-kind">
              {libraryStatus(item)}
              {item.isDemo
                ? " · Demo data"
                : item.isExample
                  ? " · Example output"
                  : ""}
            </p>
            <LibraryDetails initial={item} folders={folders} />
            <p className="small">Created {date(item.created)}</p>
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
