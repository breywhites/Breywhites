export type Category = 'bride' | 'groom' | 'couple' | 'wedding' | 'details' | 'pre-wedding' | 'events';

export const CATEGORY_LABELS: Record<Category, string> = {
  bride: 'Bride',
  groom: 'Groom',
  couple: 'Couple',
  wedding: 'Wedding',
  details: 'Details',
  'pre-wedding': 'Pre-wedding',
  events: 'Events',
};

export interface SiteSettings {
  studio_name: string;
  tagline: string;
  whatsapp: string;      // digits with country code, e.g. 918089141816
  phones: string[];
  instagram: string;
  email: string;
  slideshow_seconds: number;
}

export interface Photo {
  id: string;
  large: string;         // full URL
  thumb: string;         // full URL
  width: number | null;
  height: number | null;
  category: Category;
  title: string | null;
  published: boolean;
  featured: boolean;
  in_slideshow: boolean;
  slide_order: number;
  sort: number;
}

export interface Film {
  id: string;
  title: string;
  video_url: string;
  poster: string | null;
  duration_label: string | null;
}

export interface Package {
  id: string;
  name: string;
  short_name: string | null;
  kicker: string | null;
  price: number;
  team: string | null;
  team_sub: string | null;
  items: string[];
  extra: string | null;
}

export interface SiteData {
  settings: SiteSettings;
  slides: Photo[];
  photos: Photo[];
  films: Film[];
  freeDays: string[];    // yyyy-mm-dd, upcoming only
  packages: Package[];
}

export interface EnquiryInput {
  name: string;
  phone: string;
  event_date: string | null;
  event_type: string | null;
  message: string | null;
}

export interface PriceLinkView {
  slug: string;
  client_name: string;
  wedding_date: string | null;
  valid_until: string;
  expired: boolean;
  packages: Package[];
}

export type PriceEventKind = 'open' | 'view' | 'book' | 'ask';
