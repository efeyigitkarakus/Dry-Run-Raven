/** Akış şeması paleti ve PNG dışa aktarma yardımcıları. */

import type { FlowPalette } from './svg';

function readVar(cs: CSSStyleDeclaration, name: string): string {
  const v = cs.getPropertyValue(name).trim();
  const m = /^var\((--[\w-]+)\)$/.exec(v);
  return m ? cs.getPropertyValue(m[1]).trim() : v;
}

export function resolvePalette(): FlowPalette {
  const cs = getComputedStyle(document.documentElement);
  return {
    bg: readVar(cs, '--bg'),
    border: readVar(cs, '--border'),
    text: readVar(cs, '--text'),
    muted: readVar(cs, '--text-muted'),
    accent: readVar(cs, '--accent'),
    accentSoft: readVar(cs, '--accent-soft'),
  };
}

export async function svgToPng(svg: string, scale = 2): Promise<Uint8Array> {
  const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);
  try {
    const img = new Image();
    img.decoding = 'async';
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('svg'));
      img.src = url;
    });
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas');
    ctx.drawImage(img, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('png');
    return new Uint8Array(await blob.arrayBuffer());
  } finally {
    URL.revokeObjectURL(url);
  }
}
