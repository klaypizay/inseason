"use client";
import { SetupForm } from "./setup-form";
import type { SetupView } from "../domain/onboarding";
import {
  createContext,
  useContext,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import {
  defaultPreferences,
  formatDate,
  formatDateText,
  type Preferences,
} from "../domain/preferences";
import {
  loadPreferences,
  loadSettingsSetup,
  savePreferences,
} from "../server/preferences/actions";
import { Overlay } from "./overlay";
const Context = createContext({
  preferences: defaultPreferences,
  openSettings: () => {},
  signedIn: false,
});
export function PreferencesProvider({
  initial,
  children,
}: {
  initial: Preferences | null;
  children: ReactNode;
}) {
  const [preferences, setPreferences] = useState(initial ?? defaultPreferences),
    [draft, setDraft] = useState(initial ?? defaultPreferences),
    [open, setOpen] = useState(false),
    [message, setMessage] = useState(""),
    [pending, startTransition] = useTransition();
  const [tab, setTab] = useState<"coach" | "team">("coach"),
    [setup, setSetup] = useState<SetupView | null>(null),
    [setupError, setSetupError] = useState(""),
    [setupDirty, setSetupDirty] = useState(false),
    [setupPending, setSetupPending] = useState(false),
    [confirmClose, setConfirmClose] = useState(false);
  function closeSettings() {
    if (pending || setupPending) return;
    if (
      setupDirty ||
      draft.displayName !== preferences.displayName ||
      draft.dateFormat !== preferences.dateFormat
    ) {
      setConfirmClose(true);
      return;
    }
    setOpen(false);
  }
  function openSettings() {
    setSetup(null);
    setSetupError("");
    setSetupDirty(false);
    setConfirmClose(false);
    setTab("coach");
    setDraft(preferences);
    setMessage("");
    setOpen(true);
    startTransition(async () => {
      try {
        const [r, loaded] = await Promise.all([
          loadPreferences(),
          loadSettingsSetup(),
        ]);
        if (loaded.view) setSetup(loaded.view);
        else setSetupError(loaded.error ?? "Unable to load team settings.");
        if (r.preferences) {
          setPreferences(r.preferences);
          setDraft(r.preferences);
        } else setMessage(r.error ?? "Unable to load settings.");
      } catch {
        setMessage("Unable to load settings. Please retry.");
      }
    });
  }
  return (
    <Context.Provider
      value={{ preferences, openSettings, signedIn: !!initial }}
    >
      {children}
      <Overlay open={open} onClose={closeSettings} title="Your settings">
        <div
          className="button-row"
          role="tablist"
          aria-label="Settings sections"
        >
          {(["coach", "team"] as const).map((value) => (
            <button
              key={value}
              role="tab"
              id={"settings-tab-" + value}
              aria-controls="settings-panel"
              tabIndex={tab === value ? 0 : -1}
              onKeyDown={(e) => {
                if (
                  ["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)
                ) {
                  e.preventDefault();
                  const next =
                    e.key === "Home"
                      ? "coach"
                      : e.key === "End"
                        ? "team"
                        : tab === "coach"
                          ? "team"
                          : "coach";
                  setTab(next);
                  document.getElementById("settings-tab-" + next)?.focus();
                }
              }}
              aria-selected={tab === value}
              onClick={() => setTab(value)}
              className={tab === value ? "" : "secondary"}
            >
              {value === "coach" ? "Profile (Coach)" : "Team"}
            </button>
          ))}
        </div>
        {confirmClose && (
          <div role="alert" className="row-card">
            <p>
              You have unsaved settings. Keep editing or discard them before
              closing.
            </p>
            <div className="button-row">
              <button onClick={() => setConfirmClose(false)}>
                Keep editing
              </button>
              <button
                className="secondary"
                onClick={() => {
                  setOpen(false);
                  setConfirmClose(false);
                }}
              >
                Discard &amp; close
              </button>
            </div>
          </div>
        )}
        <div
          role="tabpanel"
          id="settings-panel"
          aria-labelledby={"settings-tab-" + tab}
        >
          <div hidden={tab !== "coach"}>
            <p>Personalize how your coaching workspace looks.</p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                startTransition(async () => {
                  setMessage("");
                  try {
                    const r = await savePreferences(draft);
                    if (r.preferences) {
                      setPreferences(r.preferences);
                      setDraft(r.preferences);
                      setMessage("Settings saved.");
                    } else setMessage(r.error ?? "Unable to save.");
                  } catch {
                    setMessage(
                      "Connection interrupted. Your saved settings are unchanged.",
                    );
                  }
                });
              }}
            >
              <label>
                Coach display name
                <input
                  value={draft.displayName}
                  maxLength={80}
                  disabled={pending}
                  onChange={(e) =>
                    setDraft({ ...draft, displayName: e.target.value })
                  }
                />
              </label>
              <label>
                Date format
                <select
                  disabled={pending}
                  value={draft.dateFormat}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      dateFormat: e.target.value as Preferences["dateFormat"],
                    })
                  }
                >
                  <option>MM/DD/YYYY</option>
                  <option>DD/MM/YYYY</option>
                  <option>YYYY-MM-DD</option>
                </select>
              </label>
              <p className="small">
                Preview: {formatDate("2027-03-18", draft.dateFormat)}. Calendar
                pickers use your browser&apos;s date format.
              </p>
              <button disabled={pending}>
                {pending ? "Saving…" : "Save settings"}
              </button>
              <p role="status">{message}</p>
            </form>
          </div>
          {setupError && <p role="alert">{setupError}</p>}
          {!setup && !setupError && (
            <p role="status">Loading coach and team settings…</p>
          )}
          <div>
            {setup && (
              <SetupForm
                initial={setup}
                mode={tab}
                onDirtyChange={setSetupDirty}
                onPendingChange={setSetupPending}
              />
            )}
          </div>
        </div>
      </Overlay>
    </Context.Provider>
  );
}
export function SettingsButton() {
  const value = useContext(Context);
  return value.signedIn ? (
    <button className="secondary" onClick={value.openSettings}>
      Settings
    </button>
  ) : null;
}
export function useDateFormat() {
  const { preferences } = useContext(Context);
  return (value: string | null | undefined) =>
    formatDate(value, preferences.dateFormat);
}
export function useDateText() {
  const { preferences } = useContext(Context);
  return (value: string) => formatDateText(value, preferences.dateFormat);
}
export function DisplayDate({ value }: { value: string }) {
  const date = useDateFormat();
  return <>{date(value)}</>;
}

export function CoachGreeting() {
  const { preferences } = useContext(Context);
  return <h1>Welcome back, {preferences.displayName || "coach"}.</h1>;
}
