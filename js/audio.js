// Moteur sonore 100 % synthétisé (Web Audio) — aucun fichier audio
let ctx = null, master = null, wet = null;
const bufs = {};
export const audioSettings = { sound: true, silent: true, haptics: true };
const S = audioSettings;
const PENTA = [0, 2, 4, 7, 9];

function mkBuf(sec, ch, fn) {
  const sr = ctx.sampleRate, n = Math.floor(sr * sec), b = ctx.createBuffer(ch, n, sr);
  for (let c = 0; c < ch; c++) fn(b.getChannelData(c), n, sr);
  return b;
}
function buildBuffers() {
  bufs.white = mkBuf(2, 1, (d, n) => { for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; });
  bufs.brown = mkBuf(2, 1, (d, n) => {
    let l = 0;
    for (let i = 0; i < n; i++) { l = (l + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = l * 3.5; }
  });
  // Crépitement de film plastique : micro-impulsions éparses
  bufs.crackle = mkBuf(2, 1, (d, n) => {
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * 0.02;
    for (let e = 0; e < 2400; e++) {
      const s = Math.floor(Math.random() * n), len = 20 + Math.floor(Math.random() * 140), amp = Math.pow(Math.random(), 2.2) * 0.9;
      for (let k = 0; k < len && s + k < n; k++) d[s + k] += amp * (Math.random() * 2 - 1) * Math.exp((-k / len) * 5);
    }
  });
  // Texture granuleuse de sable : grains fenêtrés
  bufs.grain = mkBuf(2, 1, (d, n) => {
    for (let e = 0; e < 4600; e++) {
      const s = Math.floor(Math.random() * n), len = 30 + Math.floor(Math.random() * 160), amp = 0.15 + Math.random() * 0.6;
      for (let k = 0; k < len && s + k < n; k++) d[s + k] += amp * Math.sin((Math.PI * k) / len) * (Math.random() * 2 - 1);
    }
  });
  bufs.imp = mkBuf(1.8, 2, (d, n) => { for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3.4); });
}

export function initAudio() {
  if (ctx) { if (ctx.state !== 'running') ctx.resume().catch(() => {}); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  applySession();
  ctx = new AC({ latencyHint: 'interactive' });
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 4; comp.attack.value = 0.002; comp.release.value = 0.15;
  master = ctx.createGain(); master.gain.value = S.sound ? 0.9 : 0;
  master.connect(comp); comp.connect(ctx.destination);
  buildBuffers();
  const conv = ctx.createConvolver(); conv.buffer = bufs.imp;
  wet = ctx.createGain(); wet.gain.value = 0.55; wet.connect(conv); conv.connect(master);
  const s = ctx.createBufferSource(); s.buffer = ctx.createBuffer(1, 1, 22050); s.connect(ctx.destination); s.start(0);
  ctx.resume().catch(() => {});
}
function applySession() {
  // iOS 17+ : "playback" = le son passe même en mode silencieux
  try { if (navigator.audioSession) navigator.audioSession.type = S.silent ? 'playback' : 'ambient'; } catch (e) {}
}
export function setSound(on) { S.sound = on; if (master) master.gain.setTargetAtTime(on ? 0.9 : 0, ctx.currentTime, 0.02); }
export function setSilent(on) { S.silent = on; applySession(); }

const ok = () => ctx && S.sound;
function route(node, rev = 0, pan = 0) {
  let n = node;
  if (pan && ctx.createStereoPanner) {
    const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); n.connect(p); n = p;
  }
  n.connect(master);
  if (rev > 0) { const s = ctx.createGain(); s.gain.value = rev; n.connect(s); s.connect(wet); }
}
function env(g, t, a, d, peak) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
}
function tone(o) {
  if (!ok()) return;
  const t = ctx.currentTime + (o.t || 0), a = o.a ?? 0.003, d = o.d ?? 0.15;
  const osc = ctx.createOscillator(); osc.type = o.type || 'sine';
  osc.frequency.setValueAtTime(o.f, t);
  if (o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2, t + (o.glide || 0.05));
  const g = ctx.createGain(); env(g, t, a, d, o.g ?? 0.3);
  osc.connect(g); route(g, o.rev, o.pan);
  osc.start(t); osc.stop(t + a + d + 0.05);
}
function noise(o) {
  if (!ok()) return;
  const t = ctx.currentTime + (o.t || 0), a = o.a ?? 0.002, d = o.d ?? 0.08;
  const b = bufs[o.buf || 'white'];
  const src = ctx.createBufferSource(); src.buffer = b; src.playbackRate.value = o.rate || 1;
  const f = ctx.createBiquadFilter(); f.type = o.type || 'bandpass';
  f.frequency.setValueAtTime(o.f || 1000, t);
  if (o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, t + (o.glide || d));
  f.Q.value = o.q ?? 1;
  const g = ctx.createGain(); env(g, t, a, d, o.g ?? 0.3);
  src.connect(f); f.connect(g); route(g, o.rev, o.pan);
  src.start(t, Math.random() * (b.duration - 1)); src.stop(t + a + d + 0.05);
}
function bell(f, t = 0, g = 0.12, rev = 0.45, d = 0.9) {
  tone({ f, t, a: 0.002, d, g, rev });
  tone({ f: f * 2.01, t, a: 0.002, d: d * 0.4, g: g * 0.35, rev });
  tone({ f: f * 3.98, t, a: 0.001, d: d * 0.14, g: g * 0.12, rev });
}
const semi = (base, n) => base * Math.pow(2, n / 12);

// Voix continue (film qui se décolle, couteau dans le sable)
export function loopVoice(buf, type, f, q) {
  if (!ctx) return { set() {}, stop() {} };
  const src = ctx.createBufferSource(); src.buffer = bufs[buf]; src.loop = true;
  const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
  const g = ctx.createGain(); g.gain.value = 0;
  src.connect(fl); fl.connect(g); route(g, 0.06);
  src.start();
  let dead = false;
  return {
    set(v, ff) {
      if (dead) return;
      g.gain.setTargetAtTime(S.sound ? v : 0, ctx.currentTime, 0.025);
      if (ff) fl.frequency.setTargetAtTime(ff, ctx.currentTime, 0.05);
    },
    stop() { if (dead) return; dead = true; g.gain.setTargetAtTime(0, ctx.currentTime, 0.04); src.stop(ctx.currentTime + 0.4); },
  };
}

export const Sfx = {
  pop(f = 520, pan = 0) {
    tone({ f: f * 1.9, f2: f, glide: 0.045, d: 0.13, g: 0.42, rev: 0.12, pan });
    tone({ type: 'triangle', f: f * 0.5, f2: f * 0.4, glide: 0.05, d: 0.06, g: 0.16, pan });
    noise({ type: 'highpass', f: 2500, d: 0.012, g: 0.12, pan });
  },
  wrap(pan = 0) {
    noise({ f: 1800 + Math.random() * 1600, q: 1.3, a: 0.0005, d: 0.02 + Math.random() * 0.015, g: 0.9, pan });
    noise({ type: 'lowpass', f: 700, d: 0.035, g: 0.35, pan });
    tone({ f: 190 + Math.random() * 60, f2: 80, glide: 0.03, d: 0.04, g: 0.2, pan });
  },
  flip() {
    noise({ f: 500, f2: 2400, glide: 0.22, q: 1.2, a: 0.04, d: 0.22, g: 0.32 });
    tone({ f: 260, f2: 520, glide: 0.18, a: 0.02, d: 0.2, g: 0.08, rev: 0.2 });
  },
  key(sw, up = false, pan = 0) {
    const v = 0.88 + Math.random() * 0.24;
    switch (sw) {
      case 'bleu':
        if (!up) { noise({ type: 'highpass', f: 4200, a: 0.0005, d: 0.008, g: 0.9, pan }); tone({ f: 2600 * v, d: 0.012, g: 0.1, pan }); noise({ f: 1200, d: 0.03, g: 0.35, pan }); tone({ f: 200 * v, f2: 130, glide: 0.04, d: 0.05, g: 0.2, pan }); }
        else { noise({ type: 'highpass', f: 3800, d: 0.007, g: 0.6, pan }); noise({ f: 1600, d: 0.02, g: 0.2, pan }); }
        break;
      case 'marbre':
        if (!up) { tone({ f: 1180 * v, d: 0.07, g: 0.11, pan }); tone({ f: 1770 * v, d: 0.05, g: 0.06, pan }); noise({ f: 2600 * v, q: 2, d: 0.02, g: 0.5, pan }); tone({ f: 300 * v, f2: 200, glide: 0.03, d: 0.04, g: 0.2, pan }); }
        else { tone({ f: 1500 * v, d: 0.04, g: 0.05, pan }); noise({ f: 3200, q: 2, d: 0.012, g: 0.25, pan }); }
        break;
      case 'bulle':
        if (!up) { tone({ f: 520 * v, f2: 240, glide: 0.04, d: 0.09, g: 0.35, pan }); noise({ f: 900, d: 0.02, g: 0.3, pan }); }
        else tone({ f: 330 * v, f2: 600, glide: 0.04, d: 0.05, g: 0.12, pan });
        break;
      case 'typo':
        if (!up) { noise({ type: 'highpass', f: 2500, a: 0.0005, d: 0.02, g: 0.9, pan }); noise({ f: 700, q: 2.5, d: 0.06, g: 0.4, pan }); tone({ f: 2100 * v, d: 0.03, g: 0.05, pan }); tone({ f: 110, f2: 70, glide: 0.05, d: 0.06, g: 0.3, pan }); }
        else noise({ f: 1800, q: 2, d: 0.02, g: 0.2, pan });
        break;
      default: // crème : thock
        if (!up) { noise({ f: 850 * v, q: 1.4, a: 0.001, d: 0.028, g: 0.7, pan }); tone({ f: 150 * v, f2: 95, glide: 0.05, a: 0.002, d: 0.07, g: 0.35, pan }); noise({ type: 'lowpass', f: 500, d: 0.05, g: 0.3, pan }); }
        else { noise({ f: 1500 * v, q: 1.5, d: 0.018, g: 0.3, pan }); tone({ f: 230 * v, f2: 160, glide: 0.03, d: 0.035, g: 0.1, pan }); }
    }
  },
  ding() { bell(2093, 0, 0.14, 0.5, 1.3); },
  squish(k = 1) {
    noise({ buf: 'brown', f: 260, f2: 800, glide: 0.16, q: 3.5, a: 0.01, d: 0.22, g: 0.9 * k });
    tone({ f: 120, f2: 62, glide: 0.12, a: 0.005, d: 0.16, g: 0.3 * k });
    tone({ f: 620, f2: 300, glide: 0.05, t: 0.04, d: 0.05, g: 0.05 });
    tone({ f: 520, f2: 240, glide: 0.05, t: 0.09, d: 0.05, g: 0.04 });
  },
  unsquish() { noise({ buf: 'brown', type: 'lowpass', f: 250, f2: 1500, glide: 1.1, q: 0.8, a: 0.12, d: 1.0, g: 0.35 }); },
  boop(i = 0) { const f = semi(660, PENTA[i % 5] + 12 * Math.floor((i % 10) / 5)); tone({ f, f2: f * 1.5, glide: 0.08, d: 0.12, g: 0.12, rev: 0.35 }); },
  peelStart() { noise({ buf: 'crackle', type: 'highpass', f: 1400, d: 0.14, g: 0.6 }); },
  springBack() { tone({ f: 420, f2: 280, glide: 0.08, d: 0.1, g: 0.12 }); noise({ buf: 'crackle', f: 3000, d: 0.06, g: 0.25 }); },
  whoosh() { noise({ f: 350, f2: 2600, glide: 0.3, q: 1.4, a: 0.06, d: 0.32, g: 0.42 }); },
  shine() { [0, 4, 7, 12, 16].forEach((n, i) => tone({ f: semi(1568, n), t: i * 0.045, d: 0.4, g: 0.05, rev: 0.6 })); },
  cut() { noise({ buf: 'grain', f: 3200, q: 0.7, a: 0.004, d: 0.14, g: 0.8 }); noise({ type: 'lowpass', f: 900, d: 0.08, g: 0.2 }); },
  crumble() {
    noise({ buf: 'grain', type: 'lowpass', f: 1600, f2: 500, glide: 0.4, a: 0.01, d: 0.45, g: 1.0 });
    tone({ f: 95, f2: 48, glide: 0.1, d: 0.12, g: 0.25 });
  },
  perfect() { bell(semi(1046, 7), 0, 0.08, 0.5, 0.5); bell(semi(1046, 12), 0.06, 0.07, 0.5, 0.6); },
  success() { [0, 4, 7, 12].forEach((n, i) => bell(semi(784, n), i * 0.07, 0.1)); },
  level() {
    [0, 4, 7, 12, 16, 19].forEach((n, i) => bell(semi(523, n), i * 0.08, 0.1, 0.55, 1.2));
    [0, 4, 7].forEach((n) => tone({ type: 'triangle', f: semi(262, n), a: 0.15, d: 1.6, g: 0.05, rev: 0.6 }));
  },
  coin(i = 0) { const f = semi(1318, (i % 8) * 2); tone({ f, f2: f * 1.25, glide: 0.03, d: 0.09, g: 0.08, rev: 0.3 }); },
  ui() { tone({ f: 540, f2: 820, glide: 0.05, d: 0.08, g: 0.15, rev: 0.1 }); noise({ type: 'highpass', f: 3000, d: 0.008, g: 0.07 }); },
  back() { tone({ f: 700, f2: 460, glide: 0.06, d: 0.08, g: 0.13 }); },
  bonk() { tone({ f: 210, f2: 150, glide: 0.08, d: 0.12, g: 0.26 }); tone({ type: 'triangle', f: 105, d: 0.08, g: 0.1 }); },
  buy() { bell(1046, 0, 0.1); bell(1568, 0.08, 0.1); this.shine(); },
  gift() { [0, 7, 12, 16, 19, 24].forEach((n, i) => bell(semi(659, n), i * 0.06, 0.08)); },
};

// Haptique : vibrate() sur Android, astuce <input switch> sur iOS 18+
let hl = null, lastH = 0;
export function haptic(ms = 8) {
  if (!S.haptics) return;
  const now = performance.now();
  if (now - lastH < 35) return;
  lastH = now;
  if (navigator.vibrate) { try { navigator.vibrate(ms); } catch (e) {} return; }
  if (!hl) {
    hl = document.createElement('label');
    hl.style.cssText = 'position:fixed;left:-200px;top:-200px;opacity:0;pointer-events:none;';
    const i = document.createElement('input'); i.type = 'checkbox'; i.setAttribute('switch', '');
    hl.appendChild(i); document.body.appendChild(hl);
  }
  hl.click();
}
