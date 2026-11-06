import type { Appearance } from '../sim/save';

export const HAIR = ['#f4f6f8', '#241c18', '#7a4b2a', '#e2b23a', '#c44747', '#3c8f4a', '#3d62c4', '#e07098'];
export const SKIN = ['#f6c8a4', '#e0a878', '#c4845a', '#8d5a3c'];
export const OUTFIT = ['#2f9a45', '#1f8f88', '#c44848', '#d0a040'];
export const STYLES = ['fluff', 'cap', 'ribbon'] as const;

const HAIR_KEY = [
  [255, 0, 255],
  [255, 153, 255],
  [204, 0, 204],
];
const OUTFIT_KEY = [
  [0, 224, 224],
  [0, 153, 170],
];

function shade(hexColor: string, index: number): [number, number, number] {
  const n = Number.parseInt(hexColor.slice(1), 16);
  let r = (n >> 16) & 255;
  let g = (n >> 8) & 255;
  let b = n & 255;
  const delta = index === 0 ? 28 : index === 1 ? -28 : 0;
  r = Math.max(0, Math.min(255, r + delta));
  g = Math.max(0, Math.min(255, g + delta));
  b = Math.max(0, Math.min(255, b + delta));
  return [r, g, b];
}

function near(r: number, g: number, b: number, key: number[]): boolean {
  return Math.abs(r - key[0]) < 18 && Math.abs(g - key[1]) < 18 && Math.abs(b - key[2]) < 18;
}

export function recolorSheet(source: HTMLImageElement | HTMLCanvasElement, look: Appearance): HTMLCanvasElement {
  const w = source instanceof HTMLImageElement ? source.naturalWidth || source.width : source.width;
  const h = source instanceof HTMLImageElement ? source.naturalHeight || source.height : source.height;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  ctx.drawImage(source, 0, 0);
  const image = ctx.getImageData(0, 0, w, h);
  const hair = shade(HAIR[look.hair % HAIR.length] ?? HAIR[0], 0);
  const hairDk = shade(HAIR[look.hair % HAIR.length] ?? HAIR[0], 1);
  const outfit = shade(OUTFIT[look.outfit % OUTFIT.length] ?? OUTFIT[0], 0);
  const outfitDk = shade(OUTFIT[look.outfit % OUTFIT.length] ?? OUTFIT[0], 1);
  const skin = shade(SKIN[look.skin % SKIN.length] ?? SKIN[0], 0);
  const data = image.data;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] ?? 0;
    const g = data[i + 1] ?? 0;
    const b = data[i + 2] ?? 0;
    if (data[i + 3] === 0) continue;
    let next: [number, number, number] | null = null;
    if (near(r, g, b, HAIR_KEY[0]) || near(r, g, b, HAIR_KEY[1])) next = hair;
    else if (near(r, g, b, HAIR_KEY[2])) next = hairDk;
    else if (near(r, g, b, OUTFIT_KEY[0])) next = outfit;
    else if (near(r, g, b, OUTFIT_KEY[1])) next = outfitDk;
    else if (r > 220 && g > 160 && b > 120 && r > b && g > b) {
      const dark = r < 236;
      next = dark ? shade(SKIN[look.skin % SKIN.length] ?? SKIN[0], 1) : skin;
    }
    if (!next) continue;
    data[i] = next[0];
    data[i + 1] = next[1];
    data[i + 2] = next[2];
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}
