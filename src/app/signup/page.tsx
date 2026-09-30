import Link from "next/link";
import { OAuthForm } from "../../components/oauth-form";
import { SignupForm } from "../../components/signup-form";

export const metadata = { title: "Create account | InSeason" };

export default async function Signup({
  searchParams,
}: {
  searchParams: Promise<{ confirmation?: string }>;
}) {
  const params = await searchParams;
  return (
    <main id="main" className="login-grid">
      <section className="intro">
        <p className="eyebrow">YOUR SEASON STARTS HERE</p>
        <h1>
          A clear plan.
          <br />A confident coach.
        </h1>
        <p className="lede">
          Build a season outline and step-by-step practice plans around your
          team’s goals, experience, schedule and sport.
        </p>
        <div className="court" aria-hidden="true">
          <div className="circle" />
          <div className="key" />
        </div>
        <p className="small">
          For adult coaches. Players and parents do not need accounts.
        </p>
      </section>
      <section className="card login">
        <p className="eyebrow">WELCOME, COACH</p>
        <h2>Create your account.</h2>
        <p>Use Google, or confirm your email and then set up your team.</p>
        <OAuthForm />
        <p className="small">Or create an account with email</p>
        {params.confirmation === "failed" && (
          <p role="alert" className="error">
            We couldn’t finish signing you in from that link. It may have
            expired or opened in a different browser. If your email is already
            confirmed, sign in below. Otherwise, submit the form again.
          </p>
        )}
        <SignupForm />
        <p className="small">
          Already have an account? <Link href="/login">Sign in</Link>
        </p>
      </section>
    </main>
  );
}
