/* On-device stand-in for the database, used for previews and testing.
   Mirrors the real schema, including the automatic parts:
   invoice status from payments, booked dates, document numbers and price-link stats. */
import { config } from '../config';
import { toDay } from '../format';
import type { Query, Store } from './types';

const KEY = 'bw.demo.db.v3';
const FILES_KEY = 'bw.demo.files.v3';

type Row = Record<string, any>;
type DB = Record<string, Row[]>;

const uid = () => (crypto as any).randomUUID ? crypto.randomUUID() : 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
const now = () => new Date().toISOString();
const dayOffset = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return toDay(d); };
const ago = (hours: number) => new Date(Date.now() - hours * 3600e3).toISOString();

/* ------------------------------------------------------------------ seed */
function seed(): DB {
  const PH: [string, string, string, boolean, number][] = [
    ['hero', 'bride', 'Bride portrait', false, 0], ['wedding1', 'wedding', 'The exchange', true, -1], ['event1', 'wedding', 'Bridal party', false, -1],
    ['portrait1', 'bride', 'Veiled', true, -1], ['detail1', 'details', 'Details', true, -1], ['portrait2', 'bride', 'Garden portrait', false, 4],
    ['bride1', 'bride', 'Quiet moment', true, -1], ['groom2', 'groom', 'Arrival', true, -1], ['bride2', 'bride', 'Reflection', false, 2],
    ['portrait3', 'bride', 'Golden hour', true, -1], ['groom1', 'groom', 'Departure', false, -1], ['couple1', 'couple', 'First look', true, 1],
    ['couple2', 'couple', 'Together', false, 3], ['film1', 'events', 'Reception', false, -1], ['couple3', 'couple', 'The staircase', true, -1],
  ];
  const size: Record<string, [number, number]> = { detail1: [658, 780], portrait2: [585, 780] };
  const photos = PH.map(([k, cat, title, featured, slide], i) => ({
    id: 'ph-' + k, path_large: `demo/${k}-l.webp`, path_thumb: `demo/${k}-t.webp`,
    width: (size[k] || [825, 1100])[0], height: (size[k] || [825, 1100])[1],
    category: cat, title, published: true, featured, in_slideshow: slide >= 0, slide_order: Math.max(0, slide), sort: i, created_at: ago(400 - i),
  }));

  const P = [
    ['1 Day Package', '1 Day', 'One day · Photo + video', 29000, '2 cameramen', '1 videographer · 1 photographer', ['Unlimited photos', '3 videos', '2 reels · 30–45 sec each', '1 highlight film · 2–3 min'], null],
    ['1 Day Wedding', '1 Day Wedding', 'One day · Wedding', 32000, '2 professional cameramen', '1 videographer · 1 photographer', ['Unlimited photos', '2 videos', '1 reel · 30–45 sec', '1 highlight film · 2–3 min'], null],
    ['Unique 2 Days Wedding', '2 Days', 'Two days · Wedding', 38000, '2 cameramen', '1 camera videographer · 1 mobile photographer', ['Unlimited mobile photos', '3 videos', '2 reels · 30–45 sec each', '1 highlight film · 2–3 min'], 'Coverage across two days'],
    ['Classic Wedding', 'Classic', 'Wedding · Classic', 42000, '2 professional cameramen', '1 videographer · 1 photographer', ['Unlimited photos', '3 videos', '2 reels · 30–45 sec each', '1 highlight film · 3–5 min'], 'Longer 3–5 min highlight film'],
    ['Premium Wedding', 'Premium', 'Wedding · Premium', 62000, '2 professional cameramen', '1 videographer · 1 photographer', ['Unlimited photos', '4 videos', 'Pre-wedding shoot · 2 hours', '2 reels · 30–45 sec each', '1 highlight film · 3–5 min'], 'Includes a 2-hour pre-wedding shoot'],
  ] as const;
  const packages = P.map((p, i) => ({
    id: 'pk-' + (i + 1), name: p[0], short_name: p[1], kicker: p[2], price: p[3], team: p[4], team_sub: p[5],
    items: [...p[6]], extra: p[7], active: true, sort: i + 1, created_at: ago(500),
  }));
  const pkg = (i: number) => packages[i - 1];
  const item = (i: number, qty = 1) => ({ package_id: pkg(i).id, name: pkg(i).name, description: [pkg(i).team, ...pkg(i).items].filter(Boolean).join(' · '), price: pkg(i).price, qty });

  const enquiries = [
    { id: 'enq-1', name: 'Anjali & Rohit', phone: '9847012345', event_date: dayOffset(95), event_type: 'Wedding', message: 'Looking for photo + video for our wedding in Kochi. Two days if possible.', source: 'website', status: 'new', created_at: ago(3) },
    { id: 'enq-2', name: 'Meera Nair', phone: '9446054321', event_date: dayOffset(60), event_type: 'Engagement', message: 'Engagement at home, evening function.', source: 'website', status: 'replied', created_at: ago(30) },
    { id: 'enq-3', name: 'Diya & Karthik', phone: '9072011223', event_date: dayOffset(120), event_type: 'Wedding', message: null, source: 'website', status: 'quoted', created_at: ago(76) },
    { id: 'enq-4', name: 'Sana & Vivek', phone: '9995088776', event_date: dayOffset(45), event_type: 'Wedding', message: 'We loved the reels on Instagram!', source: 'website', status: 'booked', created_at: ago(240) },
  ];

  const links = [
    { id: 'pl-1', slug: 'diya-karthik-7qx', client_name: 'Diya & Karthik', phone: '9072011223', wedding_date: dayOffset(120), package_ids: ['pk-2', 'pk-3', 'pk-4', 'pk-5'], valid_until: dayOffset(9), status: 'active', enquiry_id: 'enq-3', created_at: ago(72) },
    { id: 'pl-2', slug: 'meera-nair-k2m', client_name: 'Meera Nair', phone: '9446054321', wedding_date: dayOffset(60), package_ids: ['pk-1', 'pk-2'], valid_until: dayOffset(12), status: 'active', enquiry_id: 'enq-2', created_at: ago(26) },
    { id: 'pl-3', slug: 'sana-vivek-p4d', client_name: 'Sana & Vivek', phone: '9995088776', wedding_date: dayOffset(45), package_ids: ['pk-3', 'pk-4', 'pk-5'], valid_until: dayOffset(-2), status: 'booked', enquiry_id: 'enq-4', created_at: ago(230) },
  ];
  let evId = 1;
  const ev = (link: string, kind: string, pk: string | null, h: number) => ({ id: evId++, link_id: link, kind, package_id: pk, created_at: ago(h) });
  const events = [
    ev('pl-1', 'open', null, 70), ev('pl-1', 'view', 'pk-4', 70), ev('pl-1', 'view', 'pk-5', 70), ev('pl-1', 'open', null, 20), ev('pl-1', 'view', 'pk-5', 20), ev('pl-1', 'open', null, 5), ev('pl-1', 'view', 'pk-5', 5),
    ev('pl-3', 'open', null, 228), ev('pl-3', 'view', 'pk-4', 228), ev('pl-3', 'book', 'pk-4', 227),
  ];

  const q1Items = [item(4)];
  const q2Items = [item(5)];
  const quotes = [
    { id: 'qt-1', number: 'Q-2026-0001', client_name: 'Sana & Vivek', phone: '9995088776', event_date: dayOffset(45), venue: 'Crowne Plaza, Kochi', items: q1Items, discount: 0, advance_percent: 30, subtotal: 42000, total: 42000, terms: 'Advance payment blocks the date; balance on the event day.', status: 'invoiced', price_link_id: 'pl-3', valid_until: dayOffset(-3), created_at: ago(226), updated_at: ago(200) },
    { id: 'qt-2', number: 'Q-2026-0002', client_name: 'Diya & Karthik', phone: '9072011223', event_date: dayOffset(120), venue: 'Thrissur', items: q2Items, discount: 4000, advance_percent: 30, subtotal: 62000, total: 58000, terms: 'Advance payment blocks the date; balance on the event day.', status: 'sent', price_link_id: 'pl-1', valid_until: dayOffset(10), created_at: ago(4), updated_at: ago(4) },
  ];
  const invoices = [
    { id: 'inv-1', number: 'INV-2026-0001', quote_id: 'qt-1', client_name: 'Sana & Vivek', phone: '9995088776', event_date: dayOffset(45), venue: 'Crowne Plaza, Kochi', items: q1Items, discount: 0, total: 42000, paid: 12600, status: 'part_paid', terms: 'Thank you for choosing Breywhites.', issued_on: dayOffset(-8), due_on: dayOffset(45), created_at: ago(200), updated_at: ago(190) },
  ];
  const payments = [{ id: 'pay-1', invoice_id: 'inv-1', amount: 12600, method: 'upi', paid_on: dayOffset(-8), note: 'Advance', created_at: ago(190) }];

  // free weekends over the next few months (every third weekend already taken)
  const calendar_days: Row[] = [];
  const taken = new Set([dayOffset(45), dayOffset(30)]);
  for (let i = 4, weekend = 0; i < 150 && calendar_days.length < 14; i++) {
    const d = new Date(); d.setDate(d.getDate() + i);
    if (d.getDay() === 6) weekend++;
    if ((d.getDay() === 0 || d.getDay() === 6) && weekend % 3 !== 2 && !taken.has(toDay(d))) {
      calendar_days.push({ day: toDay(d), status: 'free', note: null, invoice_id: null, updated_at: now() });
    }
  }
  calendar_days.push({ day: dayOffset(45), status: 'booked', note: 'Sana & Vivek', invoice_id: 'inv-1', updated_at: now() });
  calendar_days.push({ day: dayOffset(30), status: 'hold', note: 'Meera — waiting for advance', invoice_id: null, updated_at: now() });

  return {
    site_settings: [{ id: 1, studio_name: 'Breywhites', tagline: 'Where your wedding becomes a timeless film.', whatsapp: '918089141816', phones: ['8089141816', '7012001816'], instagram: 'breywhites', email: 'Breywhites7@gmail.com', slideshow_seconds: 3 }],
    business_settings: [{ id: 1, advance_percent: 30, upi_id: 'breywhites@upi', bank_details: '', quote_terms: 'Advance payment blocks the date; balance on the event day.', invoice_terms: 'Thank you for choosing Breywhites.', price_link_days: 14 }],
    photos, packages, enquiries, price_links: links, price_link_events: events, quotes, invoices, payments, calendar_days,
    films: [{ id: 'film-1', title: 'Watch a wedding', video_url: 'https://instagram.com/breywhites', poster_path: 'demo/film1-l.webp', duration_label: 'Highlight film · 3–5 min', published: true, sort: 0, created_at: ago(300) }],
    doc_counters: [{ kind: 'Q', year: new Date().getFullYear(), last: 2 }, { kind: 'INV', year: new Date().getFullYear(), last: 1 }],
  };
}

/* ------------------------------------------------------------------ persistence */
let db: DB | null = null;
const memFiles: Record<string, string> = {};

function load(): DB {
  if (db) return db;
  try { db = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { db = null; }
  if (!db) { db = seed(); save(); }
  return db!;
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { /* storage full or blocked: keep in memory */ }
}
function files(): Record<string, string> {
  try { return { ...JSON.parse(localStorage.getItem(FILES_KEY) || '{}'), ...memFiles }; } catch { return { ...memFiles }; }
}

export function resetDemo() {
  db = seed(); save();
  try { localStorage.removeItem(FILES_KEY); } catch { /* ignore */ }
}

const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
const PK: Record<string, string> = { calendar_days: 'day', site_settings: 'id', business_settings: 'id' };

function table(name: string): Row[] {
  const d = load();
  if (!d[name]) d[name] = [];
  return d[name];
}

/* ------------------------------------------------------------------ query engine */
function applyQuery(rows: Row[], q: Query = {}): Row[] {
  let out = rows.filter((r) => {
    for (const [k, v] of Object.entries(q.eq || {})) if ((r[k] ?? null) !== v) return false;
    for (const [k, v] of Object.entries(q.neq || {})) if ((r[k] ?? null) === v) return false;
    for (const [k, v] of Object.entries(q.gte || {})) if (r[k] == null || r[k] < v) return false;
    for (const [k, v] of Object.entries(q.lte || {})) if (r[k] == null || r[k] > v) return false;
    for (const [k, vals] of Object.entries(q.in || {})) if (!vals.includes(r[k])) return false;
    return true;
  });
  if (q.order) {
    const keys = q.order.split(',').map((s) => { const [col, dir] = s.split('.'); return { col, desc: dir === 'desc' }; });
    out = out.slice().sort((a, b) => {
      for (const { col, desc } of keys) {
        const x = a[col], y = b[col];
        if (x === y) continue;
        if (x == null) return 1;
        if (y == null) return -1;
        return (x < y ? -1 : 1) * (desc ? -1 : 1);
      }
      return 0;
    });
  }
  if (q.limit) out = out.slice(0, q.limit);
  return clone(out);
}

/* the price_link_stats view */
function linkStats(): Row[] {
  const events = table('price_link_events');
  const pk = table('packages');
  return table('price_links').map((l) => {
    const e = events.filter((x) => x.link_id === l.id);
    const opens = e.filter((x) => x.kind === 'open');
    const counts: Record<string, number> = {};
    e.filter((x) => (x.kind === 'view' || x.kind === 'book') && x.package_id).forEach((x) => { counts[x.package_id] = (counts[x.package_id] || 0) + 1; });
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    const { enquiry_id, ...rest } = l;
    return {
      ...rest,
      opens: opens.length,
      last_opened_at: opens.map((x) => x.created_at).sort().pop() || null,
      book_clicks: e.filter((x) => x.kind === 'book').length,
      top_package: top ? (pk.find((p) => p.id === top[0])?.name || null) : null,
    };
  });
}

/* payments → invoice paid/status → booked day (the database trigger) */
function syncInvoice(invoiceId: string) {
  const inv = table('invoices').find((i) => i.id === invoiceId);
  if (!inv) return;
  inv.paid = table('payments').filter((p) => p.invoice_id === invoiceId).reduce((a, p) => a + Number(p.amount), 0);
  invoiceChanged(inv);
}

/* mirrors the invoices_status + invoices_booking triggers */
function invoiceChanged(inv: Row) {
  if (inv.status !== 'cancelled') inv.status = inv.paid >= inv.total && inv.total > 0 ? 'paid' : inv.paid > 0 ? 'part_paid' : 'due';
  inv.updated_at = now();
  const days = table('calendar_days');
  const booked = inv.event_date && (inv.status === 'part_paid' || inv.status === 'paid');
  for (let k = days.length - 1; k >= 0; k--) {
    const d = days[k];
    if (d.invoice_id === inv.id && d.status === 'booked' && (!booked || d.day !== inv.event_date)) days.splice(k, 1);
  }
  if (booked) {
    const existing = days.find((d) => d.day === inv.event_date);
    if (existing) Object.assign(existing, { status: 'booked', invoice_id: inv.id, note: inv.client_name, updated_at: now() });
    else days.push({ day: inv.event_date, status: 'booked', invoice_id: inv.id, note: inv.client_name, updated_at: now() });
  }
}

const TABLE_DEFAULTS: Record<string, () => Row> = {
  photos: () => ({ published: true, featured: false, in_slideshow: false, slide_order: 0, sort: 0, category: 'wedding', title: null }),
  packages: () => ({ active: true, sort: 0, items: [], extra: null, short_name: null, kicker: null, team: null, team_sub: null }),
  enquiries: () => ({ source: 'website', status: 'new' }),
  price_links: () => ({ status: 'active', package_ids: [], valid_until: dayOffset(14), enquiry_id: null }),
  quotes: () => ({ items: [], discount: 0, advance_percent: 30, subtotal: 0, total: 0, status: 'draft', price_link_id: null, updated_at: now() }),
  invoices: () => ({ items: [], discount: 0, total: 0, paid: 0, status: 'due', issued_on: toDay(new Date()), quote_id: null, updated_at: now() }),
  payments: () => ({ method: 'upi', paid_on: toDay(new Date()), note: null }),
  films: () => ({ published: true, sort: 0, poster_path: null, duration_label: null }),
  calendar_days: () => ({ status: 'free', note: null, invoice_id: null }),
};

const wait = (ms = 60) => new Promise((r) => setTimeout(r, ms));

export const demoStore: Store = {
  demo: true,

  async list(name, q) {
    await wait();
    return applyQuery(name === 'price_link_stats' ? linkStats() : table(name), q) as any;
  },

  async get(name, id, idCol = PK[name] || 'id') {
    await wait();
    const src = name === 'price_link_stats' ? linkStats() : table(name);
    const r = src.find((x) => x[idCol] === id);
    return r ? clone(r) as any : null;
  },

  async insert(name, row: Row) {
    await wait(120);
    const t = table(name);
    const r: Row = { ...(TABLE_DEFAULTS[name]?.() || {}), ...(name === 'price_link_events' ? {} : { id: uid() }), created_at: now(), ...clone(row) };
    if (name === 'price_links' && t.some((x) => x.slug === r.slug)) throw Object.assign(new Error('duplicate key value violates unique constraint'), { code: '23505' });
    t.push(r);
    if (name === 'payments') syncInvoice(r.invoice_id);
    if (name === 'invoices') invoiceChanged(r);
    save();
    return clone(r) as any;
  },

  async update(name, id, patch: Row, idCol = PK[name] || 'id') {
    await wait(100);
    const r = table(name).find((x) => x[idCol] === id);
    if (!r) throw new Error('Not found');
    Object.assign(r, clone(patch));
    if ('updated_at' in r) r.updated_at = now();
    if (name === 'invoices') invoiceChanged(r);
    if (name === 'payments') syncInvoice(r.invoice_id);
    save();
    return clone(r) as any;
  },

  async upsert(name, row: Row, conflict) {
    await wait(100);
    const t = table(name);
    const r = t.find((x) => x[conflict] === row[conflict]);
    if (r) Object.assign(r, clone(row), { updated_at: now() });
    else t.push({ ...(TABLE_DEFAULTS[name]?.() || {}), ...clone(row), updated_at: now() });
    save();
    return clone(r || t[t.length - 1]) as any;
  },

  async remove(name, id, idCol = PK[name] || 'id') {
    await wait(80);
    const t = table(name);
    const i = t.findIndex((x) => x[idCol] === id);
    if (i < 0) return;
    const [r] = t.splice(i, 1);
    if (name === 'payments') syncInvoice(r.invoice_id);
    if (name === 'invoices') {
      const pays = table('payments');
      for (let k = pays.length - 1; k >= 0; k--) if (pays[k].invoice_id === id) pays.splice(k, 1);
      const days = table('calendar_days');
      for (let k = days.length - 1; k >= 0; k--) if (days[k].invoice_id === id && days[k].status === 'booked') days.splice(k, 1);
    }
    if (name === 'price_links') {
      const e = table('price_link_events');
      for (let k = e.length - 1; k >= 0; k--) if (e[k].link_id === id) e.splice(k, 1);
    }
    save();
  },

  async rpc(fn, args: any = {}) {
    await wait(60);
    if (fn === 'is_admin') return true as any;
    if (fn === 'next_doc_number') {
      const year = new Date().getFullYear();
      const t = table('doc_counters');
      let c = t.find((x) => x.kind === args.p_kind && x.year === year);
      if (!c) { c = { kind: args.p_kind, year, last: 0 }; t.push(c); }
      c.last += 1;
      save();
      return `${args.p_kind}-${year}-${String(c.last).padStart(4, '0')}` as any;
    }
    if (fn === 'get_price_link') {
      const l = table('price_links').find((x) => x.slug === String(args.p_slug).toLowerCase() && x.status !== 'archived');
      if (!l) return null as any;
      const packs = table('packages').filter((p) => p.active && l.package_ids.includes(p.id)).sort((a, b) => a.sort - b.sort || a.price - b.price)
        .map(({ id, name, short_name, kicker, price, team, team_sub, items, extra }) => ({ id, name, short_name, kicker, price, team, team_sub, items, extra }));
      return { slug: l.slug, client_name: l.client_name, wedding_date: l.wedding_date, valid_until: l.valid_until, expired: l.valid_until < toDay(new Date()), packages: packs } as any;
    }
    if (fn === 'log_price_event') {
      const l = table('price_links').find((x) => x.slug === String(args.p_slug).toLowerCase());
      if (l && ['open', 'view', 'book', 'ask'].includes(args.p_kind)) {
        const e = table('price_link_events');
        e.push({ id: (e[e.length - 1]?.id || 0) + 1, link_id: l.id, kind: args.p_kind, package_id: args.p_package || null, created_at: now() });
        save();
      }
      return null as any;
    }
    throw new Error('Unknown function ' + fn);
  },

  publicUrl(path) {
    if (!path) return '';
    if (/^https?:|^data:|^blob:/.test(path)) return path;
    if (path.startsWith('demo/')) return config.assetBase + path;
    return files()[path] || '';
  },

  async upload(path, file) {
    const dataUrl: string = await new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(String(fr.result));
      fr.onerror = rej;
      fr.readAsDataURL(file);
    });
    memFiles[path] = dataUrl;
    try {
      const saved = JSON.parse(localStorage.getItem(FILES_KEY) || '{}');
      saved[path] = dataUrl;
      localStorage.setItem(FILES_KEY, JSON.stringify(saved));
    } catch { /* too big for this browser's storage: kept until the page reloads */ }
    return path;
  },

  async deleteFiles(paths) {
    paths.forEach((p) => delete memFiles[p]);
    try {
      const saved = JSON.parse(localStorage.getItem(FILES_KEY) || '{}');
      paths.forEach((p) => delete saved[p]);
      localStorage.setItem(FILES_KEY, JSON.stringify(saved));
    } catch { /* ignore */ }
  },

  auth: {
    user() {
      try { return JSON.parse(sessionStorage.getItem('bw.demo.user') || 'null'); } catch { return null; }
    },
    async signIn(email) {
      await wait(300);
      const u = { id: 'demo-admin', email: email || 'demo@breywhites' };
      try { sessionStorage.setItem('bw.demo.user', JSON.stringify(u)); } catch { /* ignore */ }
      return u;
    },
    async signOut() { try { sessionStorage.removeItem('bw.demo.user'); } catch { /* ignore */ } },
    async isAdmin() { return true; },
    async updatePassword() { await wait(200); },
    async sendReset() { await wait(200); },
    takeRecoveryFromUrl() { return false; },
  },
};
