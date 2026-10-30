// Poste "Film protecteur" : vrai pli géométrique (bissectrice coin → doigt)
import { Sfx, haptic, loopVoice } from '../audio.js';
import { VW, VH, TAU, clamp, E, lerp, hsl, shade, dark, rgba, pick, rr, circle, ellipse, FONT } from '../util.js';

const DEV_COLS = ['#B8A6FF', '#9BE5C8', '#FFB2C7', '#FFD465', '#8DC8FF', '#F3EFE8', '#3A3550', '#FF9E7A'];
const DEV = {
  phone: { body: [73, 52, 214, 436, 48], scr: [82, 61, 196, 418, 40] },
  tablet: { body: [28, 78, 304, 392, 32], scr: [44, 94, 272, 360, 18] },
  watch: { body: [88, 168, 184, 214, 60], scr: [101, 181, 158, 188, 48] },
  console: { body: [8, 176, 344, 196, 82], scr: [94, 200, 172, 148, 14] },
  monitor: { body: [14, 118, 332, 222, 24], scr: [26, 130, 308, 198, 12] },
};

function rrPoly(x, y, w, h, r, seg = 7) {
  const pts = [];
  const cs = [[x + w - r, y + r, -Math.PI / 2], [x + w - r, y + h - r, 0], [x + r, y + h - r, Math.PI / 2], [x + r, y + r, Math.PI]];
  for (const [cx, cy, a0] of cs) for (let k = 0; k <= seg; k++) {
    const a = a0 + (Math.PI / 2) * (k / seg);
    pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
  }
  return pts;
}
// Sutherland–Hodgman contre un demi-plan
function clip(poly, f, neg) {
  const out = [], cuts = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    let fa = f(a), fb = f(b);
    if (neg) { fa = -fa; fb = -fb; }
    const ia = fa >= 0, ib = fb >= 0;
    if (ia) out.push(a);
    if (ia !== ib) { const t = fa / (fa - fb), p = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }; out.push(p); cuts.push(p); }
  }
  return { pts: out, cuts };
}
function area(p) { let s = 0; for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; s += a.x * b.y - b.x * a.y; } return Math.abs(s) / 2; }
function path(ctx, p) { ctx.beginPath(); p.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.closePath(); }

export class FilmStation {
  constructor(G, o) {
    this.G = G; this.r = o.r;
    const r = o.r, lv = o.level || 1;
    this.hint = 'Attrape la languette et décolle le film';
    const avail = ['phone', 'tablet', 'watch', 'console', 'monitor'].slice(0, clamp(1 + Math.floor((lv - 1) / 2), 1, 5));
    this.dev = pick(r, avail); this.g = DEV[this.dev];
    this.col = pick(r, DEV_COLS);
    const h = r() * 360;
    this.wall = [hsl(h, 85, 62), hsl(h + 55, 90, 66), hsl(h + 180, 85, 74)];
    this.layers = lv >= 6 && r() < 0.4 ? 2 : 1;
    this.layer = 0;
    const [x, y, w, hh, rad] = this.g.scr;
    this.poly = rrPoly(x - 1, y - 1, w + 2, hh + 2, rad + 1);
    this.area0 = area(this.poly);
    this.bb = { x0: x - 1, y0: y - 1, x1: x + w + 1, y1: y + hh + 1 };
    this.diag = Math.hypot(w, hh);
    this.reveal = -1; this.t = 0; this.pid = null; this.nudge = 0;
    this.newFilm();
  }
  newFilm() {
    const r = this.r;
    let c = Math.floor(r() * 4);
    if (this.corner !== undefined && c === this.corner) c = (c + 2) % 4;
    this.corner = c;
    const b = this.bb;
    this.C = [{ x: b.x1, y: b.y0 }, { x: b.x1, y: b.y1 }, { x: b.x0, y: b.y1 }, { x: b.x0, y: b.y0 }][c];
    this.inward = { x: c < 2 ? -1 : 1, y: c === 0 || c === 3 ? 1 : -1 };
    const k = this.g.scr[4] * 0.6 + 20;
    this.P0 = { x: this.C.x + this.inward.x * k, y: this.C.y + this.inward.y * k };
    this.P = { ...this.P0 };
    this.tint = this.layer === 1 ? '#BFE3FF' : '#FFFFFF';
    this.state = 'idle'; this.fly = null; this.hq = 0;
    this.air = [];
    for (let i = 0; i < 4 + Math.floor(r() * 5); i++)
      this.air.push({ x: lerp(b.x0 + 18, b.x1 - 18, r()), y: lerp(b.y0 + 18, b.y1 - 18, r()), r: 2.5 + r() * 5 });
    this.split();
  }
  split() {
    const C = this.C, P = this.P, dx = P.x - C.x, dy = P.y - C.y, d = Math.hypot(dx, dy);
    if (d < 1) { this.rem = this.poly; this.flap = []; this.cuts = []; this.frac = 0; return; }
    const nx = dx / d, ny = dy / d, mx = (C.x + P.x) / 2, my = (C.y + P.y) / 2;
    const f = (q) => (q.x - mx) * nx + (q.y - my) * ny;
    const rem = clip(this.poly, f, false), pe = clip(this.poly, f, true);
    this.rem = rem.pts; this.cuts = rem.cuts;
    this.flap = pe.pts.map((q) => { const s = f(q); return { x: q.x - 2 * s * nx, y: q.y - 2 * s * ny }; });
    this.n = { x: nx, y: ny }; this.m = { x: mx, y: my }; this.half = d / 2;
    this.frac = 1 - area(this.rem) / this.area0;
  }
  down(x, y, id) {
    if (this.state !== 'idle' || this.pid !== null) return;
    if (Math.hypot(x - this.P.x, y - this.P.y) > 80) { this.nudge = 1; return; }
    this.pid = id; this.off = { x: this.P.x - x, y: this.P.y - y };
    this.state = 'drag'; this.lastT = performance.now(); this.lastP = { ...this.P };
    Sfx.peelStart(); haptic(10);
    if (!this.loop) this.loop = loopVoice('crackle', 'bandpass', 2800, 0.6);
  }
  move(x, y, id) {
    if (id !== this.pid || this.state !== 'drag') return;
    const nP = { x: x + this.off.x, y: y + this.off.y };
    // on ne repousse pas la languette derrière son coin
    const dot = (nP.x - this.C.x) * this.inward.x + (nP.y - this.C.y) * this.inward.y;
    if (dot < 4) { nP.x += this.inward.x * (4 - dot) / 2; nP.y += this.inward.y * (4 - dot) / 2; }
    this.P = nP; this.split();
    const now = performance.now(), dt = Math.max(0.008, (now - this.lastT) / 1000);
    const sp = Math.hypot(nP.x - this.lastP.x, nP.y - this.lastP.y) / dt;
    this.lastT = now; this.lastP = nP;
    this.loop.set(clamp(sp / 700, 0, 1) * 0.95, 2000 + clamp(sp, 0, 1800));
    const q = Math.floor(this.frac * 14);
    if (q !== this.hq) { this.hq = q; haptic(4); }
    if (this.frac > 0.985) this.release();
  }
  up(x, y, id) { if (id !== this.pid) return; this.pid = null; if (this.state === 'drag') this.release(); }
  release() {
    this.pid = null;
    this.loop && this.loop.set(0);
    if (this.frac > 0.4) {
      const dx = this.P.x - this.C.x, dy = this.P.y - this.C.y, d = Math.hypot(dx, dy) || 1;
      this.state = 'auto';
      this.anim = { t: 0, from: { ...this.P }, to: { x: this.C.x + (dx / d) * this.diag * 2.2, y: this.C.y + (dy / d) * this.diag * 2.2 } };
      this.loop && this.loop.set(0.7, 3200);
    } else {
      this.state = 'back'; this.anim = { t: 0, from: { ...this.P }, to: { ...this.P0 } };
      Sfx.springBack();
    }
  }
  update(dt) {
    this.t += dt;
    if (this.nudge > 0) this.nudge = Math.max(0, this.nudge - dt * 2.5);
    if (this.state === 'drag' && performance.now() - this.lastT > 70) this.loop && this.loop.set(0);
    if (this.state === 'auto') {
      this.anim.t += dt / 0.36;
      const e = E.inOutCubic(Math.min(1, this.anim.t));
      this.P = { x: lerp(this.anim.from.x, this.anim.to.x, e), y: lerp(this.anim.from.y, this.anim.to.y, e) };
      this.split();
      if (this.anim.t >= 1) {
        this.loop && this.loop.set(0);
        const dx = this.P.x - this.C.x, dy = this.P.y - this.C.y, d = Math.hypot(dx, dy) || 1;
        this.state = 'fly'; this.fly = { t: 0, vx: (dx / d) * 900, vy: (dy / d) * 900 - 250, x: 0, y: 0, rot: 0 };
        Sfx.whoosh(); haptic(20);
      }
    } else if (this.state === 'back') {
      this.anim.t += dt / 0.32;
      const e = E.outBack(Math.min(1, this.anim.t));
      this.P = { x: lerp(this.anim.from.x, this.anim.to.x, e), y: lerp(this.anim.from.y, this.anim.to.y, e) };
      this.split();
      if (this.anim.t >= 1) this.state = 'idle';
    } else if (this.state === 'fly') {
      const f = this.fly;
      f.t += dt; f.vy += 900 * dt; f.x += f.vx * dt; f.y += f.vy * dt; f.rot += dt * 2.2;
      if (f.t > 0.5) {
        this.state = 'reveal'; this.reveal = 0;
        Sfx.shine(); this.G.stat('films');
        const [sx, sy, sw, sh] = this.g.scr;
        this.G.fx.sparkle(sx + sw / 2, sy + sh / 2, '#ffffff', 8, Math.min(sw, sh) * 0.45);
      }
    } else if (this.state === 'reveal') {
      this.reveal += dt / 0.8;
      if (this.reveal >= 1) {
        this.reveal = -1;
        if (this.layer + 1 < this.layers) { this.layer++; this.newFilm(); }
        else { this.state = 'done'; this.G.complete({}); }
      }
    }
  }
  destroy() { this.loop && this.loop.stop(); }

  draw(ctx) {
    const [sx, sy, sw, sh, sr] = this.g.scr;
    this.drawDevice(ctx);
    ctx.save(); rr(ctx, sx, sy, sw, sh, sr); ctx.clip();
    this.drawWall(ctx);
    if (this.reveal >= 0) {
      ctx.save(); ctx.translate(sx + sw / 2, sy + sh / 2); ctx.rotate(-0.6);
      const L = Math.hypot(sw, sh), X = lerp(-L * 0.7, L * 0.7, E.inOutCubic(this.reveal));
      const g = ctx.createLinearGradient(X - 50, 0, X + 50, 0);
      g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,.6)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.fillRect(X - 50, -L, 100, L * 2); ctx.restore();
    }
    ctx.restore();
    if (this.layers === 2 && this.layer === 0) this.filmLayer(ctx, this.poly, '#BFE3FF', false);
    if (this.state === 'done' || this.state === 'reveal') return;
    if (this.state !== 'fly') this.filmLayer(ctx, this.rem, this.tint, true);
    this.drawFlap(ctx);
  }
  filmLayer(ctx, pts, tint, top) {
    if (pts.length < 3) return;
    const b = this.bb;
    path(ctx, pts);
    ctx.fillStyle = rgba(tint, tint === '#FFFFFF' ? 0.42 : 0.5); ctx.fill();
    ctx.save(); ctx.clip();
    const g = ctx.createLinearGradient(b.x0, b.y0, b.x1, b.y1);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.36, 'rgba(255,255,255,0)'); g.addColorStop(0.41, 'rgba(255,255,255,.42)');
    g.addColorStop(0.47, 'rgba(255,255,255,.06)'); g.addColorStop(0.53, 'rgba(255,255,255,.3)'); g.addColorStop(0.58, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
    if (top) {
      for (const a of this.air) {
        circle(ctx, a.x, a.y, a.r); ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 1; ctx.stroke();
      }
    }
    const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2, fs = clamp((b.x1 - b.x0) / 14, 9, 13);
    ctx.fillStyle = rgba(dark(tint, 0.7), 0.2); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `900 ${fs}px ${FONT}`; ctx.fillText(this.layer === 1 || !top ? 'TRANSPORT' : 'PROTECTION', cx, cy - fs * 0.8);
    ctx.font = `800 ${fs * 0.8}px ${FONT}`; ctx.fillText('satisfactory inc.', cx, cy + fs * 0.6);
    ctx.restore();
    path(ctx, pts); ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 1.5; ctx.stroke();
  }
  drawFlap(ctx) {
    const fl = this.flap, tint = this.tint, f = this.fly;
    ctx.save();
    if (f) {
      ctx.globalAlpha = clamp(1 - f.t / 0.5, 0, 1);
      ctx.translate(f.x + this.m.x, f.y + this.m.y); ctx.rotate(f.rot); ctx.translate(-this.m.x, -this.m.y);
    }
    if (fl.length > 2) {
      ctx.save(); ctx.translate(5, 9); path(ctx, fl); ctx.fillStyle = rgba(dark(this.G.mood.bg, 0.7), 0.16); ctx.fill(); ctx.restore();
      path(ctx, fl);
      const m = this.m, n = this.n, L = Math.max(10, this.half);
      const g = ctx.createLinearGradient(m.x, m.y, m.x + n.x * L, m.y + n.y * L);
      g.addColorStop(0, 'rgba(255,255,255,.98)'); g.addColorStop(0.3, rgba(shade(tint, 0.5), 0.94)); g.addColorStop(1, rgba(dark(tint, 0.08), 0.9));
      ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.4; ctx.stroke();
      if (this.cuts.length >= 2) {
        ctx.beginPath(); ctx.moveTo(this.cuts[0].x, this.cuts[0].y); ctx.lineTo(this.cuts[1].x, this.cuts[1].y);
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.6; ctx.stroke();
      }
    }
    // languette
    const P = this.P, n = this.n || { x: this.inward.x * 0.707, y: this.inward.y * 0.707 };
    const idle = this.state === 'idle';
    const bob = idle ? Math.sin(this.t * 4) * 2.5 + this.nudge * Math.sin(this.t * 40) * 4 : 0;
    const tx = P.x + n.x * (6 + bob), ty = P.y + n.y * (6 + bob);
    const ang = Math.atan2(n.y, n.x);
    ctx.save(); ctx.translate(tx, ty); ctx.rotate(ang);
    const ac = this.G.mood.ac;
    ctx.fillStyle = dark(ac, 0.3); rr(ctx, -30, -12, 40, 28, 13); ctx.fill();
    ctx.fillStyle = ac; rr(ctx, -30, -14, 40, 28, 13); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.4)'; rr(ctx, -24, -11, 26, 8, 4); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(0, 0); ctx.moveTo(-5, -5); ctx.lineTo(0, 0); ctx.lineTo(-5, 5); ctx.stroke();
    ctx.restore();
    if (idle && this.frac < 0.05) {
      const pulse = (this.t * 1.1) % 1;
      ctx.strokeStyle = rgba(ac, 0.5 * (1 - pulse)); ctx.lineWidth = 3;
      circle(ctx, tx, ty, 20 + pulse * 26); ctx.stroke();
    }
    ctx.restore();
  }
  drawDevice(ctx) {
    const [x, y, w, h, r] = this.g.body, c = this.col, ink = '#1A1626';
    const shadow = rgba(dark(this.G.mood.bg, 0.6), 0.14);
    if (this.dev === 'watch') {
      for (const yy of [y - 112, y + h - 38]) {
        ctx.fillStyle = dark(c, 0.3); rr(ctx, x + 36, yy + 8, w - 72, 150, 30); ctx.fill();
        ctx.fillStyle = shade(c, 0.25); rr(ctx, x + 36, yy, w - 72, 150, 30); ctx.fill();
      }
      ctx.fillStyle = dark(c, 0.2); rr(ctx, x + w - 6, y + 70, 16, 40, 7); ctx.fill();
    }
    if (this.dev === 'monitor') {
      ctx.fillStyle = shadow; ellipse(ctx, VW / 2, y + h + 82, 110, 12); ctx.fill();
      ctx.fillStyle = dark(c, 0.25); rr(ctx, VW / 2 - 22, y + h - 6, 44, 70, 10); ctx.fill();
      ctx.fillStyle = dark(c, 0.3); rr(ctx, VW / 2 - 85, y + h + 60, 170, 24, 12); ctx.fill();
      ctx.fillStyle = c; rr(ctx, VW / 2 - 85, y + h + 56, 170, 22, 11); ctx.fill();
    } else if (this.dev !== 'watch') {
      ctx.fillStyle = shadow; ellipse(ctx, VW / 2, y + h + 22, w * 0.45, 13); ctx.fill();
    }
    if (this.dev === 'phone') {
      ctx.fillStyle = dark(c, 0.25);
      rr(ctx, x + w - 4, y + 120, 8, 60, 4); ctx.fill(); rr(ctx, x - 4, y + 100, 8, 38, 4); ctx.fill(); rr(ctx, x - 4, y + 150, 8, 38, 4); ctx.fill();
    }
    ctx.fillStyle = dark(c, 0.38); rr(ctx, x, y + 10, w, h, r); ctx.fill();
    ctx.fillStyle = c; rr(ctx, x, y, w, h, r); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 2; rr(ctx, x + 2.5, y + 2.5, w - 5, h - 5, r - 2); ctx.stroke();
    const [sx, sy, sw, sh, sr] = this.g.scr;
    ctx.fillStyle = ink; rr(ctx, sx - 3, sy - 3, sw + 6, sh + 6, sr + 3); ctx.fill();
    if (this.dev === 'console') {
      const lx = x + 46, cy = y + h / 2;
      ctx.fillStyle = dark(c, 0.45); rr(ctx, lx - 22, cy - 7, 44, 14, 5); ctx.fill(); rr(ctx, lx - 7, cy - 22, 14, 44, 5); ctx.fill();
      const btn = [[x + w - 44, cy - 16, '#FF5C8A'], [x + w - 24, cy + 4, '#5CC8FF'], [x + w - 64, cy + 4, '#FFD45C'], [x + w - 44, cy + 24, '#7CE08A']];
      for (const [bx, by, bc] of btn) { ctx.fillStyle = dark(bc, 0.35); circle(ctx, bx, by + 3, 9); ctx.fill(); ctx.fillStyle = bc; circle(ctx, bx, by, 9); ctx.fill(); }
    }
  }
  drawWall(ctx) {
    const [sx, sy, sw, sh] = this.g.scr, [a, b, c] = this.wall;
    const g = ctx.createLinearGradient(sx, sy, sx + sw, sy + sh);
    g.addColorStop(0, a); g.addColorStop(1, b); ctx.fillStyle = g; ctx.fillRect(sx, sy, sw, sh);
    const blob = (x, y, r, col, al) => {
      const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, rgba(col, al)); rg.addColorStop(1, rgba(col, 0)); ctx.fillStyle = rg; ctx.fillRect(sx, sy, sw, sh);
    };
    blob(sx + sw * 0.78, sy + sh * 0.28, Math.max(sw, sh) * 0.6, c, 0.9);
    blob(sx + sw * 0.15, sy + sh * 0.85, Math.max(sw, sh) * 0.5, '#ffffff', 0.45);
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (this.dev === 'phone') {
      ctx.fillStyle = '#0D0B14'; rr(ctx, sx + sw / 2 - 34, sy + 12, 68, 20, 10); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = `800 13px ${FONT}`; ctx.fillText('9:41', sx + 34, sy + 22);
      ctx.font = `900 58px ${FONT}`; ctx.fillText('9:41', sx + sw / 2, sy + 110);
      ctx.fillStyle = 'rgba(255,255,255,.85)'; rr(ctx, sx + sw / 2 - 50, sy + sh - 14, 100, 5, 3); ctx.fill();
    } else if (this.dev === 'watch') {
      ctx.font = `900 46px ${FONT}`; ctx.fillText('10:09', sx + sw / 2, sy + sh / 2);
    } else if (this.dev === 'tablet') {
      for (let i = 0; i < 2; i++) { ctx.fillStyle = 'rgba(255,255,255,.35)'; rr(ctx, sx + 22 + i * 124, sy + 34, 106, 106, 22); ctx.fill(); }
      ctx.fillStyle = '#fff'; ctx.font = `900 34px ${FONT}`; ctx.fillText('9:41', sx + 75, sy + 87);
    } else if (this.dev === 'monitor') {
      ctx.fillStyle = 'rgba(255,255,255,.4)'; rr(ctx, sx + sw / 2 - 80, sy + sh - 34, 160, 26, 13); ctx.fill();
      ['#FF5C8A', '#FFD45C', '#5CC8FF', '#7CE08A'].forEach((cc, i) => { ctx.fillStyle = cc; rr(ctx, sx + sw / 2 - 66 + i * 36, sy + sh - 30, 20, 18, 6); ctx.fill(); });
    } else if (this.dev === 'console') {
      ctx.fillStyle = '#fff';
      const px = [[0, 1, 1, 0, 1, 1, 0], [1, 1, 1, 1, 1, 1, 1], [1, 1, 1, 1, 1, 1, 1], [0, 1, 1, 1, 1, 1, 0], [0, 0, 1, 1, 1, 0, 0], [0, 0, 0, 1, 0, 0, 0]];
      const s = 9, ox = sx + sw / 2 - 3.5 * s, oy = sy + sh / 2 - 3 * s;
      px.forEach((row, i) => row.forEach((v, j) => v && ctx.fillRect(ox + j * s, oy + i * s, s - 1, s - 1)));
    }
  }
}
