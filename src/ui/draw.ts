import { drawText, pageLength, textWidth } from './font';

export function drawWindow(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  ctx.fillStyle = '#f8f8f8';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#102038';
  ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
  ctx.fillStyle = '#c8e4f8';
  ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
  ctx.fillStyle = '#3068a8';
  ctx.fillRect(x + 3, y + 3, w - 6, h - 6);
  ctx.fillStyle = '#3874b4';
  for (let row = y + 4; row < y + h - 4; row += 2) ctx.fillRect(x + 3, row, w - 6, 1);
  ctx.fillStyle = '#90c8ec';
  ctx.fillRect(x + 3, y + 3, w - 6, 1);
  ctx.fillRect(x + 3, y + 3, 1, h - 6);
}

export function drawCursor(ctx: CanvasRenderingContext2D, x: number, y: number, on: boolean): void {
  if (!on) return;
  ctx.fillStyle = '#f8f8f8';
  ctx.fillRect(x, y + 2, 2, 5);
  ctx.fillRect(x + 2, y + 3, 2, 3);
  ctx.fillRect(x + 4, y + 4, 2, 1);
}

export function drawShadowText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, fill = '#f8f8f8'): void {
  drawText(ctx, text, x + 1, y + 1, '#183058');
  drawText(ctx, text, x, y, fill);
}

export function drawRevealed(ctx: CanvasRenderingContext2D, lines: string[], shown: number, x: number, y: number): void {
  let left = shown;
  lines.forEach((line, index) => {
    const take = Math.max(0, Math.min(line.length, left));
    drawShadowText(ctx, line.slice(0, take), x, y + index * 14);
    left -= line.length;
  });
}

export function drawContinueArrow(ctx: CanvasRenderingContext2D, x: number, y: number, frame: number): void {
  if (Math.floor(frame / 12) % 2 === 0) return;
  ctx.fillStyle = '#f8f8f8';
  ctx.fillRect(x, y, 5, 1);
  ctx.fillRect(x + 1, y + 1, 3, 1);
  ctx.fillRect(x + 2, y + 2, 1, 1);
}

export function centeredX(text: string, scale = 1): number {
  return Math.round((240 - textWidth(text, scale)) / 2);
}

export { pageLength };

const CLOUDS: { x: number; y: number; speed: number; wide: boolean }[] = [
  { x: 10, y: 16, speed: 0.12, wide: false },
  { x: 90, y: 28, speed: 0.2, wide: true },
  { x: 170, y: 12, speed: 0.1, wide: false },
  { x: 40, y: 44, speed: 0.16, wide: true },
];

function cloud(ctx: CanvasRenderingContext2D, x: number, y: number, wide: boolean): void {
  ctx.fillStyle = '#f4fbff';
  const w = wide ? 34 : 22;
  ctx.fillRect(x + 4, y, w, 6);
  ctx.fillRect(x, y + 3, w + 8, 5);
  ctx.fillRect(x + 6, y - 3, w - 8, 4);
  ctx.fillStyle = '#d5ecf8';
  ctx.fillRect(x + 2, y + 6, w + 4, 2);
}

function hill(ctx: CanvasRenderingContext2D, color: string, base: number, amp: number, freq: number, phase: number): void {
  ctx.fillStyle = color;
  for (let x = 0; x < 240; x++) {
    const h = Math.round(Math.sin(x * freq + phase) * amp + Math.sin(x * freq * 0.45 + phase) * (amp * 0.45));
    ctx.fillRect(x, base - h, 1, 160 - (base - h));
  }
}

export function drawTitleBackdrop(ctx: CanvasRenderingContext2D, frame: number): void {
  const bands = ['#1d5ea8', '#2774c0', '#3488d0', '#4aa4e0', '#6ec0ec', '#98d6f4'];
  bands.forEach((color, i) => {
    ctx.fillStyle = color;
    ctx.fillRect(0, i * 12, 240, 12);
  });
  ctx.fillStyle = '#f8e7a0';
  const pulse = Math.floor(frame / 20) % 2;
  for (let y = -10; y <= 10; y++) {
    for (let x = -10; x <= 10; x++) {
      if (x * x + y * y <= 64 + pulse) ctx.fillRect(196 + x, 26 + y, 1, 1);
    }
  }
  for (const puff of CLOUDS) {
    const x = ((puff.x - frame * puff.speed) % 280 + 280) % 280 - 30;
    cloud(ctx, Math.round(x), puff.y, puff.wide);
  }
  hill(ctx, '#1c4e86', 78, 6, 0.04, frame * 0.002);
  hill(ctx, '#1f6a34', 96, 8, 0.05, 1.2);
  hill(ctx, '#2f8a28', 112, 5, 0.08, 0.4);
  ctx.fillStyle = '#3c9a2c';
  ctx.fillRect(0, 118, 240, 42);
  ctx.fillStyle = '#58b040';
  for (let x = 0; x < 240; x += 4) {
    const sway = Math.floor(frame / 16 + x) % 2;
    ctx.fillRect(x, 116 + sway, 1, 3);
    if (x % 12 === 0) {
      ctx.fillStyle = x % 24 === 0 ? '#e05058' : '#f0d050';
      ctx.fillRect(x, 114 + sway, 2, 2);
      ctx.fillStyle = '#58b040';
    }
  }
}

export function drawMenuPanel(
  ctx: CanvasRenderingContext2D,
  labels: string[],
  index: number,
  frame: number,
  origin?: { x: number; y: number },
): { x: number; y: number; w: number; h: number } {
  const widest = labels.reduce((max, label) => Math.max(max, textWidth(label)), 0);
  const w = Math.max(72, widest + 28);
  const h = 10 + labels.length * 14;
  const x = origin?.x ?? 240 - w - 4;
  const y = origin?.y ?? 4;
  drawWindow(ctx, x, y, w, h);
  const blink = frame % 36 < 22;
  labels.forEach((label, i) => {
    const rowY = y + 8 + i * 14;
    if (i === index) drawCursor(ctx, x + 6, rowY, blink);
    drawShadowText(ctx, label, x + 16, rowY);
  });
  return { x, y, w, h };
}
