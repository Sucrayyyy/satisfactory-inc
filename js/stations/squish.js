// Poste "Squishy" : corps mou à ressorts, remontée lente type mousse à mémoire
import { Sfx, haptic } from '../audio.js';
import { VW, VH, TAU, clamp, wrapA, shade, dark, rgba, pick, rr, ellipse, circle } from '../util.js';
import { SQUISHIES } from '../data.js';

const N = 64;
export function restPt(shape, a, R) {
  let x = Math.cos(a), y = Math.sin(a);
  const top = wrapA(a + Math.PI / 2);
  switch (shape) {
    case 'chat': {
      const e1 = wrapA(top - 0.62), e2 = wrapA(top + 0.62);
      const k = 1 + 0.34 * Math.exp(-(e1 * e1) / 0.016) + 0.34 * Math.exp(-(e2 * e2) / 0.016);
      x *= 1.08 * k; y *= 0.92 * k; if (y > 0) y *= 0.9; break;
    }
    case 'peche': { const k = 1 - 0.12 * Math.exp(-(top * top) / 0.03); x *= 1.03 * k; y *= k; if (y > 0) y *= 0.94; break; }
    case 'nuage': { const k = 1 + 0.07 * Math.cos(7 * top); x *= 1.2 * k; y *= 0.8 * k; if (y > 0) y *= 0.82; break; }
    case 'fraise': { const s = Math.sin(a); x *= 1 - 0.3 * Math.pow(Math.max(0, s), 1.5); y *= s > 0 ? 1.08 : 0.84; break; }
    case 'lune': if (y > 0) y *= 0.9; break;
    default: x *= 1.14; y *= 0.88; if (y > 0) y *= 0.86;
  }
  return { x: x * R, y: y * R };
}
function smooth(ctx, pts) {
  const n = pts.length;
  ctx.beginPath();
  ctx.moveTo((pts[n - 1].x + pts[0].x) / 2, (pts[n - 1].y + pts[0].y) / 2);
  for (let i = 0; i < n; i++) { const p = pts[i], q = pts[(i + 1) % n]; ctx.quadraticCurveTo(p.x, p.y, (p.x + q.x) / 2, (p.y + q.y) / 2); }
  ctx.closePath();
}
const SEEDS = [[-0.35, -0.45], [0.38, -0.42], [-0.6, -0.1], [0.62, -0.08], [-0.22, 0.42], [0.25, 0.44], [0, 0.66], [-0.5, 0.2], [0.52, 0.22], [0, -0.55]];

export class SquishStation {
  constructor(G, o) {
    this.G = G; this.mascot = !!o.mascot;
    const r = o.r || Math.random, lv = o.level || 1;
    if (this.mascot) { this.def = SQUISHIES[0]; this.R = 92; this.c = { x: VW / 2, y: 292 }; this.goal = 0; this.box = { x: 50, y: 160, w: 260, h: 250 }; }
    else {
      const owned = SQUISHIES.filter((s) => G.save.owned.sq.includes(s.id));
      this.def = pick(r, owned.length ? owned : SQUISHIES.slice(0, 1));
      this.R = 112; this.c = { x: VW / 2, y: 262 };
      this.goal = clamp(4 + Math.floor(lv / 4), 4, 12);
    }
    this.hint = 'Écrase et maintiens le squishy';
    this.col = this.def.color; this.shape = this.def.shape;
    this.pts = [];
    for (let i = 0; i < N; i++) {
      const a = (i / N) * TAU - Math.PI / 2, p = restPt(this.shape, a, this.R);
      this.pts.push({ a, rx: p.x, ry: p.y, x: this.c.x + p.x, y: this.c.y + p.y, vx: 0, vy: 0 });
    }
    this.maxY = Math.max(...this.pts.map((p) => p.ry)); this.minY = Math.min(...this.pts.map((p) => p.ry));
    this.s = 0; this.press = null; this.shear = { x: 0, y: 0 }; this.imprints = [];
    this.count = 0; this.counted = false; this.t = Math.random() * 10; this.blink = 1; this.nextBlink = 2; this.state = 'play';
    this.sx = 1; this.sy = 1; this.shift = 0;
  }
  map(rx, ry) {
    const h = clamp((this.maxY - ry) / (this.maxY - this.minY), 0, 1);
    return { x: this.c.x + rx * this.sx + this.shear.x * h, y: this.c.y + ry * this.sy + this.shift + this.shear.y * h * 0.6 };
  }
  down(x, y, id) {
    if (this.press || this.state !== 'play') return;
    const dx = (x - this.c.x) / (this.R * 1.35), dy = (y - this.c.y) / (this.R * 1.15);
    if (dx * dx + dy * dy > 1) return;
    this.press = { id, x, y, x0: x, y0: y };
    Sfx.squish(); haptic(14);
    this.imprints.push({ u: (x - this.c.x) / this.sx, v: (y - this.c.y - this.shift) / this.sy, d: 1, r: 0, live: true });
    if (this.imprints.length > 6) this.imprints.shift();
  }
  move(x, y, id) { if (this.press && id === this.press.id) { this.press.x = x; this.press.y = y; } }
  up(x, y, id) {
    if (!this.press || id !== this.press.id) return;
    this.press = null; this.counted = false;
    Sfx.unsquish();
    for (const im of this.imprints) im.live = false;
    if (this.goal && this.count >= this.goal && this.state === 'play') { this.state = 'done'; setTimeout(() => this.G.complete({}), 650); }
  }
  update(dt) {
    this.t += dt;
    const pr = this.press;
    if (pr) this.s += (1 - this.s) * (1 - Math.exp(-dt * 6));
    else this.s -= this.s * (1 - Math.exp(-dt * (this.mascot ? 2.2 : 1.3)));
    if (pr && this.s > 0.72 && !this.counted) {
      this.counted = true; haptic(22);
      if (this.goal) {
        this.count = Math.min(this.goal, this.count + 1); Sfx.boop(this.count - 1); this.G.stat('squish');
        this.G.fx.hearts(this.c.x, this.c.y - this.R * 0.7, '#FF6B9A', 3);
      } else { Sfx.boop(Math.floor(Math.random() * 5)); this.G.fx.hearts(this.c.x, this.c.y - this.R * 0.6, '#FF6B9A', 2); }
    }
    this.shear.x = pr ? clamp((pr.x - pr.x0) * 0.4, -45, 45) : 0;
    this.shear.y = pr ? clamp((pr.y - pr.y0) * 0.25, -25, 25) : 0;
    const s = this.s, br = 1 + 0.012 * Math.sin(this.t * 2.2);
    this.sx = (1 + 0.3 * s) * br; this.sy = (1 - 0.3 * s) * (2 - br);
    this.shift = this.maxY * (1 - this.sy);
    let fa = null, fd = 0;
    if (pr) { fa = Math.atan2(pr.y - this.c.y, pr.x - this.c.x); fd = clamp(Math.hypot(pr.x - this.c.x, pr.y - this.c.y) / (this.R * 0.6), 0, 1); }
    for (const p of this.pts) {
      const m = this.map(p.rx, p.ry);
      let tx = m.x - this.c.x, ty = m.y - this.c.y;
      if (fa !== null) {
        const da = wrapA(p.a - fa), dent = 20 * s * fd * Math.exp(-(da * da) / 0.18), len = Math.hypot(tx, ty) || 1;
        tx -= (tx / len) * dent; ty -= (ty / len) * dent;
      }
      const X = this.c.x + tx, Y = this.c.y + ty;
      p.vx += ((X - p.x) * 220 - p.vx * 13) * dt; p.vy += ((Y - p.y) * 220 - p.vy * 13) * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
    }
    for (const im of this.imprints) {
      if (im.live) im.r += (this.R * (0.2 + 0.18 * s) - im.r) * Math.min(1, dt * 10);
      else im.d -= dt * 0.42;
    }
    this.imprints = this.imprints.filter((im) => im.d > 0);
    this.nextBlink -= dt;
    if (this.nextBlink < 0) { this.blink = 0; this.nextBlink = 2 + Math.random() * 3; }
    this.blink = Math.min(1, this.blink + dt * 8);
  }
  draw(ctx) {
    const { c, col, R } = this, s = this.s, ink = '#2B1650';
    ctx.fillStyle = rgba(dark(this.G.mood.bg, 0.6), 0.16);
    ellipse(ctx, c.x, c.y + this.maxY + 10, R * 0.95 * this.sx, 13); ctx.fill();
    if (this.shape === 'fraise' || this.shape === 'peche') this.drawLeaves(ctx, true);
    smooth(ctx, this.pts);
    const g = ctx.createRadialGradient(c.x - R * 0.4, c.y - R * 0.5, R * 0.1, c.x, c.y, R * 1.6);
    g.addColorStop(0, shade(col, 0.65)); g.addColorStop(0.5, col); g.addColorStop(1, dark(col, 0.3));
    ctx.fillStyle = g; ctx.fill();
    ctx.save(); ctx.clip();
    const bg = ctx.createLinearGradient(0, c.y, 0, c.y + this.maxY + 10);
    bg.addColorStop(0, rgba(dark(col, 0.3), 0)); bg.addColorStop(1, rgba(dark(col, 0.35), 0.45));
    ctx.fillStyle = bg; ctx.fillRect(c.x - R * 2, c.y, R * 4, R * 2);
    if (this.shape === 'fraise') {
      ctx.fillStyle = '#FFE58A';
      for (const [u, v] of SEEDS) { const p = this.map(u * R, v * R); ellipse(ctx, p.x, p.y, 3, 4.5, 0.3); ctx.fill(); }
    }
    for (const im of this.imprints) {
      const p = this.map(im.u, im.v), r = Math.max(2, im.r);
      const gg = ctx.createRadialGradient(p.x - r * 0.15, p.y - r * 0.2, r * 0.1, p.x, p.y, r);
      gg.addColorStop(0, rgba(dark(col, 0.4), 0.3 * im.d)); gg.addColorStop(0.7, rgba(dark(col, 0.3), 0.12 * im.d)); gg.addColorStop(1, rgba(dark(col, 0.2), 0));
      ctx.fillStyle = gg; circle(ctx, p.x, p.y, r); ctx.fill();
      ctx.strokeStyle = `rgba(255,255,255,${0.45 * im.d})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(p.x, p.y, r * 0.8, 0.1 * Math.PI, 0.7 * Math.PI); ctx.stroke();
    }
    ctx.restore();
    const gp = this.map(-0.42 * R, -0.5 * R);
    ctx.fillStyle = 'rgba(255,255,255,.75)'; ellipse(ctx, gp.x, gp.y, R * 0.24 * this.sx, R * 0.12 * this.sy, -0.5); ctx.fill();
    const gd = this.map(-0.18 * R, -0.62 * R); ctx.fillStyle = 'rgba(255,255,255,.8)'; circle(ctx, gd.x, gd.y, R * 0.04); ctx.fill();
    if (this.shape === 'chat') this.drawCat(ctx);
    if (this.shape === 'fraise' || this.shape === 'peche') this.drawLeaves(ctx, false);
    this.drawFace(ctx, ink);
    if (this.mascot) this.drawTie(ctx);
    if (this.goal) {
      const y = c.y + this.maxY + 44, n = this.goal, gap = Math.min(24, 300 / n);
      for (let i = 0; i < n; i++) {
        const x = c.x + (i - (n - 1) / 2) * gap, on = i < this.count;
        ctx.fillStyle = on ? dark(this.G.mood.ac, 0.3) : 'transparent'; circle(ctx, x, y + 3, 8); ctx.fill();
        ctx.fillStyle = on ? this.G.mood.ac : rgba(this.G.mood.fg, 0.12); circle(ctx, x, y, 8); ctx.fill();
        if (on) { ctx.fillStyle = 'rgba(255,255,255,.5)'; circle(ctx, x - 2.5, y - 2.5, 2.5); ctx.fill(); }
      }
    }
  }
  drawFace(ctx, ink) {
    const R = this.R, sq = this.s > 0.62;
    const L = this.map(-0.3 * R, -0.04 * R), Rr = this.map(0.3 * R, -0.04 * R);
    ctx.fillStyle = ink; ctx.strokeStyle = ink; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (sq) {
      ctx.lineWidth = R * 0.05; const e = R * 0.065;
      ctx.beginPath(); ctx.moveTo(L.x - e, L.y - e); ctx.lineTo(L.x + e * 0.8, L.y); ctx.lineTo(L.x - e, L.y + e);
      ctx.moveTo(Rr.x + e, Rr.y - e); ctx.lineTo(Rr.x - e * 0.8, Rr.y); ctx.lineTo(Rr.x + e, Rr.y + e); ctx.stroke();
    } else {
      for (const p of [L, Rr]) {
        ellipse(ctx, p.x, p.y, R * 0.058, R * 0.078 * this.blink); ctx.fillStyle = ink; ctx.fill();
        if (this.blink > 0.6) { ctx.fillStyle = '#fff'; circle(ctx, p.x - R * 0.018, p.y - R * 0.03, R * 0.02); ctx.fill(); }
      }
    }
    ctx.fillStyle = 'rgba(255,92,147,.33)';
    for (const sgn of [-1, 1]) { const p = this.map(sgn * 0.48 * R, 0.13 * R); ellipse(ctx, p.x, p.y, R * 0.1, R * 0.055); ctx.fill(); }
    const m = this.map(0, 0.13 * R);
    if (sq) { ctx.fillStyle = '#7A1F3D'; ellipse(ctx, m.x, m.y + 2, R * 0.055, R * 0.065); ctx.fill(); }
    else {
      ctx.lineWidth = R * 0.035; ctx.strokeStyle = ink; ctx.beginPath();
      if (this.shape === 'chat') { const w = R * 0.06; ctx.moveTo(m.x - w * 2, m.y - 2); ctx.quadraticCurveTo(m.x - w, m.y + w * 1.2, m.x, m.y - 1); ctx.quadraticCurveTo(m.x + w, m.y + w * 1.2, m.x + w * 2, m.y - 2); }
      else ctx.arc(m.x, m.y - R * 0.04, R * 0.065, 0.2 * Math.PI, 0.8 * Math.PI);
      ctx.stroke();
    }
  }
  drawCat(ctx) {
    const R = this.R;
    ctx.fillStyle = 'rgba(255,140,180,.55)';
    for (const sgn of [-1, 1]) { const p = this.map(sgn * 0.5 * R, -0.85 * R); ellipse(ctx, p.x, p.y, R * 0.08, R * 0.12, sgn * 0.5); ctx.fill(); }
    ctx.strokeStyle = 'rgba(43,22,80,.35)'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    for (const sgn of [-1, 1]) for (const dy of [-0.05, 0.05]) {
      const a = this.map(sgn * 0.62 * R, (0.08 + dy) * R), b = this.map(sgn * 0.9 * R, (0.04 + dy * 2.2) * R);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
  }
  drawLeaves(ctx, back) {
    const R = this.R, p = this.map(0, this.minY + (this.shape === 'peche' ? R * 0.1 : 4));
    if (this.shape === 'peche') {
      if (back) return;
      ctx.strokeStyle = '#8A5A3C'; ctx.lineWidth = 4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + 3, p.y - 14); ctx.stroke();
      ctx.fillStyle = '#5DBB63'; ellipse(ctx, p.x + 20, p.y - 14, 20, 9, -0.4); ctx.fill();
      ctx.strokeStyle = '#3E9A4A'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(p.x + 4, p.y - 9); ctx.lineTo(p.x + 36, p.y - 20); ctx.stroke();
    } else if (!back) {
      ctx.fillStyle = '#3FB66B';
      for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i - 2) * 0.55; ellipse(ctx, p.x + Math.cos(a) * 16, p.y + 2 + Math.sin(a) * 9, 15, 6, a); ctx.fill(); }
      ctx.fillStyle = '#2F9A57'; circle(ctx, p.x, p.y, 5); ctx.fill();
    }
  }
  drawTie(ctx) {
    const R = this.R, k = this.map(0, 0.36 * R), ac = this.G.mood.ac, w = R * 0.09;
    ctx.fillStyle = dark(ac, 0.15);
    ctx.beginPath(); ctx.moveTo(k.x - w * 0.7, k.y + w * 0.6); ctx.lineTo(k.x + w * 0.7, k.y + w * 0.6);
    ctx.lineTo(k.x + w * 1.05, k.y + w * 3.1); ctx.lineTo(k.x, k.y + w * 3.9); ctx.lineTo(k.x - w * 1.05, k.y + w * 3.1); ctx.closePath(); ctx.fill();
    ctx.fillStyle = ac; rr(ctx, k.x - w, k.y - w * 0.4, w * 2, w * 1.3, w * 0.45); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.4)'; rr(ctx, k.x - w * 0.6, k.y - w * 0.2, w * 0.8, w * 0.35, 2); ctx.fill();
  }
}

// Vignette statique pour l'Atelier
export function drawSquishyIcon(ctx, def, cx, cy, R) {
  const pts = [];
  for (let i = 0; i < 48; i++) { const p = restPt(def.shape, (i / 48) * TAU - Math.PI / 2, R); pts.push({ x: cx + p.x, y: cy + p.y }); }
  const col = def.color;
  smooth(ctx, pts);
  const g = ctx.createRadialGradient(cx - R * 0.4, cy - R * 0.5, R * 0.1, cx, cy, R * 1.6);
  g.addColorStop(0, shade(col, 0.65)); g.addColorStop(0.5, col); g.addColorStop(1, dark(col, 0.3));
  ctx.fillStyle = g; ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.75)'; ellipse(ctx, cx - R * 0.42, cy - R * 0.5, R * 0.24, R * 0.12, -0.5); ctx.fill();
  ctx.fillStyle = '#2B1650';
  for (const sx of [-1, 1]) { ellipse(ctx, cx + sx * 0.3 * R, cy - 0.04 * R, R * 0.06, R * 0.08); ctx.fill(); }
  ctx.fillStyle = 'rgba(255,92,147,.35)';
  for (const sx of [-1, 1]) { ellipse(ctx, cx + sx * 0.48 * R, cy + 0.13 * R, R * 0.1, R * 0.055); ctx.fill(); }
  ctx.strokeStyle = '#2B1650'; ctx.lineWidth = Math.max(1.5, R * 0.04); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(cx, cy + 0.09 * R, R * 0.065, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke();
}
