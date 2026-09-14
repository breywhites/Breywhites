import React, { useEffect, useMemo, useState } from 'react';
import { fmtDay, inr, toDay, waLink } from '../lib/format';
import type { PackageRow, PriceLinkRow, PriceLinkStat } from '../lib/models';
import { useRoute } from '../lib/router';
import { IconChat, IconCopy, IconExternal, IconFile, IconPlus, IconTrash } from '../site/Icons';
import { useAdmin } from './AdminApp';
import { createLink, deleteLink, extendLink, linkMessage, linkUrl, listLinks, listPackages, setLinkStatus } from './data';
import { Chips, Empty, ErrorBox, errorText, Field, Loading, PageHead, Pill, setHandoff, Sheet, takeHandoff, timeAgo, useAsync, useConfirm, useToast } from './ui';

type Prefill = { client_name?: string; phone?: string; wedding_date?: string | null; enquiry_id?: string };

async function copy(text: string) {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}

export function PriceLinks() {
  const { site, biz } = useAdmin();
  const { navigate } = useRoute();
  const toast = useToast();
  const confirm = useConfirm();
  const links = useAsync(listLinks, []);
  const packs = useAsync(listPackages, []);
  const [creating, setCreating] = useState<Prefill | null>(null);
  const [ready, setReady] = useState<PriceLinkRow | null>(null);
  const [filter, setFilter] = useState<'active' | 'all'>('active');

  useEffect(() => {
    const h = takeHandoff<Prefill>('link');
    if (h) setCreating(h);
  }, []);

  const todayStr = toDay(new Date());
  const shown = (links.data || []).filter((l) => filter === 'all' || (l.status === 'active' && l.valid_until >= todayStr));

  const share = (l: { client_name: string; wedding_date: string | null; valid_until: string; slug: string; phone: string | null }) =>
    waLink(l.phone || site.whatsapp, linkMessage(site.studio_name, l));

  const act = async (fn: () => Promise<unknown>, msg: string) => {
    try { await fn(); toast(msg); links.reload(); } catch (e) { toast(errorText(e), 'err'); }
  };

  return (
    <div className="a-wrap">
      <PageHead title="Price links" sub="Private package pages for each client — they’re not in the website menu"
        actions={<button className="a-btn dark" onClick={() => setCreating({})}><IconPlus size={15} /> New price link</button>} />

      <Chips label="Filter links" value={filter} onChange={setFilter} options={[{ value: 'active', label: 'Active' }, { value: 'all', label: 'All links' }]} />

      <div style={{ marginTop: 14 }}>
        {links.error && <ErrorBox message={links.error} retry={links.reload} />}
        {links.loading && !links.data && <Loading />}
        {links.data && shown.length === 0 && (
          <Empty title="No active links" action={<button className="a-btn dark" onClick={() => setCreating({})}>Send your first price link</button>}>
            Create a link, send it on WhatsApp, and see here when the client opens it.
          </Empty>
        )}
        <div className="a-list">
          {shown.map((l) => <LinkRow key={l.id} l={l} todayStr={todayStr} share={share}
            onCopy={async () => toast((await copy(linkUrl(l.slug))) ? 'Link copied' : 'Couldn’t copy — press and hold the link to copy', 'ok')}
            onExtend={() => act(() => extendLink(l.id, biz.price_link_days), `Valid for ${biz.price_link_days} more days`)}
            onBooked={() => act(() => setLinkStatus(l.id, 'booked'), 'Marked as booked')}
            onArchive={() => act(() => setLinkStatus(l.id, 'archived'), 'Link switched off')}
            onQuote={() => { setHandoff('quote', { client_name: l.client_name, phone: l.phone || '', event_date: l.wedding_date || '', price_link_id: l.id, top_package: l.top_package }); navigate('/admin/quotes/new'); }}
            onDelete={async () => { if (await confirm({ title: 'Delete this link?', body: 'The client will no longer be able to open it.', ok: 'Delete', danger: true })) act(() => deleteLink(l.id), 'Link deleted'); }}
          />)}
        </div>
      </div>

      {creating && (
        <CreateLink prefill={creating} packages={(packs.data || []).filter((p) => p.active)} defaultDays={biz.price_link_days}
          onClose={() => setCreating(null)}
          onCreated={(row) => { setCreating(null); setReady(row); links.reload(); }} />
      )}

      <Sheet open={!!ready} onClose={() => setReady(null)} title="Link ready"
        footer={ready ? <>
          <button className="a-btn line" onClick={async () => toast((await copy(linkUrl(ready.slug))) ? 'Link copied' : 'Couldn’t copy', 'ok')}><IconCopy size={15} /> Copy</button>
          <a className="a-btn dark" href={share(ready)} target="_blank" rel="noopener" onClick={() => setReady(null)}><IconChat size={15} /> Send on WhatsApp</a>
        </> : null}>
        {ready && (
          <>
            <div className="a-label">Private link</div>
            <a href={linkUrl(ready.slug)} target="_blank" rel="noopener" style={{ display: 'block', fontSize: 16, wordBreak: 'break-all', margin: '6px 0 16px', textDecoration: 'underline' }}>{linkUrl(ready.slug)}</a>
            <div className="a-label">Message</div>
            <div style={{ background: 'var(--paper-2)', padding: '12px 14px', whiteSpace: 'pre-line', lineHeight: 1.55, marginTop: 6, fontSize: 14 }}>{linkMessage(site.studio_name, ready)}</div>
            {!ready.phone && <p className="a-hint">No number added — WhatsApp will ask you to pick the chat.</p>}
          </>
        )}
      </Sheet>
    </div>
  );
}

function LinkRow({ l, todayStr, share, onCopy, onExtend, onBooked, onArchive, onQuote, onDelete }: {
  l: PriceLinkStat; todayStr: string; share: (l: PriceLinkStat) => string;
  onCopy: () => void; onExtend: () => void; onBooked: () => void; onArchive: () => void; onQuote: () => void; onDelete: () => void;
}) {
  const [more, setMore] = useState(false);
  const expired = l.status === 'active' && l.valid_until < todayStr;
  const tone = expired ? 'expired' : l.status;
  return (
    <article style={{ padding: '14px 0', borderBottom: '1px solid var(--rule)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 500 }}>{l.client_name}</div>
          <div className="a-hint">{l.wedding_date ? fmtDay(l.wedding_date) + ' · ' : ''}{l.package_ids.length} packages · sent {timeAgo(l.created_at)}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <Pill tone={tone}>{expired ? 'expired' : l.status}</Pill>
          <div className="a-hint" style={{ marginTop: 6 }}>{expired ? 'ended' : 'until'} {fmtDay(l.valid_until)}</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginTop: 10, fontSize: 13.5 }}>
        <span><b className="num">{l.opens}</b> {l.opens === 1 ? 'open' : 'opens'}{l.last_opened_at ? ` · last ${timeAgo(l.last_opened_at)}` : ''}</span>
        {l.top_package && <span>Looked at most: <b>{l.top_package}</b></span>}
        {l.book_clicks > 0 && <span style={{ color: 'var(--accent)' }}>Tapped “Book” {l.book_clicks}×</span>}
        {l.opens === 0 && <span className="a-hint">Not opened yet</span>}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
        <a className="a-btn line" href={share(l)} target="_blank" rel="noopener"><IconChat size={15} /> Resend</a>
        <button className="a-btn line" onClick={onCopy}><IconCopy size={15} /> Copy</button>
        <a className="a-btn line" href={linkUrl(l.slug)} target="_blank" rel="noopener"><IconExternal size={15} /> Open</a>
        <button className="a-btn line" onClick={onQuote}><IconFile size={15} /> Quote</button>
        <button className="a-btn ghost" onClick={() => setMore(!more)} aria-expanded={more}>{more ? 'Less' : 'More'}</button>
      </div>
      {more && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
          <button className="a-btn line" onClick={onExtend}>Extend validity</button>
          {l.status !== 'booked' && <button className="a-btn line" onClick={onBooked}>Mark booked</button>}
          {l.status !== 'archived' && <button className="a-btn line" onClick={onArchive}>Switch off</button>}
          <button className="a-btn danger" onClick={onDelete}><IconTrash size={15} /> Delete</button>
        </div>
      )}
    </article>
  );
}

function CreateLink({ prefill, packages, defaultDays, onClose, onCreated }: {
  prefill: Prefill; packages: PackageRow[]; defaultDays: number; onClose: () => void; onCreated: (row: PriceLinkRow) => void;
}) {
  const toast = useToast();
  const [name, setName] = useState(prefill.client_name || '');
  const [phone, setPhone] = useState(prefill.phone || '');
  const [date, setDate] = useState(prefill.wedding_date || '');
  const [chosen, setChosen] = useState<string[]>([]);
  const [days, setDays] = useState(defaultDays);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => { setChosen(packages.map((p) => p.id)); }, [packages]);
  const opts = useMemo(() => Array.from(new Set([7, 14, 30, defaultDays])).sort((a, b) => a - b), [defaultDays]);

  const submit = async () => {
    if (!name.trim()) { setErr('Add the client’s name'); return; }
    if (!chosen.length) { setErr('Choose at least one package'); return; }
    setBusy(true); setErr('');
    try {
      const row = await createLink({ client_name: name, phone, wedding_date: date || null, package_ids: packages.filter((p) => chosen.includes(p.id)).map((p) => p.id), days, enquiry_id: prefill.enquiry_id });
      onCreated(row);
    } catch (e) { toast(errorText(e), 'err'); }
    finally { setBusy(false); }
  };

  return (
    <Sheet open onClose={onClose} title="New price link"
      footer={<><button className="a-btn line" onClick={onClose}>Cancel</button><button className="a-btn dark" onClick={submit} disabled={busy}>{busy ? 'Creating…' : 'Create link'}</button></>}>
      <div className="a-grid">
        <Field id="pl-name" label="Client name"><input className="a-inp" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Anjali & Rohit" autoComplete="off" /></Field>
        <div className="a-grid two">
          <Field id="pl-phone" label="WhatsApp number"><input className="a-inp" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="10-digit number" /></Field>
          <Field id="pl-date" label="Wedding date"><input className="a-inp" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        </div>
        <div>
          <div className="a-label" style={{ marginBottom: 4 }}>Packages they’ll see</div>
          {packages.length === 0 && <div className="a-hint">Add packages first (Packages screen).</div>}
          {packages.map((p) => {
            const on = chosen.includes(p.id);
            return (
              <label key={p.id} className="a-toggle" style={{ minHeight: 50 }}>
                <span><span style={{ fontSize: 15, color: on ? 'var(--ink)' : 'var(--faint)' }}>{p.name}</span> <span className="a-hint num">{inr(p.price)}</span></span>
                <input type="checkbox" checked={on} onChange={() => setChosen(on ? chosen.filter((x) => x !== p.id) : [...chosen, p.id])} style={{ width: 22, height: 22, accentColor: '#17130f' }} />
              </label>
            );
          })}
        </div>
        <div>
          <div className="a-label" style={{ marginBottom: 6 }}>Prices valid for</div>
          <div className="a-chips">{opts.map((d) => <button key={d} className={'a-chip' + (d === days ? ' on' : '')} onClick={() => setDays(d)}>{d} days</button>)}</div>
        </div>
        {err && <div role="alert" style={{ color: '#9b2c1d' }}>{err}</div>}
      </div>
    </Sheet>
  );
}
