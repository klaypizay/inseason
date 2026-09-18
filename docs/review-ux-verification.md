# Review UX security review

Scope: account preferences, roadmap metadata and recoverable Trash, and client
review dialogs. Rafter secure-design was applied before implementation; the
Rafter web-app checklist was applied to the completed surface.

- A01 access control: `src/server/preferences/actions.ts:20,31,42` resolves the
  session for every operation. `src/server/db/preferences.ts:50` scopes library
  lookup to the owning account; migration 008 forces account RLS on preferences.
  Existing generation RLS continues to apply. Foreign read/write tests pass.
- A02 crypto: no new cryptography or credential handling. Preferences include no
  credentials. Existing opaque authenticated sessions and transport remain.
  Source-only secret scan and remote result recorded after verification.
- A03 injection: strict bounded schemas precede writes (`preferences.ts:25,67`);
  every value is a bound SQL parameter. Names/folders render as React text, never
  raw HTML. No new shell, deserialization, or file-path surface.
- A04 design: advisory account locks plus expected revisions prevent lost writes.
  Active-roadmap removal is rejected (`preferences.ts:74`). Trash resets a pending
  review and cancels queued/running generation; generation completion already
  checks running status under the same account lock. Historical recovery and
  acceptance require restoration first (`roadmap.ts:178,338,480`).
- A05 configuration: no new public API, debug output, or security-header change.
  Safe action errors omit database details and submitted content.
- A06 dependencies: no dependencies changed; remote SCA remains required.
- A07 authentication: existing session validation is reused; no new login flow.
- A08 integrity: strict field allowlists and immutable plan versions remain;
  organization metadata belongs to the generation across its versions.
- A09 logging: no user content, secrets, or request body logging added.
- A10 SSRF: no outbound endpoint or URL accepted by this feature.

Trash deliberately retains history; it is not a permanent-data-deletion feature.
No paid AI calls are needed for this change.
