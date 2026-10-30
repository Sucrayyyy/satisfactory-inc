// Poste "Pop it" et poste "Papier bulle"
import { Sfx, haptic } from '../audio.js';
import { VW, VH, TAU, clamp, E, hsl, shade, dark, rgba, pick, rr4, circle, ellipse } from '../util.js';

const PENTA = [0, 2, 4, 7, 9];
const noteF = (k) => 196 * Math.pow(2, (PENTA[((k % 5) + 5) % 5] + 12 * Math.floor(k / 5)) / 12);

const MASKS = {
  square: () => true,
  round: (u, v) => u * u + v * v <= 1.12,
  heart: (u, v) => { const x = u * 1.2, y = -v * 1.25 + 0.22, a = x * x + y * y - 1; return a * a * a - x * x * y * y * y <= 0; },
  diamond: (u, v) => Math.abs(u) + Math.abs(v) <= 1.25,
};

export class PopStation {
  constructor(G, o) {
    this.G = G;
    const r = o.r, lv = o.level || 1;
    this.hint = 'Éclate toutes les bulles';
    let n = clamp(4 + Math.floor((lv - 1) / 3), 4, 7);
    const shapes = ['square', 'round'];
    if (n >= 5) shapes.push('diamond');
    if (n >= 6) shapes.push('heart');
    this.shape = lv <= 2 ? 'square' : pick(r, shapes);
    if (this.shape === 'heart') n = 7;
    if (this.shape === 'diamond') n = Math.max(5, n) | 1;
    if (this.shape === 'round' && n < 5) n = 5;
    const pal = pick(r, ['rainbow', 'rainbow', 'duo', 'sunset', 'ocean', 'candy']);
    const h0 = r() * 360;
    const colorFor = (i, j) => {
      const t = n > 1 ? i / (n - 1) : 0;
      switch (pal) {
        case 'duo': return (i + j) % 2 ? hsl(h0, 82, 68) : hsl(h0 + 150, 80, 66);
        case 'sunset': return hsl(330 + t * 75, 92, 66);
        case 'ocean': return hsl(160 + t * 110, 78, 64);
        case 'candy': return hsl((j / (n - 1)) * 300 + h0, 90, 76);
        default: return hsl(t * 285, 86, 63);
      }
    };
    const cell = Math.min(292 / n, 62);
    this.cell = cell;
    const cx = VW / 2, cy = VH / 2 + 8;
    this.cx = cx; this.cy = cy;
    this.bubbles = [];
    const grid = new Set();
    const mask = MASKS[this.shape];
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const u = (j - (n - 1) / 2) / ((n - 1) / 2), v = (i - (n - 1) / 2) / ((n - 1) / 2);
      if (!mask(u, v)) continue;
      grid.add(i + ',' + j);
      this.bubbles.push({ x: cx + (j - (n - 1) / 2) * cell, y: cy + (i - (n - 1) / 2) * cell, r: cell * 0.36, i, j,
        col: colorFor(i, j), popped: false, t: 1, note: n - 1 - i + j });
    }
    const has = (i, j) => grid.has(i + ',' + j);
    const rad = cell * 0.5;
    for (const b of this.bubbles) {
      const { i, j } = b;
      b.corners = [
        !has(i - 1, j) && !has(i, j - 1) ? rad : 0, !has(i - 1, j) && !has(i, j + 1) ? rad : 0,
        !has(i + 1, j) && !has(i, j + 1) ? rad : 0, !has(i + 1, j) && !has(i, j - 1) ? rad : 0,
      ];
    }
    this.maxY = Math.max(...this.bubbles.map((b) => b.y)) + cell / 2;
    this.halfW = (Math.max(...this.bubbles.map((b) => b.x)) - cx) + cell / 2;
    this.left = this.bubbles.length;
    this.flip = 0; this.state = 'play'; this.wait = 0; this.lastPop = 0; this.combo = 0;
  }
  down(x, y) {
    if (this.state !== 'play') return;
    const c = this.cell * 0.52;
    for (const b of this.bubbles) {
      if (!b.popped && Math.abs(x - b.x) < c && Math.abs(y - b.y) < c) { this.pop(b); return; }
    }
  }
  pop(b) {
    b.popped = true; b.t = 0; this.left--;
    const now = performance.now();
    this.combo = now - this.lastPop < 280 ? this.combo + 1 : 0;
    this.lastPop = now;
    Sfx.pop(noteF(b.note), ((b.x - VW / 2) / VW) * 1.2);
    haptic(10);
    this.G.fx.ring(b.x, b.y, shade(b.col, 0.55), b.r * 0.6, b.r * 1.7, 0.32, 3);
    if (this.combo > 3 && this.combo % 3 === 0) this.G.fx.sparkle(b.x, b.y, '#fff', 3, 18);
    this.G.stat('pops');
    if (this.left === 0) { this.state = 'wait'; this.wait = 0.35; }
  }
  update(dt) {
    for (const b of this.bubbles) if (b.t < 1) b.t = Math.min(1, b.t + dt / 0.22);
    if (this.state === 'wait') {
      this.wait -= dt;
      if (this.wait <= 0) { this.state = 'flip'; Sfx.flip(); haptic(15); }
    } else if (this.state === 'flip') {
      this.flip += dt / 0.7;
      if (this.flip >= 1) { this.flip = 1; this.state = 'done'; this.G.complete({}); }
    }
  }
  draw(ctx) {
    const { cx, cy } = this, f = this.flip;
    const sx = Math.cos(Math.PI * f), lift = Math.sin(Math.PI * f);
    ctx.fillStyle = rgba(dark(this.G.mood.bg, 0.6), 0.13 * (1 - lift * 0.5));
    ellipse(ctx, cx, this.maxY + 22, this.halfW * Math.max(0.15, Math.abs(sx)) * (1 - lift * 0.15), 12);
    ctx.fill();
    ctx.save();
    ctx.translate(cx, cy - 46 * lift);
    ctx.scale(sx * (1 + 0.08 * lift), 1 + 0.08 * lift);
    ctx.translate(-cx, -cy);
    const c = this.cell, e = c * 0.1;
    for (const b of this.bubbles) {
      ctx.fillStyle = dark(b.col, 0.34);
      rr4(ctx, b.x - c / 2 - e, b.y - c / 2 - e + 9, c + 2 * e, c + 2 * e, b.corners); ctx.fill();
    }
    for (const b of this.bubbles) {
      ctx.fillStyle = b.col;
      rr4(ctx, b.x - c / 2 - e, b.y - c / 2 - e, c + 2 * e, c + 2 * e, b.corners); ctx.fill();
    }
    const fresh = f > 0.5;
    for (const b of this.bubbles) {
      if (fresh || !b.popped) raised(ctx, b, 1);
      else {
        pressed(ctx, b);
        if (b.t < 1) { ctx.globalAlpha = 1 - b.t; raised(ctx, b, 1 - 0.35 * b.t); ctx.globalAlpha = 1; }
      }
    }
    ctx.restore();
  }
}

function raised(ctx, b, sc) {
  const r = b.r * sc, col = b.col;
  ctx.fillStyle = dark(col, 0.2); circle(ctx, b.x, b.y + 2.5, r + 1.5); ctx.fill();
  const g = ctx.createRadialGradient(b.x - r * 0.35, b.y - r * 0.4, r * 0.1, b.x, b.y, r * 1.05);
  g.addColorStop(0, shade(col, 0.55)); g.addColorStop(0.45, shade(col, 0.12)); g.addColorStop(1, dark(col, 0.1));
  ctx.fillStyle = g; circle(ctx, b.x, b.y, r); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.75)'; ellipse(ctx, b.x - r * 0.38, b.y - r * 0.42, r * 0.24, r * 0.13, -0.6); ctx.fill();
}
function pressed(ctx, b) {
  const r = b.r, col = b.col;
  const g = ctx.createRadialGradient(b.x + r * 0.25, b.y + r * 0.35, r * 0.1, b.x, b.y, r * 1.05);
  g.addColorStop(0, shade(col, 0.22)); g.addColorStop(0.6, col); g.addColorStop(1, dark(col, 0.3));
  ctx.fillStyle = g; circle(ctx, b.x, b.y, r); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.arc(b.x, b.y, r - 1, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
}

// ---------------- Papier bulle ----------------
export class WrapStation {
  constructor(G, o) {
    this.G = G;
    const lv = o.level || 1, r = o.r;
    this.hint = 'Glisse ton doigt pour tout éclater';
    const cols = clamp(5 + Math.floor(lv / 6), 5, 8), rows = clamp(Math.round(cols * 1.5), 7, 12);
    const W = 290, d = W / (cols + 0.5);
    this.r = d * 0.42;
    const rowH = d * 0.88, x0 = VW / 2 - W / 2 + d / 2, y0 = VH / 2 - ((rows - 1) * rowH) / 2 + 6;
    this.tint = this.G.mood.ac;
    this.bubbles = [];
    for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
      const pts = [];
      for (let k = 0; k < 7; k++) { const a = (k / 7) * TAU + r(); pts.push([Math.cos(a) * (0.5 + r() * 0.35), Math.sin(a) * (0.5 + r() * 0.35)]); }
      this.bubbles.push({ x: x0 + j * d + (i % 2 ? d / 2 : 0), y: y0 + i * rowH, popped: false, t: 1, pts, crease: r() * TAU });
    }
    const xs = this.bubbles.map((b) => b.x), ys = this.bubbles.map((b) => b.y), m = this.r + 12;
    this.sheet = { x: Math.min(...xs) - m, y: Math.min(...ys) - m, w: Math.max(...xs) - Math.min(...xs) + 2 * m, h: Math.max(...ys) - Math.min(...ys) + 2 * m };
    this.left = this.bubbles.length;
    this.ptrs = new Map(); this.state = 'play'; this.sndT = 0; this.snd = 0;
  }
  down(x, y, id) { this.ptrs.set(id, { x, y }); this.tryPop(x, y); }
  move(x, y, id) {
    const p = this.ptrs.get(id);
    if (!p) return;
    const dx = x - p.x, dy = y - p.y, dist = Math.hypot(dx, dy), steps = Math.max(1, Math.ceil(dist / (this.r * 0.5)));
    for (let s = 1; s <= steps; s++) this.tryPop(p.x + (dx * s) / steps, p.y + (dy * s) / steps);
    p.x = x; p.y = y;
  }
  up(x, y, id) { this.ptrs.delete(id); }
  tryPop(x, y) {
    if (this.state !== 'play') return;
    for (const b of this.bubbles) {
      if (!b.popped && (x - b.x) ** 2 + (y - b.y) ** 2 < (this.r * 1.05) ** 2) {
        b.popped = true; b.t = 0; this.left--;
        const now = performance.now();
        if (now - this.sndT > 28) { this.sndT = now; this.snd = 0; }
        if (this.snd++ < 2) Sfx.wrap(((b.x - VW / 2) / VW) * 1.2);
        haptic(6);
        this.G.fx.burst(b.x, b.y, ['#ffffff', shade(this.tint, 0.6)], 4, 90, 2.5, 200);
        this.G.stat('pops');
        if (this.left === 0) { this.state = 'done'; setTimeout(() => this.G.complete({}), 350); }
      }
    }
  }
  update(dt) { for (const b of this.bubbles) if (b.t < 1) b.t = Math.min(1, b.t + dt / 0.18); }
  draw(ctx) {
    const s = this.sheet, tint = this.tint, r = this.r;
    ctx.fillStyle = rgba(dark(this.G.mood.bg, 0.6), 0.12);
    rr4(ctx, s.x + 4, s.y + 12, s.w, s.h, [22, 22, 22, 22]); ctx.fill();
    ctx.fillStyle = rgba(shade(tint, 0.85), 0.55);
    rr4(ctx, s.x, s.y, s.w, s.h, [22, 22, 22, 22]); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 2; ctx.stroke();
    const light = shade(tint, 0.75), mid = shade(tint, 0.4);
    for (const b of this.bubbles) {
      if (b.popped) {
        ctx.save(); ctx.translate(b.x, b.y);
        ctx.beginPath(); b.pts.forEach(([px, py], k) => (k ? ctx.lineTo(px * r, py * r) : ctx.moveTo(px * r, py * r))); ctx.closePath();
        ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.fill();
        ctx.strokeStyle = rgba(dark(tint, 0.2), 0.28); ctx.lineWidth = 1.2; ctx.stroke();
        ctx.beginPath(); ctx.moveTo(Math.cos(b.crease) * r * 0.5, Math.sin(b.crease) * r * 0.5);
        ctx.lineTo(-Math.cos(b.crease) * r * 0.4, -Math.sin(b.crease) * r * 0.4); ctx.stroke();
        ctx.restore();
        if (b.t < 1) {
          const k = 1 + 0.25 * E.outCubic(b.t);
          ctx.globalAlpha = 1 - b.t; bubble(ctx, b.x, b.y, r * k, light, mid); ctx.globalAlpha = 1;
        }
      } else bubble(ctx, b.x, b.y, r, light, mid);
    }
  }
}
function bubble(ctx, x, y, r, light, mid) {
  ctx.fillStyle = rgba(dark(mid, 0.3), 0.18); circle(ctx, x + 1.5, y + 3, r); ctx.fill();
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.05, x, y, r);
  g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(0.55, rgba(light, 0.6)); g.addColorStop(1, rgba(mid, 0.45));
  ctx.fillStyle = g; circle(ctx, x, y, r); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = '#fff'; ellipse(ctx, x - r * 0.38, y - r * 0.4, r * 0.2, r * 0.11, -0.6); ctx.fill();
}
