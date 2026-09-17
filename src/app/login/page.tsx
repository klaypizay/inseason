import { LoginForm } from "../../components/login-form";
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
          A place to plan, remember what happened, and help your team grow.
        </p>
        <div className="court" aria-hidden="true">
          <div className="circle" />
          <div className="key" />
        </div>
        <p className="small">
          One practice. One observation. A better next session.
        </p>
      </section>
      <section className="card login">
        <p className="eyebrow">WELCOME BACK, COACH</p>
        <h2>Get back to your team.</h2>
        <p>Sign in with your coach account.</p>
        <LoginForm />
        <p className="small">
          Accounts are provisioned for adult coaches during the private pilot.
          Players and parents do not need accounts.
        </p>
      </section>
    </main>
  );
}
