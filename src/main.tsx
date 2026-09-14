import React, { lazy, Suspense, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { api } from './lib/api';
import { demoSiteData } from './lib/demo';
import { waLink } from './lib/format';
import { reducedMotion } from './lib/motion';
import { Link, match, Router, useRoute } from './lib/router';
import type { SiteSettings } from './lib/types';
import { Home } from './site/Home';
import { PricePage } from './site/PricePage';
import { Portfolio } from './site/Portfolio';
import { useDocumentTitle, useSiteData } from './site/useSite';
import './styles/site.css';

const AdminApp = lazy(() => import('./admin/AdminApp'));

// switch reveal animations on before the first paint (content stays visible if JS fails)
if (!reducedMotion()) document.documentElement.classList.add('motion');

function Loading() {
  return (
    <div style={{ minHeight: '100svh', background: 'var(--ink)', color: 'var(--paper)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} aria-busy="true">
      <div className="serif it" style={{ fontSize: 30, opacity: 0.85 }}>Breywhites</div>
    </div>
  );
}

function LoadError({ retry }: { retry: () => void }) {
  const s = demoSiteData().settings;
  return (
    <main className="wrap px" style={{ minHeight: '100svh', display: 'flex', flexDirection: 'column', justifyContent: 'center', maxWidth: 560 }}>
      <div className="serif it" style={{ fontSize: 28 }}>Breywhites</div>
      <h1 className="serif" style={{ fontSize: 44, lineHeight: 1.05, margin: '22px 0 0' }}>The page didn’t load.</h1>
      <p className="muted">Check your connection and try again — or message us directly.</p>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 16 }}>
        <button className="btn btn-dark cap" onClick={retry}>Try again</button>
        <a className="btn btn-line cap" href={waLink(s.whatsapp)} target="_blank" rel="noopener">WhatsApp</a>
      </div>
    </main>
  );
}

function NotFound() {
  useDocumentTitle('Page not found — Breywhites');
  return (
    <main className="wrap px" style={{ minHeight: '100svh', display: 'flex', flexDirection: 'column', justifyContent: 'center', maxWidth: 560 }}>
      <div className="serif it" style={{ fontSize: 28 }}>Breywhites</div>
      <h1 className="serif" style={{ fontSize: 48, lineHeight: 1.05, margin: '22px 0 0' }}>This page <span className="it">wandered off.</span></h1>
      <Link to="/" className="btn btn-dark cap" style={{ marginTop: 22, alignSelf: 'flex-start' }}>Back to home</Link>
    </main>
  );
}

function PriceRoute({ slug }: { slug: string }) {
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  useEffect(() => { api.getSettings().then(setSettings).catch(() => setSettings(demoSiteData().settings)); }, []);
  return settings ? <PricePage slug={slug} settings={settings} /> : <Loading />;
}

function Routes() {
  const { path } = useRoute();
  const price = match('/p/:slug', path);
  const isSite = path === '/' || path === '/work';
  const { data, error, retry } = useSiteData(isSite);

  useEffect(() => {
    const r = requestAnimationFrame(() => requestAnimationFrame(() => document.documentElement.classList.add('loaded')));
    return () => cancelAnimationFrame(r);
  }, [data]);

  if (price) return <PriceRoute slug={price.slug.toLowerCase()} />;
  if (path === '/admin' || path.startsWith('/admin/')) return <Suspense fallback={<div style={{ minHeight: '100svh', background: 'var(--paper)' }} aria-busy="true" />}><AdminApp /></Suspense>;
  if (!isSite) return <NotFound />;
  if (error) return <LoadError retry={retry} />;
  if (!data) return <Loading />;
  return path === '/work' ? <Portfolio data={data} /> : <Home data={data} />;
}

function App() {
  return (
    <Router>
      <Routes />
    </Router>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
