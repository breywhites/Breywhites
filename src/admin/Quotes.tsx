import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { DocInput } from '../lib/docs';
import { fmtDay, inr } from '../lib/format';
import type { PackageRow, QuoteRow, QuoteStatus } from '../lib/models';
import { lineTotals } from '../lib/models';
import { Link, useRoute } from '../lib/router';
import { IconLeft, IconPlus, IconReceipt, IconTrash } from '../site/Icons';
import { useAdmin } from './AdminApp';
import type { DocDraft } from './data';
import { blankDraft, deleteQuote, getQuote, listPackages, listQuotes, packageDescription, quoteToInvoice, saveQuote, setEnquiryStatus, setQuoteStatus } from './data';
import { DocForm, DocShare } from './DocParts';
import { Chips, Empty, ErrorBox, errorText, Loading, PageHead, Pill, takeHandoff, timeAgo, useAsync, useConfirm, useToast } from './ui';

const STATUS_LABEL: Record<QuoteStatus, string> = { draft: 'Draft', sent: 'Sent', accepted: 'Accepted', declined: 'Declined', invoiced: 'Invoiced' };

export function QuotesList() {
  const { data, error, loading, reload } = useAsync(listQuotes, []);
  const [filter, setFilter] = useState<'open' | QuoteStatus | 'all'>('open');
  const list = (data || []).filter((q) => filter === 'all' || (filter === 'open' ? ['draft', 'sent', 'accepted'].includes(q.status) : q.status === filter));
  const n = (f: (q: QuoteRow) => boolean) => (data || []).filter(f).length;

  return (
    <div className="a-wrap">
      <PageHead title="Quotes" actions={<Link to="/admin/quotes/new" className="a-btn dark"><IconPlus size={15} /> New quote</Link>} />
      <Chips label="Filter quotes" value={filter} onChange={setFilter} options={[
        { value: 'open', label: 'Open', n: n((q) => ['draft', 'sent', 'accepted'].includes(q.status)) },
        { value: 'invoiced', label: 'Invoiced', n: n((q) => q.status === 'invoiced') },
        { value: 'declined', label: 'Declined', n: n((q) => q.status === 'declined') },
        { value: 'all', label: 'All', n: data?.length || 0 },
      ]} />
      <div style={{ marginTop: 12 }}>
        {error && <ErrorBox message={error} retry={reload} />}
        {loading && !data && <Loading />}
        {data && list.length === 0 && <Empty title="No quotes here" action={<Link to="/admin/quotes/new" className="a-btn dark">Make a quote</Link>} />}
        <div className="a-list">
          {list.map((q) => (
            <Link key={q.id} to={`/admin/quotes/${q.id}`} className="a-row link">
              <div className="grow">
                <div className="title">{q.client_name}</div>
                <div className="meta">{q.number}{q.event_date ? ` · ${fmtDay(q.event_date)}` : ''} · {timeAgo(q.updated_at)}</div>
              </div>
              <div className="amt num">{inr(q.total)}</div>
              <Pill tone={q.status}>{STATUS_LABEL[q.status]}</Pill>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

type QuoteHandoff = { client_name?: string; phone?: string; event_date?: string; enquiry_id?: string; price_link_id?: string; top_package?: string | null };

export function QuoteEditor({ id }: { id?: string }) {
  const { site, biz } = useAdmin();
  const { navigate } = useRoute();
  const toast = useToast();
  const confirm = useConfirm();
  const packs = useAsync(listPackages, []);
  const [quote, setQuote] = useState<QuoteRow | null>(null);
  const [draft, setDraft] = useState<DocDraft | null>(null);
  const [saved, setSaved] = useState('');
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [enquiryId, setEnquiryId] = useState<string | null>(null);
  const topPackage = useRef<string | null>(null);

  const fromRow = (q: QuoteRow): DocDraft => ({
    id: q.id, number: q.number, client_name: q.client_name, phone: q.phone || '', event_date: q.event_date || '', venue: q.venue || '',
    items: q.items || [], discount: q.discount, advance_percent: q.advance_percent, terms: q.terms || '', valid_until: q.valid_until || '', due_on: '', price_link_id: q.price_link_id,
  });

  useEffect(() => {
    if (id) {
      getQuote(id).then((q) => {
        if (!q) { setLoadError('This quote doesn’t exist any more.'); return; }
        setQuote(q); const d = fromRow(q); setDraft(d); setSaved(JSON.stringify(d));
      }).catch((e) => setLoadError(errorText(e)));
    } else {
      const d = blankDraft(biz);
      const h = takeHandoff<QuoteHandoff>('quote');
      if (h) {
        Object.assign(d, { client_name: h.client_name || '', phone: h.phone || '', event_date: h.event_date || '', price_link_id: h.price_link_id || null });
        setEnquiryId(h.enquiry_id || null);
        topPackage.current = h.top_package || null;
      }
      setDraft(d);
      setSaved('');
    }
  }, [id, biz]);

  // a quote started from a price link begins with the package they looked at most
  useEffect(() => {
    const top = topPackage.current;
    if (!top || !packs.data || !draft || draft.items.length) return;
    const p = packs.data.find((x: PackageRow) => x.name === top);
    topPackage.current = null;
    if (p) setDraft({ ...draft, items: [{ package_id: p.id, name: p.name, description: packageDescription(p), price: p.price, qty: 1 }] });
  }, [packs.data, draft]);

  const dirty = !!draft && JSON.stringify(draft) !== saved;

  const validate = () => {
    if (!draft) return false;
    if (!draft.client_name.trim()) { toast('Add the client’s name', 'err'); return false; }
    if (!draft.items.length) { toast('Add at least one package', 'err'); return false; }
    if (draft.items.some((i) => !i.name.trim())) { toast('Give every item a name', 'err'); return false; }
    return true;
  };

  const save = async (status?: QuoteStatus): Promise<QuoteRow | null> => {
    if (!draft || !validate()) return null;
    setBusy(true);
    try {
      const q = await saveQuote(draft, status);
      const d = fromRow(q);
      setQuote(q); setDraft(d); setSaved(JSON.stringify(d));
      if (!draft.id) {
        if (enquiryId) setEnquiryStatus(enquiryId, 'quoted').catch(() => {});
        navigate(`/admin/quotes/${q.id}`, { replace: true });
      }
      toast(status ? `Quote marked ${STATUS_LABEL[status].toLowerCase()}` : 'Quote saved');
      return q;
    } catch (e) { toast(errorText(e), 'err'); return null; }
    finally { setBusy(false); }
  };

  const input: DocInput | null = useMemo(() => {
    if (!draft) return null;
    const t = lineTotals(draft.items, draft.discount);
    const now = new Date().toISOString();
    return {
      kind: 'quote',
      doc: {
        id: draft.id || 'draft', number: draft.number || 'Draft', client_name: draft.client_name || 'Client name', phone: draft.phone || null,
        event_date: draft.event_date || null, venue: draft.venue || null, items: draft.items, discount: t.discount, advance_percent: draft.advance_percent,
        subtotal: t.subtotal, total: t.total, terms: draft.terms || null, status: quote?.status || 'draft', price_link_id: draft.price_link_id || null,
        valid_until: draft.valid_until || null, created_at: quote?.created_at || now, updated_at: now,
      },
    };
  }, [draft, quote]);

  const toInvoice = async () => {
    if (!quote) return;
    const current = dirty ? await save() : quote;
    if (!current) return;
    if (!(await confirm({ title: 'Turn this quote into an invoice?', body: 'The invoice copies these packages and price. Record the advance on the invoice and the date gets booked.', ok: 'Create invoice' }))) return;
    setBusy(true);
    try { const inv = await quoteToInvoice({ ...current }, biz); toast(`${inv.number} created`); navigate(`/admin/invoices/${inv.id}`); }
    catch (e) { toast(errorText(e), 'err'); }
    finally { setBusy(false); }
  };

  const remove = async () => {
    if (!quote || !(await confirm({ title: `Delete ${quote.number}?`, ok: 'Delete', danger: true }))) return;
    try { await deleteQuote(quote.id); toast('Quote deleted'); navigate('/admin/quotes'); } catch (e) { toast(errorText(e), 'err'); }
  };

  const setStatus = async (s: QuoteStatus) => {
    if (!quote) return;
    if (dirty) { await save(s); return; }
    try { const q = await setQuoteStatus(quote.id, s); setQuote(q); toast(`Marked ${STATUS_LABEL[s].toLowerCase()}`); } catch (e) { toast(errorText(e), 'err'); }
  };

  if (loadError) return <div className="a-wrap"><PageHead title="Quote" /><ErrorBox message={loadError} /></div>;
  if (!draft) return <Loading />;

  return (
    <div>
      <div className="a-head">
        <div>
          <Link to="/admin/quotes" className="a-hint" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, minHeight: 32 }}><IconLeft size={14} /> Quotes</Link>
          <h1>{quote ? quote.number : 'New quote'}</h1>
          <div className="sub" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {quote && <Pill tone={quote.status}>{STATUS_LABEL[quote.status]}</Pill>}
            {dirty ? <span>Unsaved changes</span> : quote ? <span>Saved {timeAgo(quote.updated_at)}</span> : null}
          </div>
        </div>
        <div className="a-actions">
          <button className="a-btn dark" onClick={() => save()} disabled={busy || !dirty}>{busy ? 'Saving…' : 'Save'}</button>
        </div>
      </div>

      <div className="a-doc">
        <div>
          {packs.error && <ErrorBox message={packs.error} retry={packs.reload} />}
          <DocForm kind="quote" draft={draft} setDraft={setDraft} packages={packs.data || []} />
          {quote && (
            <div className="a-card a-pad" style={{ marginTop: 18 }}>
              <div className="a-label" style={{ marginBottom: 8 }}>What happened?</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {quote.status !== 'invoiced' && (['sent', 'accepted', 'declined'] as QuoteStatus[]).map((s) => (
                  <button key={s} className={'a-btn ' + (quote.status === s ? 'dark' : 'line')} onClick={() => setStatus(s)} disabled={busy}>{STATUS_LABEL[s]}</button>
                ))}
                {quote.status !== 'invoiced'
                  ? <button className="a-btn dark" onClick={toInvoice} disabled={busy}><IconReceipt size={15} /> Make invoice</button>
                  : <Link to="/admin/invoices" className="a-btn line"><IconReceipt size={15} /> See invoices</Link>}
                <button className="a-icon" onClick={remove} aria-label="Delete quote" style={{ marginLeft: 'auto' }}><IconTrash size={17} /></button>
              </div>
            </div>
          )}
        </div>
        <DocShare input={input} site={site} biz={biz} dirty={dirty || !quote} phone={draft.phone || null}
          onSave={async () => {
            const q = await save(quote?.status === 'draft' || !quote ? 'sent' : undefined);
            return q ? { kind: 'quote', doc: q } : null;
          }} />
      </div>
    </div>
  );
}
