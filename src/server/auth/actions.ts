"use server";
import { createClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { z } from "zod";
import { database } from "../db/runtime";
import { digest } from "../db/repository";
import { issueSession, revokeSession } from "./session";
const credentials = z.object({
  email: z.email().max(254),
  password: z.string().min(1).max(256),
  adult: z.literal("on"),
});
export async function signIn(_state: { error: string }, form: FormData) {
  const parsed = credentials.safeParse({
    email: form.get("email"),
    password: form.get("password"),
    adult: form.get("adult"),
  });
  if (!parsed.success)
    return {
      error:
        "Enter your email and password and confirm you are an adult coach.",
    };
  try {
    const allowed = await database.transaction(async (q) => {
      const keys = ["login-global", digest(parsed.data.email.toLowerCase())];
      let allowed = true;
      for (const key of keys) {
        const rows = await q<{ attempts: number }>(
          `insert into coach.login_limits(key,attempts) values($1,1) on conflict(key) do update set
          attempts=case when coach.login_limits.window_start < now()-interval '15 minutes' then 1 else coach.login_limits.attempts+1 end,
          window_start=case when coach.login_limits.window_start < now()-interval '15 minutes' then now() else coach.login_limits.window_start end returning attempts`,
          [key],
        );
        if (rows[0].attempts > (key === "login-global" ? 100 : 10))
          allowed = false;
      }
      return allowed;
    });
    if (!allowed)
      return { error: "Too many sign-in attempts. Try again in 15 minutes." };
    const client = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
        global: {
          fetch: (input, init) =>
            fetch(input, { ...init, signal: AbortSignal.timeout(15000) }),
        },
      },
    );
    const { data, error } = await client.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });
    if (error || !data.user || !data.session)
      return {
        error: "Unable to sign in. Check your credentials and try again.",
      };
    // No provider credentials are persisted; revoke the short-lived login exchange.
    const logout = await client.auth.signOut({ scope: "local" });
    if (logout.error)
      return { error: "Sign-in could not finish. Please try again." };
    await issueSession(data.user.id);
  } catch {
    return { error: "Sign-in is unavailable right now. Please try again." };
  }
  redirect("/today");
}
export async function signOut() {
  await revokeSession();
  redirect("/login");
}
