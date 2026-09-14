import React, { useState } from 'react';
import { digits } from '../lib/format';
import type { FilmRow, PhotoRow } from '../lib/models';
import { store } from '../lib/store';
import { IconPlus, IconTrash } from '../site/Icons';
import { useAdmin } from './AdminApp';
import { deleteFilm, listFilms, listPhotos, saveBiz, saveFilm, saveSite } from './data';
import { errorText, Field, PageHead, Sheet, useAsync, useConfirm, useToast } from './ui';

export function SettingsScreen() {
  const { site, biz, reloadSettings, signOut } = useAdmin();
  const toast = useToast();

  const [s, setS] = useState({ studio_name: site.studio_name, tagline: site.tagline, whatsapp: site.whatsapp, phones: site.phones.join(', '), instagram: site.instagram, email: site.email });
  const [b, setB] = useState({ advance_percent: String(biz.advance_percent), upi_id: biz.upi_id || '', bank_details: biz.bank_details || '', quote_terms: biz.quote_terms, invoice_terms: biz.invoice_terms, price_link_days: String(biz.price_link_days) });
  const [busy, setBusy] = useState<string | null>(null);

  const saveWebsite = async () => {
    let wa = digits(s.whatsapp);
    if (wa.length === 10) wa = '91' + wa;
    if (wa.length < 11) { toast('WhatsApp number looks too short', 'err'); return; }
    if (!s.studio_name.trim()) { toast('Add the studio name', 'err'); return; }
    setBusy('site');
    try {
      await saveSite({ studio_name: s.studio_name.trim(), tagline: s.tagline.trim(), whatsapp: wa, phones: s.phones.split(/[,\n]/).map((x) => digits(x)).filter(Boolean), instagram: s.instagram.replace(/^@/, '').trim(), email: s.email.trim() });
      await reloadSettings();
      setS((cur) => ({ ...cur, whatsapp: wa, instagram: cur.instagram.replace(/^@/, '').trim() }));
      toast('Website details saved');
    } catch (e) { toast(errorText(e), 'err'); }
    finally { setBusy(null); }
  };

  const saveDocs = async () => {
    const adv = Math.round(Number(b.advance_percent));
    const days = Math.round(Number(b.price_link_days));
    if (!(adv >= 0 && adv <= 100)) { toast('Advance must be between 0 and 100%', 'err'); return; }
    if (!(days >= 1 && days <= 90)) { toast('Price links can last 1 to 90 days', 'err'); return; }
    setBusy('biz');
    try {
      await saveBiz({ advance_percent: adv, upi_id: b.upi_id.trim() || null, bank_details: b.bank_details.trim() || null, quote_terms: b.quote_terms.trim(), invoice_terms: b.invoice_terms.trim(), price_link_days: days });
      await reloadSettings();
      toast('Quote & invoice settings saved');
    } catch (e) { toast(errorText(e), 'err'); }
    finally { setBusy(null); }
  };

  return (
    <div className="a-wrap" style={{ maxWidth: 760 }}>
      <PageHead title="Settings" />

      <section className="a-card a-pad">
        <h2 className="serif" style={{ fontSize: 24, marginBottom: 12 }}>Website details</h2>
        <div className="a-grid">
          <div className="a-grid two">
            <Field id="st-name" label="Studio name"><input className="a-inp" value={s.studio_name} onChange={(e) => setS({ ...s, studio_name: e.target.value })} /></Field>
            <Field id="st-wa" label="WhatsApp number" hint="Bookings and enquiries go here"><input className="a-inp" type="tel" value={s.whatsapp} onChange={(e) => setS({ ...s, whatsapp: e.target.value })} /></Field>
          </div>
          <Field id="st-tag" label="Headline on the homepage" hint="The last two words are shown in italics"><input className="a-inp" value={s.tagline} onChange={(e) => setS({ ...s, tagline: e.target.value })} /></Field>
          <div className="a-grid two">
            <Field id="st-phones" label="Phone numbers" hint="Separate with commas"><input className="a-inp" value={s.phones} onChange={(e) => setS({ ...s, phones: e.target.value })} /></Field>
            <Field id="st-ig" label="Instagram username"><input className="a-inp" value={s.instagram} onChange={(e) => setS({ ...s, instagram: e.target.value })} /></Field>
          </div>
          <Field id="st-email" label="Email"><input className="a-inp" type="email" value={s.email} onChange={(e) => setS({ ...s, email: e.target.value })} /></Field>
          <button className="a-btn dark" onClick={saveWebsite} disabled={busy === 'site'} style={{ justifySelf: 'start' }}>{busy === 'site' ? 'Saving…' : 'Save website details'}</button>
        </div>
      </section>

      <Films />

      <section className="a-card a-pad" style={{ marginTop: 16 }}>
        <h2 className="serif" style={{ fontSize: 24, marginBottom: 12 }}>Quotes, invoices & price links</h2>
        <div className="a-grid">
          <div className="a-grid two">
            <Field id="bz-adv" label="Advance to block a date (%)"><input className="a-inp num" inputMode="numeric" value={b.advance_percent} onChange={(e) => setB({ ...b, advance_percent: e.target.value })} /></Field>
            <Field id="bz-days" label="Price links valid for (days)"><input className="a-inp num" inputMode="numeric" value={b.price_link_days} onChange={(e) => setB({ ...b, price_link_days: e.target.value })} /></Field>
          </div>
          <Field id="bz-upi" label="UPI ID" hint="Printed on invoices"><input className="a-inp" value={b.upi_id} onChange={(e) => setB({ ...b, upi_id: e.target.value })} placeholder="yourname@okbank" /></Field>
          <Field id="bz-bank" label="Bank details (optional)"><textarea className="a-inp" rows={3} value={b.bank_details} onChange={(e) => setB({ ...b, bank_details: e.target.value })} placeholder={'Account name\nAccount number · IFSC'} /></Field>
          <Field id="bz-qt" label="Terms on quotes"><textarea className="a-inp" rows={3} value={b.quote_terms} onChange={(e) => setB({ ...b, quote_terms: e.target.value })} /></Field>
          <Field id="bz-it" label="Note on invoices"><textarea className="a-inp" rows={2} value={b.invoice_terms} onChange={(e) => setB({ ...b, invoice_terms: e.target.value })} /></Field>
          <button className="a-btn dark" onClick={saveDocs} disabled={busy === 'biz'} style={{ justifySelf: 'start' }}>{busy === 'biz' ? 'Saving…' : 'Save quote & invoice settings'}</button>
        </div>
      </section>

      <Account signOut={signOut} />
    </div>
  );
}

function Films() {
  const toast = useToast();
  const confirm = useConfirm();
  const films = useAsync(listFilms, []);
  const photos = useAsync(listPhotos, []);
  const [edit, setEdit] = useState<Partial<FilmRow> | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!edit?.title?.trim() || !edit.video_url?.trim()) { toast('Add a title and the video link', 'err'); return; }
    let url = edit.video_url.trim();
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url.replace(/^\/+/, '');
    if (!/^https?:\/\/[^\s/]+\.[^\s]+/i.test(url)) { toast('That doesn’t look like a video link — copy it from YouTube or Instagram', 'err'); return; }
    setBusy(true);
    try { await saveFilm({ ...edit, title: edit.title.trim(), video_url: url } as any); setEdit(null); films.reload(); toast('Film saved'); }
    catch (e) { toast(errorText(e), 'err'); }
    finally { setBusy(false); }
  };

  return (
    <section className="a-card a-pad" style={{ marginTop: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
        <h2 className="serif" style={{ fontSize: 24 }}>Highlight film</h2>
        <button className="a-btn line" onClick={() => setEdit({ title: 'Watch a wedding', video_url: '', duration_label: '' })}><IconPlus size={15} /> Add</button>
      </div>
      <p className="a-hint" style={{ marginTop: 4 }}>The homepage shows your first film. Paste a YouTube, Instagram or Google Drive link.</p>
      <div className="a-list">
        {(films.data || []).map((f) => (
          <div key={f.id} className="a-row">
            {f.poster_path && <img src={store.publicUrl(f.poster_path)} alt="" style={{ width: 64, height: 44, objectFit: 'cover' }} />}
            <button className="grow" style={{ textAlign: 'left' }} onClick={() => setEdit(f)}>
              <div className="title">{f.title}</div><div className="meta">{f.video_url}</div>
            </button>
            <button className="a-icon" aria-label={`Delete ${f.title}`} onClick={async () => {
              if (await confirm({ title: 'Remove this film?', ok: 'Remove', danger: true })) { try { await deleteFilm(f.id); films.reload(); } catch (e) { toast(errorText(e), 'err'); } }
            }}><IconTrash size={17} /></button>
          </div>
        ))}
      </div>
      {edit && (
        <Sheet open onClose={() => setEdit(null)} title={edit.id ? 'Edit film' : 'Add film'}
          footer={<><button className="a-btn line" onClick={() => setEdit(null)}>Cancel</button><button className="a-btn dark" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save'}</button></>}>
          <div className="a-grid">
            <Field id="fm-title" label="Title"><input className="a-inp" value={edit.title || ''} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></Field>
            <Field id="fm-url" label="Video link"><input className="a-inp" type="url" value={edit.video_url || ''} onChange={(e) => setEdit({ ...edit, video_url: e.target.value })} placeholder="https://youtube.com/…" /></Field>
            <Field id="fm-dur" label="Small label (optional)"><input className="a-inp" value={edit.duration_label || ''} onChange={(e) => setEdit({ ...edit, duration_label: e.target.value })} placeholder="Highlight film · 3–5 min" /></Field>
            <div>
              <div className="a-label" style={{ marginBottom: 6 }}>Cover photo</div>
              <div className="a-photos" style={{ gridTemplateColumns: 'repeat(4, minmax(0,1fr))' }}>
                {(photos.data || []).slice(0, 24).map((p: PhotoRow) => (
                  <button key={p.id} className="a-ph" onClick={() => setEdit({ ...edit, poster_path: p.path_large })}
                    style={{ outline: edit.poster_path === p.path_large ? '3px solid #17130f' : 'none', outlineOffset: -3 }} aria-label="Use as cover">
                    <img src={store.publicUrl(p.path_thumb)} alt="" loading="lazy" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Sheet>
      )}
    </section>
  );
}

function Account({ signOut }: { signOut: () => void }) {
  const toast = useToast();
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const change = async () => {
    if (pw.length < 8) { toast('Use at least 8 characters', 'err'); return; }
    setBusy(true);
    try { await store.auth.updatePassword(pw); setPw(''); toast('Password changed'); }
    catch (e) { toast(errorText(e), 'err'); }
    finally { setBusy(false); }
  };
  return (
    <section className="a-card a-pad" style={{ marginTop: 16 }}>
      <h2 className="serif" style={{ fontSize: 24, marginBottom: 4 }}>Your account</h2>
      <p className="a-hint" style={{ marginTop: 0 }}>Signed in as {store.auth.user()?.email}</p>
      <div className="a-grid two" style={{ alignItems: 'end' }}>
        <Field id="acc-pw" label="New password"><input className="a-inp" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} /></Field>
        <button className="a-btn line lg" onClick={change} disabled={busy}>{busy ? 'Saving…' : 'Change password'}</button>
      </div>
      <button className="a-btn ghost" style={{ marginTop: 12 }} onClick={signOut}>Sign out</button>
    </section>
  );
}
