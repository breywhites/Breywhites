import React, { useEffect, useState } from 'react';
import { Link } from '../lib/router';
import { telLink, waLink } from '../lib/format';
import type { SiteSettings } from '../lib/types';
import { IconChat, IconClose, IconMail, IconMenu, IconPhone } from './Icons';

const NAV = [
  { to: '/work', label: 'Work' },
  { to: '/#film', label: 'Films' },
  { to: '/#dates', label: 'Free dates' },
  { to: '/#contact', label: 'Contact' },
];

/** Top bar. On the homepage it floats over the dark slideshow until you scroll. */
export function TopBar({ overHero }: { overHero: boolean }) {
  const [solid, setSolid] = useState(!overHero);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!overHero) { setSolid(true); return; }
    const on = () => setSolid(window.scrollY > 40);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, [overHero]);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    if (!open) return;
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [open]);

  return (
    <>
      <header className={'topbar' + (solid ? ' solid' : '')} style={overHero ? ({ '--bar-fg': '#faf8f4' } as React.CSSProperties) : undefined}>
        <Link to="/" className="brand" aria-label="Breywhites home">Breywhites</Link>
        <nav className="cap" aria-label="Main">
          {NAV.map((n) => <Link key={n.to} to={n.to}>{n.label}</Link>)}
        </nav>
        <button className="icon-btn menu-btn" onClick={() => setOpen(true)} aria-label="Open menu" aria-expanded={open}>
          <IconMenu size={21} />
        </button>
      </header>
      <div className={'menu' + (open ? ' open' : '')} role="dialog" aria-modal="true" aria-label="Menu" aria-hidden={!open}>
        <button className="icon-btn close" onClick={() => setOpen(false)} aria-label="Close menu"><IconClose size={21} /></button>
        <Link to="/" onClick={() => setOpen(false)}>Home</Link>
        {NAV.map((n) => <Link key={n.to} to={n.to} onClick={() => setOpen(false)}>{n.label}</Link>)}
      </div>
    </>
  );
}

/** WhatsApp / Call / Enquire bar on phones. */
export function ActionBar({ settings, showAfterHero }: { settings: SiteSettings; showAfterHero: boolean }) {
  const [show, setShow] = useState(!showAfterHero);
  useEffect(() => {
    if (!showAfterHero) { setShow(true); return; }
    const on = () => setShow(window.scrollY > window.innerHeight * 0.6);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, [showAfterHero]);

  return (
    <div className={'actbar' + (show ? ' show' : '')}>
      <a href={waLink(settings.whatsapp, `Hi ${settings.studio_name}, I'd like to know about your wedding packages.`)} target="_blank" rel="noopener">
        <IconChat size={19} /><span className="cap">WhatsApp</span>
      </a>
      <a href={telLink(settings.phones[0] || settings.whatsapp)}>
        <IconPhone size={19} /><span className="cap">Call</span>
      </a>
      <Link to="/#contact" style={{ background: 'var(--ink)', color: 'var(--paper)' }}>
        <IconMail size={19} /><span className="cap">Enquire</span>
      </Link>
    </div>
  );
}

export function Footer({ settings }: { settings: SiteSettings }) {
  return (
    <footer style={{ background: 'var(--ink)', color: 'rgba(250,248,244,.5)', borderTop: '1px solid rgba(250,248,244,.12)' }}>
      <div className="wrap px" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 24px', justifyContent: 'space-between', alignItems: 'center', paddingTop: 22, paddingBottom: 96 }}>
        <div className="cap" style={{ fontSize: 9.5 }}>© {new Date().getFullYear()} {settings.studio_name}</div>
        <Link to="/admin" className="cap" style={{ fontSize: 9.5, minHeight: 44, display: 'flex', alignItems: 'center' }}>Studio login</Link>
      </div>
    </footer>
  );
}
