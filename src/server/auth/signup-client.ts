import "server-only";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export const verifierCookie =
  process.env.NODE_ENV === "production"
    ? "__Host-inseason-signup"
    : "inseason-signup";
export const oauthVerifierCookie =
  process.env.NODE_ENV === "production"
    ? "__Host-inseason-oauth"
    : "inseason-oauth";

export function authRedirectUrl(path: "/auth/confirm" | "/auth/callback") {
  const configured = process.env.APP_URL;
  if (!configured && process.env.NODE_ENV === "production")
    throw new Error("APP_URL is required");
  const url = new URL(configured || "http://localhost:3000");
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (
    url.username ||
    url.password ||
    (url.protocol !== "https:" &&
      !(
        process.env.NODE_ENV !== "production" &&
        local &&
        url.protocol === "http:"
      ))
  )
    throw new Error("APP_URL must use HTTPS outside local development");
  return new URL(path, url.origin).toString();
}

export function signupRedirectUrl() {
  return authRedirectUrl("/auth/confirm");
}

export function signupClient() {
  return authFlowClient("signup");
}

export async function authFlowClient(flow: "signup" | "oauth") {
  const storageKey = `inseason-${flow}`;
  const verifierKey = `${storageKey}-code-verifier`;
  const cookie = flow === "signup" ? verifierCookie : oauthVerifierCookie;
  const jar = await cookies();
  const memory = new Map<string, string>();
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: {
        flowType: "pkce",
        storageKey,
        // Supabase requires this to use custom storage. Only the verifier is
        // persisted; access/refresh tokens never leave request-local memory.
        persistSession: true,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        storage: {
          getItem(key) {
            return key === verifierKey
              ? (jar.get(cookie)?.value ?? null)
              : (memory.get(key) ?? null);
          },
          setItem(key, value) {
            if (key === verifierKey)
              jar.set(cookie, value, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "lax",
                path: "/",
                maxAge: flow === "signup" ? 3600 : 600,
              });
            else memory.set(key, value);
          },
          removeItem(key) {
            if (key === verifierKey) jar.delete(cookie);
            else memory.delete(key);
          },
        },
      },
      global: {
        fetch: (input, init) =>
          fetch(input, { ...init, signal: AbortSignal.timeout(15000) }),
      },
    },
  );
}
