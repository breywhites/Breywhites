import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { SiteData } from '../lib/types';

export function useSiteData(enabled = true) {
  const [data, setData] = useState<SiteData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    api.getSiteData()
      .then((d) => { if (alive) { setData(d); setError(null); } })
      .catch((e) => { if (alive) setError(e?.message || 'Could not load'); });
    return () => { alive = false; };
  }, [attempt, enabled]);

  return { data, error, retry: () => setAttempt((a) => a + 1) };
}

export function useDocumentTitle(title: string, noindex = false) {
  useEffect(() => {
    document.title = title;
    let meta = document.querySelector('meta[name="robots"]') as HTMLMetaElement | null;
    if (noindex) {
      if (!meta) { meta = document.createElement('meta'); meta.name = 'robots'; document.head.appendChild(meta); }
      meta.content = 'noindex, nofollow';
    } else if (meta) {
      meta.content = 'index, follow';
    }
  }, [title, noindex]);
}
