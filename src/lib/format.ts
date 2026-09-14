export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function inr(n: number): string {
  return '₹' + Math.round(n || 0).toLocaleString('en-IN');
}

export function inrShort(n: number): string {
  return n >= 100000 ? '₹' + (n / 100000).toFixed(n % 100000 ? 1 : 0) + 'L' : '₹' + Math.round(n / 1000) + 'k';
}

/** yyyy-mm-dd → Date at local midnight */
export function parseDay(s: string | null | undefined): Date | null {
  if (!s) return null;
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

export function toDay(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function fmtDay(s: string | null | undefined): string {
  const d = parseDay(s);
  return d ? `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}` : '';
}

export function digits(s: string): string {
  return (s || '').replace(/[^0-9]/g, '');
}

/** WhatsApp link; Indian 10-digit numbers get the 91 prefix */
export function waLink(number: string, text?: string): string {
  let n = digits(number);
  if (n.length === 10) n = '91' + n;
  return `https://wa.me/${n}` + (text ? `?text=${encodeURIComponent(text)}` : '');
}

export function telLink(number: string): string {
  const n = digits(number);
  return 'tel:' + (n.length === 10 ? '+91' + n : '+' + n);
}

export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}
