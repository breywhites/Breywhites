/* Scroll-driven motion helpers. Values are written straight to CSS variables,
   so scrolling never re-renders React. */
import { useEffect, useRef } from 'react';

export const reducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** 0 when the element's top enters from below, 1 when its bottom leaves the top */
export function travel(el: Element): number {
  const r = el.getBoundingClientRect();
  const vh = window.innerHeight;
  return clamp((vh - r.top) / (vh + r.height), 0, 1);
}

/** progress through a tall pinned section: 0 at its top, 1 when its end meets the screen bottom */
export function pinned(el: Element): number {
  const r = el.getBoundingClientRect();
  const span = r.height - window.innerHeight;
  return span > 0 ? clamp(-r.top / span, 0, 1) : 0;
}

type FrameFn = (scrollY: number) => void;
const frames = new Set<FrameFn>();
let ticking = false;

function run() {
  ticking = false;
  const y = window.scrollY || document.documentElement.scrollTop;
  frames.forEach((f) => f(y));
}
function request() {
  if (!ticking) { ticking = true; requestAnimationFrame(run); }
}
if (typeof window !== 'undefined') {
  window.addEventListener('scroll', request, { passive: true });
  window.addEventListener('resize', request);
}

/** Call fn on every scroll frame while mounted. */
export function useScrollFrame(fn: FrameFn, deps: unknown[] = []) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    if (reducedMotion()) return;
    const f: FrameFn = (y) => ref.current(y);
    frames.add(f);
    request();
    return () => { frames.delete(f); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/** Adds data-in="1" to the element once it scrolls into view. */
export function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reducedMotion() || typeof IntersectionObserver === 'undefined') { el.dataset.in = '1'; return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { (e.target as HTMLElement).dataset.in = '1'; io.disconnect(); } });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.05 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return ref;
}
