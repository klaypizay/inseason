"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main id="main">
      <section className="card">
        <h1>We couldn’t load your workspace.</h1>
        <p role="alert">
          Please try again. If this continues, ask your pilot administrator to
          check the connection.
        </p>
        <button onClick={reset}>Try again</button>
        <p>
          <a href="/login">Return to sign in</a>
        </p>
      </section>
    </main>
  );
}
