"use client";
import { useActionState } from "react";
import { signInWithGoogle } from "../server/auth/oauth";

export function OAuthForm() {
  const [state, action, pending] = useActionState(signInWithGoogle, {
    error: "",
  });
  return (
    <form action={action} aria-label="Google sign in">
      <label className="check">
        <input type="checkbox" name="adult" required /> I am an adult coach (18
        or older).
      </label>
      <button className="secondary" disabled={pending}>
        {pending ? "Connecting to Google…" : "Continue with Google"}
      </button>
      <p className="error" role="alert">
        {state.error}
      </p>
    </form>
  );
}
