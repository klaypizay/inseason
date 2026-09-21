"use client";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FolderManager } from "./folder-manager";
import type { LibraryItem, LibraryFolder } from "../domain/preferences";
import { libraryStatus, type LibrarySelection } from "../domain/preferences";
import {
  saveLibraryItem,
  moveLibraryItems,
  reorderLibraryItems,
  reorderFolders,
} from "../server/preferences/actions";
import { Overlay } from "./overlay";
import { useDateFormat } from "./preferences-provider";
export function LibraryDetails({
  initial,
  folders = [],
  actionsOnly = false,
}: {
  initial: LibraryItem;
  folders?: string[];
  actionsOnly?: boolean;
}) {
  const router = useRouter();
  const [item, setItem] = useState(initial),
    [draft, setDraft] = useState(initial),
    [open, setOpen] = useState(false),
    [error, setError] = useState(""),
    [pending, start] = useTransition();
  return (
    <div className="library-details">
      {!actionsOnly && (
        <>
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
              review. Choose Use this roadmap when you want to switch to them.
            </p>
          )}
        </>
      )}
      <div className="button-row item-actions">
        <button
          className="secondary icon-button"
          aria-label="Edit"
          title="Edit"
          onClick={() => {
            setDraft(item);
            setError("");
            setOpen(true);
          }}
        >
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path d="m15 5 4 4M4 20l5-1L20 8a2.8 2.8 0 0 0-4-4L5 15l-1 5Z" />
          </svg>
        </button>
        <button
          className="secondary icon-button"
          aria-label={item.state === "trash" ? "Restore" : "Delete"}
          title={item.state === "trash" ? "Restore" : "Delete"}
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
          {item.state === "trash" ? (
            <span aria-hidden="true">↶</span>
          ) : (
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7" />
            </svg>
          )}
        </button>
      </div>
      <Overlay
        open={open}
        onClose={() => {
          if (!pending) setOpen(false);
        }}
        title="Name & folder"
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
              This is the roadmap your practice plans follow. Choose Use this
              roadmap on a replacement before archiving or deleting this one.
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
  seasonId,
}: {
  items: LibraryItem[];
  seasonId?: string;
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
  const [view, setView] = useState("cards");
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const drag = useRef<LibrarySelection>([]);
  const folderDrag = useRef<string | null>(null);
  const sidebar = useRef<HTMLElement>(null);
  const [folderDrop, setFolderDrop] = useState<string | null>(null);
  function orderFolders(source: string, target: string, after: boolean) {
    if (pending || source === target) return;
    const moving = savedFolders.find((f) => f.id === source);
    const ordered = savedFolders.filter((f) => f.id !== source);
    const index = ordered.findIndex((f) => f.id === target);
    if (!moving || index < 0) return;
    ordered.splice(index + (after ? 1 : 0), 0, moving);
    if (ordered.every((f, i) => f.id === savedFolders[i].id)) return;
    setError("");
    setMessage("");
    start(async () => {
      try {
        const result = await reorderFolders({
          items: ordered.map((f) => ({ id: f.id, revision: f.revision })),
        });
        if (result.reordered) {
          setMessage("Folder order saved.");
          router.refresh();
        } else setError(result.error ?? "Unable to reorder folders.");
      } catch {
        setError("Connection interrupted. Reload to check folder order.");
      }
    });
  }
  useEffect(() => {
    if (!dragging) return;
    let x = window.innerWidth / 2,
      y = window.innerHeight / 2,
      frame = 0,
      previous = 0;
    const track = (event: DragEvent) => {
      y = event.clientY;
      x = event.clientX;
    };
    const stop = () => {
      drag.current = [];
      folderDrag.current = null;
      setFolderDrop(null);
      setDragging(false);
      setDropTarget(null);
      cancelAnimationFrame(frame);
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") stop();
    };
    const tick = (time: number) => {
      if (!drag.current.length && !folderDrag.current) return;
      const elapsed = Math.min(32, previous ? time - previous : 16);
      previous = time;
      const panel = sidebar.current;
      const bounds = panel?.getBoundingClientRect();
      if (
        panel &&
        bounds &&
        window.innerWidth >= 1024 &&
        x >= bounds.left &&
        x <= bounds.right &&
        y >= bounds.top &&
        y <= bounds.bottom
      ) {
        const velocity =
          y < bounds.top + 65
            ? -Math.min(1, (bounds.top + 65 - y) / 65)
            : y > bounds.bottom - 65
              ? Math.min(1, (y - bounds.bottom + 65) / 65)
              : 0;
        if (velocity)
          panel.scrollBy({
            top: velocity * elapsed * 0.8,
            behavior: "instant",
          });
      }
      const edge = 100;
      const speed =
        y < edge
          ? -Math.min(1, (edge - y) / edge)
          : y > window.innerHeight - edge
            ? Math.min(1, (y - window.innerHeight + edge) / edge)
            : 0;
      if (speed)
        window.scrollBy({ top: speed * elapsed * 0.8, behavior: "instant" });
      frame = requestAnimationFrame(tick);
    };
    document.addEventListener("dragover", track);
    window.addEventListener("drop", stop);
    window.addEventListener("dragend", stop);
    window.addEventListener("blur", stop);
    window.addEventListener("keydown", key);
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("dragover", track);
      window.removeEventListener("drop", stop);
      window.removeEventListener("dragend", stop);
      window.removeEventListener("blur", stop);
      window.removeEventListener("keydown", key);
    };
  }, [dragging]);
  function reorder(targetId: string, after: boolean, chosen = drag.current) {
    if (
      pending ||
      !seasonId ||
      !chosen.length ||
      chosen.some((i) => i.id === targetId)
    )
      return;
    const ids = new Set(chosen.map((i) => i.id));
    const moving = items.filter((i) => ids.has(i.id));
    const ordered = items.filter((i) => !ids.has(i.id));
    const index = ordered.findIndex((i) => i.id === targetId);
    if (index < 0) return;
    ordered.splice(index + (after ? 1 : 0), 0, ...moving);
    if (ordered.every((item, index) => item.id === items[index].id)) return;
    setError("");
    setMessage("");
    start(async () => {
      try {
        const result = await reorderLibraryItems({
          seasonId,
          items: ordered.map((i) => ({ id: i.id, revision: i.revision })),
        });
        if (result.reordered) {
          setSelection([]);
          setMessage("Library order saved.");
          router.refresh();
        } else setError(result.error ?? "Unable to reorder.");
      } catch {
        setError("Connection interrupted. Reload to check the saved order.");
      }
    });
  }
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
    folderDrag.current = null;
    setFolderDrop(null);
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
          if (folderDrag.current) return;
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
      <h2>Season roadmaps & team assessments</h2>
      <p>
        Roadmaps outline what to teach each week. Assessments suggest what to
        work on based on your team notes. “Draft” means saved for review; “In
        use” marks the roadmap guiding your practices. Folders help you organize
        these items without changing which roadmap you use.
      </p>
      {items.some((item) => item.isDemo || item.isExample) && (
        <p className="small">
          “Example team” labels sample data for trying the app. “Prewritten
          example” labels a demonstration plan, rather than a personalized AI
          result. Neither is an extra planning step.
        </p>
      )}
      <div className="library-layout">
        <aside
          className="library-sidebar"
          aria-label="Folder navigation"
          ref={sidebar}
        >
          <h3>Folders</h3>
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
            {savedFolders.map((f, index) => (
              <div
                key={f.id}
                className={
                  "folder-entry" +
                  (folderDrop?.startsWith(f.id)
                    ? " drop-" + folderDrop.split(":")[1]
                    : "")
                }
                onDragOver={(e) => {
                  if (
                    !folderDrag.current ||
                    folderDrag.current === f.id ||
                    pending
                  )
                    return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  const bounds = e.currentTarget.getBoundingClientRect();
                  setFolderDrop(
                    f.id +
                      (e.clientY > bounds.top + bounds.height / 2
                        ? ":after"
                        : ":before"),
                  );
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node | null))
                    setFolderDrop(null);
                }}
                onDrop={(e) => {
                  if (!folderDrag.current) return;
                  e.preventDefault();
                  const bounds = e.currentTarget.getBoundingClientRect();
                  orderFolders(
                    folderDrag.current,
                    f.id,
                    e.clientY > bounds.top + bounds.height / 2,
                  );
                  folderDrag.current = null;
                  setFolderDrop(null);
                  setDragging(false);
                }}
              >
                {folderCard(f.name, f.id, f)}
                <div className="folder-order-controls">
                  <span
                    className="drag-handle"
                    draggable={!pending}
                    aria-label={`Drag folder ${f.name}`}
                    title="Reorder folder (drag or use arrow keys)"
                    tabIndex={0}
                    role="button"
                    onKeyDown={(e) => {
                      const offset =
                        e.key === "ArrowUp"
                          ? -1
                          : e.key === "ArrowDown"
                            ? 1
                            : 0;
                      if (offset && savedFolders[index + offset]) {
                        e.preventDefault();
                        orderFolders(
                          f.id,
                          savedFolders[index + offset].id,
                          offset > 0,
                        );
                      }
                    }}
                    onDragStart={(e) => {
                      if (pending) {
                        e.preventDefault();
                        return;
                      }
                      drag.current = [];
                      folderDrag.current = f.id;
                      setDragging(true);
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData("text/plain", "Library folder");
                    }}
                    onDragEnd={() => {
                      folderDrag.current = null;
                      setDragging(false);
                      setFolderDrop(null);
                    }}
                  >
                    ⠿
                  </span>
                </div>
              </div>
            ))}
          </div>
          <p className="small">
            Drag a folder by its grip to reorder. All items and Unfiled stay at
            the top.
          </p>
        </aside>
        <div className="library-content">
          <p className="small">
            Select items, then choose Move to folder. On desktop, drag a card or
            your selected items onto a folder, or onto another item to reorder.
            Hold near the top or bottom of the screen to scroll while dragging.
            Order is shared across views.
          </p>
          <div className="library-tools">
            <label>
              View
              <select
                value={view}
                disabled={pending || dragging}
                onChange={(e) => setView(e.target.value)}
              >
                <option value="cards">Cards</option>
                <option value="table">Table</option>
                <option value="list">List</option>
              </select>
            </label>
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
                checked={
                  shown.length > 0 && shown.every((i) => selected.has(i.id))
                }
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
          <div
            className={"library-grid library-view-" + view}
            role={view === "table" ? "table" : undefined}
            aria-label={view === "table" ? "Planning items" : undefined}
          >
            {view === "table" && (
              <div className="library-table-head" role="row">
                <span role="columnheader">Select / order</span>
                <span role="columnheader">Name</span>
                <span role="columnheader">Status</span>
                <span role="columnheader">Folder</span>
                <span role="columnheader">Created</span>
                <span role="columnheader">Open</span>
                <span role="columnheader">Actions</span>
              </div>
            )}
            {shown.map((item, itemIndex) => (
              <article
                className={
                  "card row-card library-item" +
                  (dropTarget?.startsWith(item.id)
                    ? " drop-" + dropTarget.split(":")[1]
                    : "") +
                  (selected.has(item.id) ? " selected" : "")
                }
                key={item.id + ":" + item.revision}
                role={view === "table" ? "row" : undefined}
                draggable={!pending}
                onDragOver={(e) => {
                  if (
                    !drag.current.length ||
                    pending ||
                    drag.current.some((i) => i.id === item.id)
                  )
                    return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  const bounds = e.currentTarget.getBoundingClientRect();
                  setDropTarget(
                    item.id +
                      (e.clientY > bounds.top + bounds.height / 2
                        ? ":after"
                        : ":before"),
                  );
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node | null))
                    setDropTarget(null);
                }}
                onDrop={(e) => {
                  if (!drag.current.length) return;
                  e.preventDefault();
                  const bounds = e.currentTarget.getBoundingClientRect();
                  reorder(item.id, e.clientY > bounds.top + bounds.height / 2);
                  drag.current = [];
                  setDragging(false);
                  setDropTarget(null);
                }}
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
                  e.dataTransfer.setData(
                    "text/plain",
                    "Planning library items",
                  );
                }}
                onDragEnd={() => {
                  drag.current = [];
                  setDragging(false);
                }}
              >
                <div
                  className="library-card-tools"
                  role={view === "table" ? "cell" : undefined}
                >
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
                  </label>
                  <span
                    className="drag-handle"
                    draggable={!pending}
                    aria-label={`Drag ${item.name}`}
                    title="Reorder (drag or use arrow keys)"
                    tabIndex={0}
                    role="button"
                    onKeyDown={(e) => {
                      const offset =
                        e.key === "ArrowUp"
                          ? -1
                          : e.key === "ArrowDown"
                            ? 1
                            : 0;
                      if (offset && shown[itemIndex + offset]) {
                        e.preventDefault();
                        reorder(shown[itemIndex + offset].id, offset > 0, [
                          { id: item.id, revision: item.revision },
                        ]);
                      }
                    }}
                  >
                    ⠿
                  </span>
                </div>
                <div
                  className="library-name"
                  role={view === "table" ? "cell" : undefined}
                >
                  <h2>{item.name}</h2>
                </div>
                <p
                  className="item-kind"
                  role={view === "table" ? "cell" : undefined}
                >
                  {libraryStatus(item)}
                  {item.isDemo
                    ? " · Example team"
                    : item.isExample
                      ? " · Prewritten example"
                      : ""}
                </p>
                <div role={view === "table" ? "cell" : undefined}>
                  <span className="small">{item.folder || "Unfiled"}</span>
                </div>
                <p
                  className="small"
                  role={view === "table" ? "cell" : undefined}
                >
                  {date(item.created)}
                </p>
                <div role={view === "table" ? "cell" : undefined}>
                  {item.state !== "trash" && (
                    <Link
                      href={
                        (item.planId ? "/roadmaps/" : "/drafts/") +
                        (item.planId ?? item.id)
                      }
                    >
                      Open →
                    </Link>
                  )}
                </div>
                <div
                  className="library-actions"
                  role={view === "table" ? "cell" : undefined}
                >
                  <LibraryDetails
                    initial={item}
                    folders={folders}
                    actionsOnly
                  />
                </div>
              </article>
            ))}
          </div>
          {!shown.length && (
            <p>
              No roadmaps or assessments in this view yet. Choose All folders to
              look elsewhere, or open Season roadmap to create your first plan.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
