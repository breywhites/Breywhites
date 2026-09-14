/* Database row shapes (match supabase/schema.sql). */
import type { Category } from './types';

export interface SiteSettingsRow {
  id: 1;
  studio_name: string;
  tagline: string;
  whatsapp: string;
  phones: string[];
  instagram: string;
  email: string;
  slideshow_seconds: number;
}

export interface BusinessSettingsRow {
  id: 1;
  advance_percent: number;
  upi_id: string | null;
  bank_details: string | null;
  quote_terms: string;
  invoice_terms: string;
  price_link_days: number;
}

export interface PhotoRow {
  id: string;
  path_large: string;
  path_thumb: string;
  width: number | null;
  height: number | null;
  category: Category;
  title: string | null;
  published: boolean;
  featured: boolean;
  in_slideshow: boolean;
  slide_order: number;
  sort: number;
  created_at: string;
}

export interface FilmRow {
  id: string;
  title: string;
  video_url: string;
  poster_path: string | null;
  duration_label: string | null;
  published: boolean;
  sort: number;
  created_at: string;
}

export type DayStatus = 'free' | 'booked' | 'hold';
export interface CalendarDayRow {
  day: string;
  status: DayStatus;
  note: string | null;
  invoice_id: string | null;
}

export interface PackageRow {
  id: string;
  name: string;
  short_name: string | null;
  kicker: string | null;
  price: number;
  team: string | null;
  team_sub: string | null;
  items: string[];
  extra: string | null;
  active: boolean;
  sort: number;
  created_at: string;
}

export type EnquiryStatus = 'new' | 'replied' | 'quoted' | 'booked' | 'closed';
export interface EnquiryRow {
  id: string;
  name: string;
  phone: string;
  event_date: string | null;
  event_type: string | null;
  message: string | null;
  source: string;
  status: EnquiryStatus;
  created_at: string;
}

export type LinkStatus = 'active' | 'booked' | 'archived';
export interface PriceLinkRow {
  id: string;
  slug: string;
  client_name: string;
  phone: string | null;
  wedding_date: string | null;
  package_ids: string[];
  valid_until: string;
  status: LinkStatus;
  enquiry_id: string | null;
  created_at: string;
}
export interface PriceLinkStat extends Omit<PriceLinkRow, 'enquiry_id'> {
  opens: number;
  last_opened_at: string | null;
  book_clicks: number;
  top_package: string | null;
}
export interface PriceEventRow {
  id: number;
  link_id: string;
  kind: 'open' | 'view' | 'book' | 'ask';
  package_id: string | null;
  created_at: string;
}

export interface LineItem {
  package_id: string | null;
  name: string;
  description: string;
  price: number;
  qty: number;
}

export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'declined' | 'invoiced';
export interface QuoteRow {
  id: string;
  number: string;
  client_name: string;
  phone: string | null;
  event_date: string | null;
  venue: string | null;
  items: LineItem[];
  discount: number;
  advance_percent: number;
  subtotal: number;
  total: number;
  terms: string | null;
  status: QuoteStatus;
  price_link_id: string | null;
  valid_until: string | null;
  created_at: string;
  updated_at: string;
}

export type InvoiceStatus = 'due' | 'part_paid' | 'paid' | 'cancelled';
export interface InvoiceRow {
  id: string;
  number: string;
  quote_id: string | null;
  client_name: string;
  phone: string | null;
  event_date: string | null;
  venue: string | null;
  items: LineItem[];
  discount: number;
  total: number;
  paid: number;
  status: InvoiceStatus;
  terms: string | null;
  issued_on: string;
  due_on: string | null;
  created_at: string;
  updated_at: string;
}

export type PayMethod = 'upi' | 'cash' | 'bank' | 'card' | 'other';
export interface PaymentRow {
  id: string;
  invoice_id: string;
  amount: number;
  method: PayMethod;
  paid_on: string;
  note: string | null;
  created_at: string;
}

export function lineTotals(items: LineItem[], discount: number) {
  const subtotal = items.reduce((a, it) => a + (Number(it.price) || 0) * (Number(it.qty) || 0), 0);
  const d = Math.min(Math.max(0, Number(discount) || 0), subtotal);
  return { subtotal, discount: d, total: subtotal - d };
}
