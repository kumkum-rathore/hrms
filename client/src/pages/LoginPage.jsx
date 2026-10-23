import React from 'react';
import {
  ArrowRight,
  CheckCircle2,
  LoaderCircle,
  LockKeyhole,
  Mail,
  ShieldCheck,
  TrendingUp,
  Users
} from 'lucide-react';
import { PasswordInput } from '../components/common.jsx';
import { Country } from 'country-state-city';

function Brand() {
  return (
    <div className="login-brand-lockup">
      <div className="login-brand-mark" aria-hidden="true">B</div>
      <div className="login-brand-copy">
        <strong>Bugsbon <span>HRMS</span></strong>
        <small>PEOPLE &amp; WORK, IN HARMONY</small>
      </div>
    </div>
  );
}

function LoginPage({
  email,
  setEmail,
  password,
  setPassword,
  onSubmit,
  busy,
  notice
}) {
  return (
    <main className="login-layout">
      <section className="login-card" aria-label="Sign in">
        <header className="login-card-brand">
          <Brand />
          <p>People operations, thoughtfully connected.</p>
        </header>

        <div className="login-card-body">
          <div className="login-welcome">
            <span className="login-overline">YOUR WORKSPACE AWAITS</span>
            <h1>Welcome <span>Back</span></h1>
            <p>Sign in to continue to your Bugsbon HRMS workspace.</p>
          </div>

          <form onSubmit={onSubmit} className="login-form">
            <label htmlFor="login-email">Email address</label>
            <div className="input-wrap">
              <Mail size={18} className="login-input-icon" aria-hidden="true" />
              <input
                id="login-email"
                type="email"
                autoComplete="username"
                placeholder="you@company.com"
                value={email}
                onChange={event => setEmail(event.target.value)}
                required
              />
            </div>

            <div className="label-row">
              <label htmlFor="login-password">Password</label>
            </div>
            <div className="input-wrap">
              <LockKeyhole size={18} className="login-input-icon" aria-hidden="true" />
              <PasswordInput
                id="login-password"
                autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                onChange={event => setPassword(event.target.value)}
                required
              />
            </div>

            <button className="button button-primary login-submit" disabled={busy}>
              {busy ? (
                <>
                  <LoaderCircle size={17} className="spin" />
                  Signing you in…
                </>
              ) : (
                <>
                  Login
                  <ArrowRight size={17} />
                </>
              )}
            </button>
          </form>

          <div className="secure-note">
            <ShieldCheck size={15} />
            Secure access to your workspace
          </div>
        </div>

        <footer className="login-benefits">
          <div><Users size={17} /><span>Better Teams</span></div>
          <div><CheckCircle2 size={17} /><span>Higher Productivity</span></div>
          <div><TrendingUp size={17} /><span>Bigger Growth</span></div>
        </footer>
      </section>

      {notice && (
        <div className={`toast login-toast ${notice.type}`} role="status">
          {notice.message}
        </div>
      )}
    </main>
  );
}

export default LoginPage;