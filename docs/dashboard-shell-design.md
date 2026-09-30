# Dashboard shell redesign

## Product intent

Signed-in pages use a compact application shell: a persistent top toolbar, a collapsible left navigation rail, and the existing page content in a wider workspace. The sidebar owns navigation and saved-plan organization. Account and accessibility preferences remain in the existing settings dialog, opened from one compact toolbar control. Search is omitted until the product has a real searchable index.

## Secure design (Rafter)

The only additional user data rendered by the shell is the signed-in coach's existing library-folder names. The root layout continues to establish identity with the existing opaque server-side session and loads navigation and folders through the same `withSession` repository boundary. Folder ownership remains enforced in the repository; no tenant or account identifier comes from the URL or client. The shell adds no write path, endpoint, credential, token, dependency, raw HTML, or cross-account sharing.

Data flow: browser session cookie → Next.js root layout → `withSession` → owner-scoped navigation/folder reads → React-escaped labels in the sidebar. Trust boundaries are browser-to-app and app-to-database. Spoofing and horizontal privilege risks stay bounded by the existing session and owner-scoped repository. React text rendering prevents folder-name HTML execution. The sidebar limits the number of displayed folders and truncates long labels, while the existing database rules retain the authoritative folder limits. A malicious folder name can affect only its owner's sidebar text and cannot become markup, a URL, or a query. No new repudiation, denial-of-service, or privilege-escalation path is introduced.

Residual risk: the shell's collapsed preference is local UI state and does not persist between devices. This is acceptable because it contains no sensitive data and has no authorization effect.

## Security review

The final diff preserves the existing `withSession` authorization boundary in `src/app/layout.tsx`; folder data is loaded only after the session is accepted and is reduced to `id` and `name` before crossing into the client shell. `src/components/site-navigation.tsx` renders names as ordinary React text and never places them in HTML, URLs, queries, or style values. The dashboard toggle changes presentation state only. There are no new handlers, mutations, credentials, dependencies, network calls, raw HTML sinks, parsers, or logs. OWASP web-app review found no new access-control, injection, cryptographic, authentication, integrity, logging, or SSRF surface. The local Rafter secrets scan of `src` passed. The remote `rafter run` scan could not be performed because automatic approval review rejected uploading the private repository; the structured Rafter design and code reviews were completed locally instead.
