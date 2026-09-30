"use server";

import { z } from "zod";
import { database } from "../db/runtime";
import { digest } from "../db/repository";
import { signupClient, signupRedirectUrl } from "./signup-client";

const credentials = z
  .object({
    email: z
      .email()
      .max(254)
      .transform((value) => value.toLowerCase()),
    password: z.string().min(8).max(256),
    confirmation: z.string().max(256),
    adult: z.literal("on"),
  })
  .refine((value) => value.password === value.confirmation);

export async function signUp(
  _state: { error: string; sent: boolean },
  form: FormData,
): Promise<{ error: string; sent: boolean }> {
  const parsed = credentials.safeParse({
    email: form.get("email"),
    password: form.get("password"),
    confirmation: form.get("confirmation"),
    adult: form.get("adult"),
  });
  if (!parsed.success)
    return {
      error:
        "Enter a valid email, use a password of 8–256 characters, match both passwords, and confirm you are an adult coach.",
      sent: false,
    };
  try {
    const emailRedirectTo = signupRedirectUrl();
    const allowed = await database.transaction(async (q) => {
      let allowed = true;
      for (const [key, limit] of [
        ["signup-global", 30],
        [`signup:${digest(parsed.data.email)}`, 3],
      ] as const) {
        const rows = await q<{ attempts: number }>(
          `insert into coach.login_limits(key,attempts) values($1,1)
           on conflict(key) do update set
           attempts=case when coach.login_limits.window_start < now()-interval '15 minutes' then 1 else coach.login_limits.attempts+1 end,
           window_start=case when coach.login_limits.window_start < now()-interval '15 minutes' then now() else coach.login_limits.window_start end
           returning attempts`,
          [key],
        );
        if (!rows[0] || rows[0].attempts > limit) allowed = false;
      }
      return allowed;
    });
    if (!allowed)
      return {
        error: "Too many sign-up attempts. Try again in 15 minutes.",
        sent: false,
      };
    const client = await signupClient();
    const { data, error } = await client.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: { emailRedirectTo },
    });
    // Never sign a user in during registration, even if the provider's email
    // confirmation setting was accidentally disabled.
    if (data.session) {
      await client.auth.signOut({ scope: "local" });
      return {
        error: "Registration is unavailable right now. Please try again later.",
        sent: false,
      };
    }
    if (error && error.code !== "user_already_exists") {
      if (error.code === "weak_password")
        return {
          error: "Choose a stronger password that you do not use elsewhere.",
          sent: false,
        };
      if (error.status === 429)
        return {
          error: "Too many sign-up attempts. Please wait before trying again.",
          sent: false,
        };
      return {
        error: "Registration is unavailable right now. Please try again later.",
        sent: false,
      };
    }
    return { error: "", sent: true };
  } catch {
    return {
      error: "Registration is unavailable right now. Please try again later.",
      sent: false,
    };
  }
}
