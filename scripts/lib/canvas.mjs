export function hex(value) {
  const n = Number.parseInt(value.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255];
}

export function canvas(w, h) {
  const data = new Uint8Array(w * h * 4);
  const api = {
    w,
    h,
    data,
    px(x, y, color) {
      x = Math.round(x);
      y = Math.round(y);
      if (!color || x < 0 || y < 0 || x >= w || y >= h) return;
      const i = (y * w + x) * 4;
      const a = color[3] ?? 255;
      if (a >= 255) {
        data[i] = color[0];
        data[i + 1] = color[1];
        data[i + 2] = color[2];
        data[i + 3] = 255;
        return;
      }
      if (a <= 0) return;
      const s = a / 255;
      const d = 1 - s;
      data[i] = Math.round(color[0] * s + data[i] * d);
      data[i + 1] = Math.round(color[1] * s + data[i + 1] * d);
      data[i + 2] = Math.round(color[2] * s + data[i + 2] * d);
      data[i + 3] = Math.min(255, data[i + 3] + a);
    },
    fill(x, y, rw, rh, color) {
      for (let yy = 0; yy < rh; yy++) for (let xx = 0; xx < rw; xx++) api.px(x + xx, y + yy, color);
    },
    shade(x, y, rw, rh, fill, dark) {
      api.fill(x, y, rw, rh, fill);
      for (let yy = 0; yy < rh; yy++) api.px(x + rw - 1, y + yy, dark);
      for (let xx = 0; xx < rw; xx++) api.px(x + xx, y + rh - 1, dark);
    },
    blit(src, dx, dy) {
      for (let y = 0; y < src.h; y++) {
        for (let x = 0; x < src.w; x++) {
          const i = (y * src.w + x) * 4;
          if (src.data[i + 3] === 0) continue;
          api.px(dx + x, dy + y, [src.data[i], src.data[i + 1], src.data[i + 2], src.data[i + 3]]);
        }
      }
    },
  };
  return api;
}

export function hash(x, y, salt = 0) {
  let n = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(salt, 1440662683)) >>> 0;
  n = (n ^ (n >>> 13)) >>> 0;
  n = Math.imul(n, 1274126177) >>> 0;
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

export function outline(src, color) {
  const copy = src.data.slice();
  const { w, h } = src;
  const filled = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return false;
    return copy[(y * w + x) * 4 + 3] > 20;
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (filled(x, y)) continue;
      if (filled(x - 1, y) || filled(x + 1, y) || filled(x, y - 1) || filled(x, y + 1)) src.px(x, y, color);
    }
  }
}

export function mirror(src) {
  const out = canvas(src.w, src.h);
  for (let y = 0; y < src.h; y++) {
    for (let x = 0; x < src.w; x++) {
      const i = (y * src.w + x) * 4;
      if (src.data[i + 3] === 0) continue;
      out.px(src.w - 1 - x, y, [src.data[i], src.data[i + 1], src.data[i + 2], src.data[i + 3]]);
    }
  }
  return out;
}

export function scaleNearest(src, factor) {
  const out = canvas(src.w * factor, src.h * factor);
  for (let y = 0; y < src.h; y++) {
    for (let x = 0; x < src.w; x++) {
      const i = (y * src.w + x) * 4;
      if (src.data[i + 3] === 0) continue;
      const color = [src.data[i], src.data[i + 1], src.data[i + 2], src.data[i + 3]];
      out.fill(x * factor, y * factor, factor, factor, color);
    }
  }
  return out;
}

export function packTiles(tiles, columns) {
  const rows = Math.ceil(tiles.length / columns);
  const sheet = canvas(columns * 16, rows * 16);
  tiles.forEach((tile, i) => {
    const tx = (i % columns) * 16;
    const ty = Math.floor(i / columns) * 16;
    sheet.blit(tile, tx, ty);
  });
  return sheet;
}
