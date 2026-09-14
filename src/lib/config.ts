/* Runtime configuration lives in /config.js so the same build can be pointed at
   a database without rebuilding:

   window.BW_CONFIG = {
     supabaseUrl: 'https://xxxx.supabase.co',
     supabaseAnonKey: 'sb_publishable_...',  // the publishable key (or legacy "anon" key) — safe to ship
     router: 'path'                  // 'hash' for previews that can't serve deep links
   };

   With no supabaseUrl the site runs in demo mode with sample data. */

export interface BwConfig {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  router?: 'path' | 'hash';
  assetBase?: string;
}

declare global {
  interface Window { BW_CONFIG?: BwConfig }
}

const raw: BwConfig = (typeof window !== 'undefined' && window.BW_CONFIG) || {};

export const config = {
  supabaseUrl: (raw.supabaseUrl || '').replace(/\/+$/, ''),
  supabaseAnonKey: raw.supabaseAnonKey || '',
  router: raw.router === 'hash' ? 'hash' : 'path',
  // path routes need root-relative files (/demo/x.webp works on /p/slug too)
  assetBase: raw.assetBase ?? (raw.router === 'hash' ? '' : '/'),
} as const;

export const isDemo = !config.supabaseUrl || !config.supabaseAnonKey;
