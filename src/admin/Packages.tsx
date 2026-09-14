import React, { useState } from 'react';
import { inr } from '../lib/format';
import type { PackageRow } from '../lib/models';
import { IconDown, IconPlus, IconTrash, IconUp } from '../site/Icons';
import { deletePackage, listPackages, reorder, savePackage } from './data';
import { Empty, ErrorBox, errorText, Field, Loading, PageHead, Pill, Sheet, Toggle, useAsync, useConfirm, useToast } from './ui';

type Draft = { id?: string; name: string; short_name: string; kicker: string; price: string; team: string; team_sub: string; items: string; extra: string; active: boolean; sort?: number };

const toDraft = (p?: PackageRow): Draft => ({
  id: p?.id, name: p?.name || '', short_name: p?.short_name || '', kicker: p?.kicker || '', price: p ? String(p.price) : '',
  team: p?.team || '', team_sub: p?.team_sub || '', items: (p?.items || []).join('\n'), extra: p?.extra || '', active: p?.active ?? true, sort: p?.sort,
});

export function Packages() {
  const toast = useToast();
  const confirm = useConfirm();
  const packs = useAsync(listPackages, []);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const list = packs.data || [];

  const move = async (i: number, d: number) => {
    const arr = list.slice();
    const j = i + d;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    packs.setData(arr.map((p, k) => ({ ...p, sort: k + 1 })));
    try { await reorder('packages', arr, 'sort'); } catch (e) { toast(errorText(e), 'err'); packs.reload(); }
  };

  const save = async () => {
    if (!draft) return;
    const price = Number(draft.price.replace(/[^0-9]/g, ''));
    if (!draft.name.trim()) { toast('Add a package name', 'err'); return; }
    if (!price) { toast('Add a price', 'err'); return; }
    setBusy(true);
    try {
      await savePackage({ ...draft, price, items: draft.items.split('\n'), sort: draft.sort ?? list.length + 1 });
      toast(draft.id ? 'Package saved — price page and quotes use it right away' : 'Package added');
      setDraft(null);
      packs.reload();
    } catch (e) { toast(errorText(e), 'err'); }
    finally { setBusy(false); }
  };

  const remove = async () => {
    if (!draft?.id) return;
    if (!(await confirm({ title: `Delete ${draft.name}?`, body: 'Old quotes keep their copy. To stop offering it for now, switch it off instead.', ok: 'Delete', danger: true }))) return;
    try { await deletePackage(draft.id); setDraft(null); packs.reload(); toast('Package deleted'); }
    catch (e) { toast(errorText(e), 'err'); }
  };

  const set = (k: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDraft((d) => d && { ...d, [k]: e.target.value });

  return (
    <div className="a-wrap">
      <PageHead title="Packages" sub="Used on price links and in quotes. The website shows names only, never prices."
        actions={<button className="a-btn dark" onClick={() => setDraft(toDraft())}><IconPlus size={15} /> Add package</button>} />

      {packs.error && <ErrorBox message={packs.error} retry={packs.reload} />}
      {packs.loading && !packs.data && <Loading />}
      {packs.data && list.length === 0 && <Empty title="No packages yet" action={<button className="a-btn dark" onClick={() => setDraft(toDraft())}>Add your first package</button>} />}

      <div className="a-list">
        {list.map((p, i) => (
          <div key={p.id} className="a-row">
            <button className="grow" style={{ textAlign: 'left' }} onClick={() => setDraft(toDraft(p))}>
              <div className="title">{p.name}</div>
              <div className="meta">{p.items.slice(0, 3).join(' · ')}</div>
            </button>
            <div className="amt">
              <div className="num" style={{ fontSize: 16 }}>{inr(p.price)}</div>
              {!p.active && <Pill tone="muted">Off</Pill>}
            </div>
            <div className="a-move">
              <button className="a-icon" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${p.name} up`}><IconUp size={17} /></button>
              <button className="a-icon" onClick={() => move(i, 1)} disabled={i === list.length - 1} aria-label={`Move ${p.name} down`}><IconDown size={17} /></button>
            </div>
          </div>
        ))}
      </div>

      {draft && (
        <Sheet open onClose={() => setDraft(null)} title={draft.id ? 'Edit package' : 'New package'}
          footer={<>{draft.id && <button className="a-btn danger" onClick={remove}><IconTrash size={15} /></button>}
            <button className="a-btn line" onClick={() => setDraft(null)}>Cancel</button>
            <button className="a-btn dark" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save'}</button></>}>
          <div className="a-grid">
            <div className="a-grid two">
              <Field id="pk-name" label="Package name"><input className="a-inp" value={draft.name} onChange={set('name')} placeholder="e.g. Classic Wedding" /></Field>
              <Field id="pk-price" label="Price (₹)"><input className="a-inp num" inputMode="numeric" value={draft.price} onChange={set('price')} placeholder="42000" /></Field>
            </div>
            <div className="a-grid two">
              <Field id="pk-short" label="Short name" hint="For the tabs on the price page"><input className="a-inp" value={draft.short_name} onChange={set('short_name')} placeholder="Classic" /></Field>
              <Field id="pk-kicker" label="Label" hint="Small line above the name"><input className="a-inp" value={draft.kicker} onChange={set('kicker')} placeholder="Wedding · Classic" /></Field>
            </div>
            <div className="a-grid two">
              <Field id="pk-team" label="Team"><input className="a-inp" value={draft.team} onChange={set('team')} placeholder="2 professional cameramen" /></Field>
              <Field id="pk-teamsub" label="Team details"><input className="a-inp" value={draft.team_sub} onChange={set('team_sub')} placeholder="1 videographer · 1 photographer" /></Field>
            </div>
            <Field id="pk-items" label="What’s included" hint="One item per line">
              <textarea className="a-inp" rows={5} value={draft.items} onChange={set('items')} placeholder={'Unlimited photos\n3 videos\n2 reels · 30–45 sec each'} />
            </Field>
            <Field id="pk-extra" label="Highlight (optional)" hint="What makes this package different"><input className="a-inp" value={draft.extra} onChange={set('extra')} placeholder="Includes a 2-hour pre-wedding shoot" /></Field>
            <Toggle label="Offer this package" sub="Switch off to hide it from new price links" checked={draft.active} onChange={(v) => setDraft({ ...draft, active: v })} />
          </div>
        </Sheet>
      )}
    </div>
  );
}
