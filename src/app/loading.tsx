export default function Loading() {
  return (
    <main id="main" aria-busy="true">
      <p role="status">Getting your coaching workspace ready…</p>
      <div className="card skeleton" />
    </main>
  );
}
