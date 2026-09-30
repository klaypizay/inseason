import { PreferencesProvider } from "../components/preferences-provider";
import { DashboardShell } from "../components/dashboard-shell";
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
  let folders: { id: string; name: string }[] = [];
  const token = await sessionToken();
  if (token) {
    try {
      const workspace = await withSession(database, token, async (r) => {
        const preferences = await r.preferences().get();
        return {
          preferences,
          navigation: await r.roadmap().navigation(),
          folders: await r.library().folders(),
        };
      });
      preferences = workspace.preferences;
      navigation = workspace.navigation;
      folders = workspace.folders.map(({ id, name }) => ({ id, name }));
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
          {preferences ? (
            <DashboardShell
              workspace={navigation}
              folders={folders}
              displayName={preferences.displayName}
            >
              {children}
            </DashboardShell>
          ) : (
            <>
              <header className="site-header guest-header">
                <a className="brand" href="/today">
                  <span aria-hidden="true">◉</span> INSEASON
                </a>
                <span className="tag">Your team. Your plan.</span>
              </header>
              <div className="site-content">
                {children}
                <footer>
                  Plan with your team’s goals in mind. Adjust as they grow.
                </footer>
              </div>
            </>
          )}
        </PreferencesProvider>
      </body>
    </html>
  );
}
