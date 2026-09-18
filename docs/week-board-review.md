# Week board presentation review

The generated draft and roadmap review display existing weeks in a responsive,
chronological grid grouped by phase. Compact cards expose emphasis and checkpoint;
full draft notes and source attribution remain in native expandable details.
Editor cards select the existing week editor and reflect its unsaved state.

Security design: existing authenticated, tenant-scoped loaders remain the sole data
source. Coach and model text stays in React-escaped text nodes. No HTML parsing,
new requests, persistence, credentials, dependencies, or authorization paths are
introduced. Card selection uses IDs from the already loaded plan and only changes
local selection. Saving still uses the existing validated server actions. Dates,
locks and plan acceptance semantics are unchanged.

Manual Rafter web review: injection is constrained by escaped JSX; no unsafe HTML
or executable content sinks were added. Access control, session handling, SQL,
cryptography, network destinations and logging are unchanged. Collapsed evidence
remains accessible and generated recommendations remain labeled as drafts.
React review: stable week keys, native keyboard-accessible buttons/details,
explicit selected state, focus transfer to the editor, and responsive wrapping.

Verification: TypeScript, ESLint and desktop/mobile roadmap browser flow, including
card selection, focus transfer and preservation of unsaved edits. Browser artifacts
are under ignored test-results. Remote standard Rafter scan is required on the
published source revision before completion.
