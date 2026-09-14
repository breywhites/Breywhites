/* Quote & invoice documents: drawn straight onto a canvas (no libraries),
   saved as JPG, or wrapped into a single-page PDF, then shared. */
import type { BusinessSettingsRow, InvoiceRow, LineItem, PaymentRow, QuoteRow, SiteSettingsRow } from './models';
import { lineTotals } from './models';
import { fmtDay, inr } from './format';

const INK = '#17130f', MUTED = '#8b8577', FAINT = '#b3ac9d', BG = '#faf8f4', RULE = 'rgba(23,19,15,0.16)', ACCENT = '#8a4a2f';
const SERIF = '"Instrument Serif", Georgia, serif';
const SANS = '"Space Grotesk", system-ui, sans-serif';

export type DocInput =
  | { kind: 'quote'; doc: QuoteRow }
  | { kind: 'invoice'; doc: InvoiceRow; payments: PaymentRow[] };

function capText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color: string, align: 'left' | 'right' = 'left') {
  const spacing = size * 0.2;
  ctx.font = `500 ${size}px ${SANS}`;
  ctx.fillStyle = color; ctx.textAlign = 'left';
  const chars = String(text).toUpperCase().split('');
  const ws = chars.map((c) => ctx.measureText(c).width);
  const w = ws.reduce((a, b) => a + b, 0) + spacing * Math.max(0, chars.length - 1);
  let cx = align === 'right' ? x - w : x;
  chars.forEach((c, i) => { ctx.fillText(c, cx, y); cx += ws[i] + spacing; });
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines: string[] = []; let line = '';
  words.forEach((w) => {
    const t = line ? line + ' ' + w : w;
    if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t;
  });
  if (line) lines.push(line);
  return lines;
}

function paint(ctx: CanvasRenderingContext2D, input: DocInput, site: SiteSettingsRow, biz: BusinessSettingsRow, draw: boolean, H: number): number {
  const W = 620, M = 44, RX = W - M, LX = 350;
  const d = input.doc;
  const isInv = input.kind === 'invoice';
  const T = (txt: string | null | undefined, x: number, y: number, font: string, color: string, align: CanvasTextAlign = 'left') => {
    if (!draw || !txt) return;
    ctx.font = font; ctx.fillStyle = color; ctx.textAlign = align; ctx.fillText(txt, x, y);
  };
  const cap = (txt: string, x: number, y: number, size: number, color: string, align: 'left' | 'right' = 'left') => { if (draw) capText(ctx, txt, x, y, size, color, align); };
  const rule = (y: number, x0 = M, x1 = RX, color = RULE, h = 0.75) => { if (draw) { ctx.fillStyle = color; ctx.fillRect(x0, y, x1 - x0, h); } };
  ctx.textBaseline = 'alphabetic';
  if (draw) { ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H); }

  let y = 66;
  T(site.studio_name, M, y, `italic 27px ${SERIF}`, INK);
  cap(isInv ? 'Invoice' : 'Quotation', RX, y - 9, 8, ACCENT, 'right');
  y += 20;
  cap('Wedding photography & films', M, y, 6.5, FAINT);
  T(d.number, RX, y, `400 10px ${SANS}`, INK, 'right');
  y += 24; rule(y);

  y += 32;
  cap(isInv ? 'Billed to' : 'Prepared for', M, y, 6.5, FAINT);
  cap(isInv ? 'Issued' : 'Date', LX, y, 6.5, FAINT);
  cap(isInv ? 'Due' : 'Valid until', 468, y, 6.5, FAINT);
  y += 27;
  let nameSize = 25;
  ctx.font = `italic ${nameSize}px ${SERIF}`;
  while (nameSize > 14 && ctx.measureText(d.client_name).width > LX - M - 16) { nameSize -= 1; ctx.font = `italic ${nameSize}px ${SERIF}`; }
  T(d.client_name, M, y, `italic ${nameSize}px ${SERIF}`, INK);
  const issued = isInv ? fmtDay((d as InvoiceRow).issued_on) : fmtDay(d.created_at.slice(0, 10));
  const second = isInv ? fmtDay((d as InvoiceRow).due_on) : fmtDay((d as QuoteRow).valid_until);
  T(issued, LX, y - 5, `400 10.5px ${SANS}`, INK);
  T(second || '—', 468, y - 5, `400 10.5px ${SANS}`, INK);
  if (d.phone) { y += 18; T(d.phone, M, y, `400 10px ${SANS}`, MUTED); }
  const eventLine = [d.event_date ? 'Event date ' + fmtDay(d.event_date) : '', d.venue || ''].filter(Boolean).join('  ·  ');
  if (eventLine) { y += 16; T(eventLine, M, y, `400 10px ${SANS}`, MUTED); }

  y += 40;
  cap('Package', M, y, 6.5, FAINT);
  cap('Amount', RX, y, 6.5, FAINT, 'right');
  y += 11; rule(y);

  const items: LineItem[] = d.items || [];
  items.forEach((it, i) => {
    y += 27;
    T(String(i + 1).padStart(2, '0'), M, y - 2, `500 8.5px ${SANS}`, ACCENT);
    ctx.font = `italic 17.5px ${SERIF}`;
    T(it.name, M + 26, y, `italic 17.5px ${SERIF}`, INK);
    T(inr(it.price * it.qty), RX, y, `400 11px ${SANS}`, INK, 'right');
    if (it.qty > 1) T(`${it.qty} × ${inr(it.price)}`, RX, y + 14, `400 9px ${SANS}`, FAINT, 'right');
    ctx.font = `300 9.5px ${SANS}`;
    wrap(ctx, it.description, 380).slice(0, 4).forEach((l) => { y += 14.5; T(l, M + 26, y, `300 9.5px ${SANS}`, MUTED); });
    y += 15; rule(y);
  });

  const { subtotal, discount, total } = lineTotals(items, d.discount);
  y += 10;
  const row = (label: string, val: string, color = INK, weight = 400) => { y += 21; cap(label, LX, y, 6.5, FAINT); T(val, RX, y, `${weight} 11px ${SANS}`, color, 'right'); };
  row('Subtotal', inr(subtotal));
  if (discount > 0) row('Discount', '− ' + inr(discount), ACCENT);
  y += 14; rule(y, LX, RX, INK, 1);
  y += 36;
  cap('Total', LX, y - 7, 7.5, INK);
  T(inr(total), RX, y, `italic 32px ${SERIF}`, INK, 'right');

  if (input.kind === 'quote') {
    const adv = Math.round(total * (input.doc.advance_percent || 0) / 100);
    if (adv > 0) row(`Advance (${input.doc.advance_percent}%)`, inr(adv), ACCENT, 500);
  } else {
    const inv = input.doc;
    y += 4;
    input.payments.slice().sort((a, b) => a.paid_on.localeCompare(b.paid_on)).forEach((p) => {
      row(`Paid ${fmtDay(p.paid_on)}`, '− ' + inr(p.amount), MUTED);
    });
    const balance = Math.max(0, inv.total - inv.paid);
    y += 8; rule(y + 6, LX, RX);
    y += 6;
    row(inv.status === 'cancelled' ? 'Cancelled' : balance === 0 ? 'Paid in full' : 'Balance due', inr(balance), balance === 0 ? INK : ACCENT, 500);
  }

  const terms = d.terms || '';
  const payInfo = input.kind === 'invoice' ? [biz.upi_id ? `UPI: ${biz.upi_id}` : '', biz.bank_details || ''].filter(Boolean).join('\n') : '';
  if (payInfo) {
    y += 44;
    cap('How to pay', M, y, 6.5, FAINT);
    y += 4;
    ctx.font = `400 10px ${SANS}`;
    payInfo.split('\n').forEach((p) => wrap(ctx, p, RX - M).forEach((l) => { y += 15; T(l, M, y, `400 10px ${SANS}`, INK); }));
  }
  if (terms) {
    y += payInfo ? 30 : 46;
    cap('Terms', M, y, 6.5, FAINT);
    y += 4;
    ctx.font = `300 9.5px ${SANS}`;
    terms.split('\n').forEach((p) => wrap(ctx, p, RX - M).forEach((l) => { y += 15; T(l, M, y, `300 9.5px ${SANS}`, MUTED); }));
  }

  y += 42; rule(y);
  y += 32;
  T('Thank you — we would love to be part of your day.', M, y, `italic 16px ${SERIF}`, INK);
  y += 20;
  T([site.phones.join(' / '), site.instagram ? `ig: ${site.instagram}` : '', site.email].filter(Boolean).join('  ·  '), M, y, `400 9.5px ${SANS}`, MUTED);
  y += 44;
  return Math.max(Math.ceil(y), Math.round(W * 1.4142));
}

export async function renderDocJpeg(input: DocInput, site: SiteSettingsRow, biz: BusinessSettingsRow) {
  try {
    await Promise.all([`italic 27px "Instrument Serif"`, `500 10px "Space Grotesk"`, `400 10px "Space Grotesk"`, `300 10px "Space Grotesk"`].map((f) => (document as any).fonts.load(f)));
  } catch { /* system fonts */ }
  const S = 2, W = 620;
  const measure = document.createElement('canvas').getContext('2d')!;
  const H = paint(measure, input, site, biz, false, 0);
  const c = document.createElement('canvas');
  c.width = W * S; c.height = H * S;
  const ctx = c.getContext('2d')!;
  ctx.scale(S, S);
  paint(ctx, input, site, biz, true, H);
  const dataUrl = c.toDataURL('image/jpeg', 0.9);
  return { dataUrl, w: c.width, h: c.height };
}

export function dataUrlToBlob(url: string): Blob {
  const [head, b64] = url.split(',');
  const mime = (head.match(/data:([^;]+)/) || [])[1] || 'application/octet-stream';
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export function jpegToPdf(jpegDataUrl: string, wPx: number, hPx: number): Blob {
  const img = atob(jpegDataUrl.split(',')[1]);
  const pw = 595.28, ph = +(pw * hPx / wPx).toFixed(2);
  const content = `q ${pw} 0 0 ${ph} 0 0 cm /Im0 Do Q`;
  let out = '%PDF-1.4\n%âãÏÓ\n';
  const offs: number[] = [];
  const add = (n: number, body: string) => { offs[n] = out.length; out += `${n} 0 obj\n${body}\nendobj\n`; };
  add(1, '<< /Type /Catalog /Pages 2 0 R >>');
  add(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  add(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pw} ${ph}] /Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>`);
  add(4, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  add(5, `<< /Type /XObject /Subtype /Image /Width ${wPx} /Height ${hPx} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${img.length} >>\nstream\n${img}\nendstream`);
  const xref = out.length;
  out += 'xref\n0 6\n0000000000 65535 f \n' + [1, 2, 3, 4, 5].map((n) => String(offs[n]).padStart(10, '0') + ' 00000 n \n').join('');
  out += `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  const bytes = new Uint8Array(out.length);
  for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 255;
  return new Blob([bytes], { type: 'application/pdf' });
}

/** Phone: opens the share sheet (WhatsApp, Gmail, Files). Laptop: downloads the file. */
export async function shareOrDownload(blob: Blob, filename: string): Promise<'shared' | 'cancelled' | 'downloaded'> {
  try {
    const file = new File([blob], filename, { type: blob.type });
    const nav = navigator as any;
    if (nav.canShare && nav.canShare({ files: [file] }) && /Android|iPhone|iPad/i.test(navigator.userAgent)) {
      await nav.share({ files: [file], title: filename });
      return 'shared';
    }
  } catch (e: any) {
    if (e && e.name === 'AbortError') return 'cancelled';
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return 'downloaded';
}

export function docFilename(input: DocInput, ext: 'jpg' | 'pdf') {
  const who = input.doc.client_name.replace(/&/g, 'and').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 30) || 'client';
  return `${input.doc.number}-${who}.${ext}`;
}
