import React, { useMemo, useState } from 'react';
import { fmtDay, telLink, waLink } from '../lib/format';
import type { EnquiryRow, EnquiryStatus } from '../lib/models';
import { useRoute } from '../lib/router';
import { IconChat, IconFile, IconLink, IconPhone, IconTrash } from '../site/Icons';
import { useAdmin } from './AdminApp';
import { deleteEnquiry, listEnquiries, setEnquiryStatus } from './data';
import { Chips, Empty, ErrorBox, errorText, Loading, PageHead, Pill, setHandoff, timeAgo, useAsync, useConfirm, useToast } from './ui';

const STATUSES: { value: EnquiryStatus; label: string }[] = [
  { value: 'new', label: 'New' }, { value: 'replied', label: 'Replied' }, { value: 'quoted', label: 'Quoted' },
  { value: 'booked', label: 'Booked' }, { value: 'closed', label: 'Closed' },
];

export function Enquiries() {
  const { site, refreshCounts } = useAdmin();
  const { navigate } = useRoute();
  const toast = useToast();
  const confirm = useConfirm();
  const { data, setData, error, loading, reload } = useAsync(listEnquiries, []);
  const [filter, setFilter] = useState<EnquiryStatus | 'all'>('new');

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: data?.length || 0 };
    (data || []).forEach((e) => { c[e.status] = (c[e.status] || 0) + 1; });
    return c;
  }, [data]);
  const list = (data || []).filter((e) => filter === 'all' || e.status === filter);

  const patch = (id: string, p: Partial<EnquiryRow>) => setData((d) => d?.map((e) => (e.id === id ? { ...e, ...p } : e)));

  const changeStatus = async (e: EnquiryRow, status: EnquiryStatus) => {
    const before = e.status;
    patch(e.id, { status });
    try { await setEnquiryStatus(e.id, status); refreshCounts(); toast(`Marked as ${status}`); }
    catch (err) { patch(e.id, { status: before }); toast(errorText(err), 'err'); }
  };

  const remove = async (e: EnquiryRow) => {
    if (!(await confirm({ title: 'Delete this enquiry?', body: `${e.name} — this can’t be undone.`, ok: 'Delete', danger: true }))) return;
    try { await deleteEnquiry(e.id); setData((d) => d?.filter((x) => x.id !== e.id)); refreshCounts(); toast('Enquiry deleted'); }
    catch (err) { toast(errorText(err), 'err'); }
  };

  return (
    <div className="a-wrap">
      <PageHead title="Enquiries" sub="From the form on your website" />
      <Chips label="Filter enquiries" value={filter} onChange={setFilter}
        options={[...STATUSES.map((s) => ({ ...s, n: counts[s.value] || 0 })), { value: 'all' as const, label: 'All', n: counts.all }]} />

      <div style={{ marginTop: 14 }}>
        {error && <ErrorBox message={error} retry={reload} />}
        {loading && !data && <Loading />}
        {data && list.length === 0 && (
          <Empty title={filter === 'new' ? 'You’re all caught up' : 'Nothing here'}>
            {filter === 'new' ? 'New enquiries from your website appear here.' : 'No enquiries with this status.'}
          </Empty>
        )}
        <div className="a-list">
          {list.map((e) => (
            <article key={e.id} style={{ padding: '16px 0', borderBottom: '1px solid var(--rule)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 17, fontWeight: 500 }}>{e.name}</div>
                  <div className="a-hint" style={{ marginTop: 2 }}>
                    {[e.event_type, e.event_date ? fmtDay(e.event_date) : 'No date yet', e.phone].filter(Boolean).join(' · ')}
                  </div>
                </div>
                <div style={{ textAlign: 'right', flex: 'none' }}>
                  <Pill tone={e.status}>{e.status}</Pill>
                  <div className="a-hint" style={{ marginTop: 6 }}>{timeAgo(e.created_at)}</div>
                </div>
              </div>
              {e.message && <p style={{ margin: '10px 0 0', lineHeight: 1.55, color: 'var(--ink-2)', whiteSpace: 'pre-line' }}>{e.message}</p>}

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12, alignItems: 'center' }}>
                <a className="a-btn dark" href={waLink(e.phone, `Hi ${e.name.split(/\s*&\s*|\s+/)[0]}, this is ${site.studio_name} — thank you for your enquiry!`)} target="_blank" rel="noopener"
                  onClick={() => { if (e.status === 'new') changeStatus(e, 'replied'); }}>
                  <IconChat size={15} /> WhatsApp
                </a>
                <a className="a-btn line" href={telLink(e.phone)}><IconPhone size={15} /> Call</a>
                <button className="a-btn line" onClick={() => { setHandoff('link', { client_name: e.name, phone: e.phone, wedding_date: e.event_date, enquiry_id: e.id }); navigate('/admin/links'); }}>
                  <IconLink size={15} /> Send prices
                </button>
                <button className="a-btn line" onClick={() => { setHandoff('quote', { client_name: e.name, phone: e.phone, event_date: e.event_date || '', enquiry_id: e.id }); navigate('/admin/quotes/new'); }}>
                  <IconFile size={15} /> Quote
                </button>
                <select className="a-inp" style={{ width: 'auto', minHeight: 44, fontSize: 14 }} value={e.status} aria-label={`Status for ${e.name}`}
                  onChange={(ev) => changeStatus(e, ev.target.value as EnquiryStatus)}>
                  {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
                <button className="a-icon" onClick={() => remove(e)} aria-label={`Delete enquiry from ${e.name}`} style={{ marginLeft: 'auto' }}><IconTrash size={17} /></button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
