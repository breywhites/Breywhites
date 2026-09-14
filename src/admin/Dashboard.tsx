import React from 'react';
import { fmtDay, inr, waLink } from '../lib/format';
import { Link, useRoute } from '../lib/router';
import { IconCalendar, IconChat, IconFile, IconImage, IconLink } from '../site/Icons';
import { useAdmin } from './AdminApp';
import { dashboard } from './data';
import { daysUntil, Empty, ErrorBox, inDays, Loading, Pill, timeAgo, useAsync } from './ui';

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export function Dashboard() {
  const { site } = useAdmin();
  const { navigate } = useRoute();
  const { data, error, loading, reload } = useAsync(dashboard, []);

  return (
    <div className="a-wrap">
      <div className="a-head">
        <div>
          <div className="a-hint">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
          <h1>{greeting()}</h1>
        </div>
      </div>

      {error && <ErrorBox message={error} retry={reload} />}
      {loading && !data && <Loading />}
      {data && (
        <>
          <div className="a-stats">
            <button className="a-stat" onClick={() => navigate('/admin/enquiries')}>
              <span className="v">{data.newEnquiries.length}</span>
              <span className="l">New {data.newEnquiries.length === 1 ? 'enquiry' : 'enquiries'}</span>
            </button>
            <button className="a-stat" onClick={() => navigate('/admin/links')}>
              <span className="v">{data.openedLinks.length}</span>
              <span className="l">Price links opened this week</span>
            </button>
            <button className="a-stat" onClick={() => navigate('/admin/invoices')}>
              <span className="v">{inr(data.balanceDue)}</span>
              <span className="l">Balance still to collect</span>
            </button>
            <button className="a-stat" onClick={() => navigate('/admin/calendar')}>
              <span className="v">{data.upcoming[0] ? inDays(daysUntil(data.upcoming[0].event_date)!) : '—'}</span>
              <span className="l">{data.upcoming[0] ? `Next: ${data.upcoming[0].client_name}` : 'No weddings booked yet'}</span>
            </button>
          </div>

          <div className="a-grid two" style={{ marginTop: 14, gridTemplateColumns: undefined }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 8 }}>
              <Link to="/admin/links" className="a-btn line lg"><IconLink size={16} /> Send prices</Link>
              <Link to="/admin/quotes/new" className="a-btn dark lg"><IconFile size={16} /> New quote</Link>
              <Link to="/admin/calendar" className="a-btn line lg"><IconCalendar size={16} /> Free dates</Link>
              <Link to="/admin/photos" className="a-btn line lg"><IconImage size={16} /> Add photos</Link>
            </div>
          </div>

          <section className="a-section">
            <h2>Upcoming weddings</h2>
            {data.upcoming.length === 0 ? (
              <Empty title="No bookings yet">When a client pays an advance, their wedding shows up here.</Empty>
            ) : (
              <div className="a-list">
                {data.upcoming.map((i) => {
                  const bal = Math.max(0, i.total - i.paid);
                  return (
                    <Link key={i.id} to={`/admin/invoices/${i.id}`} className="a-row link">
                      <div style={{ width: 52, textAlign: 'center', flex: 'none' }}>
                        <div className="serif" style={{ fontSize: 26, lineHeight: 1 }}>{fmtDay(i.event_date).split(' ')[0]}</div>
                        <div className="a-label" style={{ marginTop: 2 }}>{fmtDay(i.event_date).split(' ')[1]}</div>
                      </div>
                      <div className="grow">
                        <div className="title">{i.client_name}</div>
                        <div className="meta">{inDays(daysUntil(i.event_date)!)}{i.venue ? ` · ${i.venue}` : ''}</div>
                      </div>
                      <div className="amt">
                        {bal > 0 ? <><div className="num">{inr(bal)}</div><div className="meta">balance</div></> : <Pill tone="paid">Paid</Pill>}
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>

          <div className="a-grid two" style={{ alignItems: 'start' }}>
            <section className="a-section">
              <h2>Latest enquiries</h2>
              {data.recentEnquiries.length === 0 ? <Empty title="No enquiries yet" /> : (
                <div className="a-list">
                  {data.recentEnquiries.map((e) => (
                    <div key={e.id} className="a-row">
                      <div className="grow">
                        <div className="title">{e.name}</div>
                        <div className="meta">{[e.event_type, e.event_date && fmtDay(e.event_date), timeAgo(e.created_at)].filter(Boolean).join(' · ')}</div>
                      </div>
                      {e.status === 'new' && <Pill tone="new">New</Pill>}
                      <a className="a-icon" href={waLink(e.phone, `Hi ${e.name.split(' ')[0]}, this is ${site.studio_name} — thank you for your enquiry!`)} target="_blank" rel="noopener" aria-label={`WhatsApp ${e.name}`}><IconChat size={18} /></a>
                    </div>
                  ))}
                  <Link to="/admin/enquiries" className="a-btn ghost" style={{ marginTop: 6 }}>All enquiries</Link>
                </div>
              )}
            </section>

            <section className="a-section">
              <h2>Price links opened</h2>
              {data.openedLinks.length === 0 ? <Empty title="Nothing opened this week">Send a price link and you’ll see here when it’s opened.</Empty> : (
                <div className="a-list">
                  {data.openedLinks.slice(0, 4).map((l) => (
                    <Link key={l.id} to="/admin/links" className="a-row link">
                      <div className="grow">
                        <div className="title">{l.client_name}</div>
                        <div className="meta">Opened {l.opens}× · last {timeAgo(l.last_opened_at)}{l.top_package ? ` · liked ${l.top_package}` : ''}</div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </div>

          {data.openQuotes.length > 0 && (
            <section className="a-section">
              <h2>Quotes waiting for an answer</h2>
              <div className="a-list">
                {data.openQuotes.slice(0, 5).map((q) => (
                  <Link key={q.id} to={`/admin/quotes/${q.id}`} className="a-row link">
                    <div className="grow"><div className="title">{q.client_name}</div><div className="meta">{q.number} · {timeAgo(q.updated_at)}</div></div>
                    <div className="amt num">{inr(q.total)}</div>
                    <Pill tone={q.status}>{q.status}</Pill>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
