/* Shrinks photos in the browser before upload: a 6 MB camera JPEG becomes
   a ~300 KB large version and a ~60 KB thumbnail. */

export interface Compressed { blob: Blob; width: number; height: number; type: string }

function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('This file isn’t a photo we can read')); };
    img.src = url;
  });
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), type, quality));
}

export async function compress(file: Blob, maxSide: number, quality = 0.78): Promise<Compressed> {
  const img = await loadImage(file);
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, w, h);
  let blob = await toBlob(canvas, 'image/webp', quality);
  let type = 'image/webp';
  if (!blob || blob.type !== 'image/webp') { blob = await toBlob(canvas, 'image/jpeg', quality); type = 'image/jpeg'; }
  if (!blob) throw new Error('Couldn’t process this photo');
  return { blob, width: w, height: h, type };
}

export async function photoVersions(file: File) {
  const large = await compress(file, 1600, 0.8);
  const thumb = await compress(file, 640, 0.74);
  return { large, thumb };
}
