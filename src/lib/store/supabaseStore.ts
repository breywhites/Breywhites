import { supa } from '../supa';
import type { Query, Store } from './types';

function enc(v: string | number | boolean) {
  return encodeURIComponent(String(v));
}

export function buildQuery(q: Query = {}): string {
  const parts = [`select=${q.select ? encodeURIComponent(q.select) : '*'}`];
  for (const [k, v] of Object.entries(q.eq || {})) parts.push(v === null ? `${k}=is.null` : `${k}=eq.${enc(v)}`);
  for (const [k, v] of Object.entries(q.neq || {})) parts.push(v === null ? `${k}=not.is.null` : `${k}=neq.${enc(v)}`);
  for (const [k, v] of Object.entries(q.gte || {})) parts.push(`${k}=gte.${enc(v)}`);
  for (const [k, v] of Object.entries(q.lte || {})) parts.push(`${k}=lte.${enc(v)}`);
  for (const [k, vals] of Object.entries(q.in || {})) {
    parts.push(`${k}=in.(${vals.map((v) => `"${String(v).replace(/"/g, '')}"`).map(encodeURIComponent).join(',')})`);
  }
  if (q.order) parts.push(`order=${q.order}`);
  if (q.limit) parts.push(`limit=${q.limit}`);
  return parts.join('&');
}

export const supabaseStore: Store = {
  demo: false,

  list: (table, q) => supa.select(table, buildQuery(q)),

  async get(table, id, idCol = 'id') {
    const rows = await supa.select(table, `select=*&${idCol}=eq.${enc(id)}&limit=1`);
    return rows[0] || null;
  },

  async insert(table, row) {
    const rows = await supa.insert(table, row);
    return rows[0];
  },

  async update(table, id, patch, idCol = 'id') {
    const rows = await supa.update(table, `${idCol}=eq.${enc(id)}`, patch);
    return rows[0];
  },

  async upsert(table, row, conflict) {
    const rows = await supa.insert(table, row, { upsert: conflict });
    return rows[0];
  },

  remove: (table, id, idCol = 'id') => supa.remove(table, `${idCol}=eq.${enc(id)}`),

  rpc: (fn, args) => supa.rpc(fn, args || {}),

  publicUrl: (path) => supa.publicUrl(path),
  upload: (path, file) => supa.upload(path, file),
  deleteFiles: (paths) => supa.deleteFiles(paths),

  auth: {
    user: () => supa.session()?.user || null,
    async signIn(email, password) { return (await supa.signIn(email, password)).user; },
    signOut: () => supa.signOut(),
    async isAdmin() {
      try { return (await supa.rpc<boolean>('is_admin')) === true; } catch { return false; }
    },
    updatePassword: (pw) => supa.updatePassword(pw),
    sendReset: (email, redirectTo) => supa.sendPasswordReset(email, redirectTo),
    takeRecoveryFromUrl: () => supa.takeSessionFromHash(),
  },
};
