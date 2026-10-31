// Independent bitmap compositor. Source facts and limitations: docs/research/RENOVATION.md.
const wave = (ms, period) => Math.sin(2 * Math.PI * ms / period);
const pulse = (ms, period) => Math.abs(wave(ms, period));
const rainbow = (ms, seed = 0) => [16000, 12000, 20000].map(p => Math.trunc(128 + 127 * pulse(ms, p + seed)));
const styles = {
  plain: [[1, [0, 0, 0, 150]], [0, 'code']],
  ss: [[2, [0, 0, 0, 255]], [0, 'code']],
  legend: [[2, 'code'], [0, 'legend']],
  l125: [[2, [3, 98, 134, 150]], [0, [0, 255, 255, 150]]],
  mentor: [[2, [249, 240, 111, 200]], [0, [247, 148, 30, 255]]],
  dr: [[0, [255, 0, 0, 255]]],
  party: [[2, [0, 0, 0, 50]], [0, 'party']],
  g4g: [[1.2, 'g4g'], [0, 'g4g']]
};
const partyColors = [[255, 11, 223], [255, 217, 11], [133, 255, 169]];

export function buildNameplate(state, titles, roles) {
  const name = String(state.growId ?? '').replace(/[^a-z0-9]/gi, '').slice(0, 18);
  if (!name) return null;
  const selected = titles.filter(t => state.titles?.includes(t.key));
  const has = key => selected.some(t => t.key === key);
  const staff = selected.find(t => t.staff)?.staff;
  const legendary = selected.some(t => t.legendary);
  const color = staff ?? (legendary ? has('dr') ? '4' : '2' : has('dr') && !has('party') ? '4' : '0');
  const text = (staff ? '@' : '') + (has('dr') ? 'Dr.' : '') + name + (has('legend') ? ' of Legend' : '');
  const guildRole = roles[state.guildRole];
  const glyphs = [...text].map(ch => ({ ch, color }));
  if (guildRole) glyphs.push(...[...(' ' + guildRole.text)].map(ch => ({ ch, rgb: guildRole.colour })));
  const style = has('g4g') ? 'g4g' : legendary ? 'legend' : has('l125') ? 'l125' : has('mentor') ? 'mentor'
    : has('dr') && !has('party') && !has('ss') ? 'dr' : has('party') ? 'party' : has('ss') ? 'ss' : 'plain';
  const badge = ['g4g', 'mentor', 'legend', 'tt', 'cc'].map(key => selected.find(t => t.key === key && t.flag)).find(Boolean);
  const place = (state.guildFlag || state.guildBg) && !has('cc') && !has('tt')
    ? { guild: true, item: state.guildFlag, background: state.guildBg }
    : badge ? { src: badge.plateFlag ?? `img/titles/${badge.flag}.png`, badge: badge.key }
    : state.flag ? { src: `img/flags/${state.flag}.png`, flag: true } : null;
  const icons = selected.filter(t => t.both || t.after).sort((a, b) => +a.key.startsWith('pbl') - +b.key.startsWith('pbl'))
    .map(t => ({ src: `img/titles/${t.both ?? t.after}.png`, paired: !!t.both }));
  return { glyphs, text, style, color, place, icons, legendary, supporter: has('ss'),
    mentor: has('mentor'), l125: has('l125'), g4g: has('g4g'),
    enlarged: has('legend') || has('mentor'), role: state.role ? `img/flags/role-${state.role}.png` : null,
    wrench: !!state.wrenchOn };
}

/** Font cells are [sx,sy,w,h,offsetX,offsetY,advance]. No browser text metrics. */
export function layoutNameplate(model, font, ms = 0, frameOf = () => [32, 32]) {
  if (!model) return { width: 0, height: 0, glyphs: [], pictures: [], boxes: [] };
  // Preserve the host's 7.5u nameplate scale, enlarged for sourced title classes.
  const unit = 7.5 / 23 * (model.enlarged ? 1 / .6 : model.supporter ? 1 / .8 : 1);
  const cells = model.glyphs.map(g => ({ ...g, cell: font.chars[g.ch.codePointAt(0)] ?? font.chars[63] }));
  const width = cells.reduce((sum, g) => sum + g.cell[6], 0) * unit;
  const height = Math.max(...cells.map(g => g.cell[5] + g.cell[3])) * unit;
  const swell = model.style === 'l125' ? 1 + .175 * pulse(ms, 8000)
    : model.style === 'g4g' && !model.legendary ? .9 + .175 * pulse(ms, 8000) : 1;
  const gap = 7 * 1200 / 1024 * unit, smallGap = 5 * 1200 / 1024 * unit;
  let textX = -width / 2 + (model.place ? height / 2 : 0), left = textX;
  const top = -height, pictures = [];
  const iconSize = 41.6 * unit, pizza = font.chars[font.emoticons?.['(pizza)'] ?? 297];
  const ornamentAdvance = (pizza?.[6] ?? 32) * 2 * unit;
  const ornamentY = top + (pizza ? (pizza[5] + pizza[3]) * unit / 2 : height / 2);
  model.icons.forEach((icon, i) => {
    pictures.push({ ...icon, title: true, box: [textX - .9 * ornamentAdvance - i * (iconSize + gap), ornamentY - iconSize * swell / 2, iconSize * swell, iconSize * swell] });
    if (icon.paired && i === 0) pictures.push({ ...icon, title: true, mirror: true,
      box: [textX + width * swell + smallGap, ornamentY - iconSize * swell / 2, iconSize * swell, iconSize * swell] });
  });
  if (model.icons.length) {
    const paired = model.icons[0].paired;
    textX += ornamentAdvance * (paired ? 1.25 : .25);
    left += ornamentAdvance * (paired ? -.9 : -1.05) - (model.icons.length - 1) * (iconSize + gap);
  }
  let placeBox, guildOrigin;
  if (model.place?.guild) {
    const size = height * 1.5, box = [left - gap - size, -height * 1.375, size, size];
    placeBox = box; guildOrigin = box;
    if (model.place.background) pictures.push({ item: model.place.background, guild: true, box });
    if (model.place.item) {
      const inset = model.place.background ? size * .2 : 0, side = size - 2 * inset;
      guildOrigin = [box[0] + inset, box[1] + inset];
      pictures.push({ item: model.place.item, guild: true, box: [box[0] + inset, box[1] + inset, side, side] });
    }
  } else if (model.place) {
    const [w, h] = frameOf(model.place.src), side = height * w / h;
    placeBox = [left - gap - side - (model.place.badge === 'g4g' ? 4 * unit : 0), top, side, height];
    pictures.push({ ...model.place, box: placeBox });
  }
  if (model.role) {
    const [w, h] = frameOf(model.role), side = height * w / h;
    const x = guildOrigin ? guildOrigin[0] - gap - side : placeBox ? placeBox[0] + placeBox[2] / 2 - gap - side : left - gap - side / 2;
    pictures.push({ src: model.role, role: true, box: [x - side / 2 - (model.supporter ? gap * 1.25 : 0), guildOrigin ? guildOrigin[1] - height / 2 : top, side, height] });
  }
  if (model.wrench) {
    const side = height * 1.2 * (model.supporter ? 1.5 : 1);
    pictures.push({ wrench: true, green: model.supporter,
      alpha: Math.trunc(190 + 60 * wave(ms, 1000)) / 255,
      angle: model.supporter ? 20 * wave(ms, 3000) : 0,
      box: [textX + width + smallGap - (model.supporter ? 2 * unit : 0), top - (model.supporter ? 3 * unit : 0), side, side] });
  }
  const glyphs = [];
  for (const [offset, ink] of styles[model.style]) {
    let x = textX;
    cells.forEach((g, i) => {
      const rgba = Array.isArray(ink) ? ink : ink === 'legend' ? [...rainbow(ms), 255]
        : ink === 'g4g' ? [...rainbow(ms, 1000 * (i + 2)), 255]
        : ink === 'party' ? [...partyColors[Math.floor(i / Math.max(1, Math.floor(model.text.length / 6))) % 3], 255]
        : [...(g.rgb ?? font.colors[g.color] ?? [255, 255, 255]), 255];
      glyphs.push({ cell: g.cell, x: x + offset * unit + g.cell[4] * unit * swell,
        y: top + offset * unit + g.cell[5] * unit * swell, scale: unit * swell, rgba });
      x += g.cell[6] * unit * swell;
    });
  }
  const boxes = [[textX, top, width * Math.max(1, swell), height * Math.max(1, swell)], ...pictures.map(p => p.box)];
  return { width: 2 * Math.max(...boxes.map(([x, , w]) => Math.max(Math.abs(x), Math.abs(x + w)))), height,
    glyphs, pictures, boxes, unit };
}

export class BitmapNameplate {
  constructor(font, image, frames, { imageOf, guildFlag, drawWrench }) {
    Object.assign(this, { font, image, frames, imageOf, guildFlag, drawWrench });
    this.tints = new Map(); this.iconTints = new Map();
  }
  frameOf(src) {
    const key = src.replace(/^img\//, '').replace(/\.png$/, '');
    const image = this.imageOf(src);
    return this.frames[key] ?? [image?.naturalWidth || image?.width || 32, image?.naturalHeight || image?.height || 32];
  }
  tinted(cell, rgb) {
    const [sx, sy, width, height] = cell;
    const key = [sx, sy, width, height, ...rgb].join(',');
    if (!this.tints.has(key)) {
      if (this.tints.size >= 512) this.tints.delete(this.tints.keys().next().value);
      const c = document.createElement('canvas'); c.width = width; c.height = height;
      const ctx = c.getContext('2d'); ctx.drawImage(this.image, sx, sy, width, height, 0, 0, width, height);
      ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = `rgb(${rgb})`; ctx.fillRect(0, 0, c.width, c.height);
      ctx.globalCompositeOperation = 'destination-in'; ctx.drawImage(this.image, sx, sy, width, height, 0, 0, width, height);
      this.tints.set(key, c);
    }
    return this.tints.get(key);
  }
  tintedIcon(image, rgb) {
    const key = image.src + ':' + rgb.join(',');
    if (!this.iconTints.has(key)) {
      if (this.iconTints.size >= 64) this.iconTints.delete(this.iconTints.keys().next().value);
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth || image.width; canvas.height = image.naturalHeight || image.height;
      const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0);
      ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = `rgb(${rgb})`; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = 'destination-in'; ctx.drawImage(image, 0, 0);
      this.iconTints.set(key, canvas);
    }
    return this.iconTints.get(key);
  }
  draw(ctx, model, cx, baseline, scale, ms, state, measureOnly = false) {
    const layout = layoutNameplate(model, this.font, ms, src => this.frameOf(src));
    if (measureOnly || !model) return layout.width * scale;
    ctx.save();
    try {
      ctx.setTransform(scale, 0, 0, scale, cx, baseline); ctx.imageSmoothingEnabled = false;
      for (const g of layout.glyphs) {
        const [sx, sy, w, h] = g.cell;
        ctx.globalAlpha = g.rgba[3] / 255;
        ctx.drawImage(this.tinted(g.cell, g.rgba.slice(0, 3)), 0, 0, w, h, g.x, g.y, w * g.scale, h * g.scale);
      }
      ctx.globalAlpha = 1;
      for (const p of layout.pictures) {
        if (p.wrench) { this.drawWrench(ctx, p, state); continue; }
        const im = p.guild ? this.guildFlag(p.item) : this.imageOf(p.src);
        if (!im) continue;
        let [x, y, w, h] = p.box;
        ctx.save();
        const animated = p.role || p.badge || p.flag;
        const grow = animated && model.supporter ? 1.25 : 1;
        let glow = p.badge === 'g4g' || p.role && !model.mentor && !model.l125 && model.g4g;
        const pulseIcon = p.badge === 'mentor' || model.l125 && (p.badge || p.flag) || p.role && (model.mentor || model.l125);
        if (glow || pulseIcon) {
          const factor = grow + .25 * pulse(ms, 8000);
          ctx.globalCompositeOperation = 'lighter';
          const glowSource = glow && p.role ? this.imageOf('img/titles/g4g.png') ?? im : im;
          const glowImage = glow ? this.tintedIcon(glowSource, rainbow(ms)) : im;
          ctx.drawImage(glowImage, x - w * (factor - 1) / 2, y - h * (factor - 1) / 2, w * factor, h * factor);
          ctx.globalCompositeOperation = 'source-over';
        }
        const factor = p.badge === 'mentor' ? 2 + .25 * pulse(ms, 4000) : grow;
        x -= w * (factor - 1) / 2; y -= h * (factor - 1) / 2; w *= factor; h *= factor;
        if (p.mirror) { ctx.translate(x + w, y); ctx.scale(-1, 1); ctx.drawImage(im, 0, 0, w, h); }
        else ctx.drawImage(im, x, y, w, h);
        ctx.restore();
      }
    } finally { ctx.restore(); }
    return layout.width * scale;
  }
}
