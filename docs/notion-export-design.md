# Notion practice export design

- **Identity and authorization:** Coaches keep the existing InSeason session. Notion uses OAuth Authorization Code flow. Every export reloads the week through `withSession`, so ownership is checked in the domain repository rather than trusted from the browser.
- **Credentials:** The rotating Notion access and refresh tokens are encrypted with AES-256-GCM in an HTTP-only, secure, SameSite=Lax cookie. The encryption key, OAuth client id, and OAuth client secret stay in Vercel environment variables. Tokens are never logged or exposed to client JavaScript.
- **Data sent:** Only the selected practice title, date, duration, and drill content are sent to Notion after the coach clicks Export. No roster or player profile data is included.
- **API boundary:** OAuth state is single-use, encrypted, expires after ten minutes, and is checked with a timing-safe comparison. Export identifiers are strict UUIDs. Notion responses have bounded parsing and user-safe errors.
- **Destination, retention, and revocation:** OAuth duplicates an “InSeason Practice Plans” template page and returns its id; exports are created only beneath that page. InSeason stores no Notion token in PostgreSQL. Users can revoke the connection in Notion. The cookie expires after 30 days.
- **Threat model:** Cross-user export is prevented by repository ownership checks; CSRF is limited by SameSite cookies, OAuth state, and server actions; token disclosure is limited by encryption and HTTP-only cookies; outbound requests use the fixed Notion API origin, preventing SSRF.
