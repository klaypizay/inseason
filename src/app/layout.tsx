import {
  PreferencesProvider,
  SettingsButton,
} from "../components/preferences-provider";
import { withSession } from "../server/db/repository";
import { database } from "../server/db/runtime";
import { sessionToken } from "../server/auth/session";
import { Unauthorized } from "../domain/errors";
import type { Metadata } from "next";
import "./styles.css";
export const metadata: Metadata = {
  title: "Season Coach",
  description: "A clear next step for your basketball season.",
};
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let preferences = null;
  const token = await sessionToken();
  if (token) {
    try {
      preferences = await withSession(database, token, (r) =>
        r.preferences().get(),
      );
    } catch (e) {
      if (!(e instanceof Unauthorized)) throw e;
    }
  }
  return (
    <html lang="en">
      <body>
        <PreferencesProvider
          key={preferences ? "signed-in" : "guest"}
          initial={preferences}
        >
          <a className="skip" href="#main">
            Skip to content
          </a>
          <header>
            <a className="brand" href="/today">
              <span aria-hidden="true">◉</span> SEASON COACH
            </a>
            <div className="header-tools">
              <span className="tag">A little more prepared.</span>
              <SettingsButton />
            </div>
          </header>
          {children}
          <footer>Built for the coach. Centered on development.</footer>
        </PreferencesProvider>
      </body>
    </html>
  );
}
