// Outils partagés : maths, couleurs, formes
export const VW = 360, VH = 540;
export const FONT = 'ui-rounded, "SF Pro Rounded", "Nunito", system-ui, -apple-system, sans-serif';
export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export const E = {
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  inCubic: (t) => t * t * t,
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outBack: (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  outElastic: (t) => (t <= 0 ? 0 : t >= 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (TAU / 3)) + 1),
};

// PRNG déterministe (mulberry32) : un niveau = une graine
export function rnd(seed) {
  let a = (seed >>> 0) || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
export function shuffle(r, a) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// ---- Couleurs ----
export function hexToRgb(h) {
  h = h.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map((v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('');
}
const cache = new Map();
export function mix(a, b, t) {
  const k = a + b + t;
  let v = cache.get(k);
  if (v) return v;
  const A = hexToRgb(a), B = hexToRgb(b);
  v = rgbToHex(lerp(A[0], B[0], t), lerp(A[1], B[1], t), lerp(A[2], B[2], t));
  if (cache.size > 4000) cache.clear();
  cache.set(k, v);
  return v;
}
// Les ombres de la DA sont teintées violet profond, jamais noires
export const INK = '#2B1650';
export const shade = (c, amt) => mix(c, '#ffffff', amt);
export const dark = (c, amt) => mix(c, INK, amt);
export function hsl(h, s, l) {
  h = ((h % 360) + 360) % 360; s /= 100; l /= 100;
  const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return rgbToHex(255 * f(0), 255 * f(8), 255 * f(4));
}
export function rgba(hex, a) { const [r, g, b] = hexToRgb(hex); return `rgba(${r},${g},${b},${a})`; }

// ---- Formes ----
export function rr(ctx, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
export function rr4(ctx, x, y, w, h, [tl, tr, br, bl]) {
  ctx.beginPath();
  ctx.moveTo(x + tl, y);
  ctx.lineTo(x + w - tr, y);
  if (tr) ctx.arcTo(x + w, y, x + w, y + tr, tr);
  ctx.lineTo(x + w, y + h - br);
  if (br) ctx.arcTo(x + w, y + h, x + w - br, y + h, br);
  ctx.lineTo(x + bl, y + h);
  if (bl) ctx.arcTo(x, y + h, x, y + h - bl, bl);
  ctx.lineTo(x, y + tl);
  if (tl) ctx.arcTo(x, y, x + tl, y, tl);
  ctx.closePath();
}
export function circle(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, Math.max(0.01, r), 0, TAU); }
export function ellipse(ctx, x, y, rx, ry, rot = 0) {
  ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), rot, 0, TAU);
}

export function fmt(n) {
  n = Math.round(n);
  if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace('.', ',') + ' M';
  if (n >= 1e5) return Math.round(n / 1e3) + ' k';
  return n.toLocaleString('fr-FR');
}
