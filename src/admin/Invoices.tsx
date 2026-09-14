import React, { useEffect, useMemo, useState } from 'react';
import type { DocInput } from '../lib/docs';
import { fmtDay, inr, toDay } from '../lib/format';
import type { InvoiceRow, InvoiceStatus, PaymentRow, PayMethod } from '../lib/models';
import { lineTotals } from '../lib/models';
import { Link, useRoute } from '../lib/router';
import { IconLeft, IconPlus, IconTrash } from '../site/Icons';
import { useAdmin } from './AdminApp';
import type { DocDraft } from './data';
import { addPayment, blankDraft, cancelInvoice, deleteInvoice, deletePayment, getInvoice, listInvoices, listPackages, saveInvoice } from './data';
import { DocForm, DocShare } from './DocParts';
import { Chips, daysUntil, Empty, ErrorBox, errorText, Field, inDays, Loading, PageHead, Pill, Sheet, timeAgo, useAsync, useConfirm, useToast } from './ui';

const LABEL: Record<InvoiceStatus, string> = { due: 'Due', part_paid: 'Part paid', paid: 'Paid', cancelled: 'Cancelled' };
const METHODS: { value: PayMethod; label: string }[] = [
  { value: 'upi', label: 'UPI' }, { value: 'cash', label: 'Cash' }, { value: 'bank', label: 'Bank transfer' }, { value: 'card', label: 'Card' }, { value: 'other', label: 'Other' },
];

export function InvoicesList() {
  const { data, error, loading, reload } = useAsync(listInvoices, []);
  const [filter, setFilter] = useState<'unpaid' | InvoiceStatus | 'all'>('unpaid');
  const all = data || [];
  const list = all.filter((i) => filter === 'all' || (filter === 'unpaid' ? i.status === 'due' || i.status === 'part_paid' : i.status === filter));
  const due = all.filter((i) => i.status === 'due' || i.status === 'part_paid').reduce((a, i) => a + i.total - i.paid, 0);
  const collected = all.filter((i) => i.status !== 'cancelled').reduce((a, i) => a + i.paid, 0);

  return (
    <div className="a-wrap">
      <PageHead title="Invoices" sub={data ? <><span className="num">{inr(due)}</span> still to collect · <span className="num">{inr(collected)}</span> received</> : null}
        actions={<Link to="/admin/invoices/new" className="a-btn line"><IconPlus size={15} /> New invoice</Link>} />
      <Chips label="Filter invoices" value={filter} onChange={setFilter} options={[
        { value: 'unpaid', label: 'Unpaid', n: all.filter((i) => i.status === 'due' || i.status === 'part_paid').length },
        { value: 'paid', label: 'Paid', n: all.filter((i) => i.status === 'paid').length },
        { value: 'cancelled', label: 'Cancelled', n: all.filter((i) => i.status === 'cancelled').length },
        { value: 'all', label: 'All', n: all.length },
      ]} />
      <div style={{ marginTop: 12 }}>
        {error && <ErrorBox message={error} retry={reload} />}
        {loading && !data && <Loading />}
        {data && list.length === 0 && <Empty title="No invoices here">Open an accepted quote and tap “Make invoice”.</Empty>}
        <div className="a-list">
          {list.map((i) => {
            const bal = Math.max(0, i.total - i.paid);
            const days = daysUntil(i.event_date);
            return (
              <Link key={i.id} to={`/admin/invoices/${i.id}`} className="a-row link">
                <div className="grow">
                  <div className="title">{i.client_name}</div>
                  <div className="meta">{i.number}{i.event_date ? ` · ${fmtDay(i.event_date)}${days != null && days >= 0 ? ` (${inDays(days)})` : ''}` : ''}</div>
                </div>
                <div className="amt">
                  <div className="num">{inr(i.status === 'paid' ? i.total : bal)}</div>
                  <div className="meta">{i.status === 'paid' ? 'paid' : i.status === 'cancelled' ? '' : 'balance'}</div>
                </div>
                <Pill tone={i.status}>{LABEL[i.status]}</Pill>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function InvoiceDetail({ id }: { id: string }) {
  const { site, biz } = useAdmin();
  const { navigate } = useRoute();
  const toast = useToast();
  const confirm = useConfirm();
  const { data, setData, error, loading, reload } = useAsync(() => getInvoice(id), [id]);
  const [paying, setPaying] = useState(false);

  if (error) return <div className="a-wrap"><PageHead title="Invoice" /><ErrorBox message={error} retry={reload} /></div>;
  if (loading && !data) return <Loading />;
  if (!data) return <div className="a-wrap"><PageHead title="Invoice" /><Empty title="This invoice doesn’t exist any more" action={<Link to="/admin/invoices" className="a-btn line">All invoices</Link>} /></div>;

  const { inv, payments } = data;
  const bal = Math.max(0, inv.total - inv.paid);
  const pct = inv.total ? Math.min(100, Math.round((inv.paid / inv.total) * 100)) : 0;
  const input: DocInput = { kind: 'invoice', doc: inv, payments };

  const removePayment = async (p: PaymentRow) => {
    if (!(await confirm({ title: `Remove ${inr(p.amount)} payment?`, body: `Recorded on ${fmtDay(p.paid_on)}.`, ok: 'Remove', danger: true }))) return;
    try { await deletePayment(p.id); toast('Payment removed'); reload(); } catch (e) { toast(errorText(e), 'err'); }
  };
  const cancel = async () => {
    if (!(await confirm({ title: `Cancel ${inv.number}?`, body: 'The date is freed up on the calendar. Payments stay on record.', ok: 'Cancel invoice', danger: true }))) return;
    try { await cancelInvoice(inv); toast('Invoice cancelled'); reload(); } catch (e) { toast(errorText(e), 'err'); }
  };
  const remove = async () => {
    if (!(await confirm({ title: `Delete ${inv.number}?`, body: 'The invoice and its payments are removed for good.', ok: 'Delete', danger: true }))) return;
    try { await deleteInvoice(inv); toast('Invoice deleted'); navigate('/admin/invoices'); } catch (e) { toast(errorText(e), 'err'); }
  };

  return (
    <div>
      <div className="a-head">
        <div>
          <Link to="/admin/invoices" className="a-hint" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, minHeight: 32 }}><IconLeft size={14} /> Invoices</Link>
          <h1>{inv.client_name}</h1>
          <div className="sub" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span>{inv.number}</span><Pill tone={inv.status}>{LABEL[inv.status]}</Pill>
            {inv.event_date && <span>{fmtDay(inv.event_date)} · {inDays(daysUntil(inv.event_date)!)}</span>}
          </div>
        </div>
        <div className="a-actions">
          {inv.status !== 'cancelled' && bal > 0 && <button className="a-btn dark" onClick={() => setPaying(true)}><IconPlus size={15} /> Record payment</button>}
        </div>
      </div>

      <div className="a-doc">
        <div>
          <div className="a-card a-pad">
            <div className="a-totals" style={{ gridTemplateColumns: '1fr auto' }}>
              <span>Total</span><span className="num">{inr(inv.total)}</span>
              <span>Received</span><span className="num">{inr(inv.paid)}</span>
              <span style={{ alignSelf: 'end' }}>{bal > 0 ? 'Balance due' : 'Balance'}</span>
              <span className="big" style={{ color: bal > 0 ? 'var(--accent)' : 'var(--ink)' }}>{inr(bal)}</span>
            </div>
            <div className="a-progress" style={{ marginTop: 14, height: 6 }} aria-label={`${pct}% paid`}><i style={{ width: pct + '%' }} /></div>
            <div className="a-hint" style={{ marginTop: 6 }}>{pct}% paid{inv.due_on && bal > 0 ? ` · due by ${fmtDay(inv.due_on)}` : ''}</div>
          </div>

          <section className="a-section">
            <h2>Payments</h2>
            {payments.length === 0 ? (
              <Empty title="No payments yet" action={inv.status !== 'cancelled' ? <button className="a-btn dark" onClick={() => setPaying(true)}>Record the advance</button> : null}>
                Once the advance is recorded, {inv.event_date ? fmtDay(inv.event_date) : 'the date'} is booked on your calendar.
              </Empty>
            ) : (
              <div className="a-list">
                {payments.map((p) => (
                  <div key={p.id} className="a-row">
                    <div className="grow"><div className="title num">{inr(p.amount)}</div><div className="meta">{fmtDay(p.paid_on)} · {METHODS.find((m) => m.value === p.method)?.label}{p.note ? ` · ${p.note}` : ''}</div></div>
                    <button className="a-icon" onClick={() => removePayment(p)} aria-label={`Remove payment of ${inr(p.amount)}`}><IconTrash size={16} /></button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="a-section">
            <h2>Details</h2>
            <div className="a-list">
              {inv.items.map((it, i) => (
                <div key={i} className="a-row">
                  <div className="grow"><div className="title">{it.name}{it.qty > 1 ? ` × ${it.qty}` : ''}</div><div className="meta" style={{ whiteSpace: 'normal' }}>{it.description}</div></div>
                  <div className="amt num">{inr(it.price * it.qty)}</div>
                </div>
              ))}
              {inv.discount > 0 && <div className="a-row"><div className="grow">Discount</div><div className="amt num" style={{ color: 'var(--accent)' }}>− {inr(inv.discount)}</div></div>}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
              <Link to={`/admin/invoices/${inv.id}/edit`} className="a-btn line">Edit details</Link>
              {inv.quote_id && <Link to={`/admin/quotes/${inv.quote_id}`} className="a-btn line">View quote</Link>}
              {inv.status !== 'cancelled' && <button className="a-btn line" onClick={cancel}>Cancel invoice</button>}
              <button className="a-icon" onClick={remove} aria-label="Delete invoice" style={{ marginLeft: 'auto' }}><IconTrash size={17} /></button>
            </div>
            <div className="a-hint" style={{ marginTop: 10 }}>Issued {fmtDay(inv.issued_on)} · updated {timeAgo(inv.updated_at)}</div>
          </section>
        </div>

        <DocShare input={input} site={site} biz={biz} dirty={false} onSave={async () => input} phone={inv.phone} />
      </div>

      {paying && (
        <PaymentSheet inv={inv} advancePercent={biz.advance_percent} onClose={() => setPaying(false)}
          onSaved={(p) => {
            setPaying(false);
            toast(`${inr(p.amount)} recorded${inv.event_date && inv.paid === 0 ? ` — ${fmtDay(inv.event_date)} is now booked` : ''}`);
            setData(undefined as any); reload();
          }} />
      )}
    </div>
  );
}

function PaymentSheet({ inv, advancePercent, onClose, onSaved }: { inv: InvoiceRow; advancePercent: number; onClose: () => void; onSaved: (p: PaymentRow) => void }) {
  const toast = useToast();
  const bal = Math.max(0, inv.total - inv.paid);
  const suggested = inv.paid === 0 && advancePercent > 0 ? Math.min(bal, Math.round(inv.total * advancePercent / 100)) : bal;
  const [amount, setAmount] = useState(String(suggested));
  const [method, setMethod] = useState<PayMethod>('upi');
  const [date, setDate] = useState(toDay(new Date()));
  const [note, setNote] = useState(inv.paid === 0 ? 'Advance' : bal === suggested ? 'Balance' : '');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const n = Number(amount.replace(/[^0-9]/g, ''));
    if (!n) { toast('Enter the amount received', 'err'); return; }
    if (n > bal) { toast(`That’s more than the balance of ${inr(bal)} — check the amount`, 'err'); return; }
    setBusy(true);
    try { onSaved(await addPayment({ invoice_id: inv.id, amount: n, method, paid_on: date, note })); }
    catch (e) { toast(errorText(e), 'err'); }
    finally { setBusy(false); }
  };

  return (
    <Sheet open onClose={onClose} title="Record payment"
      footer={<><button className="a-btn line" onClick={onClose}>Cancel</button><button className="a-btn dark" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save payment'}</button></>}>
      <div className="a-grid">
        <Field id="pay-amt" label="Amount received (₹)" hint={`Balance ${inr(bal)}${inv.paid === 0 && advancePercent ? ` · ${advancePercent}% advance is ${inr(Math.round(inv.total * advancePercent / 100))}` : ''}`}>
          <input className="a-inp num" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} style={{ fontSize: 22 }} />
        </Field>
        <div className="a-chips" style={{ flexWrap: 'wrap' }}>
          {inv.paid === 0 && advancePercent > 0 && <button className="a-chip" onClick={() => { setAmount(String(Math.round(inv.total * advancePercent / 100))); setNote('Advance'); }}>Advance {advancePercent}%</button>}
          <button className="a-chip" onClick={() => { setAmount(String(bal)); setNote(inv.paid ? 'Balance' : 'Full payment'); }}>Full balance</button>
        </div>
        <div>
          <div className="a-label" style={{ marginBottom: 6 }}>Paid by</div>
          <div className="a-chips" style={{ flexWrap: 'wrap' }}>{METHODS.map((m) => <button key={m.value} className={'a-chip' + (m.value === method ? ' on' : '')} onClick={() => setMethod(m.value)}>{m.label}</button>)}</div>
        </div>
        <div className="a-grid two">
          <Field id="pay-date" label="Date"><input className="a-inp" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field id="pay-note" label="Note (optional)"><input className="a-inp" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Advance" /></Field>
        </div>
      </div>
    </Sheet>
  );
}

export function InvoiceEditor({ id }: { id?: string }) {
  const { site, biz } = useAdmin();
  const { navigate } = useRoute();
  const toast = useToast();
  const packs = useAsync(listPackages, []);
  const [inv, setInv] = useState<InvoiceRow | null>(null);
  const [draft, setDraft] = useState<DocDraft | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id) { setDraft({ ...blankDraft(biz), terms: biz.invoice_terms, valid_until: '' }); return; }
    getInvoice(id).then((r) => {
      if (!r) return;
      setInv(r.inv);
      setDraft({ id: r.inv.id, number: r.inv.number, client_name: r.inv.client_name, phone: r.inv.phone || '', event_date: r.inv.event_date || '', venue: r.inv.venue || '',
        items: r.inv.items, discount: r.inv.discount, advance_percent: biz.advance_percent, terms: r.inv.terms || '', valid_until: '', due_on: r.inv.due_on || '' });
    }).catch((e) => toast(errorText(e), 'err'));
  }, [id, biz, toast]);

  const input: DocInput | null = useMemo(() => {
    if (!draft) return null;
    const t = lineTotals(draft.items, draft.discount);
    const now = new Date().toISOString();
    return { kind: 'invoice', payments: [], doc: {
      id: draft.id || 'draft', number: draft.number || 'Draft', quote_id: inv?.quote_id || null, client_name: draft.client_name || 'Client name', phone: draft.phone || null,
      event_date: draft.event_date || null, venue: draft.venue || null, items: draft.items, discount: t.discount, total: t.total, paid: inv?.paid || 0,
      status: inv?.status || 'due', terms: draft.terms || null, issued_on: inv?.issued_on || toDay(new Date()), due_on: draft.due_on || null, created_at: now, updated_at: now,
    } };
  }, [draft, inv]);

  const save = async () => {
    if (!draft) return;
    if (!draft.client_name.trim()) { toast('Add the client’s name', 'err'); return; }
    if (!draft.items.length || draft.items.some((i) => !i.name.trim())) { toast('Add at least one named item', 'err'); return; }
    setBusy(true);
    try {
      const saved = await saveInvoice(draft, biz);
      toast(id ? 'Invoice updated' : `${saved.number} created`);
      navigate(`/admin/invoices/${saved.id}`, { replace: true });
    } catch (e) { toast(errorText(e), 'err'); }
    finally { setBusy(false); }
  };

  if (!draft) return <Loading />;
  return (
    <div>
      <div className="a-head">
        <div>
          <Link to={id ? `/admin/invoices/${id}` : '/admin/invoices'} className="a-hint" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, minHeight: 32 }}><IconLeft size={14} /> Back</Link>
          <h1>{id ? `Edit ${draft.number}` : 'New invoice'}</h1>
          {inv && inv.paid > 0 && <div className="sub">Payments already recorded stay as they are.</div>}
        </div>
        <div className="a-actions"><button className="a-btn dark" onClick={save} disabled={busy}>{busy ? 'Saving…' : id ? 'Save changes' : 'Create invoice'}</button></div>
      </div>
      <div className="a-doc">
        <DocForm kind="invoice" draft={draft} setDraft={setDraft} packages={packs.data || []} />
        <div className="preview">
          <DocShare input={input} site={site} biz={biz} dirty onSave={async () => { await save(); return null; }} phone={draft.phone || null} />
        </div>
      </div>
    </div>
  );
}
