/* Sample content used when no database is connected (previews, local testing). */
import { config } from './config';
import { toDay } from './format';
import type { Category, Film, Package, Photo, PriceLinkView, SiteData } from './types';

const img = (key: string, size: 'l' | 't') => `${config.assetBase}demo/${key}-${size}.webp`;

const PHOTO_SEED: [string, Category, string, number, number][] = [
  // key, category, title, width, height (large)
  ['hero', 'bride', 'Bride portrait', 826, 1100],
  ['wedding1', 'wedding', 'The exchange', 826, 1100],
  ['event1', 'wedding', 'Bridal party', 826, 1100],
  ['portrait1', 'bride', 'Veiled', 826, 1100],
  ['detail1', 'details', 'Details', 658, 780],
  ['portrait2', 'bride', 'Garden portrait', 585, 780],
  ['bride1', 'bride', 'Quiet moment', 825, 1100],
  ['groom2', 'groom', 'Arrival', 825, 1100],
  ['bride2', 'bride', 'Reflection', 825, 1100],
  ['portrait3', 'bride', 'Golden hour', 825, 1100],
  ['groom1', 'groom', 'Departure', 825, 1100],
  ['couple1', 'couple', 'First look', 825, 1100],
  ['couple2', 'couple', 'Together', 825, 1100],
  ['film1', 'events', 'Reception', 825, 1100],
  ['couple3', 'couple', 'The staircase', 825, 1100],
];
const SLIDES = ['hero', 'couple1', 'bride2', 'couple2', 'portrait2'];
const FEATURED = ['wedding1', 'portrait1', 'detail1', 'bride1', 'groom2', 'portrait3', 'couple1', 'couple3'];

export const demoPhotos: Photo[] = PHOTO_SEED.map(([key, category, title, w, h], i) => ({
  id: 'demo-' + key,
  large: img(key, 'l'),
  thumb: img(key, 't'),
  width: w,
  height: h,
  category,
  title,
  published: true,
  featured: FEATURED.includes(key),
  in_slideshow: SLIDES.includes(key),
  slide_order: SLIDES.indexOf(key),
  sort: i,
}));

export const demoPackages: Package[] = [
  { id: 'pk-1', name: '1 Day Package', short_name: '1 Day', kicker: 'One day · Photo + video', price: 29000, team: '2 cameramen', team_sub: '1 videographer · 1 photographer', items: ['Unlimited photos', '3 videos', '2 reels · 30–45 sec each', '1 highlight film · 2–3 min'], extra: null },
  { id: 'pk-2', name: '1 Day Wedding', short_name: '1 Day Wedding', kicker: 'One day · Wedding', price: 32000, team: '2 professional cameramen', team_sub: '1 videographer · 1 photographer', items: ['Unlimited photos', '2 videos', '1 reel · 30–45 sec', '1 highlight film · 2–3 min'], extra: null },
  { id: 'pk-3', name: 'Unique 2 Days Wedding', short_name: '2 Days', kicker: 'Two days · Wedding', price: 38000, team: '2 cameramen', team_sub: '1 camera videographer · 1 mobile photographer', items: ['Unlimited mobile photos', '3 videos', '2 reels · 30–45 sec each', '1 highlight film · 2–3 min'], extra: 'Coverage across two days' },
  { id: 'pk-4', name: 'Classic Wedding', short_name: 'Classic', kicker: 'Wedding · Classic', price: 42000, team: '2 professional cameramen', team_sub: '1 videographer · 1 photographer', items: ['Unlimited photos', '3 videos', '2 reels · 30–45 sec each', '1 highlight film · 3–5 min'], extra: 'Longer 3–5 min highlight film' },
  { id: 'pk-5', name: 'Premium Wedding', short_name: 'Premium', kicker: 'Wedding · Premium', price: 62000, team: '2 professional cameramen', team_sub: '1 videographer · 1 photographer', items: ['Unlimited photos', '4 videos', 'Pre-wedding shoot · 2 hours', '2 reels · 30–45 sec each', '1 highlight film · 3–5 min'], extra: 'Includes a 2-hour pre-wedding shoot' },
];

const demoFilms: Film[] = [
  { id: 'film-1', title: 'Watch a wedding', video_url: 'https://instagram.com/breywhites', poster: img('film1', 'l'), duration_label: 'Highlight film · 3–5 min' },
];

function upcomingFreeDays(): string[] {
  // a few Saturdays / Sundays from next month, like a real calendar would have
  const out: string[] = [];
  const d = new Date();
  d.setDate(d.getDate() + 20);
  while (out.length < 8) {
    if (d.getDay() === 0 || d.getDay() === 6) out.push(toDay(d));
    d.setDate(d.getDate() + (out.length % 3 === 0 ? 3 : 1));
  }
  return out;
}

export function demoSiteData(): SiteData {
  return {
    settings: {
      studio_name: 'Breywhites',
      tagline: 'Where your wedding becomes a timeless film.',
      whatsapp: '918089141816',
      phones: ['8089141816', '7012001816'],
      instagram: 'breywhites',
      email: 'Breywhites7@gmail.com',
      slideshow_seconds: 3,
    },
    slides: demoPhotos.filter((p) => p.in_slideshow).sort((a, b) => a.slide_order - b.slide_order),
    photos: demoPhotos,
    films: demoFilms,
    freeDays: upcomingFreeDays(),
    packages: demoPackages,
  };
}

export function demoPriceLink(slug: string): PriceLinkView | null {
  if (slug === 'expired-demo') {
    return { slug, client_name: 'Meera & Arun', wedding_date: null, valid_until: '2026-01-10', expired: true, packages: [] };
  }
  if (!/^[a-z0-9-]{3,60}$/.test(slug)) return null;
  const wedding = new Date(); wedding.setDate(wedding.getDate() + 95);
  const valid = new Date(); valid.setDate(valid.getDate() + 14);
  return {
    slug,
    client_name: 'Anjali & Rohit',
    wedding_date: toDay(wedding),
    valid_until: toDay(valid),
    expired: false,
    packages: demoPackages,
  };
}
