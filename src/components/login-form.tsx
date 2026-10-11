"use client";
import { useActionState } from "react";
import { signIn } from "../server/auth/actions";
export function LoginForm() {
  const [state, action, pending] = useActionState(signIn, { error: "" });
  return (
    <form action={action} aria-label="Email sign in">
      <label htmlFor="email">Email</label>
      <input
        id="email"
        name="email"
        type="email"
        autoComplete="username"
        maxLength={254}
        required
      />
      <label htmlFor="password">Password</label>
      <input
        id="password"
        name="password"
        type="password"
        autoComplete="current-password"
        maxLength={256}
        required
      />
      <p role="alert" className="error">
        {state.error}
      </p>
      <button disabled={pending}>
        {pending ? "Signing in…" : "Sign in →"}
      </button>
    </form>
  );
}
