/* Everything the public website reads or writes. */
import { demoSiteData } from './demo';
import { toDay } from './format';
import type { FilmRow, PackageRow, PhotoRow, SiteSettingsRow } from './models';
import { store } from './store';
import { supa } from './supa';
import type { EnquiryInput, Film, Package, Photo, PriceEventKind, PriceLinkView, SiteData, SiteSettings } from './types';

export function toPhoto(r: PhotoRow): Photo {
  return {
    id: r.id,
    large: store.publicUrl(r.path_large),
    thumb: store.publicUrl(r.path_thumb),
    width: r.width,
    height: r.height,
    category: r.category,
    title: r.title,
    published: r.published,
    featured: r.featured,
    in_slideshow: r.in_slideshow,
    slide_order: r.slide_order,
    sort: r.sort,
  };
}

function toSettings(r: SiteSettingsRow | undefined): SiteSettings {
  if (!r) return demoSiteData().settings;
  const { studio_name, tagline, whatsapp, phones, instagram, email, slideshow_seconds } = r;
  return { studio_name, tagline, whatsapp, phones: phones || [], instagram, email, slideshow_seconds };
}

let siteCache: Promise<SiteData> | null = null;

export const api = {
  clearCache() { siteCache = null; },

  getSiteData(): Promise<SiteData> {
    if (siteCache) return siteCache;
    siteCache = (async () => {
      const today = toDay(new Date());
      const [settings, photos, films, days, packages] = await Promise.all([
        store.list<SiteSettingsRow>('site_settings', { select: 'id,studio_name,tagline,whatsapp,phones,instagram,email,slideshow_seconds', eq: { id: 1 } }),
        store.list<PhotoRow>('photos', { order: 'sort.asc,created_at.desc' }),
        store.list<FilmRow>('films', { eq: { published: true }, order: 'sort.asc' }),
        store.list<{ day: string }>('calendar_days', { select: 'day', eq: { status: 'free' }, gte: { day: today }, order: 'day.asc', limit: 24 }),
        store.list<PackageRow>('packages', { eq: { active: true }, order: 'sort.asc,price.asc' }),
      ]);
      const all = photos.map(toPhoto);
      return {
        settings: toSettings(settings[0]),
        slides: all.filter((p) => p.in_slideshow).sort((a, b) => a.slide_order - b.slide_order),
        photos: all.filter((p) => p.published),
        films: films.map((f): Film => ({ id: f.id, title: f.title, video_url: f.video_url, poster: f.poster_path ? store.publicUrl(f.poster_path) : null, duration_label: f.duration_label })),
        freeDays: days.map((d) => d.day),
        packages: packages.map(({ id, name, short_name, kicker, price, team, team_sub, items, extra }): Package => ({ id, name, short_name, kicker, price, team, team_sub, items, extra })),
      };
    })();
    siteCache.catch(() => { siteCache = null; });
    return siteCache;
  },

  async getSettings(): Promise<SiteSettings> {
    if (siteCache) return (await siteCache).settings;
    const rows = await store.list<SiteSettingsRow>('site_settings', { eq: { id: 1 } });
    return toSettings(rows[0]);
  },

  async submitEnquiry(e: EnquiryInput): Promise<void> {
    const row = { ...e, source: 'website', status: 'new' };
    // visitors may add an enquiry but not read it back, so ask for no reply body
    if (store.demo) await store.insert('enquiries', row);
    else await supa.insert('enquiries', row, { returning: false });
  },

  getPriceLink(slug: string): Promise<PriceLinkView | null> {
    return store.rpc<PriceLinkView | null>('get_price_link', { p_slug: slug });
  },

  logPriceEvent(slug: string, kind: PriceEventKind, packageId?: string): void {
    store.rpc('log_price_event', { p_slug: slug, p_kind: kind, p_package: packageId || null }).catch(() => {});
  },
};
