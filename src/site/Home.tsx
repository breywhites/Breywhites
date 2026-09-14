import React, { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../lib/api';
import { fmtDay, MONTHS, pad2, parseDay, telLink, waLink } from '../lib/format';
import { clamp, pinned, travel, useReveal, useScrollFrame } from '../lib/motion';
import { Link } from '../lib/router';
import type { Film, Package, Photo, SiteData, SiteSettings } from '../lib/types';
import { CATEGORY_LABELS } from '../lib/types';
import { ActionBar, Footer, TopBar } from './Chrome';
import { IconArrow, IconChat, IconPlay } from './Icons';
import { useDocumentTitle } from './useSite';

/* ------------------------------------------------------------------ */
function Reveal({ as = 'div', fx = 'fx-up', delay = 0, className = '', style, children, ...rest }:
  { as?: any; fx?: string; delay?: number; className?: string; style?: React.CSSProperties; children?: React.ReactNode } & Record<string, any>) {
  const ref = useReveal<HTMLElement>();
  const Tag = as;
  return <Tag ref={ref} className={`${fx} ${className}`} style={{ ...style, '--d': delay + 'ms' }} {...rest}>{children}</Tag>;
}

function Words({ text, start = 300, step = 90, italicFrom }: { text: string; start?: number; step?: number; italicFrom?: number }) {
  const words = text.split(/\s+/).filter(Boolean);
  return (
    <>
      {words.map((w, i) => (
        <React.Fragment key={i}>{i > 0 && ' '}<span className="hw" style={{ '--d': start + i * step + 'ms', fontStyle: italicFrom != null && i >= italicFrom ? 'italic' : undefined } as React.CSSProperties}>
          <span>{w}</span>
        </span></React.Fragment>
      ))}
    </>
  );
}

/* ------------------------------------------------------------------ */
function HeroSlideshow({ slides, settings }: { slides: Photo[]; settings: SiteSettings }) {
  const ref = useRef<HTMLElement>(null);
  const [index, setIndex] = useState(0);
  const [prev, setPrev] = useState(-1);
  const [ready, setReady] = useState(false);
  const [loadRest, setLoadRest] = useState(false);
  const timer = useRef<number>();
  const n = slides.length;
  const ms = clamp(settings.slideshow_seconds || 3, 2, 10) * 1000;

  const idxRef = useRef(0);
  const go = (i: number) => {
    if (n < 2) return;
    const next = ((i % n) + n) % n;
    if (next === idxRef.current) return;
    setPrev(idxRef.current);
    idxRef.current = next;
    setIndex(next);
  };
  const goRef = useRef(go);
  goRef.current = go;
  const restart = () => {
    window.clearInterval(timer.current);
    if (n < 2) return;
    timer.current = window.setInterval(() => {
      if (!document.hidden) goRef.current(idxRef.current + 1);
    }, ms);
  };

  useEffect(() => {
    const r = requestAnimationFrame(() => requestAnimationFrame(() => setReady(true)));
    const t = window.setTimeout(() => setLoadRest(true), 900);   // fetch the other photos after the first one
    return () => { cancelAnimationFrame(r); window.clearTimeout(t); };
  }, []);
  useEffect(() => { restart(); return () => window.clearInterval(timer.current); }, [n, ms]);

  useScrollFrame((y) => {
    ref.current?.style.setProperty('--hc', clamp(y / window.innerHeight, 0, 1).toFixed(3));
  });

  const x0 = useRef<number | null>(null);
  const words = settings.tagline.split(/\s+/);

  return (
    <section
      ref={ref}
      className={'hero' + (ready ? ' slides-ready' : '')}
      style={{ '--dur': ms + 'ms', '--kb': ms + 1600 + 'ms' } as React.CSSProperties}
      onTouchStart={(e) => { x0.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        if (x0.current == null) return;
        const dx = e.changedTouches[0].clientX - x0.current; x0.current = null;
        if (Math.abs(dx) > 40) { go(index + (dx < 0 ? 1 : -1)); restart(); }
      }}
      aria-label="Featured wedding photographs"
    >
      <div className="hero-media">
        {slides.map((s, i) => (
          <div key={s.id} className={'slide' + (i === index ? ' on' : i === prev ? ' off' : '')}>
            {(i === 0 || loadRest) && (
              <img
                src={s.large}
                alt={i === index ? `${s.title || CATEGORY_LABELS[s.category]} — wedding photography by ${settings.studio_name}` : ''}
                width={s.width || undefined}
                height={s.height || undefined}
                fetchPriority={i === 0 ? 'high' : 'low'}
                decoding="async"
              />
            )}
          </div>
        ))}
      </div>
      <div className="hero-shade" />
      <div className="hero-grad" />
      <div className="hero-text wrap px">
        <div className="cap load-fade" style={{ '--d': '200ms', fontSize: 10, opacity: 0.85 } as React.CSSProperties}>Weddings · Films · Reels</div>
        <h1><Words text={settings.tagline} italicFrom={Math.max(0, words.length - 2)} /></h1>
        <div className="hero-controls load-fade" style={{ '--d': '1200ms' } as React.CSSProperties}>
          <div className="cue" />
          {n > 1 && (
            <>
              <div className="segs" role="tablist" aria-label="Choose photo">
                {slides.map((s, i) => (
                  <button key={s.id} className={'seg' + (i < index ? ' done' : i === index ? ' on' : '')}
                    onClick={() => { go(i); restart(); }} aria-label={`Photo ${i + 1}`} aria-selected={i === index} role="tab">
                    <i />
                  </button>
                ))}
              </div>
              <div className="cap" style={{ fontSize: 10, opacity: 0.85 }} aria-live="polite">{pad2(index + 1)} / {pad2(n)}</div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
function Marquee() {
  const box = useRef<HTMLElement>(null);
  const a = useRef<HTMLDivElement>(null);
  const b = useRef<HTMLDivElement>(null);
  useScrollFrame(() => {
    if (!box.current || !a.current || !b.current) return;
    const t = travel(box.current);
    a.current.style.transform = `translateX(${(-t * 45).toFixed(2)}%)`;
    b.current.style.transform = `translateX(${(-45 + t * 45).toFixed(2)}%)`;
  });
  return (
    <section ref={box} className="marquee" aria-hidden="true">
      <div ref={a} className="it">Weddings — Films — Reels — Pre-wedding — Weddings — Films — Reels —</div>
      <div ref={b} className="outline">Two days — One story — Unlimited photos — Two days — One story —</div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
function SidewaysGallery({ photos }: { photos: Photo[] }) {
  const sec = useRef<HTMLElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const count = useRef<HTMLSpanElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const n = photos.length;

  useScrollFrame(() => {
    if (!sec.current || !track.current) return;
    const p = pinned(sec.current);
    const max = Math.max(0, track.current.scrollWidth - window.innerWidth);
    track.current.style.setProperty('--hx', (p * max).toFixed(1));
    if (count.current) count.current.textContent = pad2(Math.min(n, Math.floor(p * n) + 1));
    if (bar.current) bar.current.style.transform = `scaleX(${Math.max(0.05, p).toFixed(3)})`;
  }, [n]);

  return (
    <section id="work" ref={sec} className="hs">
      <div className="hs-stage">
        <div className="wrap px" style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 22 }}>
          <div>
            <div className="idx">02 — The work</div>
            <h2 className="serif it" style={{ fontSize: 'clamp(36px, 9vw, 60px)', lineHeight: 1.05, margin: '8px 0 0' }}>Recent weddings</h2>
          </div>
          <div className="serif" style={{ fontSize: 22 }} aria-hidden="true"><span ref={count}>01</span><span style={{ color: 'var(--faint)' }}> / {pad2(n)}</span></div>
        </div>
        <div ref={track} className="hs-track">
          {photos.map((p) => (
            <Link key={p.id} to="/work" className="hs-card ph" aria-label={`${p.title || 'Photo'} — see all work`}>
              <img src={p.thumb} alt={`${p.title || CATEGORY_LABELS[p.category]} — Breywhites`} loading="lazy" decoding="async" />
              <div className="grad" />
              {p.title && <div className="name">{p.title}</div>}
            </Link>
          ))}
          <Link to="/work" className="hs-end">
            <div className="serif it" style={{ fontSize: 32, lineHeight: 1.1 }}>See all the work</div>
            <div className="cap" style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>Portfolio <IconArrow size={14} /></div>
          </Link>
          <div style={{ flex: 'none', width: 20 }} />
        </div>
        <div className="wrap px" style={{ width: '100%', marginTop: 22 }}>
          <div style={{ height: 1, background: 'rgba(23,19,15,.15)', position: 'relative' }}>
            <div ref={bar} style={{ position: 'absolute', left: 0, top: -1, height: 3, width: '100%', background: 'var(--ink)', transformOrigin: 'left', transform: 'scaleX(.05)' }} />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
const SERVICES = [
  { tag: 'Every package', title: 'Photography', desc: 'Professional cameramen through the day, with unlimited edited photos.', bg: '#efebe2', fg: '#17130f' },
  { tag: 'Every package', title: 'Wedding films', desc: 'Full event videos plus a highlight film of 2–3 or 3–5 minutes.', bg: '#17130f', fg: '#faf8f4' },
  { tag: '30–45 seconds', title: 'Reels', desc: 'Short reels cut for Instagram, ready to share.', bg: '#e4ddcf', fg: '#17130f' },
  { tag: 'Premium', title: 'Pre-wedding', desc: 'A 2-hour session before the big day.', bg: '#8a4a2f', fg: '#faf8f4' },
];

function StackedServices() {
  return (
    <section style={{ paddingTop: 20 }} aria-labelledby="services-title">
      <div className="wrap px" style={{ paddingBottom: 18 }}><div id="services-title" className="idx">03 — What we cover</div></div>
      {SERVICES.map((c, i) => (
        <div key={c.title} className="stack-card" style={{ top: 64 + i * 16, background: c.bg, color: c.fg }}>
          <div className="wrap" style={{ width: '100%', display: 'flex', justifyContent: 'space-between' }}>
            <div className="cap" style={{ fontSize: 10, opacity: 0.6 }}>{pad2(i + 1)}</div>
            <div className="cap" style={{ fontSize: 10, opacity: 0.6 }}>{c.tag}</div>
          </div>
          <div className="wrap" style={{ width: '100%' }}>
            <h3>{c.title}</h3>
            <p style={{ fontSize: 15, lineHeight: 1.6, margin: '14px 0 0', maxWidth: 420, opacity: 0.75, fontWeight: 300 }}>{c.desc}</p>
          </div>
        </div>
      ))}
    </section>
  );
}

/* ------------------------------------------------------------------ */
function FilmSection({ film, fallback }: { film: Film | undefined; fallback: Photo | undefined }) {
  const ref = useRef<HTMLAnchorElement>(null);
  useScrollFrame(() => {
    if (ref.current) ref.current.style.setProperty('--fe', clamp(travel(ref.current) * 2.2, 0, 1).toFixed(3));
  });
  const poster = film?.poster || fallback?.large;
  if (!film && !poster) return null;
  return (
    <a ref={ref} id="film" href={film?.video_url || '#'} target="_blank" rel="noopener" className="film ph" aria-label={film ? `Play ${film.title}` : 'Films'}>
      {poster && <img src={poster} alt="" loading="lazy" decoding="async" />}
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(23,19,15,.35)' }} />
      <div style={{ position: 'relative', textAlign: 'center', color: 'var(--paper)' }}>
        <div className="play"><IconPlay /></div>
        <div className="serif it" style={{ fontSize: 34, marginTop: 16 }}>{film?.title || 'Watch a wedding'}</div>
        {film?.duration_label && <div className="cap" style={{ fontSize: 9.5, opacity: 0.8, marginTop: 6 }}>{film.duration_label}</div>}
      </div>
    </a>
  );
}

/* ------------------------------------------------------------------ */
function FreeDates({ days, settings }: { days: string[]; settings: SiteSettings }) {
  return (
    <div id="dates" className="wrap px" style={{ paddingTop: 80, paddingBottom: 80, scrollMarginTop: 60 }}>
      <Reveal className="idx">04 — Availability</Reveal>
      <Reveal as="h2" className="serif" style={{ fontSize: 'clamp(38px, 9vw, 64px)', lineHeight: 1.05, margin: '8px 0 0' }}>
        Free dates <span className="it">this season</span>
      </Reveal>
      {days.length > 0 ? (
        <div className="dates" style={{ marginTop: 24 }}>
          {days.slice(0, 8).map((d, i) => {
            const dt = parseDay(d)!;
            return (
              <Reveal as="a" fx="fx-pop" delay={i * 60} key={d} className="date" target="_blank" rel="noopener"
                href={waLink(settings.whatsapp, `Hi ${settings.studio_name}, is ${fmtDay(d)} still free for our wedding?`)}
                aria-label={`Ask about ${fmtDay(d)} on WhatsApp`}>
                <div className="cap" style={{ fontSize: 9, color: 'var(--muted)' }}>{MONTHS[dt.getMonth()]}</div>
                <div className="serif it" style={{ fontSize: 26, marginTop: 2 }}>{pad2(dt.getDate())}</div>
              </Reveal>
            );
          })}
        </div>
      ) : (
        <p className="muted" style={{ marginTop: 18 }}>Dates are going fast — message us to check yours.</p>
      )}
      <Reveal as="p" delay={200} className="muted" style={{ fontSize: 13, marginTop: 16 }}>Tap a date to check it with us on WhatsApp.</Reveal>
    </div>
  );
}

function PackagesTeaser({ packages, settings }: { packages: Package[]; settings: SiteSettings }) {
  if (!packages.length) return null;
  return (
    <div className="wrap px" style={{ paddingBottom: 90 }}>
      <Reveal className="idx">05 — Packages</Reveal>
      <div style={{ marginTop: 14, borderTop: '1px solid var(--ink)' }}>
        {packages.map((p, i) => (
          <Reveal key={p.id} delay={i * 80} className="pk-row">
            <div className="serif it" style={{ fontSize: 24 }}>{p.name}</div>
            <div className="cap muted" style={{ fontSize: 9.5, textAlign: 'right' }}>{p.kicker}</div>
          </Reveal>
        ))}
      </div>
      <Reveal as="a" delay={150} className="btn btn-dark cap" style={{ marginTop: 22, width: '100%', maxWidth: 420 }}
        href={waLink(settings.whatsapp, `Hi ${settings.studio_name}, could you send me your package prices?`)} target="_blank" rel="noopener">
        <IconChat size={16} /> Get prices on WhatsApp
      </Reveal>
    </div>
  );
}

/* ------------------------------------------------------------------ */
function Enquiry({ settings }: { settings: SiteSettings }) {
  const [form, setForm] = useState({ name: '', phone: '', event_date: '', event_type: 'Wedding', message: '' });
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [err, setErr] = useState('');
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const phone = form.phone.replace(/[^0-9+]/g, '');
    if (!form.name.trim()) { setErr('Please add your name'); return; }
    if (phone.replace(/\D/g, '').length < 10) { setErr('Please add a 10-digit phone number'); return; }
    setErr(''); setState('sending');
    try {
      await api.submitEnquiry({
        name: form.name.trim().slice(0, 120), phone: form.phone.trim().slice(0, 30),
        event_date: form.event_date || null, event_type: form.event_type || null, message: form.message.trim().slice(0, 2000) || null,
      });
      setState('sent');
    } catch {
      setState('error');
    }
  };

  const waText = `Hi ${settings.studio_name}, I'm ${form.name || '…'}.` + (form.event_date ? ` Our ${form.event_type.toLowerCase()} is on ${fmtDay(form.event_date)}.` : '') + (form.message ? ` ${form.message}` : '');

  return (
    <section id="contact" style={{ background: 'var(--ink)', color: 'var(--paper)', padding: '90px 0 70px', scrollMarginTop: 0 }}>
      <div className="wrap px">
        <Reveal as="h2" className="serif" style={{ fontSize: 'clamp(46px, 12vw, 104px)', lineHeight: 0.98, margin: 0 }}>
          Let's film <span className="it">your story.</span>
        </Reveal>

        {state === 'sent' ? (
          <div style={{ marginTop: 34, maxWidth: 520 }} role="status">
            <div className="serif it" style={{ fontSize: 30 }}>Thank you, {form.name.split(' ')[0]}.</div>
            <p style={{ opacity: 0.75, fontWeight: 300, lineHeight: 1.6 }}>We've got your details and will reply soon. Want an answer faster? Send the same message on WhatsApp.</p>
            <a className="btn btn-light cap" href={waLink(settings.whatsapp, waText)} target="_blank" rel="noopener" style={{ marginTop: 10 }}><IconChat size={16} /> Continue on WhatsApp</a>
          </div>
        ) : (
          <form onSubmit={submit} style={{ marginTop: 26, maxWidth: 820 }} noValidate>
            <div className="form-grid">
              <label className="field"><span className="cap">Your name</span><input className="inp" value={form.name} onChange={set('name')} autoComplete="name" placeholder="e.g. Anjali" /></label>
              <label className="field"><span className="cap">Phone / WhatsApp</span><input className="inp" type="tel" inputMode="tel" value={form.phone} onChange={set('phone')} autoComplete="tel" placeholder="10-digit number" /></label>
              <label className="field"><span className="cap">Event date</span><input className="inp" type="date" value={form.event_date} onChange={set('event_date')} /></label>
              <label className="field"><span className="cap">Event</span>
                <select className="inp" value={form.event_type} onChange={set('event_type')}>
                  {['Wedding', 'Engagement', 'Pre-wedding', 'Bride-to-be', 'Birthday', 'Other'].map((o) => <option key={o}>{o}</option>)}
                </select>
              </label>
            </div>
            <label className="field"><span className="cap">Anything else? (optional)</span><textarea className="inp" value={form.message} onChange={set('message')} placeholder="Venue, number of days, what you have in mind…" /></label>
            {err && <p style={{ color: '#e8b49d', margin: '12px 0 0' }} role="alert">{err}</p>}
            {state === 'error' && <p style={{ color: '#e8b49d', margin: '12px 0 0' }} role="alert">Couldn't send just now — please message us on WhatsApp instead.</p>}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 24 }}>
              <button className="btn btn-light cap" type="submit" disabled={state === 'sending'} style={{ minWidth: 200 }}>{state === 'sending' ? 'Sending…' : 'Send enquiry'}</button>
              <a className="btn cap" style={{ border: '1px solid rgba(250,248,244,.4)' }} href={waLink(settings.whatsapp, waText)} target="_blank" rel="noopener"><IconChat size={16} /> WhatsApp instead</a>
            </div>
          </form>
        )}

        <div style={{ marginTop: 44, display: 'flex', flexWrap: 'wrap', gap: '0 26px' }} className="cap">
          {settings.phones.map((p) => <a key={p} href={telLink(p)} style={{ minHeight: 44, display: 'flex', alignItems: 'center' }}>{p}</a>)}
          <a href={`https://instagram.com/${settings.instagram}`} target="_blank" rel="noopener" style={{ minHeight: 44, display: 'flex', alignItems: 'center' }}>ig · {settings.instagram}</a>
          <a href={`mailto:${settings.email}`} style={{ minHeight: 44, display: 'flex', alignItems: 'center', textTransform: 'none', letterSpacing: '.04em', fontSize: 13 }}>{settings.email}</a>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
export function Home({ data }: { data: SiteData }) {
  const { settings } = data;
  useDocumentTitle(`${settings.studio_name} — Wedding Photography & Films`);
  const slides = data.slides.length ? data.slides : data.photos.slice(0, 5);
  const featured = useMemo(() => {
    const f = data.photos.filter((p) => p.featured);
    return (f.length >= 4 ? f : data.photos).slice(0, 10);
  }, [data.photos]);

  return (
    <>
      <TopBar overHero />
      <main>
        {slides.length > 0 && <HeroSlideshow slides={slides} settings={settings} />}
        <div className="sheet">
          <Marquee />
          <section className="wrap px" style={{ paddingTop: 56, paddingBottom: 30 }}>
            <Reveal className="idx">01 — {settings.studio_name}</Reveal>
            <Reveal as="p" delay={120} className="serif" style={{ fontSize: 'clamp(28px, 7vw, 52px)', lineHeight: 1.2, margin: '14px 0 0', maxWidth: 900 }}>
              {settings.tagline} <span className="it">Every love story deserves to be filmed like a fairytale.</span>
            </Reveal>
          </section>
          {featured.length > 0 && <SidewaysGallery photos={featured} />}
          <StackedServices />
          <div style={{ position: 'relative', zIndex: 2, background: 'var(--paper)', paddingTop: 40 }}>
            <FilmSection film={data.films[0]} fallback={data.photos.find((p) => p.category === 'events') || data.photos[0]} />
            <FreeDates days={data.freeDays} settings={settings} />
            <PackagesTeaser packages={data.packages} settings={settings} />
            <Enquiry settings={settings} />
          </div>
        </div>
      </main>
      <Footer settings={settings} />
      <ActionBar settings={settings} showAfterHero />
    </>
  );
}
