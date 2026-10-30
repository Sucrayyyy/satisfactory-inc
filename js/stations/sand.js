// Poste "Sable cinétique" : on tranche, la tranche bascule et s'effrite en tas
import { Sfx, haptic, loopVoice } from '../audio.js';
import { VW, VH, clamp, E, shade, dark, rgba, pick, shuffle, rr, circle } from '../util.js';

const SETS = [
  ['#FFB3C7', '#FFE08A', '#9EE6C9', '#B8A6FF'],
  ['#F7C59F', '#EFE6CF', '#FF9F7A'],
  ['#A0E7E5', '#B4F8C8', '#FBE7C6', '#FFAEBC'],
  ['#C3B1E1', '#F8C8DC', '#B5EAD7'],
  ['#FFD6A5', '#FDFFB6', '#CAFFBF', '#9BF6FF', '#BDB2FF'],
];
function sandPattern(ctx, col) {
  const c = document.createElement('canvas'); c.width = c.height = 96;
  const x = c.getContext('2d');
  x.fillStyle = col; x.fillRect(0, 0, 96, 96);
  const light = [0.12, 0.2, 0.28].map((a) => shade(col, a)), darks = [0.06, 0.1, 0.15].map((a) => dark(col, a));
  for (let i = 0; i < 1600; i++) {
    const r = Math.random();
    x.fillStyle = r < 0.45 ? light[i % 3] : r < 0.92 ? darks[i % 3] : 'rgba(255,255,255,.8)';
    x.fillRect((Math.random() * 96) | 0, (Math.random() * 96) | 0, 1 + (Math.random() < 0.3 ? 1 : 0), 1);
  }
  const p = ctx.createPattern(c, 'repeat');
  try { p.setTransform(new DOMMatrix().scale(0.5)); } catch (e) {}
  return p;
}

const TRAY_X0 = 10, TRAY_X1 = 350;

export class SandStation {
  constructor(G, o) {
    this.G = G;
    const r = o.r, lv = o.level || 1;
    this.hint = 'Tranche du haut vers le bas, sur les pointillés';
    this.N = clamp(4 + Math.floor((lv - 4) / 3), 4, 9);
    this.left = 30; this.right = 302; this.top = 206; this.bot = 390;
    const set = pick(r, SETS), k = clamp(2 + Math.floor(r() * 3), 2, set.length);
    const cols = shuffle(r, set.slice()).slice(0, k), H = this.bot - this.top;
    this.bands = [];
    let y = this.top;
    cols.forEach((col, i) => {
      const h = i === k - 1 ? this.bot - y : Math.round((H / k) * (0.8 + r() * 0.4));
      this.bands.push({ y0: y, y1: y + h, col, pat: sandPattern(G.ctx, col) });
      y += h;
    });
    this.sliceW = Math.round(((this.right - this.left) * 0.8) / this.N);
    this.cuts = 0; this.perfects = 0; this.inc = null; this.falls = []; this.grains = [];
    this.pid = null; this.state = 'play'; this.end = 0;
    this.pile = document.createElement('canvas'); this.pile.width = VW * 2; this.pile.height = VH * 2;
    this.pctx = this.pile.getContext('2d'); this.pctx.scale(2, 2);
    this.hm = new Float32Array(Math.ceil(VW / 2) + 1);
    for (let i = 0; i < this.hm.length; i++) { const x = i * 2; this.hm[i] = x >= TRAY_X0 && x <= TRAY_X1 - 4 ? this.bot : VH - 2; }
  }
  targetX() { return this.right - this.sliceW; }
  colAt(y) { for (const b of this.bands) if (y < b.y1) return b.col; return this.bands[this.bands.length - 1].col; }
  inRange(x) { return x > this.left + 14 && x < this.right - 6; }
  down(x, y, id) {
    if (this.state !== 'play' || this.pid !== null) return;
    this.pid = id; this.fx = x; this.fy = y; this.lastY = y; this.lastT = performance.now();
    if (!this.loop) this.loop = loopVoice('grain', 'bandpass', 3000, 0.7);
    if (this.inc && Math.abs(x - this.inc.x) < 26 && y <= this.top + this.inc.d + 40) return;
    if (y < this.top + 30 && y >= this.top - 4 && this.inRange(x)) this.begin(x);
  }
  begin(x) {
    this.inc = { x: clamp(x, this.left + 14, this.right - 6), d: 0 };
    haptic(6);
  }
  move(x, y, id) {
    if (id !== this.pid) return;
    this.fx = x; this.fy = y;
    const now = performance.now(), dt = Math.max(0.008, (now - this.lastT) / 1000);
    if (!this.inc && this.lastY < this.top + 30 && y >= this.top - 4 && this.inRange(x)) this.begin(x);
    if (this.inc && this.state === 'play') {
      const d = clamp(y - this.top, 0, this.bot - this.top);
      if (d > this.inc.d) {
        const sp = (d - this.inc.d) / dt;
        this.inc.d = d;
        this.loop.set(clamp(sp / 500, 0.15, 1) * 0.9, 2400 + clamp(sp * 2, 0, 1800));
        if (Math.random() < 0.35) this.G.fx.burst(this.inc.x, this.top + d, [this.colAt(this.top + d)], 1, 50, 1.6, 500);
        if (d >= this.bot - this.top - 1) this.finishCut();
      }
    }
    this.lastY = y; this.lastT = now;
  }
  up(x, y, id) { if (id !== this.pid) return; this.pid = null; this.loop && this.loop.set(0); }
  finishCut() {
    const x = this.inc.x, err = Math.abs(x - this.targetX());
    this.falls.push({ x0: x, x1: this.right, a: 0, w: 0.3, broke: false });
    this.right = x; this.inc = null; this.cuts++;
    this.loop && this.loop.set(0);
    Sfx.cut(); haptic(18); this.G.stat('cuts');
    const tx = (x + this.left) / 2;
    if (err <= 7) { this.perfects++; this.G.fx.text(VW / 2, 150, 'Parfait !', this.G.mood.ac, 30); setTimeout(() => Sfx.perfect(), 80); }
    else if (err <= 18) this.G.fx.text(VW / 2, 150, 'Bien', this.G.mood.ac, 26);
    if (this.cuts >= this.N || this.right - this.left < 40) { this.state = 'end'; this.end = 1.5; }
  }
  spawnGrain(x, y, vx, vy, col) {
    if (this.grains.length > 1400) return;
    this.grains.push({ x, y, vx, vy, c: Math.random() < 0.5 ? shade(col, 0.1) : dark(col, 0.06), s: 2.2 + Math.random() * 1.6 });
  }
  breakSlice(f) {
    const px = f.x1, py = this.bot, ca = Math.cos(f.a), sa = Math.sin(f.a), step = 4;
    for (let lx = f.x0 - px; lx < 0; lx += step) for (let ly = this.top - py; ly < 0; ly += step) {
      const wx = px + lx * ca - ly * sa, wy = py + lx * sa + ly * ca;
      const hgt = -ly / (this.bot - this.top);
      this.spawnGrain(wx + Math.random() * 2, wy + Math.random() * 2, 10 + hgt * (40 + Math.random() * 70), -Math.random() * 30, this.colAt(py + ly));
    }
    Sfx.crumble(); haptic(25);
  }
  update(dt) {
    for (const f of this.falls) {
      f.w += dt * 9; f.a += f.w * dt;
      if (f.a > 0.5 && !f.broke) { f.broke = true; this.breakSlice(f); }
    }
    this.falls = this.falls.filter((f) => !f.broke);
    const hm = this.hm, p = this.pctx, keep = [];
    for (const g of this.grains) {
      g.vy += 1500 * dt; g.x += g.vx * dt; g.y += g.vy * dt; g.vx *= 1 - dt * 1.5;
      // rebord à droite du plateau : le sable reste dessus
      if (g.x > TRAY_X1 - 6) { g.x = TRAY_X1 - 6; g.vx = -Math.abs(g.vx) * 0.3; }
      g.x = clamp(g.x, 1, VW - 1);
      let ci = Math.round(g.x / 2);
      if (g.y >= hm[ci] - g.s) {
        // angle de repos : le grain roule tant qu'une colonne voisine est nettement plus basse
        const wall = (c) => c < 0 || c >= hm.length || c * 2 > TRAY_X1 - 6 || (g.x > this.right && c * 2 <= this.right + 1);
        for (let it = 0; it < 40; it++) {
          let best = ci, bestH = hm[ci] + 1.3;
          for (const dc of Math.random() < 0.5 ? [-1, 1] : [1, -1]) {
            const nc = ci + dc;
            if (!wall(nc) && hm[nc] > bestH) { best = nc; bestH = hm[nc]; }
          }
          if (best === ci) break;
          ci = best;
        }
        g.x = ci * 2; g.y = hm[ci] - g.s;
        p.fillStyle = g.c; p.fillRect(g.x - g.s / 2, g.y, g.s + 0.6, g.s);
        hm[ci] -= g.s * 0.75;
      } else keep.push(g);
    }
    this.grains = keep;
    if (this.state === 'end') {
      this.end -= dt;
      if (this.end <= 0 && !this.falls.length) { this.state = 'done'; this.G.complete({ perfect: this.perfects }); }
    }
  }
  destroy() { this.loop && this.loop.stop(); }
  drawBlock(ctx, x0, x1, radius) {
    ctx.save(); rr(ctx, x0, this.top, x1 - x0, this.bot - this.top, radius); ctx.clip();
    for (const b of this.bands) { ctx.fillStyle = b.pat; ctx.fillRect(x0, b.y0, x1 - x0, b.y1 - b.y0 + 0.5); }
    const g = ctx.createLinearGradient(0, this.top, 0, this.bot);
    g.addColorStop(0, 'rgba(255,255,255,.12)'); g.addColorStop(0.8, 'rgba(43,22,80,0)'); g.addColorStop(1, 'rgba(43,22,80,.12)');
    ctx.fillStyle = g; ctx.fillRect(x0, this.top, x1 - x0, this.bot - this.top);
    ctx.restore();
  }
  draw(ctx) {
    const ac = this.G.mood.ac;
    ctx.fillStyle = rgba(dark(this.G.mood.bg, 0.6), 0.13); rr(ctx, TRAY_X0 + 4, this.bot + 14, TRAY_X1 - TRAY_X0, 22, 11); ctx.fill();
    ctx.fillStyle = dark(shade(ac, 0.55), 0.2); rr(ctx, TRAY_X0, this.bot + 7, TRAY_X1 - TRAY_X0, 20, 10); ctx.fill();
    ctx.fillStyle = shade(ac, 0.6); rr(ctx, TRAY_X0, this.bot, TRAY_X1 - TRAY_X0, 18, 9); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.5)'; rr(ctx, TRAY_X0 + 12, this.bot + 3, TRAY_X1 - TRAY_X0 - 24, 4, 2); ctx.fill();
    // bloc
    this.drawBlock(ctx, this.left, this.right, this.cuts ? 6 : 10);
    ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.fillRect(this.left + 8, this.top, this.right - this.left - 14, 2.5);
    if (this.cuts) { ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.fillRect(this.right - 4, this.top + 2, 4, this.bot - this.top - 4); }
    ctx.drawImage(this.pile, 0, 0, VW, VH);
    for (const f of this.falls) {
      ctx.save(); ctx.translate(f.x1, this.bot); ctx.rotate(f.a); ctx.translate(-f.x1, -this.bot);
      this.drawBlock(ctx, f.x0, f.x1, 3); ctx.restore();
    }
    for (const g of this.grains) { ctx.fillStyle = g.c; ctx.fillRect(g.x - g.s / 2, g.y, g.s, g.s); }
    if (this.state === 'play') {
      const tx = this.targetX();
      ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.lineWidth = 2.5; ctx.setLineDash([7, 7]); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(tx, this.top - 4); ctx.lineTo(tx, this.bot); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = ac;
      ctx.beginPath(); ctx.moveTo(tx - 9, this.top - 22); ctx.lineTo(tx + 9, this.top - 22); ctx.lineTo(tx, this.top - 9); ctx.closePath(); ctx.fill();
    }
    if (this.inc) {
      const x = this.inc.x;
      ctx.strokeStyle = 'rgba(43,22,80,.35)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x, this.top); ctx.lineTo(x, this.top + this.inc.d); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x + 1.6, this.top); ctx.lineTo(x + 1.6, this.top + this.inc.d); ctx.stroke();
    }
    if (this.pid !== null && this.state === 'play') {
      const x = this.inc ? this.inc.x : this.fx, tip = this.inc ? this.top + this.inc.d : this.fy;
      ctx.save(); ctx.translate(x, tip);
      const g = ctx.createLinearGradient(-5, 0, 5, 0);
      g.addColorStop(0, '#E8ECF4'); g.addColorStop(0.5, '#FFFFFF'); g.addColorStop(1, '#B9C2D3');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(-4, -110); ctx.lineTo(4, -110); ctx.lineTo(4, -6); ctx.lineTo(0, 0); ctx.lineTo(-4, -6); ctx.closePath(); ctx.fill();
      ctx.fillStyle = dark(ac, 0.3); rr(ctx, -8, -168, 16, 60, 8); ctx.fill();
      ctx.fillStyle = ac; rr(ctx, -8, -170, 16, 58, 8); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.45)'; rr(ctx, -5, -165, 4, 44, 2); ctx.fill();
      ctx.restore();
    }
    // compteur de tranches
    for (let i = 0; i < this.N; i++) {
      const x = VW / 2 + (i - (this.N - 1) / 2) * 22, y = this.bot + 62, on = i < this.cuts;
      ctx.fillStyle = on ? ac : rgba(this.G.mood.fg, 0.12); circle(ctx, x, y, 7); ctx.fill();
    }
  }
}
