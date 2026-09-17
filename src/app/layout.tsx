import type { Metadata } from "next";
import "./styles.css";
export const metadata: Metadata = {
  title: "Season Coach",
  description: "A clear next step for your basketball season.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <a className="skip" href="#main">
          Skip to content
        </a>
        <header>
          <a className="brand" href="/today">
            <span aria-hidden="true">◉</span> SEASON COACH
          </a>
          <span className="tag">A little more prepared.</span>
        </header>
        {children}
        <footer>Built for the coach. Centered on development.</footer>
      </body>
    </html>
  );
}
