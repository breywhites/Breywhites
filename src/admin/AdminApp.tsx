import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { BusinessSettingsRow, SiteSettingsRow } from '../lib/models';
import { Link, match, useRoute } from '../lib/router';
import { store } from '../lib/store';
import { resetDemo } from '../lib/store/demoStore';
import {
  IconBox, IconCalendar, IconFile, IconHome, IconImage, IconInbox, IconLink, IconMore, IconOut, IconReceipt, IconSettings, IconExternal,
} from '../site/Icons';
import { useDocumentTitle } from '../site/useSite';
import { loadSettings } from './data';
import { Feedback, useConfirm } from './ui';
import { Login, NewPassword, NotAdmin } from './Login';
import { Dashboard } from './Dashboard';
import { Enquiries } from './Enquiries';
import { PriceLinks } from './PriceLinks';
import { QuoteEditor, QuotesList } from './Quotes';
import { InvoiceDetail, InvoiceEditor, InvoicesList } from './Invoices';
import { CalendarScreen } from './Calendar';
import { Photos } from './Photos';
import { Packages } from './Packages';
import { SettingsScreen } from './Settings';

interface AdminCtx {
  site: SiteSettingsRow;
  biz: BusinessSettingsRow;
  reloadSettings: () => Promise<void>;
  signOut: () => Promise<void>;
  newCount: number;
  refreshCounts: () => void;
}
const Ctx = createContext<AdminCtx>(null as any);
export const useAdmin = () => useContext(Ctx);

const NAV = [
  { to: '/admin', label: 'Home', icon: IconHome, exact: true },
  { to: '/admin/enquiries', label: 'Enquiries', icon: IconInbox, badge: true },
  { to: '/admin/links', label: 'Price links', icon: IconLink },
  { to: '/admin/quotes', label: 'Quotes', icon: IconFile },
  { to: '/admin/invoices', label: 'Invoices', icon: IconReceipt },
  { to: '/admin/calendar', label: 'Calendar', icon: IconCalendar },
  { to: '/admin/photos', label: 'Photos', icon: IconImage },
  { to: '/admin/packages', label: 'Packages', icon: IconBox },
  { to: '/admin/settings', label: 'Settings', icon: IconSettings },
];
const TABS = ['/admin', '/admin/enquiries', '/admin/quotes', '/admin/calendar'];

function isOn(path: string, to: string, exact?: boolean) {
  return exact ? path === to : path === to || path.startsWith(to + '/');
}

/* admin styles ship as their own file so the public website never downloads them */
declare const process: { env: Record<string, string | undefined> };
const ADMIN_CSS = process.env.BW_ADMIN_CSS || '';

function useAdminStyles() {
  const [ready, setReady] = useState(() => !ADMIN_CSS || !!document.querySelector('link[data-admin-css]'));
  useEffect(() => {
    if (ready) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = ADMIN_CSS;
    link.setAttribute('data-admin-css', '');
    const done = () => setReady(true);
    link.onload = done;
    link.onerror = done;
    document.head.appendChild(link);
    const t = window.setTimeout(done, 4000);
    return () => window.clearTimeout(t);
  }, [ready]);
  return ready;
}

export default function AdminApp() {
  const [phase, setPhase] = useState<'checking' | 'login' | 'recovery' | 'notadmin' | 'ready'>('checking');
  const styled = useAdminStyles();

  useEffect(() => {
    document.documentElement.classList.remove('motion');
    return () => { api.clearCache(); };
  }, []);

  const check = useCallback(async () => {
    if (store.auth.takeRecoveryFromUrl()) { setPhase('recovery'); return; }
    if (!store.auth.user()) { setPhase('login'); return; }
    setPhase((await store.auth.isAdmin()) ? 'ready' : 'notadmin');
  }, []);
  useEffect(() => { check(); }, [check]);

  if (phase === 'checking' || !styled) return <div className="adm" aria-busy="true" style={{ minHeight: '100vh', background: '#fbfaf8' }} />;
  return (
    <Feedback>
      <div className="adm">
        {phase === 'login' && <Login onDone={check} />}
        {phase === 'recovery' && <NewPassword onDone={check} />}
        {phase === 'notadmin' && <NotAdmin onSignOut={async () => { await store.auth.signOut(); setPhase('login'); }} />}
        {phase === 'ready' && <Shell onSignedOut={() => setPhase('login')} />}
      </div>
    </Feedback>
  );
}

function Shell({ onSignedOut }: { onSignedOut: () => void }) {
  const { path, navigate } = useRoute();
  const confirm = useConfirm();
  const [settings, setSettings] = useState<{ site: SiteSettingsRow; biz: BusinessSettingsRow } | null>(null);
  const [newCount, setNewCount] = useState(0);
  const [failed, setFailed] = useState(false);
  useDocumentTitle('Studio — Breywhites', true);

  const reloadSettings = useCallback(async () => {
    try { setSettings(await loadSettings()); setFailed(false); } catch { setFailed(true); }
  }, []);
  const refreshCounts = useCallback(() => {
    store.list('enquiries', { select: 'id', eq: { status: 'new' } }).then((r) => setNewCount(r.length)).catch(() => {});
  }, []);
  useEffect(() => { reloadSettings(); refreshCounts(); }, [reloadSettings, refreshCounts]);
  useEffect(() => { window.scrollTo(0, 0); }, [path]);

  const signOut = useCallback(async () => {
    const ok = await confirm({ title: 'Sign out?', ok: 'Sign out' });
    if (!ok) return;
    await store.auth.signOut();
    onSignedOut();
    navigate('/admin', { replace: true });
  }, [confirm, navigate, onSignedOut]);

  if (failed) {
    return (
      <div className="a-login"><div className="form">
        <h1 className="serif" style={{ fontSize: 34 }}>Can’t reach the studio data</h1>
        <p className="a-hint" style={{ fontSize: 14 }}>Check your internet connection and try again.</p>
        <button className="a-btn dark lg" onClick={reloadSettings} style={{ marginTop: 12 }}>Try again</button>
      </div></div>
    );
  }
  if (!settings) return <div aria-busy="true" />;

  let screen: React.ReactNode;
  let m: Record<string, string> | null;
  if (path === '/admin' || path === '/admin/') screen = <Dashboard />;
  else if (path === '/admin/enquiries') screen = <Enquiries />;
  else if (path === '/admin/links') screen = <PriceLinks />;
  else if (path === '/admin/quotes') screen = <QuotesList />;
  else if (path === '/admin/quotes/new') screen = <QuoteEditor key="new" />;
  else if ((m = match('/admin/quotes/:id', path))) screen = <QuoteEditor key={m.id} id={m.id} />;
  else if (path === '/admin/invoices') screen = <InvoicesList />;
  else if (path === '/admin/invoices/new') screen = <InvoiceEditor key="new" />;
  else if ((m = match('/admin/invoices/:id/edit', path))) screen = <InvoiceEditor key={'e' + m.id} id={m.id} />;
  else if ((m = match('/admin/invoices/:id', path))) screen = <InvoiceDetail key={m.id} id={m.id} />;
  else if (path === '/admin/calendar') screen = <CalendarScreen />;
  else if (path === '/admin/photos') screen = <Photos />;
  else if (path === '/admin/packages') screen = <Packages />;
  else if (path === '/admin/settings') screen = <SettingsScreen />;
  else if (path === '/admin/more') screen = <More signOut={signOut} />;
  else screen = <div className="a-empty" style={{ marginTop: 30 }}><div className="t">Page not found</div><Link to="/admin" className="a-btn line" style={{ marginTop: 12 }}>Back to home</Link></div>;

  const moreOn = !TABS.some((t) => isOn(path, t, t === '/admin'));

  return (
    <Ctx.Provider value={{ ...settings, reloadSettings, signOut, newCount, refreshCounts }}>
      {store.demo && (
        <div className="a-banner">
          <span><b>Preview</b> · sample data, kept on this device</span>
          <button className="a-btn ghost" style={{ minHeight: 30, padding: '0 10px' }} onClick={async () => {
            if (await confirm({ title: 'Reset sample data?', body: 'Everything you changed in this preview goes back to the starting examples.', ok: 'Reset', danger: true })) { resetDemo(); window.location.reload(); }
          }}>Reset</button>
        </div>
      )}
      <aside className="a-side" aria-label="Studio">
        <Link to="/admin" className="brand">{settings.site.studio_name}</Link>
        <nav>
          {NAV.map((n) => (
            <Link key={n.to} to={n.to} className={isOn(path, n.to, n.exact) ? 'on' : ''} aria-current={isOn(path, n.to, n.exact) ? 'page' : undefined}>
              <n.icon size={18} /> {n.label}
              {n.badge && newCount > 0 && <span className="a-count">{newCount}</span>}
            </Link>
          ))}
        </nav>
        <nav style={{ marginTop: 'auto' }}>
          <Link to="/"><IconExternal size={18} /> View website</Link>
          <a href="#" onClick={(e) => { e.preventDefault(); signOut(); }}><IconOut size={18} /> Sign out</a>
        </nav>
      </aside>
      <main className="a-main">
        <div className="a-top">
          <Link to="/admin" className="brand">{settings.site.studio_name}</Link>
          <div className="a-hint" style={{ marginLeft: 'auto' }}>{store.auth.user()?.email}</div>
        </div>
        {screen}
      </main>
      <nav className="a-tabs" aria-label="Studio">
        {NAV.filter((n) => TABS.includes(n.to)).map((n) => (
          <Link key={n.to} to={n.to} className={isOn(path, n.to, n.exact) ? 'on' : ''} style={{ position: 'relative' }}>
            <n.icon size={21} />
            {n.badge && newCount > 0 && <span className="a-badge">{newCount}</span>}
            {n.label}
          </Link>
        ))}
        <Link to="/admin/more" className={moreOn ? 'on' : ''}><IconMore size={21} />More</Link>
      </nav>
    </Ctx.Provider>
  );
}

function More({ signOut }: { signOut: () => void }) {
  const items = NAV.filter((n) => !TABS.includes(n.to));
  return (
    <>
      <div className="a-head"><div><h1>More</h1></div></div>
      <div className="a-list">
        {items.map((n) => (
          <Link key={n.to} to={n.to} className="a-row link">
            <n.icon size={20} /><div className="grow"><div className="title">{n.label}</div></div>
          </Link>
        ))}
        <Link to="/" className="a-row link"><IconExternal size={20} /><div className="grow"><div className="title">View website</div></div></Link>
        <button className="a-row link" style={{ width: '100%', textAlign: 'left' }} onClick={signOut}><IconOut size={20} /><div className="grow"><div className="title">Sign out</div></div></button>
      </div>
    </>
  );
}
