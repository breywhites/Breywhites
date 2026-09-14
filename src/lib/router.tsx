/* Minimal router: real paths in production (/work, /p/anjali-rohit),
   hash paths (#/work) when the host can't serve deep links. */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { config } from './config';

type Nav = { path: string; navigate: (to: string, opts?: { replace?: boolean }) => void };
const Ctx = createContext<Nav>({ path: '/', navigate: () => {} });

function currentPath(): string {
  if (config.router === 'hash') {
    const h = window.location.hash.replace(/^#/, '');
    return h.startsWith('/') ? h.split('?')[0] : '/';
  }
  return window.location.pathname || '/';
}

export function href(to: string): string {
  return config.router === 'hash' ? '#' + to : to;
}

export function Router({ children }: { children: React.ReactNode }) {
  const [path, setPath] = useState(currentPath);

  useEffect(() => {
    const on = () => setPath(currentPath());
    window.addEventListener('popstate', on);
    window.addEventListener('hashchange', on);
    return () => { window.removeEventListener('popstate', on); window.removeEventListener('hashchange', on); };
  }, []);

  const navigate = useCallback((to: string, opts: { replace?: boolean } = {}) => {
    const [p, anchor] = to.split('#');
    const target = p || '/';
    if (target !== currentPath()) {
      const url = href(target);
      if (opts.replace) window.history.replaceState(null, '', url); else window.history.pushState(null, '', url);
      setPath(target);
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    }
    if (anchor) scrollToId(anchor);
  }, []);

  const value = useMemo(() => ({ path, navigate }), [path, navigate]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function scrollToId(id: string, tries = 20) {
  const el = document.getElementById(id);
  if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
  if (tries > 0) setTimeout(() => scrollToId(id, tries - 1), 60);
}

export function useRoute() { return useContext(Ctx); }

export function match(pattern: string, path: string): Record<string, string> | null {
  const a = pattern.split('/').filter(Boolean);
  const b = path.split('/').filter(Boolean);
  if (a.length !== b.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith(':')) params[a[i].slice(1)] = decodeURIComponent(b[i]);
    else if (a[i] !== b[i]) return null;
  }
  return params;
}

type LinkProps = React.AnchorHTMLAttributes<HTMLAnchorElement> & { to: string };

/** Internal link. "/#dates" scrolls to a homepage section, from any page. */
export function Link({ to, onClick, ...rest }: LinkProps) {
  const { navigate } = useRoute();
  const [p, anchor] = to.split('#');
  const url = config.router === 'hash' ? href(p || '/') : to;
  return (
    <a
      href={url}
      {...rest}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        navigate((p || '/') + (anchor ? '#' + anchor : ''));
      }}
    />
  );
}
