// Poste "Clavier" : macro-pad à keycaps bien épaisses
import { Sfx, haptic } from '../audio.js';
import { VW, clamp, E, hsl, shade, dark, rgba, pick, shuffle, rr, FONT } from '../util.js';

const WORDS = {
  3: ['POP', 'ZEN', 'MOU', 'AMI', 'WOW', 'ZAP', 'BIP', 'ZOU', 'OUF'],
  4: ['DOUX', 'CLIC', 'PLOP', 'COOL', 'MIEL', 'SOIE', 'JOIE', 'FLOU', 'ZOOM', 'CHIC', 'NUIT', 'LAIT'],
  5: ['CALME', 'BULLE', 'MOCHI', 'SABLE', 'NUAGE', 'COTON', 'BISOU', 'CHILL', 'COCON', 'PIXEL', 'RELAX', 'SUCRE', 'PLOUF'],
  6: ['BONBON', 'SOUPLE', 'TENDRE', 'SIESTE', 'POUDRE', 'FONDRE', 'SORBET', 'SQUISH', 'BULLES', 'VELOUR'],
  7: ['DOUCEUR', 'VELOURS', 'CARAMEL', 'CLAVIER', 'SOURIRE', 'CERISES', 'LUMIERE', 'PLAISIR'],
  8: ['GUIMAUVE', 'HARMONIE', 'PAPILLON', 'MOELLEUX', 'PAISIBLE', 'SERENITE', 'CROUSTIL'],
  9: ['SATISFAIT', 'CHAMALLOW', 'DOUCEMENT', 'FRAMBOISE', 'TRANQUILE'],
};
const CAPSETS = [
  (ac, i) => ({ cap: '#FFFFFF', leg: '#3A2D52' }),
  (ac, i) => ({ cap: hsl(i * 40, 85, 82), leg: dark(hsl(i * 40, 85, 60), 0.55) }),
  (ac, i) => ({ cap: i % 3 === 1 ? '#FF8A4C' : '#EDE6D6', leg: i % 3 === 1 ? '#fff' : '#4A4237' }),
  (ac, i) => ({ cap: '#2E2A44', leg: '#F5EFFF' }),
  (ac, i) => ({ cap: shade(ac, 0.55), leg: dark(ac, 0.5) }),
  (ac, i) => ({ cap: i % 2 ? '#BDE8D2' : '#F7F3EA', leg: '#2F4A3D' }),
];

export class KeysStation {
  constructor(G, o) {
    this.G = G; this.r = o.r;
    const r = o.r, lv = o.level || 1;
    this.hint = 'Tape le mot sur les touches';
    this.sw = G.save.eq.sw;
    const len = clamp(3 + Math.floor((lv - 2) / 3), 3, 9);
    const nWords = lv < 6 ? 1 : lv < 14 ? 2 : 3;
    this.words = [];
    for (let i = 0; i < nWords; i++) {
      const L = clamp(len - i, 3, 9);
      let w, guard = 0;
      do { w = pick(r, WORDS[L]); } while (this.words.includes(w) && guard++ < 10);
      this.words.push(w);
    }
    this.capset = pick(r, CAPSETS);
    this.wi = 0; this.t = 0;
    this.setupWord();
  }
  setupWord() {
    const r = this.r, w = this.words[this.wi];
    this.word = w; this.idx = 0; this.state = 'play'; this.wave = 0; this.idle = 0;
    this.slots = [...w].map((ch) => ({ ch, t: 0, filled: false, shake: 0 }));
    const uniq = [...new Set(w)];
    const total = uniq.length <= 6 ? 9 : uniq.length <= 9 ? 12 : 16, cols = total === 9 ? 3 : 4;
    const pool = shuffle(r, 'ABCDEFGHIJKLMNOPRSTUVZ'.split('').filter((c) => !uniq.includes(c)));
    const letters = shuffle(r, [...uniq, ...pool.slice(0, total - uniq.length)]);
    const gap = 12, k = Math.min(86, (330 - gap * (cols - 1)) / cols), gw = cols * k + (cols - 1) * gap;
    const rows = total / cols, x0 = VW / 2 - gw / 2, y0 = 200 + (4 - rows) * (k + gap) * 0.35;
    this.keys = letters.map((ch, i) => {
      const cs = this.capset(this.G.mood.ac, Math.floor(i / cols) + (i % cols));
      return { ch, x: x0 + (i % cols) * (k + gap), y: y0 + Math.floor(i / cols) * (k + gap), w: k, h: k, p: 0, target: 0, pid: null, flash: 0, err: 0, cap: cs.cap, leg: cs.leg };
    });
    this.appear = 0;
  }
  hit(x, y) { return this.keys.find((k) => x >= k.x - 5 && x <= k.x + k.w + 5 && y >= k.y - 5 && y <= k.y + k.h + 12); }
  down(x, y, id) { const k = this.hit(x, y); if (!k || k.pid !== null) return; k.pid = id; this.press(k); }
  up(x, y, id) { const k = this.keys.find((k) => k.pid === id); if (k) { k.pid = null; this.release(k); } }
  key(ch) { const k = this.keys.find((k) => k.ch === ch); if (k && k.target === 0) { this.press(k); setTimeout(() => this.release(k), 90); } }
  press(k) {
    k.target = 1;
    Sfx.key(this.sw, false, (k.x + k.w / 2 - VW / 2) / VW);
    haptic(9); this.idle = 0; this.G.stat('keys');
    if (this.state !== 'play') return;
    if (k.ch === this.word[this.idx]) {
      const s = this.slots[this.idx]; s.filled = true; s.t = 0; this.idx++; k.flash = 1;
      if (this.idx === this.word.length) this.wordDone();
    } else {
      this.slots[this.idx].shake = 1; k.err = 1;
      setTimeout(() => Sfx.bonk(), 30);
    }
  }
  release(k) { k.target = 0; Sfx.key(this.sw, true, (k.x + k.w / 2 - VW / 2) / VW); }
  wordDone() {
    this.state = 'wave'; this.wave = 0;
    setTimeout(() => (this.sw === 'typo' ? Sfx.ding() : Sfx.perfect()), 120);
    const sl = this.slotGeom();
    this.G.fx.sparkle(VW / 2, sl.y + sl.s / 2, this.G.mood.ac, 7, sl.total / 2);
  }
  slotGeom() {
    const n = this.word.length, s = Math.min(48, (330 - (n - 1) * 6) / n), total = n * s + (n - 1) * 6;
    return { s, total, x0: VW / 2 - total / 2, y: 90 };
  }
  update(dt) {
    this.t += dt; this.idle += dt; this.appear = Math.min(1, this.appear + dt / 0.4);
    for (const k of this.keys) {
      k.p += (k.target - k.p) * Math.min(1, dt * 38);
      k.flash = Math.max(0, k.flash - dt * 2.5); k.err = Math.max(0, k.err - dt * 3);
    }
    for (const s of this.slots) { s.t = Math.min(1, s.t + dt / 0.3); s.shake = Math.max(0, s.shake - dt * 3); }
    if (this.state === 'wave') {
      this.wave += dt;
      if (this.wave > 0.95) {
        this.wi++;
        if (this.wi < this.words.length) this.setupWord();
        else { this.state = 'done'; this.G.complete({}); }
      }
    }
  }
  draw(ctx) {
    const ac = this.G.mood.ac, fg = this.G.mood.fg, sl = this.slotGeom();
    // mot
    this.slots.forEach((s, i) => {
      const wave = this.state === 'wave' ? Math.sin(Math.PI * clamp(this.wave * 3 - i * 0.18, 0, 1)) : 0;
      const x = sl.x0 + i * (sl.s + 6) + Math.sin(s.shake * 30) * 5 * s.shake, y = sl.y - wave * 14;
      if (!s.filled) {
        ctx.fillStyle = rgba(fg, 0.08); rr(ctx, x, y, sl.s, sl.s * 1.12, 12); ctx.fill();
        ctx.strokeStyle = rgba(fg, i === this.idx ? 0.45 : 0.16); ctx.lineWidth = 2; ctx.setLineDash([5, 5]); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = rgba(fg, i === this.idx ? 0.55 : 0.3); ctx.font = `900 ${sl.s * 0.56}px ${FONT}`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(s.ch, x + sl.s / 2, y + sl.s * 0.58);
      } else {
        const sc = E.outBack(s.t);
        ctx.save(); ctx.translate(x + sl.s / 2, y + sl.s * 0.56); ctx.scale(sc, sc);
        ctx.fillStyle = dark(ac, 0.3); rr(ctx, -sl.s / 2, -sl.s * 0.56 + 5, sl.s, sl.s * 1.12, 12); ctx.fill();
        ctx.fillStyle = ac; rr(ctx, -sl.s / 2, -sl.s * 0.56, sl.s, sl.s * 1.12, 12); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.35)'; rr(ctx, -sl.s / 2 + 5, -sl.s * 0.56 + 4, sl.s - 10, sl.s * 0.3, 6); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = `900 ${sl.s * 0.6}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(s.ch, 0, 2); ctx.restore();
      }
    });
    if (this.words.length > 1) {
      for (let i = 0; i < this.words.length; i++) {
        ctx.fillStyle = i < this.wi ? ac : rgba(fg, i === this.wi ? 0.4 : 0.15);
        ctx.beginPath(); ctx.arc(VW / 2 + (i - (this.words.length - 1) / 2) * 16, sl.y - 22, 4, 0, Math.PI * 2); ctx.fill();
      }
    }
    // touches
    const next = this.word[this.idx], hintOn = this.idle > 2.6 && this.state === 'play';
    const ap = E.outBack(this.appear);
    for (const k of this.keys) {
      ctx.save();
      ctx.translate(k.x + k.w / 2 + Math.sin(k.err * 40) * 3 * k.err, k.y + k.h / 2); ctx.scale(ap, ap); ctx.translate(-k.w / 2, -k.h / 2);
      drawKey(ctx, k, ac, hintOn && k.ch === next ? 0.5 + 0.5 * Math.sin(this.t * 6) : 0);
      ctx.restore();
    }
  }
}

function drawKey(ctx, k, ac, glow) {
  const depth = 10, p = k.p, w = k.w, h = k.h, c = k.cap, yy = p * (depth - 2);
  ctx.fillStyle = dark(c, 0.45); rr(ctx, 0, depth, w, h - 2, 18); ctx.fill();
  ctx.fillStyle = dark(c, 0.14); rr(ctx, 0, yy, w, h, 18); ctx.fill();
  const ins = 7, g = ctx.createLinearGradient(0, yy, 0, yy + h);
  g.addColorStop(0, shade(c, 0.4)); g.addColorStop(1, c);
  ctx.fillStyle = g; rr(ctx, ins, yy + 3, w - ins * 2, h - ins * 2 - 3, 13); ctx.fill();
  if (k.flash > 0) { ctx.fillStyle = rgba(ac, 0.6 * k.flash); rr(ctx, 0, yy, w, h, 18); ctx.fill(); }
  if (glow > 0) { ctx.strokeStyle = rgba(ac, glow); ctx.lineWidth = 4; rr(ctx, -3, yy - 3, w + 6, h + 6, 20); ctx.stroke(); }
  ctx.fillStyle = 'rgba(255,255,255,.5)'; rr(ctx, ins + 5, yy + 6, w * 0.35, 5, 3); ctx.fill();
  ctx.fillStyle = k.leg; ctx.font = `900 ${w * 0.38}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(k.ch, w / 2, yy + 3 + (h - ins * 2 - 3) / 2 + 1);
}
