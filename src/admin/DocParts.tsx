import React, { useEffect, useRef, useState } from 'react';
import type { DocInput } from '../lib/docs';
import { dataUrlToBlob, docFilename, jpegToPdf, renderDocJpeg, shareOrDownload } from '../lib/docs';
import { fmtDay, inr, waLink } from '../lib/format';
import type { BusinessSettingsRow, InvoiceRow, LineItem, PackageRow, PaymentRow, QuoteRow, SiteSettingsRow } from '../lib/models';
import { lineTotals } from '../lib/models';
import { IconChat, IconFile, IconImage, IconMinus, IconPlus, IconTrash } from '../site/Icons';
import type { DocDraft } from './data';
import { packageDescription } from './data';
import { store } from '../lib/store';
import { errorText, Field, Sheet, useToast } from './ui';

/* ---------------- form ---------------- */
export function DocForm({ kind, draft, setDraft, packages }: { kind: 'quote' | 'invoice'; draft: DocDraft; setDraft: (d: DocDraft) => void; packages: PackageRow[] }) {
  const set = <K extends keyof DocDraft>(k: K, v: DocDraft[K]) => setDraft({ ...draft, [k]: v });
  const setItem = (i: number, patch: Partial<LineItem>) => set('items', draft.items.map((it, k) => (k === i ? { ...it, ...patch } : it)));
  const t = lineTotals(draft.items, draft.discount);
  const advance = Math.round(t.total * (draft.advance_percent || 0) / 100);

  return (
    <div className="a-grid" style={{ gap: 22 }}>
      <section>
        <div className="a-label" style={{ marginBottom: 8 }}>Client</div>
        <div className="a-grid two">
          <Field id="doc-name" label="Name"><input className="a-inp" value={draft.client_name} onChange={(e) => set('client_name', e.target.value)} placeholder="e.g. Anjali & Rohit" autoComplete="off" /></Field>
          <Field id="doc-phone" label="WhatsApp number"><input className="a-inp" type="tel" inputMode="tel" value={draft.phone} onChange={(e) => set('phone', e.target.value)} placeholder="10-digit number" /></Field>
          <Field id="doc-date" label="Event date"><input className="a-inp" type="date" value={draft.event_date} onChange={(e) => set('event_date', e.target.value)} /></Field>
          <Field id="doc-venue" label="Venue (optional)"><input className="a-inp" value={draft.venue} onChange={(e) => set('venue', e.target.value)} placeholder="e.g. Kochi" /></Field>
        </div>
      </section>

      <section>
        <div className="a-label" style={{ marginBottom: 8 }}>Packages</div>
        <div className="a-chips" style={{ flexWrap: 'wrap' }}>
          {packages.filter((p) => p.active).map((p) => (
            <button key={p.id} className="a-chip" onClick={() => set('items', [...draft.items, { package_id: p.id, name: p.name, description: packageDescription(p), price: p.price, qty: 1 }])}>
              <IconPlus size={13} /> {p.name} <span className="n num">{inr(p.price)}</span>
            </button>
          ))}
          <button className="a-chip" onClick={() => set('items', [...draft.items, { package_id: null, name: '', description: '', price: 0, qty: 1 }])}><IconPlus size={13} /> Custom item</button>
        </div>
        <div style={{ marginTop: 8, borderTop: '1px solid var(--rule)' }}>
          {draft.items.length === 0 && <div className="a-hint" style={{ padding: '14px 0' }}>Tap a package above to add it.</div>}
          {draft.items.map((it, i) => (
            <div key={i} className="a-line">
              <div style={{ display: 'grid', gap: 6 }}>
                <input className="a-inp" aria-label="Item name" value={it.name} onChange={(e) => setItem(i, { name: e.target.value })} placeholder="Item name, e.g. Drone coverage" style={{ fontWeight: 500 }} />
                <textarea className="a-inp" aria-label="Item details" rows={2} value={it.description} onChange={(e) => setItem(i, { description: e.target.value })} placeholder="What’s included (optional)" style={{ minHeight: 56, fontSize: 14 }} />
              </div>
              <div style={{ display: 'grid', gap: 6, justifyItems: 'end', alignContent: 'start' }}>
                <input className="a-inp num" aria-label="Price" inputMode="numeric" value={it.price ? String(it.price) : ''} placeholder="₹"
                  onChange={(e) => setItem(i, { price: Number(e.target.value.replace(/[^0-9]/g, '')) || 0 })} style={{ width: 112, textAlign: 'right' }} />
                <div className="a-qty">
                  <button onClick={() => setItem(i, { qty: Math.max(1, it.qty - 1) })} aria-label="Less"><IconMinus size={14} /></button>
                  <span>{it.qty}</span>
                  <button onClick={() => setItem(i, { qty: Math.min(50, it.qty + 1) })} aria-label="More"><IconPlus size={14} /></button>
                </div>
                <button className="a-icon" onClick={() => set('items', draft.items.filter((_, k) => k !== i))} aria-label={`Remove ${it.name || 'item'}`}><IconTrash size={16} /></button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="a-grid two">
        <Field id="doc-discount" label="Discount (₹)"><input className="a-inp num" inputMode="numeric" value={draft.discount ? String(draft.discount) : ''} placeholder="0" onChange={(e) => set('discount', Number(e.target.value.replace(/[^0-9]/g, '')) || 0)} /></Field>
        {kind === 'quote' ? (
          <Field id="doc-adv" label="Advance (%)"><input className="a-inp num" inputMode="numeric" value={String(draft.advance_percent)} onChange={(e) => set('advance_percent', Math.min(100, Number(e.target.value.replace(/[^0-9]/g, '')) || 0))} /></Field>
        ) : (
          <Field id="doc-due" label="Balance due by"><input className="a-inp" type="date" value={draft.due_on} onChange={(e) => set('due_on', e.target.value)} /></Field>
        )}
        {kind === 'quote' && <Field id="doc-valid" label="Quote valid until"><input className="a-inp" type="date" value={draft.valid_until} onChange={(e) => set('valid_until', e.target.value)} /></Field>}
      </section>

      <Field id="doc-terms" label={kind === 'quote' ? 'Terms' : 'Note'}><textarea className="a-inp" rows={3} value={draft.terms} onChange={(e) => set('terms', e.target.value)} /></Field>

      <div className="a-card a-pad a-totals">
        <span>Subtotal</span><span>{inr(t.subtotal)}</span>
        {t.discount > 0 && <><span>Discount</span><span style={{ color: 'var(--accent)' }}>− {inr(t.discount)}</span></>}
        <span style={{ alignSelf: 'end' }}>Total</span><span className="big">{inr(t.total)}</span>
        {kind === 'quote' && advance > 0 && <><span className="a-hint">Advance ({draft.advance_percent}%)</span><span className="a-hint">{inr(advance)}</span></>}
      </div>
    </div>
  );
}

/* ---------------- preview + share ---------------- */
export function DocShare({ input, site, biz, dirty, onSave, phone }: {
  input: DocInput | null; site: SiteSettingsRow; biz: BusinessSettingsRow;
  dirty: boolean; onSave: () => Promise<DocInput | null>; phone: string | null;
}) {
  const toast = useToast();
  const [img, setImg] = useState<{ dataUrl: string; w: number; h: number; key: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [saved, setSaved] = useState<{ url: string; name: string; title: string } | null>(null);
  const key = input ? JSON.stringify(input) : '';
  const seq = useRef(0);

  useEffect(() => {
    if (!input) { setImg(null); return; }
    const n = ++seq.current;
    const k = key;
    const t = window.setTimeout(() => {
      renderDocJpeg(input, site, biz).then((r) => { if (n === seq.current) setImg({ ...r, key: k }); }).catch(() => {});
    }, 450);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, site, biz]);

  const deliver = async (blob: Blob, doc: DocInput, what: 'jpg' | 'pdf', dataUrl: string) => {
    const name = docFilename(doc, what);
    const res = await shareOrDownload(blob, name);
    if (res !== 'downloaded') return;
    if (store.demo) setSaved({ url: dataUrl, name, title: `${doc.kind === 'quote' ? 'Quote' : 'Invoice'} ${doc.doc.number}` });
    else toast(`${what.toUpperCase()} saved — attach it in WhatsApp`);
  };

  const run = async (what: 'jpg' | 'pdf') => {
    // already drawn for exactly this document: share straight from the tap (phones require that)
    if (!dirty && input && img && img.key === key) {
      try { await deliver(what === 'pdf' ? jpegToPdf(img.dataUrl, img.w, img.h) : dataUrlToBlob(img.dataUrl), input, what, img.dataUrl); }
      catch (e) { toast(errorText(e), 'err'); }
      return;
    }
    setBusy(what);
    try {
      const doc = dirty ? await onSave() : input;
      if (!doc) return;
      const r = await renderDocJpeg(doc, site, biz);
      await deliver(what === 'pdf' ? jpegToPdf(r.dataUrl, r.w, r.h) : dataUrlToBlob(r.dataUrl), doc, what, r.dataUrl);
    } catch (e) { toast(errorText(e), 'err'); }
    finally { setBusy(null); }
  };

  const ready = !!input && !dirty;

  return (
    <div className="preview">
      <div className="a-paper" aria-label="Document preview">
        {img ? <img src={img.dataUrl} alt="Preview of the document" /> : <div className="skeleton" style={{ aspectRatio: '1 / 1.414' }} />}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 8, marginTop: 10 }}>
        <button className="a-btn dark lg" onClick={() => run('pdf')} disabled={!input || !!busy}><IconFile size={15} /> {busy === 'pdf' ? 'Making…' : 'Send PDF'}</button>
        <button className="a-btn line lg" onClick={() => run('jpg')} disabled={!input || !!busy}><IconImage size={15} /> {busy === 'jpg' ? 'Making…' : 'Send image'}</button>
      </div>
      {ready ? (
        <a className="a-btn line lg block" style={{ marginTop: 8 }} href={waLink(phone || site.whatsapp, docMessage(input!, site, biz))} target="_blank" rel="noopener">
          <IconChat size={15} /> WhatsApp message
        </a>
      ) : (
        <button className="a-btn line lg block" style={{ marginTop: 8 }} disabled={!input || !!busy} onClick={() => onSave()}>
          <IconChat size={15} /> Save to send a message
        </button>
      )}
      <p className="a-hint" style={{ textAlign: 'center' }}>On a phone, “Send” opens the share menu — pick WhatsApp and the client’s chat.</p>

      <Sheet open={!!saved} onClose={() => setSaved(null)} title={saved?.title || ''}
        footer={<button className="a-btn dark" onClick={() => setSaved(null)}>Done</button>}>
        <p className="a-hint" style={{ marginTop: 0 }}>Made {saved?.name}. This preview may not be allowed to save files — on your live website it downloads, and on a phone the share menu opens so you can pick WhatsApp.</p>
        {saved && <img src={saved.url} alt="The document that was sent" style={{ width: '100%', border: '1px solid var(--rule)' }} />}
      </Sheet>
    </div>
  );
}

export function docMessage(input: DocInput, site: SiteSettingsRow, biz: BusinessSettingsRow): string {
  const d = input.doc;
  const t = lineTotals(d.items, d.discount);
  const lines = d.items.map((it, i) => `${i + 1}. ${it.name}${it.qty > 1 ? ` × ${it.qty}` : ''} — ${inr(it.price * it.qty)}`);
  const head = `Hi ${d.client_name},\n\nHere is your ${input.kind === 'quote' ? 'quotation' : 'invoice'} from ${site.studio_name} (${d.number}).` + (d.event_date ? `\nEvent date: ${fmtDay(d.event_date)}` : '');
  if (input.kind === 'quote') {
    const q = input.doc as QuoteRow;
    const adv = Math.round(t.total * q.advance_percent / 100);
    return [head, '', ...lines, '', t.discount ? `Discount: − ${inr(t.discount)}` : '', `Total: ${inr(t.total)}`, adv ? `Advance to block the date (${q.advance_percent}%): ${inr(adv)}` : '', '',
      q.valid_until ? `Valid until ${fmtDay(q.valid_until)}. Reply here to confirm your date.` : 'Reply here to confirm your date.'].filter((l, i, a) => l !== '' || a[i - 1] !== '').join('\n');
  }
  const inv = input.doc as InvoiceRow;
  const bal = Math.max(0, inv.total - inv.paid);
  return [head, '', `Total: ${inr(inv.total)}`, `Paid so far: ${inr(inv.paid)}`, bal ? `Balance due: ${inr(bal)}${inv.due_on ? ` by ${fmtDay(inv.due_on)}` : ''}` : 'Paid in full — thank you!',
    bal && biz.upi_id ? `\nPay by UPI: ${biz.upi_id}` : ''].filter(Boolean).join('\n');
}

export function toDocInputQuote(q: QuoteRow): DocInput { return { kind: 'quote', doc: q }; }
export function toDocInputInvoice(inv: InvoiceRow, payments: PaymentRow[]): DocInput { return { kind: 'invoice', doc: inv, payments }; }
