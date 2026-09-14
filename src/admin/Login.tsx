import React, { useState } from 'react';
import { config } from '../lib/config';
import { store } from '../lib/store';
import { errorText, Field, useToast } from './ui';

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="a-login">
      <div className="art"><img src={`${config.assetBase}demo/couple3-l.webp`} alt="" /></div>
      <div className="form">{children}</div>
    </div>
  );
}

export function Login({ onDone }: { onDone: () => void }) {
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [forgot, setForgot] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    if (!email.trim() || (!forgot && !password)) { setErr(forgot ? 'Enter your email' : 'Enter your email and password'); return; }
    setBusy(true);
    try {
      if (forgot) {
        await store.auth.sendReset(email.trim(), window.location.origin + '/admin');
        toast('Check your email for a link to set a new password');
        setForgot(false);
      } else {
        await store.auth.signIn(email.trim(), password);
        onDone();
      }
    } catch (e2) {
      setErr(errorText(e2));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Frame>
      <div className="serif it" style={{ fontSize: 30 }}>Breywhites</div>
      <h1 className="serif" style={{ fontSize: 40, lineHeight: 1.05, marginTop: 26 }}>{forgot ? 'Reset password' : 'Studio login'}</h1>
      <p className="a-hint" style={{ fontSize: 14, margin: '8px 0 22px' }}>
        {store.demo ? 'Preview mode — type any email and password to look around.' : forgot ? 'We’ll email you a link to choose a new password.' : 'Only for the studio team.'}
      </p>
      <form onSubmit={submit} className="a-grid" noValidate>
        <Field id="login-email" label="Email">
          <input className="a-inp" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        {!forgot && (
          <Field id="login-password" label="Password">
            <input className="a-inp" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
        )}
        {err && <div role="alert" style={{ color: '#9b2c1d' }}>{err}</div>}
        <button className="a-btn dark lg" type="submit" disabled={busy}>{busy ? 'Please wait…' : forgot ? 'Send reset link' : 'Sign in'}</button>
        {!store.demo && (
          <button type="button" className="a-btn ghost" onClick={() => { setForgot(!forgot); setErr(''); }}>{forgot ? 'Back to sign in' : 'Forgot password?'}</button>
        )}
      </form>
    </Frame>
  );
}

export function NewPassword({ onDone }: { onDone: () => void }) {
  const toast = useToast();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.length < 8) { setErr('Use at least 8 characters'); return; }
    if (pw !== pw2) { setErr('The two passwords don’t match'); return; }
    setBusy(true);
    try { await store.auth.updatePassword(pw); toast('Password updated'); onDone(); }
    catch (e2) { setErr(errorText(e2)); }
    finally { setBusy(false); }
  };
  return (
    <Frame>
      <h1 className="serif" style={{ fontSize: 38, lineHeight: 1.05 }}>Choose a new password</h1>
      <form onSubmit={submit} className="a-grid" style={{ marginTop: 20 }} noValidate>
        <Field id="np-1" label="New password"><input className="a-inp" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} /></Field>
        <Field id="np-2" label="Type it again"><input className="a-inp" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} /></Field>
        {err && <div role="alert" style={{ color: '#9b2c1d' }}>{err}</div>}
        <button className="a-btn dark lg" disabled={busy}>{busy ? 'Saving…' : 'Save password'}</button>
      </form>
    </Frame>
  );
}

export function NotAdmin({ onSignOut }: { onSignOut: () => void }) {
  return (
    <Frame>
      <h1 className="serif" style={{ fontSize: 38, lineHeight: 1.05 }}>This account isn’t a studio admin</h1>
      <p style={{ lineHeight: 1.6, color: 'var(--ink-2)' }}>
        You’re signed in as <b>{store.auth.user()?.email || 'this user'}</b>, but it hasn’t been given admin access yet.
        Run the “make yourself the admin” line at the end of the database setup, then sign in again.
      </p>
      <button className="a-btn dark lg" onClick={onSignOut}>Sign out</button>
    </Frame>
  );
}
