// Satisfactory Inc. — boucle de jeu, progression infinie, Atelier, Zen
import { Sfx, initAudio, haptic, audioSettings, setSound, setSilent } from './audio.js';
import { FX } from './fx.js';
import { VW, VH, rnd, pick, clamp, E, dark, shade, fmt } from './util.js';
import { AMBIANCES, SWITCHES, SQUISHIES, rankName, PRAISE } from './data.js';
import { PopStation, WrapStation } from './stations/pop.js';
import { FilmStation } from './stations/film.js';
import { KeysStation } from './stations/keys.js';
import { SquishStation, drawSquishyIcon } from './stations/squish.js';
import { SandStation } from './stations/sand.js';

const STATIONS = {
  pop: { name: 'Pop it', cls: PopStation, unlock: 1 },
  film: { name: 'Film protecteur', cls: FilmStation, unlock: 1 },
  keys: { name: 'Clavier', cls: KeysStation, unlock: 2 },
  squish: { name: 'Squishy', cls: SquishStation, unlock: 3 },
  sand: { name: 'Sable cinétique', cls: SandStation, unlock: 4 },
  wrap: { name: 'Papier bulle', cls: WrapStation, unlock: 5 },
};
const ICONS = {
  pop: '<svg viewBox="0 0 54 54"><rect x="4" y="4" width="46" height="46" rx="14" fill="#FF7AA8"/><g fill="#FFC2D7"><circle cx="17" cy="17" r="7"/><circle cx="37" cy="17" r="7"/><circle cx="17" cy="37" r="7"/></g><circle cx="37" cy="37" r="7" fill="#C94F7C"/></svg>',
  film: '<svg viewBox="0 0 54 54"><rect x="12" y="3" width="30" height="48" rx="9" fill="#8DC8FF"/><rect x="15" y="6" width="24" height="42" rx="6" fill="#4A7BD6"/><path d="M39 6v14L25 6z" fill="#fff"/></svg>',
  keys: '<svg viewBox="0 0 54 54"><rect x="6" y="12" width="42" height="36" rx="11" fill="#9A8BC9"/><rect x="6" y="6" width="42" height="36" rx="11" fill="#EDE8FF"/><text x="27" y="31" font-size="20" font-weight="900" text-anchor="middle" fill="#3A2D52" font-family="ui-rounded,Nunito,sans-serif">A</text></svg>',
  squish: '<svg viewBox="0 0 54 54"><ellipse cx="27" cy="31" rx="23" ry="18" fill="#FFC9DA"/><circle cx="19" cy="30" r="2.8" fill="#2B1650"/><circle cx="35" cy="30" r="2.8" fill="#2B1650"/><ellipse cx="17" cy="21" rx="6" ry="3" fill="#fff" transform="rotate(-25 17 21)"/></svg>',
  sand: '<svg viewBox="0 0 54 54"><rect x="6" y="16" width="34" height="11" fill="#FFB3C7"/><rect x="6" y="27" width="34" height="11" fill="#FFE08A"/><rect x="6" y="38" width="34" height="10" fill="#9EE6C9"/><rect x="44" y="4" width="4" height="40" rx="2" fill="#7C6AF0"/></svg>',
  wrap: '<svg viewBox="0 0 54 54"><rect x="4" y="4" width="46" height="46" rx="12" fill="#D9ECFF"/><g fill="#fff" stroke="#9CC7F2" stroke-width="2"><circle cx="16" cy="17" r="7"/><circle cx="38" cy="17" r="7"/><circle cx="27" cy="36" r="7"/></g></svg>',
};

// ---------- Sauvegarde ----------
const KEY = 'satisfactory-inc-v1';
const DEF = {
  level: 1, coins: 0, owned: { amb: ['bonbon'], sw: ['creme'], sq: ['mochi'] }, eq: { amb: 'bonbon', sw: 'creme' },
  prime: 0, tip: 0, settings: { sound: true, haptics: true, silent: true }, daily: { last: '', streak: 0 },
  stats: { pops: 0, films: 0, keys: 0, squish: 0, cuts: 0, tasks: 0 },
};
function merge(a, b) { for (const k in b) a[k] = b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) ? merge(a[k] || {}, b[k]) : b[k]; return a; }
function load() { try { const s = JSON.parse(localStorage.getItem(KEY)); if (s) return merge(JSON.parse(JSON.stringify(DEF)), s); } catch (e) {} return JSON.parse(JSON.stringify(DEF)); }
const save = load();
function persist() { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) {} }
Object.assign(audioSettings, save.settings);

const $ = (s) => document.querySelector(s);
const cv = $('#stage'), ctx = cv.getContext('2d');
const G = {
  ctx, save, fx: new FX(), mode: 'home', station: null, trans: null, view: { s: 1, ox: 0, oy: 0 }, W: 0, H: 0, dpr: 1, mood: null,
  stat(k, n = 1) { save.stats[k] = (save.stats[k] || 0) + n; },
  complete(info) { onComplete(info || {}); },
};
const mult = () => 1 + 0.25 * save.prime;
const tipChance = () => Math.min(0.5, 0.04 * save.tip);
const safe = { t: 0, b: 0 };

// ---------- Ambiance ----------
function setMood(lv) {
  const amb = AMBIANCES.find((a) => a.id === save.eq.amb) || AMBIANCES[0];
  const m = amb.moods[(lv - 1) % amb.moods.length];
  G.mood = { ...m, dark: !!amb.dark };
  const st = document.documentElement.style;
  st.setProperty('--bg', m.bg); st.setProperty('--ac', m.ac); st.setProperty('--fg', m.fg); st.setProperty('--ac-d', dark(m.ac, 0.3));
  document.documentElement.classList.toggle('dark', !!amb.dark);
  $('meta[name=theme-color]').setAttribute('content', m.bg);
}

// ---------- Canvas ----------
function resize() {
  const p = getComputedStyle($('#probe'));
  safe.t = parseFloat(p.paddingTop) || 0; safe.b = parseFloat(p.paddingBottom) || 0;
  G.dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  G.W = innerWidth; G.H = innerHeight;
  cv.width = Math.round(G.W * G.dpr); cv.height = Math.round(G.H * G.dpr);
  layoutView();
}
function layoutView() {
  const st = G.station;
  if (!st) return;
  const box = st.box || { x: 0, y: 30, w: VW, h: VH - 30 };
  let top, bot;
  if (G.mode === 'home') { top = $('#tagline').getBoundingClientRect().bottom + 4; bot = $('#homeActions').getBoundingClientRect().top - 4; }
  else { top = safe.t + 62; bot = G.H - safe.b - 66; }
  const aw = G.W - 12, ah = Math.max(80, bot - top);
  const s = Math.min(aw / box.w, ah / box.h, G.mode === 'home' ? 1.5 : 1.9);
  G.view = { s, ox: G.W / 2 - (box.x + box.w / 2) * s, oy: top + ah / 2 - (box.y + box.h / 2) * s };
}
const toScreen = (x, y) => ({ x: G.view.ox + x * G.view.s, y: G.view.oy + y * G.view.s });
const toV = (e) => ({ x: (e.clientX - G.view.ox) / G.view.s, y: (e.clientY - G.view.oy) / G.view.s });

function loadStation(st, instant) {
  const prev = G.station;
  G.station = st;
  layoutView();
  if (instant || !prev) { prev && prev.destroy && prev.destroy(); G.trans = null; }
  else G.trans = { from: prev, t: 0, dur: 0.6 };
  hint(G.mode === 'home' ? null : st.hint);
}
function fadeSwap(fn) {
  cv.classList.add('fade');
  setTimeout(() => { fn(); cv.classList.remove('fade'); }, 230);
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (G.station) G.station.update(dt);
  if (G.trans) {
    G.trans.t += dt / G.trans.dur;
    if (G.trans.t >= 1) { G.trans.from.destroy && G.trans.from.destroy(); G.trans = null; }
  }
  G.fx.update(dt);
  const d = G.dpr, { s, ox, oy } = G.view;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height);
  const drawSt = (st, off) => { ctx.setTransform(d * s, 0, 0, d * s, d * (ox + off), d * oy); st.draw(ctx); };
  if (G.trans) {
    const e = E.inOutCubic(clamp(G.trans.t, 0, 1));
    drawSt(G.trans.from, -e * G.W); drawSt(G.station, (1 - e) * G.W);
  } else if (G.station) drawSt(G.station, 0);
  ctx.setTransform(d * s, 0, 0, d * s, d * ox, d * oy); G.fx.draw(ctx);
  requestAnimationFrame(frame);
}

// ---------- Entrées ----------
cv.addEventListener('pointerdown', (e) => {
  initAudio();
  if (!G.station || G.trans) return;
  try { cv.setPointerCapture(e.pointerId); } catch (err) {}
  const p = toV(e); G.station.down && G.station.down(p.x, p.y, e.pointerId);
});
cv.addEventListener('pointermove', (e) => {
  if (!G.station || G.trans) return;
  const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
  for (const ev of evs.length ? evs : [e]) { const p = toV(ev); G.station.move && G.station.move(p.x, p.y, e.pointerId); }
});
const upH = (e) => { if (!G.station) return; const p = toV(e); G.station.up && G.station.up(p.x, p.y, e.pointerId); };
cv.addEventListener('pointerup', upH);
cv.addEventListener('pointercancel', upH);
document.addEventListener('touchmove', (e) => { if (e.target === cv) e.preventDefault(); }, { passive: false });
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());
for (const ev of ['pointerdown', 'touchend', 'click', 'keydown']) document.addEventListener(ev, initAudio, { capture: true });
window.addEventListener('keydown', (e) => {
  if (/^[a-z]$/i.test(e.key) && G.station && G.station.key && !G.trans) G.station.key(e.key.toUpperCase());
});
document.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (b && !b.dataset.silent) { Sfx.ui(); haptic(6); }
});
document.addEventListener('visibilitychange', () => { if (document.hidden) persist(); else initAudio(); });
window.addEventListener('resize', resize);

// ---------- Interface ----------
let shown = save.coins;
function renderCoins() { $('#coinText').textContent = fmt(shown); }
function bump(el) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
function addCoins(n, x, y) { save.coins += n; persist(); flyCoins(n, x, y); }
function spend(n) { save.coins -= n; shown = save.coins; renderCoins(); persist(); }
function flyCoins(n, x, y) {
  const pill = $('#coinPill'), pr = pill.getBoundingClientRect(), tx = pr.left + 26, ty = pr.top + pr.height / 2;
  const k = clamp(Math.ceil(n / 8), 3, 10);
  for (let i = 0; i < k; i++) {
    const el = document.createElement('div'); el.className = 'fly bub'; document.body.appendChild(el);
    const sx = x + (Math.random() - 0.5) * 70, sy = y + (Math.random() - 0.5) * 40;
    const mx = (sx + tx) / 2 + (Math.random() - 0.5) * 140, my = Math.min(sy, ty) - 40 - Math.random() * 80;
    const a = el.animate([
      { transform: `translate(${sx}px,${sy}px) scale(.3)`, opacity: 0 },
      { transform: `translate(${mx}px,${my}px) scale(1.25)`, opacity: 1, offset: 0.45 },
      { transform: `translate(${tx}px,${ty}px) scale(.7)`, opacity: 1 },
    ], { duration: 640 + i * 30, delay: i * 60, easing: 'cubic-bezier(.5,0,.3,1)', fill: 'forwards' });
    a.onfinish = () => {
      el.remove();
      shown = i === k - 1 ? save.coins : Math.min(save.coins, Math.round(shown + n / k));
      renderCoins(); bump(pill); Sfx.coin(i);
    };
  }
}
function hint(t) {
  const h = $('#hint');
  if (!t) { h.classList.add('off'); return; }
  h.textContent = t; h.classList.remove('off');
}
let bannerT = 0;
function banner(t) {
  const b = $('#banner'); b.textContent = t; b.classList.add('show');
  clearTimeout(bannerT); bannerT = setTimeout(() => b.classList.remove('show'), 2600);
}
function setHud() {
  const m = G.mode;
  $('#btnHome').classList.toggle('hidden', m === 'home');
  $('#btnGear').classList.toggle('hidden', m !== 'home');
  $('#lvlPill').classList.toggle('hidden', m === 'home');
  if (m === 'level') { $('#lvlText').textContent = `Niveau ${save.level}`; renderDots(); }
  if (m === 'zen') { $('#lvlText').textContent = `Zen · ${STATIONS[G.zk].name}`; $('#dots').innerHTML = ''; }
}
function renderDots() {
  $('#dots').innerHTML = G.tasks.map((_, i) => `<i class="${i < G.ti ? 'on' : ''}"></i>`).join('');
}
function buildLogo() {
  const w = 'satisfactory';
  $('#logo').innerHTML = [...w].map((c, i) => `<span class="l" style="animation-delay:${i * 0.07}s">${c}</span>`).join('') + '<span class="inc">inc.</span>';
}
const rankIdx = (lv) => Math.floor((lv - 1) / 5);
function updateHome() {
  const lv = save.level, ri = rankIdx(lv);
  $('#playLvl').textContent = `Niveau ${lv}`;
  $('#rankName').textContent = rankName(ri);
  $('#rankNext').textContent = `Promotion au niveau ${(ri + 1) * 5 + 1}`;
  requestAnimationFrame(() => ($('#rankBar').style.width = `${(((lv - 1) % 5) / 5) * 100 + 4}%`));
  $('#btnGift').classList.toggle('has', giftAvailable());
}

// ---------- Modes ----------
function showHome() {
  closeSheet(); closeModal();
  G.mode = 'home'; setMood(save.level);
  $('#home').classList.add('show'); setHud(); updateHome();
  fadeSwap(() => loadStation(new SquishStation(G, { mascot: true }), true));
}
function genLevel(lv) {
  if (lv === 1) return [{ k: 'pop', seed: 11 }, { k: 'film', seed: 12 }, { k: 'pop', seed: 13 }];
  const r = rnd(lv * 7919 + 13), pool = Object.keys(STATIONS).filter((k) => STATIONS[k].unlock <= lv);
  const count = lv % 7 === 0 ? 4 : 3, tasks = [];
  const fresh = Object.keys(STATIONS).find((k) => STATIONS[k].unlock === lv);
  if (fresh) tasks.push(fresh);
  let guard = 0;
  while (tasks.length < count && guard++ < 50) {
    const k = pick(r, pool);
    if (k === tasks[tasks.length - 1] || tasks.filter((t) => t === k).length >= (pool.length >= count ? 1 : 2)) continue;
    tasks.push(k);
  }
  return tasks.map((k, i) => ({ k, seed: lv * 1000 + i * 37 + 1 }));
}
function makeTask(i) { const t = G.tasks[i]; return new STATIONS[t.k].cls(G, { level: save.level, r: rnd(t.seed) }); }
function startLevel() {
  closeModal();
  const lv = save.level;
  G.mode = 'level'; G.tasks = genLevel(lv); G.ti = 0; G.earned = 0; G.tips = 0;
  setMood(lv); $('#home').classList.remove('show'); setHud();
  fadeSwap(() => loadStation(makeTask(0), true));
  const k = G.tasks[0].k;
  if (STATIONS[k].unlock === lv && lv > 1) setTimeout(() => banner(`Nouveau poste débloqué : ${STATIONS[k].name} !`), 300);
  else if (lv % 7 === 0) setTimeout(() => banner('Commande spéciale : 4 missions !'), 300);
}
function onComplete(info) {
  const st = G.station;
  if (!st || st._done) return;
  st._done = true;
  const c = toScreen(VW / 2, VH * 0.42);
  G.fx.confetti(VW / 2, VH * 0.4, [G.mood.ac, shade(G.mood.ac, 0.5), '#FFD45C', '#7CE0B0', '#8DC8FF'], 30);
  Sfx.success(); haptic(30);
  if (G.mode === 'level') {
    const lv = save.level;
    let n = Math.round((10 + lv * 1.6) * mult());
    if (info.perfect) n += info.perfect * (2 + Math.floor(lv / 4));
    const tip = Math.random() < tipChance();
    if (tip) { n *= 3; G.tips++; }
    G.earned += n; save.stats.tasks++;
    G.fx.text(VW / 2, VH * 0.17, tip ? 'Pourboire ×3 !' : pick(Math.random, PRAISE), G.mood.ac, 38);
    setTimeout(() => addCoins(n, c.x, c.y), 250);
    G.ti++; renderDots(); persist();
    setTimeout(() => {
      if (G.mode !== 'level' || G.station !== st) return;
      if (G.ti < G.tasks.length) loadStation(makeTask(G.ti));
      else levelDone();
    }, 1300);
  } else if (G.mode === 'zen') {
    const n = 2 + Math.floor(save.level / 6);
    save.stats.tasks++;
    G.fx.text(VW / 2, VH * 0.17, pick(Math.random, PRAISE), G.mood.ac, 36);
    setTimeout(() => addCoins(n, c.x, c.y), 250);
    setTimeout(() => { if (G.mode === 'zen' && G.station === st) loadStation(makeZen(G.zk)); }, 1200);
  }
}
function grantGift() {
  const pool = [
    ...SQUISHIES.filter((x) => !save.owned.sq.includes(x.id)).map((x) => ({ t: 'sq', x, label: `Squishy « ${x.name} »` })),
    ...SWITCHES.filter((x) => !save.owned.sw.includes(x.id)).map((x) => ({ t: 'sw', x, label: `Switch « ${x.name} »` })),
    ...AMBIANCES.filter((x) => !save.owned.amb.includes(x.id)).map((x) => ({ t: 'amb', x, label: `Ambiance « ${x.name} »` })),
  ];
  if (!pool.length) { const n = 150 + save.level * 10; save.coins += n; return `${fmt(n)} bulles bonus`; }
  pool.sort((a, b) => a.x.price - b.x.price);
  const g = pool[0]; save.owned[g.t].push(g.x.id);
  return g.label;
}
function levelDone() {
  const lv = save.level, bonus = Math.round((20 + lv * 5) * mult());
  const promo = lv % 5 === 0;
  const gift = promo ? grantGift() : null;
  save.level++; persist();
  Sfx.level(); haptic(40);
  const total = G.earned + bonus;
  modal(`
    <div class="m-kick">Niveau ${lv}</div>
    <div class="m-title">Terminé !</div>
    <div class="m-reward"><span class="bub"></span><b id="mCount">${fmt(G.earned)}</b></div>
    <div class="m-lines">
      <div><span>Missions${G.tips ? ` · ${G.tips} pourboire${G.tips > 1 ? 's' : ''}` : ''}</span><b>+${fmt(G.earned)}</b></div>
      <div><span>Prime de fin de niveau</span><b>+${fmt(bonus)}</b></div>
    </div>
    ${promo ? `<div class="m-promo">Promotion ! Tu deviens <b>${rankName(rankIdx(lv + 1))}</b>.<br>Cadeau : ${gift}</div>` : ''}
    <div class="m-actions"><button class="btn glass" id="mHome">Accueil</button><button class="btn primary" id="mNext">Niveau ${lv + 1}</button></div>`);
  const el = $('#mCount'), t0 = performance.now();
  const tick = (now) => {
    const u = Math.min(1, (now - t0) / 900);
    el.textContent = fmt(G.earned + bonus * E.outCubic(u));
    if (u < 1) requestAnimationFrame(tick);
  };
  setTimeout(() => {
    requestAnimationFrame(tick);
    const r = el.getBoundingClientRect(); addCoins(bonus, r.left + r.width / 2, r.top + r.height / 2);
  }, 450);
  $('#mNext').onclick = () => startLevel();
  $('#mHome').onclick = () => showHome();
  void total;
}
function makeZen(k) {
  return new STATIONS[k].cls(G, { level: Math.max(STATIONS[k].unlock, save.level - Math.floor(Math.random() * 4)), r: rnd((Math.random() * 1e9) | 0), zen: true });
}
function startZen(k) {
  closeSheet();
  G.mode = 'zen'; G.zk = k; setMood(save.level);
  $('#home').classList.remove('show'); setHud();
  fadeSwap(() => loadStation(makeZen(k), true));
}

// ---------- Feuilles ----------
function openSheet(title, html) {
  $('#sheetTitle').textContent = title; $('#sheetBody').innerHTML = html;
  $('#sheet').classList.add('show'); $('#scrim').classList.add('show');
}
function closeSheet() { $('#sheet').classList.remove('show'); $('#scrim').classList.remove('show'); }
function modal(html) { $('#modalCard').innerHTML = html; $('#modal').classList.add('show'); }
function closeModal() { $('#modal').classList.remove('show'); }
$('#sheetClose').onclick = closeSheet;
$('#scrim').onclick = closeSheet;

function openZen() {
  const html = '<div class="zgrid">' + Object.entries(STATIONS).map(([k, s]) => {
    const lock = s.unlock > save.level;
    return `<button class="zcard glass ${lock ? 'lock' : ''}" data-z="${k}">${ICONS[k]}${s.name}<small>${lock ? `Niveau ${s.unlock}` : 'Sans fin'}</small></button>`;
  }).join('') + '</div><p class="credit">Le mode Zen n’a pas d’objectif : joue autant que tu veux.</p>';
  openSheet('Mode Zen', html);
  $('#sheetBody').querySelectorAll('[data-z]').forEach((b) => (b.onclick = () => {
    const k = b.dataset.z;
    if (STATIONS[k].unlock > save.level) { b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake'); Sfx.bonk(); return; }
    startZen(k);
  }));
}

let shopTab = 'amb';
const priceHtml = (p) => `<span class="price"><span class="bub"></span>${fmt(p)}</span>`;
function openShop() { openSheet('Atelier', '<div class="seg glass" id="seg"></div><div class="grid" id="shopGrid"></div>'); renderShop(); }
function renderShop() {
  const tabs = { amb: 'Ambiances', sq: 'Squishys', sw: 'Switchs', up: 'Boosts' };
  $('#seg').innerHTML = Object.entries(tabs).map(([k, v]) => `<button data-t="${k}" class="${k === shopTab ? 'on' : ''}">${v}</button>`).join('');
  $('#seg').querySelectorAll('button').forEach((b) => (b.onclick = () => { shopTab = b.dataset.t; renderShop(); }));
  const grid = $('#shopGrid'); grid.innerHTML = '';
  const card = (pv, nm, ds, action) => {
    const el = document.createElement('div'); el.className = 'card glass';
    el.innerHTML = `<div class="pv">${pv}</div><div class="nm">${nm}</div><div class="ds">${ds}</div>${action}`;
    grid.appendChild(el); return el;
  };
  const buyBtn = (p) => `<button class="btn small primary" data-silent="1" data-buy>${priceHtml(p)}</button>`;
  const tryBuy = (btn, price, fn) => {
    if (save.coins < price) { btn.classList.remove('shake'); void btn.offsetWidth; btn.classList.add('shake'); Sfx.bonk(); haptic(20); return; }
    spend(price); fn(); Sfx.buy(); haptic(30); persist(); renderShop(); bump($('#coinPill'));
  };
  if (shopTab === 'amb') {
    for (const a of AMBIANCES) {
      const owned = save.owned.amb.includes(a.id), eq = save.eq.amb === a.id;
      const pv = `<div class="sw4">${a.moods.slice(0, 4).map((m) => `<i style="background:${m.bg};--c:${m.ac}"></i>`).join('')}</div>`;
      const act = eq ? '<div class="tag">Équipée</div>' : owned ? '<button class="btn small glass" data-eq>Équiper</button>' : buyBtn(a.price);
      const el = card(pv, a.name, a.dark ? 'Mode sombre' : `${a.moods.length} teintes`, act);
      const equip = () => { save.eq.amb = a.id; persist(); setMood(save.level); renderShop(); };
      el.querySelector('[data-eq]')?.addEventListener('click', equip);
      el.querySelector('[data-buy]')?.addEventListener('click', (e) => tryBuy(e.currentTarget, a.price, () => { save.owned.amb.push(a.id); equip(); }));
    }
  } else if (shopTab === 'sq') {
    for (const s of SQUISHIES) {
      const owned = save.owned.sq.includes(s.id);
      const el = card('<canvas width="240" height="180" style="width:120px;height:90px"></canvas>', s.name, owned ? 'Dans ta collection' : 'Apparaît dans les niveaux',
        owned ? '<div class="tag">✓ Possédé</div>' : buyBtn(s.price));
      const c = el.querySelector('canvas'), x = c.getContext('2d'); x.scale(2, 2);
      drawSquishyIcon(x, s, 60, 47, 34);
      el.querySelector('.pv').onclick = () => { initAudio(); Sfx.squish(0.8); haptic(10); };
      el.querySelector('[data-buy]')?.addEventListener('click', (e) => tryBuy(e.currentTarget, s.price, () => save.owned.sq.push(s.id)));
    }
  } else if (shopTab === 'sw') {
    for (const s of SWITCHES) {
      const owned = save.owned.sw.includes(s.id), eq = save.eq.sw === s.id;
      const pv = `<div class="kc" style="background:linear-gradient(${shade(s.cap, 0.4)},${s.cap});box-shadow:inset 0 -6px 0 ${dark(s.cap, 0.15)},0 6px 0 ${dark(s.cap, 0.4)}">${s.name[0]}</div>`;
      const act = eq ? '<div class="tag">Équipé</div>' : owned ? '<button class="btn small glass" data-eq>Équiper</button>' : buyBtn(s.price);
      const el = card(pv, s.name, s.desc, act);
      const kc = el.querySelector('.kc');
      kc.addEventListener('pointerdown', () => { initAudio(); Sfx.key(s.id, false); haptic(8); });
      kc.addEventListener('pointerup', () => Sfx.key(s.id, true));
      const equip = () => { save.eq.sw = s.id; persist(); renderShop(); };
      el.querySelector('[data-eq]')?.addEventListener('click', equip);
      el.querySelector('[data-buy]')?.addEventListener('click', (e) => tryBuy(e.currentTarget, s.price, () => { save.owned.sw.push(s.id); equip(); }));
    }
    const p = document.createElement('p'); p.className = 'credit'; p.style.gridColumn = '1/-1';
    p.textContent = 'Touche une keycap pour l’écouter avant d’acheter.'; grid.appendChild(p);
  } else {
    const pc = Math.round(150 * Math.pow(1.65, save.prime));
    const el1 = card(`<div class="big-n">×${mult().toFixed(2).replace('.', ',')}</div>`, 'Prime de satisfaction',
      `Bulles ×${(mult() + 0.25).toFixed(2).replace('.', ',')} au prochain palier`, buyBtn(pc));
    el1.classList.add('up');
    el1.querySelector('[data-buy]').addEventListener('click', (e) => tryBuy(e.currentTarget, pc, () => save.prime++));
    const maxed = save.tip >= 12, tc = Math.round(220 * Math.pow(1.8, save.tip));
    const el2 = card(`<div class="big-n">${Math.round(tipChance() * 100)} %</div>`, 'Pourboire',
      maxed ? 'Niveau max atteint' : `Chance de bulles ×3 : ${Math.round(Math.min(0.5, 0.04 * (save.tip + 1)) * 100)} %`, maxed ? '<div class="tag">Max</div>' : buyBtn(tc));
    el2.classList.add('up');
    el2.querySelector('[data-buy]')?.addEventListener('click', (e) => tryBuy(e.currentTarget, tc, () => save.tip++));
  }
}

function openSettings() {
  const st = save.stats;
  const row = (k, label) => `<div class="setrow glass"><span>${label}</span><button class="tog ${save.settings[k] ? 'on' : ''}" data-k="${k}" aria-label="${label}"></button></div>`;
  const stat = (n, l) => `<div class="stat glass"><b>${fmt(n || 0)}</b><span>${l}</span></div>`;
  openSheet('Réglages', `<div class="setlist">
    ${row('sound', 'Sons')}${row('haptics', 'Vibrations')}${row('silent', 'Son même en mode silencieux')}
    <h3>Ton bilan chez Satisfactory Inc.</h3>
    <div class="stats">${stat(st.pops, 'bulles éclatées')}${stat(st.films, 'films retirés')}${stat(st.keys, 'touches frappées')}${stat(st.squish, 'squishs')}${stat(st.cuts, 'tranches de sable')}${stat(st.tasks, 'missions accomplies')}</div>
    <button class="btn glass" id="reset" style="margin-top:8px">Recommencer à zéro</button>
    <p class="credit">Satisfactory Inc. — Département du Bien-être Tactile.<br>Tous les sons sont synthétisés en direct.</p></div>`);
  $('#sheetBody').querySelectorAll('.tog').forEach((t) => (t.onclick = () => {
    const k = t.dataset.k; save.settings[k] = !save.settings[k]; t.classList.toggle('on', save.settings[k]);
    if (k === 'sound') setSound(save.settings[k]);
    if (k === 'haptics') audioSettings.haptics = save.settings[k];
    if (k === 'silent') setSilent(save.settings[k]);
    persist();
  }));
  let armed = false;
  $('#reset').onclick = (e) => {
    if (!armed) { armed = true; e.currentTarget.textContent = 'Sûr ? Touche encore pour tout effacer'; return; }
    try { localStorage.removeItem(KEY); } catch (err) {}
    location.reload();
  };
}

// ---------- Cadeau du jour ----------
const dayKey = (d) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
const giftAvailable = () => save.daily.last !== dayKey(new Date());
function claimGift() {
  if (!giftAvailable()) {
    modal(`<div class="m-kick">Cadeau du jour</div><div class="m-title">Reviens demain</div>
      <p class="credit" style="font-size:14px">Série en cours : ${save.daily.streak} jour${save.daily.streak > 1 ? 's' : ''}. Chaque jour d’affilée, le cadeau grossit.</p>
      <div class="m-actions"><button class="btn primary" id="mOk">OK</button></div>`);
    $('#mOk').onclick = closeModal; return;
  }
  const y = dayKey(new Date(Date.now() - 864e5));
  save.daily.streak = save.daily.last === y ? Math.min(save.daily.streak + 1, 7) : 1;
  save.daily.last = dayKey(new Date());
  const n = 30 + save.daily.streak * 25 + save.level * 2;
  persist(); Sfx.gift(); haptic(30); updateHome();
  modal(`<div class="m-kick">Cadeau du jour · Jour ${save.daily.streak}/7</div><div class="m-title">Pour toi</div>
    <div class="m-reward"><span class="bub"></span><b>+${fmt(n)}</b></div>
    <p class="credit" style="font-size:14px">Reviens demain : la série augmente le cadeau.</p>
    <div class="m-actions"><button class="btn primary" id="mOk">Encaisser</button></div>`);
  $('#mOk').onclick = () => { const r = $('#mOk').getBoundingClientRect(); closeModal(); addCoins(n, r.left + r.width / 2, r.top); };
}

// ---------- Démarrage ----------
$('#btnPlay').onclick = startLevel;
$('#btnHome').onclick = showHome;
$('#btnGear').onclick = openSettings;
$('#btnZen').onclick = openZen;
$('#btnShop').onclick = openShop;
$('#btnGift').onclick = claimGift;

buildLogo(); setMood(save.level); renderCoins();
G.mode = 'home'; $('#home').classList.add('show'); setHud(); updateHome();
resize();
loadStation(new SquishStation(G, { mascot: true }), true);
requestAnimationFrame(frame);
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
window.G = G;
