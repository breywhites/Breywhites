import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { waLink } from '../lib/format';
import type { Category, Photo, SiteData } from '../lib/types';
import { CATEGORY_LABELS } from '../lib/types';
import { ActionBar, Footer, TopBar } from './Chrome';
import { IconChat, IconClose, IconLeft, IconRight } from './Icons';
import { useDocumentTitle } from './useSite';

function Lightbox({ photos, index, onClose, onIndex }: { photos: Photo[]; index: number; onClose: () => void; onIndex: (i: number) => void }) {
  const n = photos.length;
  const p = photos[index];
  const x0 = useRef<number | null>(null);
  const go = useCallback((d: number) => onIndex((index + d + n) % n), [index, n, onIndex]);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', key);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', key); document.body.style.overflow = ''; };
  }, [go, onClose]);

  // warm the neighbours so swiping feels instant
  useEffect(() => {
    [photos[(index + 1) % n], photos[(index - 1 + n) % n]].forEach((q) => { if (q) { const im = new Image(); im.src = q.large; } });
  }, [index, n, photos]);

  if (!p) return null;
  return (
    <div className="lightbox" role="dialog" aria-modal="true" aria-label="Photo viewer"
      onTouchStart={(e) => { x0.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        if (x0.current == null) return;
        const dx = e.changedTouches[0].clientX - x0.current; x0.current = null;
        if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
      }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px 0 20px' }}>
        <div className="cap" style={{ fontSize: 10, opacity: 0.7 }}>{index + 1} / {n}{p.title ? ` · ${p.title}` : ''}</div>
        <button className="icon-btn" onClick={onClose} aria-label="Close"><IconClose size={22} /></button>
      </div>
      <div className="lb-img" onClick={onClose}>
        <img src={p.large} alt={`${p.title || CATEGORY_LABELS[p.category]} — Breywhites`} onClick={(e) => e.stopPropagation()} />
      </div>
      <div className="lb-bar">
        <button className="icon-btn" onClick={() => go(-1)} aria-label="Previous photo"><IconLeft size={22} /></button>
        <div className="cap" style={{ fontSize: 9.5, opacity: 0.6 }}>{CATEGORY_LABELS[p.category]}</div>
        <button className="icon-btn" onClick={() => go(1)} aria-label="Next photo"><IconRight size={22} /></button>
      </div>
    </div>
  );
}

export function Portfolio({ data }: { data: SiteData }) {
  const { settings } = data;
  useDocumentTitle(`Work — ${settings.studio_name}`);
  const [filter, setFilter] = useState<Category | 'all'>('all');
  const [open, setOpen] = useState<number | null>(null);

  const cats = useMemo(() => {
    const present = new Set(data.photos.map((p) => p.category));
    return (Object.keys(CATEGORY_LABELS) as Category[]).filter((c) => present.has(c));
  }, [data.photos]);
  const list = useMemo(() => (filter === 'all' ? data.photos : data.photos.filter((p) => p.category === filter)), [data.photos, filter]);

  return (
    <>
      <TopBar overHero={false} />
      <main className="wrap px" style={{ paddingTop: 100, paddingBottom: 80 }}>
        <div className="idx">The work</div>
        <h1 className="serif" style={{ fontSize: 'clamp(46px, 11vw, 96px)', lineHeight: 1, margin: '10px 0 0' }}>
          Every <span className="it">wedding,</span> <br />its own story.
        </h1>
        <p className="muted" style={{ margin: '14px 0 26px' }}>{data.photos.length} photographs · updated from our studio</p>

        <div className="chips cap" role="tablist" aria-label="Filter photos">
          <button className={'chip' + (filter === 'all' ? ' on' : '')} onClick={() => setFilter('all')} role="tab" aria-selected={filter === 'all'}>All</button>
          {cats.map((c) => (
            <button key={c} className={'chip' + (filter === c ? ' on' : '')} onClick={() => setFilter(c)} role="tab" aria-selected={filter === c}>{CATEGORY_LABELS[c]}</button>
          ))}
        </div>

        <div className="masonry" style={{ marginTop: 20 }}>
          {list.map((p, i) => (
            <button key={p.id} className="tile ph" onClick={() => setOpen(i)} aria-label={`Open ${p.title || 'photo'}`}
              style={{ display: 'block', width: '100%', aspectRatio: p.width && p.height ? `${p.width} / ${p.height}` : undefined }}>
              <img src={p.thumb} alt={`${p.title || CATEGORY_LABELS[p.category]} — Breywhites`} loading={i < 6 ? 'eager' : 'lazy'} decoding="async"
                width={p.width || undefined} height={p.height || undefined} />
            </button>
          ))}
        </div>
        {list.length === 0 && <p className="muted">No photos here yet.</p>}

        <div style={{ borderTop: '1px solid var(--rule)', marginTop: 50, paddingTop: 30 }}>
          <div className="serif" style={{ fontSize: 'clamp(34px, 8vw, 56px)', lineHeight: 1.05 }}>Like what you see? <span className="it">Check your date.</span></div>
          <a className="btn btn-dark cap" style={{ marginTop: 20 }} href={waLink(settings.whatsapp, `Hi ${settings.studio_name}, I saw your portfolio and would like to check a date.`)} target="_blank" rel="noopener">
            <IconChat size={16} /> Message on WhatsApp
          </a>
        </div>
      </main>
      <Footer settings={settings} />
      <ActionBar settings={settings} showAfterHero={false} />
      {open != null && <Lightbox photos={list} index={open} onClose={() => setOpen(null)} onIndex={setOpen} />}
    </>
  );
}
