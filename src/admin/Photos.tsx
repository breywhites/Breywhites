import React, { useMemo, useRef, useState } from 'react';
import type { PhotoRow } from '../lib/models';
import { store } from '../lib/store';
import type { Category } from '../lib/types';
import { CATEGORY_LABELS } from '../lib/types';
import { IconClose, IconDown, IconImage, IconPlus, IconTrash, IconUp } from '../site/Icons';
import { useAdmin } from './AdminApp';
import { deletePhoto, listPhotos, reorder, saveSite, updatePhoto, uploadPhotos } from './data';
import { Chips, Empty, ErrorBox, errorText, Field, Loading, PageHead, Sheet, Toggle, useAsync, useConfirm, useToast } from './ui';

const CATS = Object.keys(CATEGORY_LABELS) as Category[];

export function Photos() {
  const { site, reloadSettings } = useAdmin();
  const toast = useToast();
  const confirm = useConfirm();
  const photos = useAsync(listPhotos, []);
  const [tab, setTab] = useState<'all' | 'slideshow' | 'home'>('all');
  const [cat, setCat] = useState<Category | 'all'>('all');
  const [edit, setEdit] = useState<PhotoRow | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number; name: string } | null>(null);
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const all = photos.data || [];
  const slides = useMemo(() => all.filter((p) => p.in_slideshow).sort((a, b) => a.slide_order - b.slide_order), [all]);
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    all.forEach((p) => { c[p.category] = (c[p.category] || 0) + 1; });
    return c;
  }, [all]);
  const list = tab === 'home' ? all.filter((p) => p.featured) : all.filter((p) => cat === 'all' || p.category === cat);

  const upload = async (files: FileList | File[] | null) => {
    const arr = Array.from(files || []).filter((f) => f.type.startsWith('image/'));
    if (!arr.length) return;
    const category: Category = cat === 'all' ? 'wedding' : cat;
    setProgress({ done: 0, total: arr.length, name: '' });
    try {
      const { added, failed } = await uploadPhotos(arr, category, (done, total, name) => setProgress({ done, total, name }));
      photos.setData((d) => [...(d || []), ...added]);
      toast(failed.length ? `${added.length} added, ${failed.length} couldn’t be read` : `${added.length} ${added.length === 1 ? 'photo' : 'photos'} added to ${CATEGORY_LABELS[category]}`, failed.length ? 'err' : 'ok');
    } catch (e) { toast(errorText(e), 'err'); }
    finally { setProgress(null); if (input.current) input.current.value = ''; }
  };

  const patch = async (p: PhotoRow, change: Partial<PhotoRow>) => {
    if (change.in_slideshow && !p.in_slideshow) change.slide_order = (slides[slides.length - 1]?.slide_order || 0) + 1;
    const next = { ...p, ...change };
    photos.setData((d) => d?.map((x) => (x.id === p.id ? next : x)));
    if (edit?.id === p.id) setEdit(next);
    try { await updatePhoto(p.id, change); }
    catch (e) { photos.setData((d) => d?.map((x) => (x.id === p.id ? p : x))); toast(errorText(e), 'err'); }
  };

  const moveSlide = async (i: number, d: number) => {
    const arr = slides.slice();
    const j = i + d;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    const withOrder = arr.map((p, k) => ({ ...p, slide_order: k + 1 }));
    photos.setData((cur) => cur?.map((x) => withOrder.find((w) => w.id === x.id) || x));
    try { await reorder('photos', withOrder, 'slide_order'); } catch (e) { toast(errorText(e), 'err'); photos.reload(); }
  };

  const remove = async (p: PhotoRow) => {
    if (!(await confirm({ title: 'Delete this photo?', body: 'It will be removed from the website and the portfolio.', ok: 'Delete', danger: true }))) return;
    try { await deletePhoto(p); photos.setData((d) => d?.filter((x) => x.id !== p.id)); setEdit(null); toast('Photo deleted'); }
    catch (e) { toast(errorText(e), 'err'); }
  };

  const setSpeed = async (s: number) => {
    try { await saveSite({ slideshow_seconds: s }); await reloadSettings(); toast(`Slideshow changes every ${s} seconds`); }
    catch (e) { toast(errorText(e), 'err'); }
  };

  return (
    <div className="a-wrap">
      <PageHead title="Photos" sub={`${all.length} photos · ${slides.length} in the slideshow`}
        actions={<button className="a-btn dark" onClick={() => input.current?.click()} disabled={!!progress}><IconPlus size={15} /> Add photos</button>} />
      <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => upload(e.target.files)} />

      <Chips label="View" value={tab} onChange={setTab} options={[
        { value: 'all', label: 'Portfolio', n: all.length },
        { value: 'slideshow', label: 'Slideshow', n: slides.length },
        { value: 'home', label: 'Homepage gallery', n: all.filter((p) => p.featured).length },
      ]} />

      {progress && (
        <div className="a-card a-pad" style={{ marginTop: 12 }} role="status">
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
            <span>Uploading {Math.min(progress.done + 1, progress.total)} of {progress.total}…</span><span className="a-hint">{progress.name}</span>
          </div>
          <div className="a-progress" style={{ marginTop: 8 }}><i style={{ width: `${(progress.done / progress.total) * 100}%` }} /></div>
          <div className="a-hint" style={{ marginTop: 6 }}>Photos are resized on your phone first, so uploads stay quick.</div>
        </div>
      )}

      {photos.error && <ErrorBox message={photos.error} retry={photos.reload} />}
      {photos.loading && !photos.data && <Loading />}

      {tab === 'slideshow' && photos.data && (
        <div style={{ marginTop: 14 }}>
          <div className="a-card a-pad">
            <div className="a-label">Change photo every</div>
            <div className="a-chips" style={{ marginTop: 8 }}>
              {[2, 3, 4, 5, 6].map((s) => <button key={s} className={'a-chip' + (s === site.slideshow_seconds ? ' on' : '')} onClick={() => setSpeed(s)}>{s} sec</button>)}
            </div>
          </div>
          <p className="a-hint">The first photo shows when the website opens — put your strongest image on top. Tall photos look best on phones.</p>
          {slides.length === 0 ? <Empty title="No slideshow photos">Open any photo and switch on “In the slideshow”.</Empty> : (
            <div className="a-list">
              {slides.map((p, i) => (
                <div key={p.id} className="a-row">
                  <span className="a-hint num" style={{ width: 20 }}>{i + 1}</span>
                  <img src={store.publicUrl(p.path_thumb)} alt="" style={{ width: 56, height: 70, objectFit: 'cover', background: 'var(--ph)' }} />
                  <div className="grow"><div className="title">{p.title || CATEGORY_LABELS[p.category]}</div><div className="meta">{i === 0 ? 'Shows first' : CATEGORY_LABELS[p.category]}</div></div>
                  <div className="a-move">
                    <button className="a-icon" onClick={() => moveSlide(i, -1)} disabled={i === 0} aria-label="Move up"><IconUp size={17} /></button>
                    <button className="a-icon" onClick={() => moveSlide(i, 1)} disabled={i === slides.length - 1} aria-label="Move down"><IconDown size={17} /></button>
                  </div>
                  <button className="a-icon" onClick={() => patch(p, { in_slideshow: false })} aria-label="Take out of the slideshow" title="Take out of the slideshow"><IconClose size={17} /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab !== 'slideshow' && photos.data && (
        <div style={{ marginTop: 12 }}>
          {tab === 'all' && (
            <Chips label="Category" value={cat} onChange={setCat}
              options={[{ value: 'all' as const, label: 'All' }, ...CATS.map((c) => ({ value: c, label: CATEGORY_LABELS[c], n: counts[c] || 0 }))]} />
          )}
          {tab === 'home' && <p className="a-hint">These show in “Recent weddings” on your homepage, in this order.</p>}
          <div className={'a-drop' + (over ? ' over' : '')} style={{ margin: '12px 0' }}
            onClick={() => input.current?.click()} role="button" tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter') input.current?.click(); }}
            onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
            onDrop={(e) => { e.preventDefault(); setOver(false); upload(e.dataTransfer.files); }}>
            <IconImage size={22} />
            <div style={{ marginTop: 6 }}>Tap to add photos{cat !== 'all' && tab === 'all' ? ` to ${CATEGORY_LABELS[cat]}` : ''}</div>
            <div className="a-hint">You can pick many at once</div>
          </div>
          {list.length === 0 ? <Empty title="No photos here yet" /> : (
            <div className="a-photos">
              {list.map((p) => (
                <button key={p.id} className={'a-ph' + (p.published ? '' : ' hidden')} onClick={() => setEdit(p)} aria-label={`Edit ${p.title || 'photo'}`}>
                  <img src={store.publicUrl(p.path_thumb)} alt="" loading="lazy" decoding="async" />
                  <span className="tags">
                    {p.in_slideshow && <span className="tag">Slide</span>}
                    {p.featured && <span className="tag">Home</span>}
                    {!p.published && <span className="tag">Hidden</span>}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {edit && (
        <Sheet open onClose={() => setEdit(null)} title="Photo"
          footer={<><button className="a-btn danger" onClick={() => remove(edit)}><IconTrash size={15} /> Delete</button><button className="a-btn dark" onClick={() => setEdit(null)}>Done</button></>}>
          <img src={store.publicUrl(edit.path_thumb)} alt="" style={{ width: '100%', height: '26vh', objectFit: 'contain', background: 'var(--ph)' }} />
          <div className="a-grid" style={{ marginTop: 14 }}>
            <Field id="ph-title" label="Title (optional)">
              <input className="a-inp" defaultValue={edit.title || ''} onBlur={(e) => { const v = e.target.value.trim() || null; if (v !== edit.title) patch(edit, { title: v }); }} placeholder="e.g. First look" />
            </Field>
            <Field id="ph-cat" label="Category">
              <select className="a-inp" value={edit.category} onChange={(e) => patch(edit, { category: e.target.value as Category })}>
                {CATS.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
              </select>
            </Field>
          </div>
          <div style={{ marginTop: 8 }}>
            <Toggle label="Show in portfolio" sub="Visible on the Work page" checked={edit.published} onChange={(v) => patch(edit, { published: v })} />
            <Toggle label="Homepage gallery" sub="Shows in “Recent weddings”" checked={edit.featured} onChange={(v) => patch(edit, { featured: v })} />
            <Toggle label="In the slideshow" sub="The big photos at the top of the homepage" checked={edit.in_slideshow} onChange={(v) => patch(edit, { in_slideshow: v })} />
          </div>
        </Sheet>
      )}
    </div>
  );
}
