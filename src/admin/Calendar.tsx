import React, { useMemo, useState } from 'react';
import { fmtDay, inr, MONTHS, toDay } from '../lib/format';
import type { CalendarDayRow, DayStatus, InvoiceRow } from '../lib/models';
import { Link } from '../lib/router';
import { store } from '../lib/store';
import { IconLeft, IconRight } from '../site/Icons';
import { listDays, setDay } from './data';
import { daysUntil, ErrorBox, errorText, Field, inDays, Loading, PageHead, Pill, Sheet, useAsync, useToast } from './ui';

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function CalendarScreen() {
  const toast = useToast();
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const first = toDay(month);
  const last = toDay(new Date(month.getFullYear(), month.getMonth() + 1, 0));
  const days = useAsync(() => listDays(first, last), [first]);
  const invoices = useAsync(() => store.list<InvoiceRow>('invoices', { neq: { status: 'cancelled' }, gte: { event_date: toDay(new Date()) }, order: 'event_date.asc', limit: 20 }), []);
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const map = useMemo(() => {
    const m: Record<string, CalendarDayRow> = {};
    (days.data || []).forEach((d) => { m[d.day] = d; });
    return m;
  }, [days.data]);

  const cells = useMemo(() => {
    const out: (string | null)[] = [];
    const lead = (month.getDay() + 6) % 7;
    for (let i = 0; i < lead; i++) out.push(null);
    const n = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    for (let d = 1; d <= n; d++) out.push(toDay(new Date(month.getFullYear(), month.getMonth(), d)));
    while (out.length % 7) out.push(null);
    return out;
  }, [month]);

  const todayStr = toDay(new Date());
  const counts = { free: 0, hold: 0, booked: 0 } as Record<DayStatus, number>;
  (days.data || []).forEach((d) => { counts[d.status]++; });

  const apply = async (day: string, status: DayStatus | null, note?: string | null) => {
    setBusy(true);
    const prev = map[day];
    days.setData((list) => {
      const rest = (list || []).filter((x) => x.day !== day);
      return status ? [...rest, { day, status, note: note ?? null, invoice_id: null }] : rest;
    });
    try { await setDay(day, status, note); }
    catch (e) { days.setData((list) => [...(list || []).filter((x) => x.day !== day), ...(prev ? [prev] : [])]); toast(errorText(e), 'err'); }
    finally { setBusy(false); }
  };

  const markWeekends = async () => {
    const targets = cells.filter((d): d is string => !!d && d >= todayStr && !map[d] && [0, 6].includes(new Date(d + 'T00:00').getDay()));
    if (!targets.length) { toast('No open weekend days left this month'); return; }
    setBusy(true);
    try {
      for (const d of targets) await setDay(d, 'free');
      toast(`${targets.length} weekend ${targets.length === 1 ? 'day' : 'days'} marked free`);
      days.reload();
    } catch (e) { toast(errorText(e), 'err'); }
    finally { setBusy(false); }
  };

  const sel = open ? map[open] : undefined;

  return (
    <div className="a-wrap">
      <PageHead title="Calendar" sub="Free dates show on your website. Dates with a paid advance are booked automatically." />

      <div className="a-calgrid">
      <div className="a-card a-pad">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <button className="a-icon" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} aria-label="Previous month"><IconLeft size={18} /></button>
          <h2 className="serif" style={{ fontSize: 26 }}>{MONTHS[month.getMonth()]} {month.getFullYear()}</h2>
          <button className="a-icon" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} aria-label="Next month"><IconRight size={18} /></button>
        </div>
        {days.error && <ErrorBox message={days.error} retry={days.reload} />}
        <div className="a-cal" aria-busy={days.loading}>
          {DOW.map((d) => <div key={d} className="dow">{d}</div>)}
          {cells.map((d, i) => {
            if (!d) return <div key={'x' + i} className="a-day out" />;
            const row = map[d];
            const cls = ['a-day', row?.status || '', d < todayStr ? 'past' : '', d === todayStr ? 'today' : ''].join(' ');
            return (
              <button key={d} className={cls} onClick={() => setOpen(d)} aria-label={`${fmtDay(d)}${row ? ', ' + row.status : ''}`}>
                <span>{Number(d.slice(8))}</span>
                {row && <span className="dot" />}
              </button>
            );
          })}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
          <div className="a-legend">
            <span><i style={{ background: '#e7efe3', borderColor: '#bcd2b4' }} /> Free {counts.free}</span>
            <span><i style={{ background: '#f6ecd6', borderColor: '#e0c48e' }} /> On hold {counts.hold}</span>
            <span><i style={{ background: '#17130f' }} /> Booked {counts.booked}</span>
          </div>
          <button className="a-btn line" onClick={markWeekends} disabled={busy}>Mark weekends free</button>
        </div>
      </div>

      <section className="a-section">
        <h2>Booked weddings</h2>
        {invoices.loading && !invoices.data && <Loading />}
        {invoices.data && invoices.data.filter((i) => i.event_date).length === 0 && <div className="a-hint">No upcoming bookings.</div>}
        <div className="a-list">
          {(invoices.data || []).filter((i) => i.event_date).map((i) => (
            <Link key={i.id} to={`/admin/invoices/${i.id}`} className="a-row link">
              <div className="grow"><div className="title">{i.client_name}</div><div className="meta">{fmtDay(i.event_date)} · {inDays(daysUntil(i.event_date)!)}</div></div>
              <div className="amt num">{i.total - i.paid > 0 ? `${inr(i.total - i.paid)} due` : ''}</div>
              <Pill tone={i.status}>{i.status.replace('_', ' ')}</Pill>
            </Link>
          ))}
        </div>
      </section>
      </div>

      {open && (
        <DaySheet day={open} row={sel} busy={busy} onClose={() => setOpen(null)}
          onSet={async (status, note) => { await apply(open, status, note); setOpen(null); toast(status ? `${fmtDay(open)} marked ${status === 'hold' ? 'on hold' : status}` : `${fmtDay(open)} cleared`); }} />
      )}
    </div>
  );
}

function DaySheet({ day, row, busy, onClose, onSet }: { day: string; row?: CalendarDayRow; busy: boolean; onClose: () => void; onSet: (s: DayStatus | null, note?: string | null) => void }) {
  const [note, setNote] = useState(row?.note || '');
  const booked = row?.status === 'booked';
  return (
    <Sheet open onClose={onClose} title={fmtDay(day)}>
      {booked ? (
        <>
          <p style={{ marginTop: 0 }}>Booked{row?.note ? ` — ${row.note}` : ''}.</p>
          {row?.invoice_id && <Link to={`/admin/invoices/${row.invoice_id}`} className="a-btn dark block">Open invoice</Link>}
          <button className="a-btn danger block" style={{ marginTop: 8 }} disabled={busy} onClick={() => onSet(null)}>Clear this booking from the calendar</button>
        </>
      ) : (
        <div className="a-grid">
          <button className={'a-btn lg block ' + (row?.status === 'free' ? 'dark' : 'line')} disabled={busy} onClick={() => onSet('free', null)}>Free — show on website</button>
          <Field id="day-note" label="Note for on-hold (optional)"><input className="a-inp" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Meera — waiting for advance" /></Field>
          <button className={'a-btn lg block ' + (row?.status === 'hold' ? 'dark' : 'line')} disabled={busy} onClick={() => onSet('hold', note || null)}>On hold — hide from website</button>
          {row && <button className="a-btn ghost block" disabled={busy} onClick={() => onSet(null)}>Clear</button>}
        </div>
      )}
    </Sheet>
  );
}
