import { LoginForm } from "../../components/login-form";
export const metadata = { title: "Sign in | Season Coach" };
export default function Login() {
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
          basketball team’s goals, experience and schedule. Review, adjust and
          head to the court with a plan.
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
        <LoginForm />
        <p className="small">
          During this private pilot, use the coach account provided with your
          invitation. Players and parents do not need accounts.
        </p>
      </section>
    </main>
  );
}
