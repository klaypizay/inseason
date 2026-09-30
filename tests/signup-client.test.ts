import { createHash } from "node:crypto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const jar = vi.hoisted(() => ({
  values: new Map<string, string>(),
  set: vi.fn(),
  delete: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (key: string) =>
      jar.values.has(key) ? { value: jar.values.get(key) } : undefined,
    set: jar.set,
    delete: jar.delete,
  }),
}));
import {
  signupClient,
  signupRedirectUrl,
  verifierCookie,
  authFlowClient,
  oauthVerifierCookie,
} from "../src/server/auth/signup-client";

beforeEach(() => {
  vi.resetAllMocks();
  jar.values.clear();
  jar.set.mockImplementation((key, value) => jar.values.set(key, value));
  jar.delete.mockImplementation((key) => jar.values.delete(key));
  vi.stubEnv("SUPABASE_URL", "https://auth.example.invalid");
  vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "synthetic-publishable-key");
  vi.stubEnv("APP_URL", "http://localhost:3000");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

it("persists only a protected PKCE verifier and completes an exchange across requests", async () => {
  const user = {
    id: "synthetic-id",
    email: "coach@example.invalid",
    email_confirmed_at: "2026-09-24",
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    created_at: "2026-09-24",
  };
  let challenge = "";
  let exchanged = false;
  const fetchMock = vi.fn(
    async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      const body = init?.body ? JSON.parse(String(init.body)) : {};
      if (url.includes("/signup")) {
        challenge = body.code_challenge;
        expect(body.code_challenge_method).toBe("s256");
        expect(new URL(url).searchParams.get("redirect_to")).toContain(
          "http://localhost:3000/auth/confirm",
        );
        return Response.json(user);
      }
      if (url.includes("/token?grant_type=pkce")) {
        expect(body.auth_code).toBe("synthetic-code");
        expect(
          createHash("sha256").update(body.code_verifier).digest("base64url"),
        ).toBe(challenge);
        exchanged = true;
        return Response.json({
          access_token: "synthetic-access-token",
          refresh_token: "synthetic-refresh-token",
          expires_in: 3600,
          token_type: "bearer",
          user,
        });
      }
      if (url.includes("/logout")) return new Response(null, { status: 204 });
      throw new Error("Unexpected auth request");
    },
  );
  vi.stubGlobal("fetch", fetchMock);
  const first = await signupClient();
  const signup = await first.auth.signUp({
    email: user.email,
    password: "synthetic passphrase",
    options: { emailRedirectTo: signupRedirectUrl() },
  });
  expect(signup.error).toBeNull();
  expect(jar.values.size).toBe(1);
  expect(jar.set).toHaveBeenCalledWith(
    verifierCookie,
    expect.any(String),
    expect.objectContaining({
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 3600,
    }),
  );
  const second = await signupClient();
  const verified = await second.auth.exchangeCodeForSession("synthetic-code");
  expect(verified.error).toBeNull();
  expect(exchanged).toBe(true);
  expect(verified.data.user?.id).toBe(user.id);
  expect((await second.auth.signOut({ scope: "local" })).error).toBeNull();
  expect(jar.values.size).toBe(0);
  for (const [, value] of jar.set.mock.calls) {
    expect(value).not.toContain("synthetic-access-token");
    expect(value).not.toContain("synthetic-refresh-token");
  }
});

it("uses a separate short-lived verifier for Google authorization", async () => {
  jar.values.set(verifierCookie, "pending-email-verifier");
  const client = await authFlowClient("oauth");
  const result = await client.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: "http://localhost:3000/auth/callback",
      skipBrowserRedirect: true,
    },
  });
  expect(result.error).toBeNull();
  const url = new URL(result.data.url!);
  expect(url.searchParams.get("provider")).toBe("google");
  expect(url.searchParams.get("code_challenge_method")).toBe("s256");
  expect(jar.values.get(verifierCookie)).toBe("pending-email-verifier");
  expect(jar.set).toHaveBeenCalledWith(
    oauthVerifierCookie,
    expect.any(String),
    expect.objectContaining({ httpOnly: true, sameSite: "lax", maxAge: 600 }),
  );
});

it("requires an explicit HTTPS app origin in production", () => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("APP_URL", "");
  expect(() => signupRedirectUrl()).toThrow("APP_URL");
  vi.stubEnv("APP_URL", "http://localhost:3000");
  expect(() => signupRedirectUrl()).toThrow("HTTPS");
  vi.stubEnv("APP_URL", "https://coach.example/some/path?next=external");
  expect(signupRedirectUrl()).toBe("https://coach.example/auth/confirm");
});

it.each([
  "javascript:alert(1)",
  "http://remote.example",
  "https://user:password@example.com",
])("rejects unsafe operator origins: %s", (origin) => {
  vi.stubEnv("APP_URL", origin);
  expect(() => signupRedirectUrl()).toThrow();
});
