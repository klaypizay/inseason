# InSeason authentication and product separation

## Secure design

InSeason serves adult human coaches. Google sign-in uses Supabase Auth's authorization-code flow with PKCE. The browser starts the flow through a same-origin Server Action, Supabase and Google authenticate the coach, and Supabase returns a bounded authorization code to the fixed `/auth/callback` route on the trusted `APP_URL` origin. A separate, short-lived HttpOnly, SameSite=Lax, production-Secure cookie stores only the PKCE verifier. Provider access and refresh tokens remain request-local and are revoked before the existing opaque, database-backed InSeason session is issued.

Email/password signup also uses Supabase PKCE and email confirmation. Supabase owns password hashing and email verification. The server validates email, 8–256 character passwords, matching confirmation, and adult attestation. Atomic global and hashed-email attempt budgets complement provider limits and use generic responses to avoid account enumeration. Neither flow accepts a user-controlled return URL, provider name, account id, tenant id, or role.

Authorization remains resource ownership enforced through the existing database repositories and forced RLS. Account ids come only from provider-verified responses. Logout revokes the application session. InSeason uses InSeason-specific verifier, SDK storage, and application-session cookie names; the basketball domain and Vercel project share no browser cookies or redirects.

## Threat model

Data flow: browser → Vercel/Next.js → Supabase Auth → Google → Supabase Auth → fixed InSeason callback → application session database. Trust boundaries are browser/edge, app/provider, and app/database. PKCE and protected cookies address spoofing and callback replay; HTTPS, fixed origins, provider URL validation, and bounded codes address tampering and disclosure; generic errors avoid provider and account leakage; database and provider rate limits address signup/sign-in abuse; provider identity plus repository ownership checks prevent privilege escalation. No provider token, password, authorization code, or raw provider error is logged.

Abuse twins: automated signup email spam is constrained by global and per-email counters; an attacker replaying or moving a callback lacks the browser verifier; an attacker supplying a redirect cannot influence the fixed callback; an unconfirmed provider identity cannot receive an application session. Residual operational risks are Google/Supabase availability and provider-dashboard misconfiguration. The callback and site URLs must remain `https://inseason.ai` endpoints.

## Implementation review

Rafter's web-application review found no unresolved issue in the authentication diff. `oauth.ts` fixes the provider to Google, verifies the returned Supabase origin and authorize path, and logs only a stage label. `signup-client.ts` validates the operator-controlled HTTPS origin and stores only the flow-specific PKCE verifier in protected cookies. Both callback routes require a bounded code and the initiating browser's verifier, revoke the temporary provider session, and redirect only to fixed local destinations. Signup input is schema-bounded, rate-limit SQL uses parameters, duplicate accounts receive the same response as new accounts, and unexpected auto-confirm sessions fail closed. React escapes all displayed values; no raw HTML, client secret, arbitrary outbound URL, new dependency, or authorization bypass is introduced.

Validation: TypeScript, ESLint, the production build, and all 92 runnable tests passed; 7 credential-dependent tests were skipped. Thirty-five focused OAuth/signup tests cover adult attestation, fixed redirects, unexpected provider destinations, replay and missing-verifier failures, confirmed identity, token revocation, protected verifier storage, password length, enumeration-safe responses, and rate-limit/database failure. Rafter's source-only local secrets scan found no secrets. A repository-wide scan reported only generated `.next` build identifiers; source was clean.

The user explicitly waived the remote Rafter source upload on 2026-09-30. The local design review, web-application review, tests, build, and source-only secrets scan remain the security evidence for this release.
