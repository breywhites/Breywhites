import React, { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { fmtDay, inr, pad2, waLink } from '../lib/format';
import type { PriceLinkView, SiteSettings } from '../lib/types';
import { IconChat, IconLeft, IconRight } from './Icons';
import { useDocumentTitle } from './useSite';

/** Private price page: breywhites.com/p/<slug>. Not linked from the website. */
export function PricePage({ slug, settings }: { slug: string; settings: SiteSettings }) {
  const [link, setLink] = useState<PriceLinkView | null | undefined>(undefined);
  const [failed, setFailed] = useState(false);
  const [index, setIndex] = useState(0);
  const rail = useRef<HTMLDivElement>(null);
  const lockUntil = useRef(0);
  const viewed = useRef(new Set<string>());

  useDocumentTitle(link ? `Packages for ${link.client_name} — ${settings.studio_name}` : `Packages — ${settings.studio_name}`, true);

  useEffect(() => {
    let alive = true;
    api.getPriceLink(slug)
      .then((l) => {
        if (!alive) return;
        setLink(l);
        if (l && !l.expired) api.logPriceEvent(slug, 'open');
      })
      .catch(() => alive && setFailed(true));
    return () => { alive = false; };
  }, [slug]);

  const packs = link?.packages || [];

  // count a package as "viewed" after it stays on screen for a moment
  useEffect(() => {
    const p = packs[index];
    if (!p || viewed.current.has(p.id)) return;
    const t = window.setTimeout(() => { viewed.current.add(p.id); api.logPriceEvent(slug, 'view', p.id); }, 1500);
    return () => window.clearTimeout(t);
  }, [index, packs, slug]);

  const step = () => {
    const card = rail.current?.querySelector('.pcard') as HTMLElement | null;
    return card ? card.getBoundingClientRect().width + 12 : 1;
  };
  const goTo = (i: number) => {
    const idx = Math.max(0, Math.min(packs.length - 1, i));
    lockUntil.current = Date.now() + 700;
    rail.current?.scrollTo({ left: idx * step(), behavior: 'smooth' });
    setIndex(idx);
  };
  const onScroll = () => {
    const r = rail.current;
    if (!r || Date.now() < lockUntil.current) return;
    const max = r.scrollWidth - r.clientWidth;
    const idx = max > 0 && r.scrollLeft >= max - 4 ? packs.length - 1 : Math.round(r.scrollLeft / step());
    if (idx !== index) setIndex(idx);
  };

  const who = link?.client_name || '';
  const when = link?.wedding_date ? ` for our wedding on ${fmtDay(link.wedding_date)}` : '';
  const bookHref = (name: string, price: number) => waLink(settings.whatsapp, `Hi ${settings.studio_name}, we'd like to book the ${name} package (${inr(price)})${when}. — ${who}`);
  const askHref = waLink(settings.whatsapp, `Hi ${settings.studio_name}, I have a question about your packages. — ${who}`);

  /* ---------- states ---------- */
  if (failed || link === null || (link && link.expired)) {
    const expired = !!link?.expired;
    return (
      <main className="wrap px" style={{ minHeight: '100svh', display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingTop: 40, paddingBottom: 40, maxWidth: 560 }}>
        <div className="serif it" style={{ fontSize: 28 }}>{settings.studio_name}</div>
        <h1 className="serif" style={{ fontSize: 'clamp(38px, 10vw, 60px)', lineHeight: 1.05, margin: '26px 0 0' }}>
          {failed ? 'We couldn’t load your prices.' : expired ? <>These prices <span className="it">have expired.</span></> : <>This link <span className="it">isn’t available.</span></>}
        </h1>
        <p className="muted" style={{ lineHeight: 1.6, marginTop: 14 }}>
          {failed ? 'Please check your connection and try again, or message us.' : 'Message us and we’ll send you a fresh link with our current packages.'}
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 20 }}>
          <a className="btn btn-dark cap" href={waLink(settings.whatsapp, `Hi ${settings.studio_name}, could you send me a fresh price link?${who ? ' — ' + who : ''}`)} target="_blank" rel="noopener">
            <IconChat size={16} /> Ask on WhatsApp
          </a>
          {failed && <button className="btn btn-line cap" onClick={() => window.location.reload()}>Try again</button>}
        </div>
      </main>
    );
  }

  if (link === undefined) {
    return (
      <main aria-busy="true" style={{ paddingTop: 30 }}>
        <div className="wrap px" style={{ textAlign: 'center' }}>
          <div className="serif it" style={{ fontSize: 28 }}>{settings.studio_name}</div>
          <div className="skeleton" style={{ height: 20, width: 180, margin: '26px auto 0' }} />
        </div>
        <div className="rail" style={{ marginTop: 70 }}>
          {[0, 1].map((i) => <div key={i} className="pcard skeleton" style={{ height: 520 }} />)}
        </div>
      </main>
    );
  }

  /* ---------- packages ---------- */
  return (
    <main style={{ paddingBottom: 30 }}>
      <header className="wrap px" style={{ paddingTop: 26, textAlign: 'center' }}>
        <div className="serif it" style={{ fontSize: 28 }}>{settings.studio_name}</div>
        <div className="cap muted" style={{ fontSize: 9.5, marginTop: 4 }}>Wedding packages for</div>
        <h1 className="serif it" style={{ fontSize: 26, fontWeight: 400, margin: '14px 0 0' }}>{link.client_name}</h1>
        <div style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 3 }}>
          {link.wedding_date && <>{fmtDay(link.wedding_date)} · </>}
          <span style={{ color: 'var(--accent)' }}>prices valid until {fmtDay(link.valid_until)}</span>
        </div>
      </header>

      {packs.length > 1 && (
        <div style={{ overflowX: 'auto', scrollbarWidth: 'none', marginTop: 22, borderTop: '1px solid var(--rule)', borderBottom: '1px solid var(--rule)' }}>
          <div className="tabs cap" role="tablist" aria-label="Packages">
            {packs.map((p, i) => (
              <button key={p.id} className={'tab' + (i === index ? ' on' : '')} onClick={() => goTo(i)} role="tab" aria-selected={i === index}>
                {p.short_name || p.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div ref={rail} className="rail" onScroll={onScroll} style={{ marginTop: 20 }}>
        {packs.map((p, i) => (
          <article key={p.id} className="pcard" aria-label={p.name}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div className="cap muted" style={{ fontSize: 9.5 }}>{p.kicker}</div>
              <div className="cap muted" style={{ fontSize: 9.5 }}>{pad2(i + 1)} / {pad2(packs.length)}</div>
            </div>
            <h2 className="serif it" style={{ fontSize: 32, fontWeight: 400, lineHeight: 1.08, margin: '18px 0 0', minHeight: 70 }}>{p.name}</h2>
            <div className="serif" style={{ fontSize: 58, lineHeight: 1, marginTop: 6 }}>{inr(p.price)}</div>
            <div style={{ fontSize: 12.5, color: 'var(--accent)', marginTop: 8, minHeight: 18 }}>{p.extra || ''}</div>

            <div style={{ height: 1, background: 'var(--ink)', margin: '18px 0 4px' }} />
            {(p.team || p.team_sub) && (
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--rule)' }}>
                <div className="cap muted" style={{ fontSize: 9, paddingTop: 3 }}>Team</div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 14 }}>{p.team}</div>
                  {p.team_sub && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{p.team_sub}</div>}
                </div>
              </div>
            )}
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, flex: 1 }}>
              {p.items.map((it) => <li key={it} style={{ padding: '12px 0', borderBottom: '1px solid var(--rule)', fontSize: 14.5 }}>{it}</li>)}
            </ul>
            <a className="btn btn-dark cap" style={{ marginTop: 20 }} href={bookHref(p.name, p.price)} target="_blank" rel="noopener"
              onClick={() => api.logPriceEvent(slug, 'book', p.id)}>
              <IconChat size={16} /> Book this package
            </a>
          </article>
        ))}
      </div>

      {packs.length > 1 && (
        <div className="wrap px" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
          <button className="icon-btn" style={{ border: '1px solid rgba(23,19,15,.2)', opacity: index === 0 ? 0.35 : 1 }} onClick={() => goTo(index - 1)} aria-label="Previous package"><IconLeft size={16} /></button>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {packs.map((p, i) => <button key={p.id} className={'dot' + (i === index ? ' on' : '')} onClick={() => goTo(i)} aria-label={`Show ${p.name}`} style={{ padding: 0 }} />)}
          </div>
          <button className="icon-btn" style={{ border: '1px solid rgba(23,19,15,.2)', opacity: index === packs.length - 1 ? 0.35 : 1 }} onClick={() => goTo(index + 1)} aria-label="Next package"><IconRight size={16} /></button>
        </div>
      )}

      {packs.length > 1 && (
        <section className="wrap px" style={{ marginTop: 36 }}>
          <h2 className="serif" style={{ fontSize: 24, fontWeight: 400, margin: 0 }}>At a glance</h2>
          <div style={{ marginTop: 12, borderTop: '1px solid var(--ink)' }}>
            {packs.map((p, i) => (
              <button key={p.id} onClick={() => goTo(i)} style={{ width: 'calc(100% + 24px)', textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, minHeight: 64, borderBottom: '1px solid var(--rule)', padding: '8px 12px', margin: '0 -12px', background: i === index ? 'var(--paper-2)' : 'transparent', boxSizing: 'border-box' }}>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 14.5, fontWeight: 500 }}>{p.name}</span>
                  <span style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{p.items.slice(0, 3).join(' · ')}</span>
                </span>
                <span style={{ fontSize: 14.5, whiteSpace: 'nowrap' }}>{inr(p.price)}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <footer className="wrap px" style={{ paddingTop: 30, textAlign: 'center' }}>
        <div className="serif it" style={{ fontSize: 19, lineHeight: 1.4 }}>Every love story deserves to be filmed like a fairytale.</div>
        <a className="btn btn-line cap" href={askHref} target="_blank" rel="noopener" onClick={() => api.logPriceEvent(slug, 'ask')} style={{ marginTop: 16 }}>
          <IconChat size={16} /> Ask a question
        </a>
        <div className="cap muted" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0 18px', marginTop: 16 }}>
          {settings.phones.map((ph) => <a key={ph} href={`tel:+91${ph}`} style={{ minHeight: 44, display: 'flex', alignItems: 'center' }}>{ph}</a>)}
          <a href={`https://instagram.com/${settings.instagram}`} target="_blank" rel="noopener" style={{ minHeight: 44, display: 'flex', alignItems: 'center' }}>ig · {settings.instagram}</a>
        </div>
      </footer>
    </main>
  );
}
