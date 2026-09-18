"use client";
import Link from "next/link";
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
  function openSettings() {
    setDraft(preferences);
    setMessage("");
    setOpen(true);
    startTransition(async () => {
      try {
        const r = await loadPreferences();
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
      <Overlay open={open} onClose={() => setOpen(false)} title="Your settings">
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
        <div className="save-bar">
          <h3>Coach & team profile</h3>
          <p>
            Update experience, guidance preferences, team details, and season
            setup.
          </p>
          <Link href="/setup" onClick={() => setOpen(false)}>
            Edit coach & team profile →
          </Link>
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
