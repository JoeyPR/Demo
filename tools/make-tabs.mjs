/* Generate tab-weather / tab-wrench PNGs (180x184) in the donor tab style:
   rounded-rect background (dark slate off / light sky-blue on), sticker icon
   (white contour + black offset shadow). Pure Node, no deps. */
import { writeFileSync } from "fs";
import { deflateSync } from "zlib";

const W = 180, H = 184;

function make() { return { d: new Uint8Array(W * H * 4) }; }
function px(c, x, y, r, g, b, a) {
  x = Math.round(x); y = Math.round(y);
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 4;
  const na = a / 255, oa = c.d[i + 3] / 255;
  const da = na + oa * (1 - na);
  if (da <= 0) return;
  c.d[i]   = Math.round((r * na + c.d[i]   * oa * (1 - na)) / da);
  c.d[i+1] = Math.round((g * na + c.d[i+1] * oa * (1 - na)) / da);
  c.d[i+2] = Math.round((b * na + c.d[i+2] * oa * (1 - na)) / da);
  c.d[i+3] = Math.round(da * 255);
}
function circle(c, cx, cy, rad, col) {
  for (let y = Math.floor(cy - rad) - 1; y <= Math.ceil(cy + rad) + 1; y++)
    for (let x = Math.floor(cx - rad) - 1; x <= Math.ceil(cx + rad) + 1; x++) {
      const d = Math.hypot(x + .5 - cx, y + .5 - cy);
      if (d <= rad) px(c, x, y, ...col, 255);
      else if (d <= rad + 1) px(c, x, y, ...col, Math.round(255 * (rad + 1 - d)));
    }
}
function bar(c, cx, cy, len, wid, ang, col) {
  const dx = Math.cos(ang), dy = Math.sin(ang);
  for (let t = -len; t <= len; t++) for (let r = -wid; r <= wid; r++)
    px(c, cx + dx * t - dy * r, cy + dy * t + dx * r, ...col, 255);
}
function capsule(c, cx, cy, len, wid, ang, col) {
  const dx = Math.cos(ang), dy = Math.sin(ang);
  for (const sgn of [-1, 1]) circle(c, cx + dx * len * sgn, cy + dy * len * sgn, wid, col);
  bar(c, cx, cy, Math.max(0, len - wid * .5), wid, ang, col);
}
function rrect(c, x0, y0, x1, y1, rad, col) {
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, hw = (x1 - x0) / 2 - rad, hh = (y1 - y0) / 2 - rad;
  for (let y = Math.floor(y0); y <= Math.ceil(y1); y++)
    for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) {
      const qx = Math.max(Math.abs(x + .5 - cx) - hw, 0), qy = Math.max(Math.abs(y + .5 - cy) - hh, 0);
      const d = Math.hypot(qx, qy);
      if (d <= rad) px(c, x, y, ...col, 255);
      else if (d <= rad + 1) px(c, x, y, ...col, Math.round(255 * (rad + 1 - d)));
    }
}

/* icons: grow = additive contour thickness (px) */
function drawWeather(c, ox, oy, grow) {
  const sun = c._col || [255, 208, 54], cloud = c._col || [255, 255, 255];
  const cx = 88, cy = 74;
  circle(c, cx + ox, cy + oy, 24 + grow, sun);
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4 + Math.PI / 8;
    circle(c, cx + Math.cos(a) * (33 + grow) + ox, cy + Math.sin(a) * (33 + grow) + oy, 6 + grow, sun);
  }
  circle(c, 78 + ox, 114 + oy, 16 + grow, cloud);
  circle(c, 98 + ox, 108 + oy, 20 + grow, cloud);
  circle(c, 118 + ox, 114 + oy, 14 + grow, cloud);
  capsule(c, 98 + ox, 118 + oy, 20 + grow * .5, 15 + grow, 0, cloud);
}
function drawWrench(c, ox, oy, grow) {
  const steel = c._col || [216, 228, 238];
  const cx = 90 + ox, cy = 90 + oy, ang = -Math.PI / 4, L = 44, w = 13 + grow;
  const dx = Math.cos(ang), dy = Math.sin(ang);
  const heads = [-1, 1].map(sgn => [cx + dx * L * sgn, cy + dy * L * sgn, w + 9 + grow]);
  const cov = (x, y) => {
    // distance to bar segment
    const t = Math.max(-L, Math.min(L, (x - cx) * dx + (y - cy) * dy));
    const bx = cx + dx * t, by = cy + dy * t;
    let d = Math.hypot(x - bx, y - by) - w;
    for (const [hx, hy, r] of heads) d = Math.min(d, Math.hypot(x - hx, y - hy) - r);
    return d;
  };
  for (let y = 20; y < H - 20; y++) for (let x = 20; x < W - 20; x++) {
    const d = cov(x + .5, y + .5);
    if (d <= 0) px(c, x, y, ...steel, 255);
    else if (d <= 1) px(c, x, y, ...steel, Math.round(255 * (1 - d)));
  }
}

const OFF_BG = [44, 52, 60], ON_BG = [122, 182, 208];
function sticker(c, drawCore) {
  c._col = [18, 22, 26]; drawCore(c, 5, 6, 4);   // shadow
  c._col = [255, 255, 255]; drawCore(c, 0, 0, 5); // contour
  c._col = null; drawCore(c, 0, 0, 0);             // core
}
function tab(kind, on) {
  const c = make();
  rrect(c, 5, 5, W - 5, H - 5, 22, on ? ON_BG : OFF_BG);
  for (let x = 9; x < W - 9; x++) px(c, x, 9, 255, 255, 255, 24);
  sticker(c, kind === "weather" ? drawWeather : drawWrench);
  return c.d;
}

/* ---- PNG encode ---- */
function crc32(buf) {
  let t = crc32.t || (crc32.t = new Uint32Array(256).map((_, n) => {
    let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  }));
  let c = 0xFFFFFFFF;
  for (const b of buf) c = t[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function png(rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc(H * (W * 4 + 1));
  for (let y = 0; y < H; y++) {
    raw[y * (W * 4 + 1)] = 0;
    Buffer.from(rgba.buffer, y * W * 4, W * 4).copy(raw, y * (W * 4 + 1) + 1);
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))
  ]);
}

for (const kind of ["weather", "wrench"]) for (const on of [false, true]) {
  const rgba = Buffer.from(tab(kind, on).buffer);
  writeFileSync(`img/tab-${kind}${on ? "-on" : ""}.png`, png(rgba));
  console.log(`wrote img/tab-${kind}${on ? "-on" : ""}.png`);
}
