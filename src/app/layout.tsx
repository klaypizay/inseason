import { SiteNavigation } from "../components/site-navigation";
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
  description:
    "Personalized basketball season roadmaps and step-by-step practice plans for your team.",
};
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let preferences = null;
  let navigation = null;
  const token = await sessionToken();
  if (token) {
    try {
      const workspace = await withSession(database, token, async (r) => {
        const preferences = await r.preferences().get();
        return {
          preferences,
          navigation: await r.roadmap().navigation(),
        };
      });
      preferences = workspace.preferences;
      navigation = workspace.navigation;
    } catch (e) {
      if (!(e instanceof Unauthorized)) throw e;
    }
  }
  return (
    <html lang="en">
      <body className={preferences ? "signed-in-shell" : undefined}>
        <PreferencesProvider
          key={preferences ? "signed-in" : "guest"}
          initial={preferences}
        >
          <a className="skip" href="#main">
            Skip to content
          </a>
          <header className="site-header">
            <a className="brand" href="/today">
              <span aria-hidden="true">◉</span> SEASON COACH
            </a>
            {preferences && <SiteNavigation workspace={navigation} />}
            <div className="header-tools">
              <span className="tag">Your team. Your plan.</span>
              <SettingsButton />
            </div>
          </header>
          <div className="site-content">
            {children}
            <footer>
              Plan with your team’s goals in mind. Adjust as they grow.
            </footer>
          </div>
        </PreferencesProvider>
      </body>
    </html>
  );
}
