import { afterEach, beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  start: vi.fn(),
  exchange: vi.fn(),
  logout: vi.fn(),
  issue: vi.fn(),
  get: vi.fn(),
  remove: vi.fn(),
}));
vi.mock("../src/server/auth/signup-client", () => ({
  oauthVerifierCookie: "oauth",
  authRedirectUrl: () => "http://localhost:3000/auth/callback",
  authFlowClient: async () => ({
    auth: {
      signInWithOAuth: m.start,
      exchangeCodeForSession: m.exchange,
      signOut: m.logout,
    },
  }),
}));
vi.mock("../src/server/auth/session", () => ({ issueSession: m.issue }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: m.get, delete: m.remove }),
}));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error("redirect:" + path);
  },
}));
import { signInWithGoogle } from "../src/server/auth/oauth";
import { GET } from "../src/app/auth/callback/route";
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("SUPABASE_URL", "https://auth.example.invalid");
  vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "synthetic-publishable-key");
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(Response.json({ external: { google: true } })),
  );
  m.start.mockResolvedValue({
    data: {
      url: "https://auth.example.invalid/auth/v1/authorize?provider=google",
    },
    error: null,
  });
  m.get.mockReturnValue({ value: "verifier" });
  m.exchange.mockResolvedValue({
    data: {
      session: {},
      user: { id: "coach", email_confirmed_at: "2026-09-24" },
    },
    error: null,
  });
  m.logout.mockResolvedValue({ error: null });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
it("shows a recoverable message when the provider rejects authorization", async () => {
  m.start.mockResolvedValue({
    data: { url: null },
    error: { message: "synthetic provider detail" },
  });
  const form = new FormData();
  form.set("adult", "on");
  expect((await signInWithGoogle({ error: "" }, form)).error).toContain(
    "unavailable",
  );
  expect(m.start).toHaveBeenCalledOnce();
});
it("requires adult attestation and requests only Google with fixed callback", async () => {
  const form = new FormData();
  expect((await signInWithGoogle({ error: "" }, form)).error).toContain(
    "adult",
  );
  expect(m.start).not.toHaveBeenCalled();
  form.set("adult", "on");
  await expect(signInWithGoogle({ error: "" }, form)).rejects.toThrow(
    "redirect:https://auth.example.invalid/auth/v1/authorize",
  );
  expect(m.start).toHaveBeenCalledWith({
    provider: "google",
    options: {
      redirectTo: "http://localhost:3000/auth/callback",
      skipBrowserRedirect: true,
    },
  });
});
it("rejects an unexpected authorization origin", async () => {
  m.start.mockResolvedValue({
    data: { url: "https://attacker.invalid" },
    error: null,
  });
  const f = new FormData();
  f.set("adult", "on");
  expect((await signInWithGoogle({ error: "" }, f)).error).toContain(
    "unavailable",
  );
});
it("exchanges verified identity, revokes provider tokens and issues the app session", async () => {
  await expect(
    GET(
      new Request(
        "http://localhost:3000/auth/callback?code=synthetic&next=https://attacker.invalid",
      ),
    ),
  ).rejects.toThrow("redirect:/today");
  expect(m.issue).toHaveBeenCalledWith("coach");
  expect(m.logout.mock.invocationCallOrder[0]).toBeLessThan(
    m.issue.mock.invocationCallOrder[0],
  );
  expect(m.remove).toHaveBeenCalledWith("oauth");
});
it.each(["?error=access_denied", "", `?code=${"x".repeat(2049)}`])(
  "fails safely for denied or invalid callbacks %s",
  async (query) => {
    await expect(
      GET(new Request("http://localhost:3000/auth/callback" + query)),
    ).rejects.toThrow("redirect:/login?oauth=failed");
    expect(m.issue).not.toHaveBeenCalled();
  },
);
it("rejects missing verifier, unverified email and failed revocation", async () => {
  m.get.mockReturnValue(undefined);
  await expect(
    GET(new Request("http://localhost:3000/auth/callback?code=x")),
  ).rejects.toThrow("oauth=failed");
  expect(m.exchange).not.toHaveBeenCalled();
  m.get.mockReturnValue({ value: "v" });
  m.exchange.mockResolvedValue({
    data: { session: {}, user: { id: "unverified" } },
    error: null,
  });
  await expect(
    GET(new Request("http://localhost:3000/auth/callback?code=x")),
  ).rejects.toThrow("oauth=failed");
  expect(m.issue).not.toHaveBeenCalled();
  m.exchange.mockResolvedValue({
    data: { session: {}, user: { id: "coach", email_confirmed_at: "yes" } },
    error: null,
  });
  m.logout.mockResolvedValue({ error: {} });
  await expect(
    GET(new Request("http://localhost:3000/auth/callback?code=x")),
  ).rejects.toThrow("oauth=failed");
  expect(m.issue).not.toHaveBeenCalled();
});
