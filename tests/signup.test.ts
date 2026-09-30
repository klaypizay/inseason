import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  transaction: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
  exchange: vi.fn(),
  issueSession: vi.fn(),
  cookieGet: vi.fn(),
  cookieDelete: vi.fn(),
}));
vi.mock("../src/server/db/runtime", () => ({
  database: { transaction: mocks.transaction },
}));
vi.mock("../src/server/db/repository", () => ({
  digest: (value: string) => `hashed:${value}`,
}));
vi.mock("../src/server/auth/signup-client", () => ({
  verifierCookie: "signup-verifier",
  signupRedirectUrl: () => "http://localhost:3000/auth/confirm",
  signupClient: async () => ({
    auth: {
      signUp: mocks.signUp,
      signOut: mocks.signOut,
      exchangeCodeForSession: mocks.exchange,
    },
  }),
}));
vi.mock("../src/server/auth/session", () => ({
  issueSession: mocks.issueSession,
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: mocks.cookieGet, delete: mocks.cookieDelete }),
}));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`redirect:${path}`);
  },
}));

import { signUp } from "../src/server/auth/signup";
import { GET } from "../src/app/auth/confirm/route";

function form(
  overrides: Partial<
    Record<"email" | "password" | "confirmation" | "adult", string>
  > = {},
) {
  const form = new FormData();
  for (const [key, value] of Object.entries({
    email: "Coach@example.com",
    password: "long synthetic passphrase",
    confirmation: "long synthetic passphrase",
    adult: "on",
    ...overrides,
  }))
    form.set(key, value);
  return form;
}
const initial = { error: "", sent: false };
beforeEach(() => {
  vi.resetAllMocks();
  mocks.query.mockResolvedValue([{ attempts: 1 }]);
  mocks.transaction.mockImplementation((work) => work(mocks.query));
  mocks.signUp.mockResolvedValue({
    data: { session: null, user: { id: "account" } },
    error: null,
  });
  mocks.signOut.mockResolvedValue({ error: null });
  mocks.cookieGet.mockReturnValue({ value: "verifier" });
  mocks.exchange.mockResolvedValue({
    data: {
      session: {},
      user: { id: "verified-account", email_confirmed_at: "2026-09-24" },
    },
    error: null,
  });
});

describe("registration", () => {
  it("accepts an eight-character password", async () => {
    expect(
      await signUp(
        initial,
        form({ password: "eight888", confirmation: "eight888" }),
      ),
    ).toEqual({ error: "", sent: true });
    expect(mocks.signUp).toHaveBeenCalled();
  });
  it.each([
    { adult: "" },
    { email: "invalid" },
    { password: "short" },
    { password: "seven77", confirmation: "seven77" },
    { confirmation: "different password" },
  ])("rejects invalid input before provider calls: %j", async (input) => {
    expect((await signUp(initial, form(input))).sent).toBe(false);
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.signUp).not.toHaveBeenCalled();
  });
  it("sends normalized credentials with a fixed callback, without issuing a session", async () => {
    expect(await signUp(initial, form())).toEqual({ error: "", sent: true });
    expect(mocks.signUp).toHaveBeenCalledWith({
      email: "coach@example.com",
      password: "long synthetic passphrase",
      options: { emailRedirectTo: "http://localhost:3000/auth/confirm" },
    });
    expect(mocks.query).toHaveBeenCalledTimes(2);
    expect(mocks.query.mock.calls[1][1]).toEqual([
      "signup:hashed:coach@example.com",
    ]);
    expect(mocks.issueSession).not.toHaveBeenCalled();
  });
  it("does not reveal duplicate accounts", async () => {
    mocks.signUp.mockResolvedValue({
      data: { session: null },
      error: { code: "user_already_exists" },
    });
    expect(await signUp(initial, form())).toEqual({ error: "", sent: true });
  });
  it.each([4, 31])(
    "blocks signup when rate counters reach %i",
    async (attempts) => {
      mocks.query.mockResolvedValue([{ attempts }]);
      expect((await signUp(initial, form())).error).toContain("Too many");
      expect(mocks.signUp).not.toHaveBeenCalled();
    },
  );
  it("fails closed when the database is unavailable", async () => {
    mocks.transaction.mockRejectedValue(new Error("private DB detail"));
    expect((await signUp(initial, form())).error).not.toContain("private");
    expect(mocks.signUp).not.toHaveBeenCalled();
  });
  it("revokes unexpected auto-confirm sessions and does not log the user in", async () => {
    mocks.signUp.mockResolvedValue({ data: { session: {} }, error: null });
    expect((await signUp(initial, form())).sent).toBe(false);
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(mocks.issueSession).not.toHaveBeenCalled();
  });
  it("does not disclose provider errors", async () => {
    mocks.signUp.mockRejectedValue(new Error("secret provider detail"));
    expect((await signUp(initial, form())).error).not.toContain("secret");
  });
});

describe("confirmation", () => {
  it("exchanges the code, revokes the provider session, and opens setup", async () => {
    await expect(
      GET(
        new Request(
          "http://localhost:3000/auth/confirm?code=valid&next=https://attacker.invalid",
        ),
      ),
    ).rejects.toThrow("redirect:/setup");
    expect(mocks.exchange).toHaveBeenCalledWith("valid");
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(mocks.issueSession).toHaveBeenCalledWith("verified-account");
    expect(mocks.signOut.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.issueSession.mock.invocationCallOrder[0],
    );
    expect(mocks.cookieDelete).toHaveBeenCalledWith("signup-verifier");
  });
  it("rejects confirmation without the initiating browser's verifier", async () => {
    mocks.cookieGet.mockReturnValue(undefined);
    await expect(
      GET(new Request("http://localhost:3000/auth/confirm?code=valid")),
    ).rejects.toThrow("redirect:/signup?confirmation=failed");
    expect(mocks.exchange).not.toHaveBeenCalled();
    expect(mocks.issueSession).not.toHaveBeenCalled();
  });
  it.each(["", "?error=expired&code=bad", `?code=${"x".repeat(2049)}`])(
    "rejects missing, errored or oversized codes",
    async (query) => {
      await expect(
        GET(new Request(`http://localhost:3000/auth/confirm${query}`)),
      ).rejects.toThrow("confirmation=failed");
      expect(mocks.exchange).not.toHaveBeenCalled();
    },
  );
  it("rejects invalid or replayed authorization codes", async () => {
    mocks.exchange.mockResolvedValue({
      data: { session: null, user: null },
      error: { message: "expired" },
    });
    await expect(
      GET(new Request("http://localhost:3000/auth/confirm?code=replayed")),
    ).rejects.toThrow("confirmation=failed");
    expect(mocks.issueSession).not.toHaveBeenCalled();
  });
  it("rejects unverified users even when the provider returns a session", async () => {
    mocks.exchange.mockResolvedValue({
      data: { session: {}, user: { id: "unverified" } },
      error: null,
    });
    await expect(
      GET(new Request("http://localhost:3000/auth/confirm?code=unverified")),
    ).rejects.toThrow("confirmation=failed");
    expect(mocks.signOut).toHaveBeenCalled();
    expect(mocks.issueSession).not.toHaveBeenCalled();
  });
  it("fails closed if provider revocation fails", async () => {
    mocks.signOut.mockResolvedValue({ error: { message: "unavailable" } });
    await expect(
      GET(new Request("http://localhost:3000/auth/confirm?code=valid")),
    ).rejects.toThrow("confirmation=failed");
    expect(mocks.issueSession).not.toHaveBeenCalled();
  });
});
