/* Admin actions on top of the store. Screens call these, never the store directly. */
import { config } from '../lib/config';
import { fmtDay, toDay } from '../lib/format';
import { photoVersions } from '../lib/image';
import type {
  BusinessSettingsRow, CalendarDayRow, DayStatus, EnquiryRow, EnquiryStatus, FilmRow, InvoiceRow, LineItem, LinkStatus,
  PackageRow, PaymentRow, PhotoRow, PriceLinkRow, PriceLinkStat, QuoteRow, QuoteStatus, SiteSettingsRow,
} from '../lib/models';
import { lineTotals } from '../lib/models';
import { store } from '../lib/store';
import type { Category } from '../lib/types';

const today = () => toDay(new Date());
const addDays = (n: number, from = new Date()) => { const d = new Date(from); d.setDate(d.getDate() + n); return toDay(d); };

/* ---------------- settings ---------------- */
export async function loadSettings() {
  const [site, biz] = await Promise.all([
    store.get<SiteSettingsRow>('site_settings', 1),
    store.get<BusinessSettingsRow>('business_settings', 1),
  ]);
  return {
    site: site || { id: 1, studio_name: 'Breywhites', tagline: 'Where your wedding becomes a timeless film.', whatsapp: '918089141816', phones: ['8089141816'], instagram: 'breywhites', email: '', slideshow_seconds: 3 } as SiteSettingsRow,
    biz: biz || { id: 1, advance_percent: 30, upi_id: null, bank_details: null, quote_terms: '', invoice_terms: '', price_link_days: 14 } as BusinessSettingsRow,
  };
}
export const saveSite = (patch: Partial<SiteSettingsRow>) => store.update<SiteSettingsRow>('site_settings', 1, patch);
export const saveBiz = (patch: Partial<BusinessSettingsRow>) => store.update<BusinessSettingsRow>('business_settings', 1, patch);

/* ---------------- dashboard ---------------- */
export async function dashboard() {
  const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString();
  const [enquiries, links, invoices, quotes] = await Promise.all([
    store.list<EnquiryRow>('enquiries', { order: 'created_at.desc', limit: 50 }),
    store.list<PriceLinkStat>('price_link_stats', { order: 'created_at.desc', limit: 50 }),
    store.list<InvoiceRow>('invoices', { neq: { status: 'cancelled' }, order: 'event_date.asc' }),
    store.list<QuoteRow>('quotes', { in: { status: ['draft', 'sent'] }, order: 'created_at.desc', limit: 20 }),
  ]);
  const upcoming = invoices.filter((i) => i.event_date && i.event_date >= today());
  return {
    newEnquiries: enquiries.filter((e) => e.status === 'new'),
    recentEnquiries: enquiries.slice(0, 4),
    openedLinks: links.filter((l) => l.last_opened_at && l.last_opened_at >= weekAgo && l.status === 'active'),
    balanceDue: invoices.filter((i) => i.status === 'due' || i.status === 'part_paid').reduce((a, i) => a + Math.max(0, i.total - i.paid), 0),
    upcoming: upcoming.slice(0, 6),
    openQuotes: quotes,
  };
}

/* ---------------- enquiries ---------------- */
export const listEnquiries = () => store.list<EnquiryRow>('enquiries', { order: 'created_at.desc', limit: 500 });
export const setEnquiryStatus = (id: string, status: EnquiryStatus) => store.update<EnquiryRow>('enquiries', id, { status });
export const deleteEnquiry = (id: string) => store.remove('enquiries', id);

/* ---------------- packages ---------------- */
export const listPackages = () => store.list<PackageRow>('packages', { order: 'sort.asc,price.asc' });
export async function savePackage(p: Partial<PackageRow> & { name: string; price: number }) {
  const row = {
    name: p.name.trim(), short_name: p.short_name?.trim() || null, kicker: p.kicker?.trim() || null,
    price: Math.max(0, Math.round(Number(p.price) || 0)), team: p.team?.trim() || null, team_sub: p.team_sub?.trim() || null,
    items: (p.items || []).map((s) => s.trim()).filter(Boolean), extra: p.extra?.trim() || null,
    active: p.active ?? true, sort: p.sort ?? 99,
  };
  return p.id ? store.update<PackageRow>('packages', p.id, row) : store.insert<PackageRow>('packages', row);
}
export const deletePackage = (id: string) => store.remove('packages', id);
export async function reorder<T extends { id: string }>(table: string, rows: T[], col: 'sort' | 'slide_order') {
  await Promise.all(rows.map((r, i) => store.update(table, r.id, { [col]: i + 1 })));
}
export const packageDescription = (p: PackageRow) => [p.team && `${p.team}${p.team_sub ? ` (${p.team_sub})` : ''}`, ...p.items].filter(Boolean).join(' · ');

/* ---------------- photos ---------------- */
export const listPhotos = () => store.list<PhotoRow>('photos', { order: 'sort.asc,created_at.desc' });
export async function uploadPhotos(files: File[], category: Category, onProgress: (done: number, total: number, name: string) => void) {
  const existing = await store.list<PhotoRow>('photos', { select: 'id,sort', order: 'sort.desc', limit: 1 });
  let sort = (existing[0]?.sort || 0) + 1;
  const added: PhotoRow[] = [];
  const failed: string[] = [];
  const year = new Date().getFullYear();
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    onProgress(i, files.length, f.name);
    try {
      const { large, thumb } = await photoVersions(f);
      const key = `${year}/${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      const ext = large.type === 'image/webp' ? 'webp' : 'jpg';
      const pl = await store.upload(`${key}-l.${ext}`, large.blob);
      const pt = await store.upload(`${key}-t.${ext}`, thumb.blob);
      const title = f.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').replace(/\b(IMG|DSC|PXL|WA)\s?\d+.*$/i, '').trim().slice(0, 60) || null;
      added.push(await store.insert<PhotoRow>('photos', { path_large: pl, path_thumb: pt, width: large.width, height: large.height, category, title, sort: sort++, published: true }));
    } catch {
      failed.push(f.name);
    }
  }
  onProgress(files.length, files.length, '');
  return { added, failed };
}
export const updatePhoto = (id: string, patch: Partial<PhotoRow>) => store.update<PhotoRow>('photos', id, patch);
export async function deletePhoto(p: PhotoRow) {
  await store.remove('photos', p.id);
  if (!p.path_large.startsWith('demo/')) await store.deleteFiles([p.path_large, p.path_thumb]).catch(() => {});
}

/* ---------------- films ---------------- */
export const listFilms = () => store.list<FilmRow>('films', { order: 'sort.asc,created_at.asc' });
export const saveFilm = (f: Partial<FilmRow> & { title: string; video_url: string }) =>
  f.id ? store.update<FilmRow>('films', f.id, { title: f.title, video_url: f.video_url, duration_label: f.duration_label || null, poster_path: f.poster_path || null, published: f.published ?? true })
    : store.insert<FilmRow>('films', { title: f.title, video_url: f.video_url, duration_label: f.duration_label || null, poster_path: f.poster_path || null, published: true, sort: 0 });
export const deleteFilm = (id: string) => store.remove('films', id);

/* ---------------- calendar ---------------- */
export const listDays = (from: string, to: string) => store.list<CalendarDayRow>('calendar_days', { gte: { day: from }, lte: { day: to }, order: 'day.asc' });
export async function setDay(day: string, status: DayStatus | null, note?: string | null) {
  if (!status) return store.remove('calendar_days', day, 'day');
  return store.upsert<CalendarDayRow>('calendar_days', { day, status, note: note ?? null, invoice_id: null }, 'day');
}

/* ---------------- price links ---------------- */
export const listLinks = () => store.list<PriceLinkStat>('price_link_stats', { order: 'created_at.desc', limit: 300 });

export function linkUrl(slug: string) {
  const base = window.location.origin + (config.router === 'hash' ? window.location.pathname + '#' : '');
  return `${base}/p/${slug}`;
}

export function slugify(name: string) {
  return name.toLowerCase().replace(/&/g, ' ').normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'client';
}

export async function createLink(input: { client_name: string; phone: string; wedding_date: string | null; package_ids: string[]; days: number; enquiry_id?: string | null }) {
  const base = slugify(input.client_name);
  for (let attempt = 0; attempt < 4; attempt++) {
    const slug = `${base}-${Math.random().toString(36).slice(2, 5)}`;
    try {
      return await store.insert<PriceLinkRow>('price_links', {
        slug, client_name: input.client_name.trim(), phone: input.phone.trim() || null, wedding_date: input.wedding_date || null,
        package_ids: input.package_ids, valid_until: addDays(input.days), status: 'active', enquiry_id: input.enquiry_id || null,
      });
    } catch (e: any) {
      if (!/duplicate|23505/.test(String(e?.message) + e?.code)) throw e;
    }
  }
  throw new Error('Couldn’t create a unique link — try again');
}
export const setLinkStatus = (id: string, status: LinkStatus) => store.update('price_links', id, { status });
export const extendLink = (id: string, days: number) => store.update('price_links', id, { valid_until: addDays(days), status: 'active' });
export const deleteLink = (id: string) => store.remove('price_links', id);

export function linkMessage(studio: string, l: { client_name: string; wedding_date: string | null; valid_until: string; slug: string }) {
  return `Hi ${l.client_name},\n\nHere are our wedding packages with full prices${l.wedding_date ? ` for ${fmtDay(l.wedding_date)}` : ''} — made just for you:\n${linkUrl(l.slug)}\n\nTap any package to book your date on WhatsApp. Prices valid until ${fmtDay(l.valid_until)}.\n\n— ${studio}`;
}

/* ---------------- quotes ---------------- */
export const listQuotes = () => store.list<QuoteRow>('quotes', { order: 'created_at.desc', limit: 500 });
export const getQuote = (id: string) => store.get<QuoteRow>('quotes', id);

export interface DocDraft {
  id?: string;
  number?: string;
  client_name: string;
  phone: string;
  event_date: string;
  venue: string;
  items: LineItem[];
  discount: number;
  advance_percent: number;
  terms: string;
  valid_until: string;     // quotes
  due_on: string;          // invoices
  price_link_id?: string | null;
}

export function blankDraft(biz: BusinessSettingsRow): DocDraft {
  return { client_name: '', phone: '', event_date: '', venue: '', items: [], discount: 0, advance_percent: biz.advance_percent, terms: biz.quote_terms, valid_until: addDays(14), due_on: '' };
}

export async function saveQuote(d: DocDraft, status?: QuoteStatus): Promise<QuoteRow> {
  const t = lineTotals(d.items, d.discount);
  const row = {
    client_name: d.client_name.trim(), phone: d.phone.trim() || null, event_date: d.event_date || null, venue: d.venue.trim() || null,
    items: d.items, discount: t.discount, advance_percent: d.advance_percent, subtotal: t.subtotal, total: t.total,
    terms: d.terms.trim() || null, valid_until: d.valid_until || null, price_link_id: d.price_link_id || null,
    ...(status ? { status } : {}),
  };
  if (d.id) return store.update<QuoteRow>('quotes', d.id, row);
  const number = await store.rpc<string>('next_doc_number', { p_kind: 'Q' });
  return store.insert<QuoteRow>('quotes', { ...row, number, status: status || 'draft' });
}
export const setQuoteStatus = (id: string, status: QuoteStatus) => store.update<QuoteRow>('quotes', id, { status });
export const deleteQuote = (id: string) => store.remove('quotes', id);

/* ---------------- invoices & payments ---------------- */
export const listInvoices = () => store.list<InvoiceRow>('invoices', { order: 'created_at.desc', limit: 500 });
export async function getInvoice(id: string) {
  const [inv, payments] = await Promise.all([
    store.get<InvoiceRow>('invoices', id),
    store.list<PaymentRow>('payments', { eq: { invoice_id: id }, order: 'paid_on.asc,created_at.asc' }),
  ]);
  return inv ? { inv, payments } : null;
}

export async function saveInvoice(d: DocDraft, biz: BusinessSettingsRow, quoteId?: string | null): Promise<InvoiceRow> {
  const t = lineTotals(d.items, d.discount);
  const row = {
    client_name: d.client_name.trim(), phone: d.phone.trim() || null, event_date: d.event_date || null, venue: d.venue.trim() || null,
    items: d.items, discount: t.discount, total: t.total, terms: d.terms.trim() || biz.invoice_terms || null, due_on: d.due_on || d.event_date || null,
  };
  if (d.id) return store.update<InvoiceRow>('invoices', d.id, row);
  const number = await store.rpc<string>('next_doc_number', { p_kind: 'INV' });
  return store.insert<InvoiceRow>('invoices', { ...row, number, quote_id: quoteId || null, issued_on: today(), status: 'due', paid: 0 });
}

export async function quoteToInvoice(q: QuoteRow, biz: BusinessSettingsRow): Promise<InvoiceRow> {
  const inv = await saveInvoice({
    client_name: q.client_name, phone: q.phone || '', event_date: q.event_date || '', venue: q.venue || '', items: q.items,
    discount: q.discount, advance_percent: q.advance_percent, terms: biz.invoice_terms || q.terms || '', valid_until: '', due_on: q.event_date || '',
  }, biz, q.id);
  await store.update('quotes', q.id, { status: 'invoiced' });
  if (q.price_link_id) await store.update('price_links', q.price_link_id, { status: 'booked' }).catch(() => {});
  return inv;
}

export const addPayment = (p: { invoice_id: string; amount: number; method: PaymentRow['method']; paid_on: string; note: string }) =>
  store.insert<PaymentRow>('payments', { ...p, amount: Math.round(p.amount), note: p.note.trim() || null });
export const deletePayment = (id: string) => store.remove('payments', id);

// the database frees the booked date when an invoice is cancelled or deleted
export const cancelInvoice = (inv: InvoiceRow) => store.update<InvoiceRow>('invoices', inv.id, { status: 'cancelled' });
export const deleteInvoice = (inv: InvoiceRow) => store.remove('invoices', inv.id);
