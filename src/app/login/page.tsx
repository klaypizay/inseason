import { LoginForm } from "../../components/login-form";
import Link from "next/link";
import { OAuthForm } from "../../components/oauth-form";

export const metadata = { title: "Sign in | InSeason" };

export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ oauth?: string }>;
}) {
  const params = await searchParams;
  return (
    <main id="main" className="login-grid">
      <section className="intro">
        <p className="eyebrow">YOUR SEASON STARTS HERE</p>
        <h1>
          Coach with
          <br />a clear next step.
        </h1>
        <p className="lede">
          Get a season outline and step-by-step practice plans built around your
          team’s goals, experience and schedule. Review, adjust and head to
          practice with a plan.
        </p>
        <div className="court" aria-hidden="true">
          <div className="circle" />
          <div className="key" />
        </div>
        <p className="small">
          For first-time coaches, parent volunteers and anyone who wants a
          clearer plan for the team.
        </p>
      </section>
      <section className="card login">
        <p className="eyebrow">WELCOME BACK, COACH</p>
        <h2>Get back to your team.</h2>
        <p>Sign in with your coach account.</p>
        {params.oauth === "failed" && (
          <p className="error" role="alert">
            Google sign-in didn’t finish. Please try again in this browser, or
            use email and password.
          </p>
        )}
        <OAuthForm />
        <p className="small">Or sign in with email</p>
        <LoginForm />
        <p className="small">
          New to InSeason? <Link href="/signup">Create an account</Link>.
          Players and parents do not need accounts.
        </p>
      </section>
    </main>
  );
}
