"use client";
import Link from "next/link";
import { useActionState } from "react";
import { signUp } from "../server/auth/signup";

export function SignupForm() {
  const [state, action, pending] = useActionState(signUp, {
    error: "",
    sent: false,
  });
  if (state.sent)
    return (
      <div role="status">
        <h2>Check your email.</h2>
        <p>
          If this address can be registered, you’ll receive a confirmation link.
          Open it in this browser to finish creating your account.
        </p>
        <p className="small">
          Check your spam folder too. If you already have an account, sign in
          with your existing password. To request another link, return to
          sign-up and submit the same details after a few minutes.
        </p>
        <Link className="button-link" href="/login">
          Go to sign in →
        </Link>
      </div>
    );
  return (
    <form action={action}>
      <label htmlFor="email">Email</label>
      <input
        id="email"
        name="email"
        type="email"
        autoComplete="email"
        maxLength={254}
        required
      />
      <label htmlFor="password">Password</label>
      <input
        id="password"
        name="password"
        type="password"
        autoComplete="new-password"
        minLength={8}
        maxLength={256}
        aria-describedby="password-help"
        required
      />
      <p id="password-help" className="small">
        Use at least 8 characters. A few unrelated words make a strong,
        memorable password.
      </p>
      <label htmlFor="confirmation">Confirm password</label>
      <input
        id="confirmation"
        name="confirmation"
        type="password"
        autoComplete="new-password"
        minLength={8}
        maxLength={256}
        required
      />
      <label className="check">
        <input name="adult" type="checkbox" required /> I am an adult coach (18
        or older).
      </label>
      <p role="alert" className="error">
        {state.error}
      </p>
      <button disabled={pending}>
        {pending ? "Creating account…" : "Create account →"}
      </button>
    </form>
  );
}
