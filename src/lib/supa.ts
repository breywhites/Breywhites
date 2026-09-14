/* A small Supabase client over plain fetch (REST, Auth, Storage).
   Keeps the bundle light and has no install step. */
import { config } from './config';

const SESSION_KEY = 'bw.session';

export interface Session {
  access_token: string;
  refresh_token: string;
  expires_at: number;      // epoch seconds
  user: { id: string; email?: string };
}

export class SupaError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function readSession(): Session | null {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch { return null; }
}
function writeSession(s: Session | null) {
  try {
    if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else localStorage.removeItem(SESSION_KEY);
  } catch { /* private mode: session lasts for this tab only */ }
}

let session: Session | null = typeof window !== 'undefined' ? readSession() : null;
let refreshing: Promise<Session | null> | null = null;

async function parse(res: Response) {
  const text = await res.text();
  let body: any = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!res.ok) {
    const msg = (body && (body.message || body.msg || body.error_description || body.error)) || res.statusText;
    throw new SupaError(String(msg), res.status, body && body.code);
  }
  return body;
}

async function validToken(): Promise<string | null> {
  if (!session) return null;
  if (session.expires_at - 60 > Date.now() / 1000) return session.access_token;
  if (!refreshing) {
    refreshing = fetch(`${config.supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: { apikey: config.supabaseAnonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: session.refresh_token }),
    })
      .then(parse)
      .then((b) => { session = toSession(b); writeSession(session); return session; })
      .catch(() => { session = null; writeSession(null); return null; })
      .finally(() => { refreshing = null; });
  }
  const s = await refreshing;
  return s ? s.access_token : null;
}

function toSession(b: any): Session {
  return {
    access_token: b.access_token,
    refresh_token: b.refresh_token,
    expires_at: b.expires_at || Math.floor(Date.now() / 1000) + (b.expires_in || 3600),
    user: { id: b.user?.id, email: b.user?.email },
  };
}

async function headers(extra: Record<string, string> = {}) {
  const h: Record<string, string> = { apikey: config.supabaseAnonKey, ...extra };
  // a signed-in user's token goes in Authorization. New "publishable" keys (sb_publishable_…)
  // are not JWTs and must only be sent as apikey; old "anon" keys (eyJ…) are also sent as Bearer.
  const token = (await validToken()) || (config.supabaseAnonKey.startsWith('eyJ') ? config.supabaseAnonKey : '');
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

export const supa = {
  /* ---------- database (PostgREST) ---------- */
  async select<T = any>(table: string, query = 'select=*'): Promise<T[]> {
    const res = await fetch(`${config.supabaseUrl}/rest/v1/${table}?${query}`, { headers: await headers() });
    return parse(res);
  },

  async insert<T = any>(table: string, rows: object | object[], opts: { returning?: boolean; upsert?: string } = {}): Promise<T[]> {
    const prefer = [opts.returning === false ? 'return=minimal' : 'return=representation'];
    if (opts.upsert) prefer.push('resolution=merge-duplicates');
    const q = opts.upsert ? `?on_conflict=${encodeURIComponent(opts.upsert)}` : '';
    const res = await fetch(`${config.supabaseUrl}/rest/v1/${table}${q}`, {
      method: 'POST',
      headers: await headers({ 'Content-Type': 'application/json', Prefer: prefer.join(',') }),
      body: JSON.stringify(rows),
    });
    return (await parse(res)) || [];
  },

  async update<T = any>(table: string, match: string, patch: object): Promise<T[]> {
    const res = await fetch(`${config.supabaseUrl}/rest/v1/${table}?${match}`, {
      method: 'PATCH',
      headers: await headers({ 'Content-Type': 'application/json', Prefer: 'return=representation' }),
      body: JSON.stringify(patch),
    });
    return (await parse(res)) || [];
  },

  async remove(table: string, match: string): Promise<void> {
    const res = await fetch(`${config.supabaseUrl}/rest/v1/${table}?${match}`, {
      method: 'DELETE',
      headers: await headers(),
    });
    await parse(res);
  },

  async rpc<T = any>(fn: string, args: object = {}): Promise<T> {
    const res = await fetch(`${config.supabaseUrl}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: await headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(args),
    });
    return parse(res);
  },

  /* ---------- auth ---------- */
  session(): Session | null { return session; },

  async signIn(email: string, password: string): Promise<Session> {
    const res = await fetch(`${config.supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: config.supabaseAnonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    session = toSession(await parse(res));
    writeSession(session);
    return session;
  },

  async signOut(): Promise<void> {
    const token = session?.access_token;
    session = null;
    writeSession(null);
    if (token) {
      await fetch(`${config.supabaseUrl}/auth/v1/logout`, {
        method: 'POST',
        headers: { apikey: config.supabaseAnonKey, Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
  },

  /** After a password-reset email link: #access_token=...&refresh_token=...&type=recovery */
  takeSessionFromHash(): boolean {
    const h = window.location.hash;
    if (!/access_token=/.test(h)) return false;
    const params = new URLSearchParams(h.replace(/^#\/?/, ''));
    const access = params.get('access_token');
    const refresh = params.get('refresh_token');
    if (!access || !refresh) return false;
    let userId = '';
    try { userId = JSON.parse(atob(access.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).sub; } catch { /* ignore */ }
    session = {
      access_token: access,
      refresh_token: refresh,
      expires_at: Math.floor(Date.now() / 1000) + Number(params.get('expires_in') || 3600),
      user: { id: userId },
    };
    writeSession(session);
    window.history.replaceState(null, '', window.location.pathname);
    return params.get('type') === 'recovery';
  },

  async updatePassword(password: string): Promise<void> {
    const res = await fetch(`${config.supabaseUrl}/auth/v1/user`, {
      method: 'PUT',
      headers: await headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ password }),
    });
    await parse(res);
  },

  async sendPasswordReset(email: string, redirectTo: string): Promise<void> {
    const res = await fetch(`${config.supabaseUrl}/auth/v1/recover?redirect_to=${encodeURIComponent(redirectTo)}`, {
      method: 'POST',
      headers: { apikey: config.supabaseAnonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    await parse(res);
  },

  /* ---------- storage ---------- */
  publicUrl(path: string | null | undefined, bucket = 'photos'): string {
    if (!path) return '';
    if (/^https?:|^data:|^blob:/.test(path)) return path;
    if (path.startsWith('demo/')) return config.assetBase + path;   // starter photos shipped with the site
    return `${config.supabaseUrl}/storage/v1/object/public/${bucket}/${path.split('/').map(encodeURIComponent).join('/')}`;
  },

  async upload(path: string, file: Blob, bucket = 'photos'): Promise<string> {
    const res = await fetch(`${config.supabaseUrl}/storage/v1/object/${bucket}/${path}`, {
      method: 'POST',
      headers: await headers({ 'Content-Type': file.type || 'application/octet-stream', 'x-upsert': 'true', 'cache-control': 'max-age=31536000' }),
      body: file,
    });
    await parse(res);
    return path;
  },

  async deleteFiles(paths: string[], bucket = 'photos'): Promise<void> {
    if (!paths.length) return;
    const res = await fetch(`${config.supabaseUrl}/storage/v1/object/${bucket}`, {
      method: 'DELETE',
      headers: await headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ prefixes: paths }),
    });
    await parse(res);
  },
};
