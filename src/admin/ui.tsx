import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { IconClose } from '../site/Icons';

/* ---------------- data loading ---------------- */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [n, setN] = useState(0);
  useEffect(() => {
    let live = true;
    setLoading(true);
    fn().then((d) => { if (live) { setData(d); setError(null); } })
      .catch((e) => { if (live) setError(errorText(e)); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, n]);
  return { data, setData, error, loading, reload: () => setN((x) => x + 1) };
}

export function errorText(e: any): string {
  const m = String(e?.message || e || '');
  if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return 'No internet connection — check and try again.';
  if (/JWT|expired|401/i.test(m)) return 'Your login has expired — please sign in again.';
  if (/row-level security|permission denied|42501/i.test(m)) return 'This account isn’t allowed to do that.';
  if (/duplicate key|23505/i.test(m)) return 'That already exists.';
  if (/Invalid login credentials/i.test(m)) return 'Email or password is wrong.';
  return m || 'Something went wrong — try again.';
}

/* ---------------- toast & confirm ---------------- */
type ToastFn = (msg: string, kind?: 'ok' | 'err') => void;
type ConfirmOpts = { title: string; body?: string; ok?: string; danger?: boolean };
type ConfirmFn = (opts: ConfirmOpts) => Promise<boolean>;
const ToastCtx = createContext<ToastFn>(() => {});
const ConfirmCtx = createContext<ConfirmFn>(async () => false);

export function Feedback({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<{ msg: string; kind: 'ok' | 'err'; id: number } | null>(null);
  const [ask, setAsk] = useState<(ConfirmOpts & { resolve: (v: boolean) => void }) | null>(null);
  const timer = useRef<number>();

  const show = useCallback<ToastFn>((msg, kind = 'ok') => {
    window.clearTimeout(timer.current);
    setToast({ msg, kind, id: Date.now() });
    timer.current = window.setTimeout(() => setToast(null), kind === 'err' ? 5000 : 2600);
  }, []);
  const confirm = useCallback<ConfirmFn>((opts) => new Promise((resolve) => setAsk({ ...opts, resolve })), []);
  const close = useCallback((v: boolean) => { setAsk((a) => { a?.resolve(v); return null; }); }, []);

  return (
    <ToastCtx.Provider value={show}>
      <ConfirmCtx.Provider value={confirm}>
        {children}
        {toast && <div key={toast.id} className={'a-toast' + (toast.kind === 'err' ? ' err' : '')} role={toast.kind === 'err' ? 'alert' : 'status'}>{toast.msg}</div>}
        <Sheet open={!!ask} onClose={() => close(false)} title={ask?.title || ''}
          footer={<><button className="a-btn line" onClick={() => close(false)}>Cancel</button>
            <button className={'a-btn ' + (ask?.danger ? 'danger' : 'dark')} onClick={() => close(true)}>{ask?.ok || 'OK'}</button></>}>
          {ask?.body && <p style={{ margin: 0, lineHeight: 1.6, color: 'var(--ink-2)' }}>{ask.body}</p>}
        </Sheet>
      </ConfirmCtx.Provider>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);
export const useConfirm = () => useContext(ConfirmCtx);

/* ---------------- building blocks ---------------- */
export function PageHead({ title, sub, actions }: { title: React.ReactNode; sub?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="a-head">
      <div><h1>{title}</h1>{sub && <div className="sub">{sub}</div>}</div>
      {actions && <div className="a-actions">{actions}</div>}
    </div>
  );
}

export function Field({ label, hint, children, id }: { label: string; hint?: React.ReactNode; children: React.ReactElement; id: string }) {
  return (
    <div className="a-field">
      <label className="a-label" htmlFor={id}>{label}</label>
      {React.cloneElement(children, { id })}
      {hint && <div className="a-hint">{hint}</div>}
    </div>
  );
}

export function Toggle({ checked, onChange, label, sub }: { checked: boolean; onChange: (v: boolean) => void; label: string; sub?: string }) {
  return (
    <div className="a-toggle" role="switch" aria-checked={checked} tabIndex={0}
      onClick={() => onChange(!checked)} onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); onChange(!checked); } }}>
      <div><div style={{ fontSize: 15 }}>{label}</div>{sub && <div className="a-hint" style={{ marginTop: 2 }}>{sub}</div>}</div>
      <div className={'a-switch' + (checked ? ' on' : '')} />
    </div>
  );
}

export function Chips<T extends string>({ options, value, onChange, label }: { options: { value: T; label: string; n?: number }[]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div className="a-chips" role="tablist" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} className={'a-chip' + (o.value === value ? ' on' : '')} onClick={() => onChange(o.value)} role="tab" aria-selected={o.value === value}>
          {o.label}{o.n != null && <span className="n">{o.n}</span>}
        </button>
      ))}
    </div>
  );
}

export function Sheet({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: string; children?: React.ReactNode; footer?: React.ReactNode }) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') closeRef.current(); };
    window.addEventListener('keydown', key);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', key); document.body.style.overflow = prev; };
  }, [open]);
  if (!open) return null;
  return (
    <div className="a-sheet-bg" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="a-sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="a-sheet-head"><h2>{title}</h2><button className="a-icon" onClick={onClose} aria-label="Close"><IconClose size={20} /></button></div>
        <div className="a-sheet-body">{children}</div>
        {footer && <div className="a-sheet-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Empty({ title, children, action }: { title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="a-empty">
      <div className="t">{title}</div>
      {children && <p style={{ margin: '6px 0 0', lineHeight: 1.6 }}>{children}</p>}
      {action && <div style={{ marginTop: 14 }}>{action}</div>}
    </div>
  );
}

export function Pill({ tone, children }: { tone: string; children: React.ReactNode }) {
  return <span className={'pill ' + tone}>{children}</span>;
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return <div className="a-hint" style={{ padding: '30px 0' }} aria-busy="true">{label}</div>;
}

export function ErrorBox({ message, retry }: { message: string; retry?: () => void }) {
  return (
    <div className="a-empty" role="alert" style={{ borderColor: 'rgba(155,44,29,.35)' }}>
      <div className="t">Couldn’t load this</div>
      <p style={{ margin: '6px 0 0' }}>{message}</p>
      {retry && <button className="a-btn line" style={{ marginTop: 12 }} onClick={retry}>Try again</button>}
    </div>
  );
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return '';
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  const d = Math.floor(s / 86400);
  return d === 1 ? 'yesterday' : d < 30 ? `${d} days ago` : new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export function daysUntil(day: string | null | undefined): number | null {
  if (!day) return null;
  const [y, m, d] = day.split('-').map(Number);
  const t = new Date(y, m - 1, d).getTime();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.round((t - today.getTime()) / 86400000);
}

export function inDays(n: number): string {
  if (n === 0) return 'today';
  if (n === 1) return 'tomorrow';
  if (n === -1) return 'yesterday';
  return n > 0 ? `in ${n} days` : `${-n} days ago`;
}

/* hand-off between screens ("Make quote" from an enquiry) */
export function setHandoff(key: string, value: unknown) {
  try { sessionStorage.setItem('bw.handoff.' + key, JSON.stringify(value)); } catch { /* ignore */ }
}
export function takeHandoff<T>(key: string): T | null {
  try {
    const v = sessionStorage.getItem('bw.handoff.' + key);
    sessionStorage.removeItem('bw.handoff.' + key);
    return v ? JSON.parse(v) : null;
  } catch { return null; }
}
