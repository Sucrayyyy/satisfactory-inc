// Particules et textes flottants (coordonnées virtuelles)
import { TAU, E, rgba, dark, FONT } from './util.js';

export class FX {
  constructor() { this.ps = []; this.tx = []; }
  ring(x, y, col, r0 = 8, r1 = 40, dur = 0.35, w = 3) { this.ps.push({ k: 'ring', x, y, col, r0, r1, dur, w, t: 0 }); }
  burst(x, y, cols, n = 12, sp = 180, sz = 5, grav = 600) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, v = sp * (0.35 + Math.random() * 0.75);
      this.ps.push({ k: 'dot', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - sp * 0.3, grav,
        sz: sz * (0.6 + Math.random() * 0.8), col: cols[i % cols.length], dur: 0.5 + Math.random() * 0.4, t: 0 });
    }
  }
  sparkle(x, y, col, n = 5, spread = 40) {
    for (let i = 0; i < n; i++) this.ps.push({ k: 'star', x: x + (Math.random() - 0.5) * spread * 2,
      y: y + (Math.random() - 0.5) * spread * 2, sz: 5 + Math.random() * 7, col, dur: 0.5 + Math.random() * 0.35, t: -Math.random() * 0.25 });
  }
  hearts(x, y, col, n = 3) {
    for (let i = 0; i < n; i++) this.ps.push({ k: 'heart', x: x + (Math.random() - 0.5) * 70, y, vx: (Math.random() - 0.5) * 40,
      vy: -90 - Math.random() * 60, grav: -20, sz: 8 + Math.random() * 6, col, dur: 0.9 + Math.random() * 0.3, t: -i * 0.07 });
  }
  confetti(x, y, cols, n = 30) {
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4, v = 260 + Math.random() * 280;
      this.ps.push({ k: 'conf', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, grav: 700, sz: 5 + Math.random() * 6,
        col: cols[i % cols.length], rot: Math.random() * TAU, vr: (Math.random() - 0.5) * 14, dur: 1.1 + Math.random() * 0.5, t: 0, round: Math.random() < 0.5 });
    }
  }
  text(x, y, s, col, size = 34) { this.tx.length = 0; this.tx.push({ x, y, s, col, size, t: 0, dur: 1.3 }); }
  update(dt) {
    for (const p of this.ps) {
      p.t += dt;
      if (p.t < 0 || p.vx === undefined) continue;
      p.vy += (p.grav || 0) * dt;
      if (p.k === 'conf') { p.vx *= 1 - dt * 1.8; p.vy *= 1 - dt * 1.2; p.rot += p.vr * dt; }
      p.x += p.vx * dt; p.y += p.vy * dt;
    }
    this.ps = this.ps.filter((p) => p.t < p.dur);
    for (const t of this.tx) t.t += dt;
    this.tx = this.tx.filter((t) => t.t < t.dur);
  }
  draw(ctx) {
    for (const p of this.ps) {
      if (p.t < 0) continue;
      const u = p.t / p.dur;
      if (p.k === 'ring') {
        const r = p.r0 + (p.r1 - p.r0) * E.outCubic(u);
        ctx.strokeStyle = rgba(p.col, 1 - u); ctx.lineWidth = p.w * (1 - u * 0.6);
        ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.stroke();
      } else if (p.k === 'dot') {
        ctx.globalAlpha = 1 - u * u; ctx.fillStyle = p.col;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.sz * (1 - u * 0.5), 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
      } else if (p.k === 'star') {
        star(ctx, p.x, p.y, p.sz * Math.sin(Math.PI * u), p.col);
      } else if (p.k === 'heart') {
        ctx.globalAlpha = 1 - u; heart(ctx, p.x, p.y, p.sz * (0.6 + 0.4 * E.outBack(Math.min(1, u * 3))), p.col); ctx.globalAlpha = 1;
      } else if (p.k === 'conf') {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.globalAlpha = u > 0.75 ? (1 - u) * 4 : 1; ctx.fillStyle = p.col;
        if (p.round) { ctx.beginPath(); ctx.arc(0, 0, p.sz * 0.55, 0, TAU); ctx.fill(); }
        else ctx.fillRect(-p.sz / 2, -p.sz / 4, p.sz, p.sz / 2);
        ctx.restore();
      }
    }
    for (const t of this.tx) {
      const u = t.t / t.dur, sc = E.outBack(Math.min(1, u * 4)), a = u > 0.7 ? (1 - u) / 0.3 : 1;
      ctx.save(); ctx.translate(t.x, t.y - 18 * u); ctx.scale(sc, sc); ctx.globalAlpha = a;
      ctx.font = `900 ${t.size}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
      ctx.lineWidth = t.size * 0.32; ctx.strokeStyle = dark(t.col, 0.4); ctx.strokeText(t.s, 0, 4);
      ctx.strokeStyle = '#fff'; ctx.strokeText(t.s, 0, 0);
      ctx.fillStyle = t.col; ctx.fillText(t.s, 0, 0);
      ctx.restore();
    }
  }
}

export function star(ctx, x, y, s, col) {
  if (s <= 0) return;
  ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x, y - s);
  ctx.quadraticCurveTo(x, y, x + s, y); ctx.quadraticCurveTo(x, y, x, y + s);
  ctx.quadraticCurveTo(x, y, x - s, y); ctx.quadraticCurveTo(x, y, x, y - s); ctx.fill();
}
export function heart(ctx, x, y, s, col) {
  ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x, y + s * 0.9);
  ctx.bezierCurveTo(x - s * 1.4, y, x - s * 0.6, y - s * 1.1, x, y - s * 0.35);
  ctx.bezierCurveTo(x + s * 0.6, y - s * 1.1, x + s * 1.4, y, x, y + s * 0.9); ctx.fill();
}
