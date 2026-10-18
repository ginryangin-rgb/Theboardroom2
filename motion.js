/* Motion. Turns a game of instant cuts into one that moves: pages slide in the direction you navigated, numbers count to their new
   value, the sidebar highlight glides, dialogs ease in and fade out, the season has a progress bar, and goals pulse.
   Everything respects the "reduce motion" setting. Pure helpers are exported so they can be tested. */

const baseMotionRender = render, baseMotionClose = closeModal, baseMotionGo = go;
const motion = { mem: {}, navTop: null, date: null, pct: 0, score: null, skipNum: false, dir: 'r' };
function reducedMotion() { return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches }
function canAnimate() { return typeof requestAnimationFrame === 'function' && typeof document.createElement === 'function' && !reducedMotion() }

/* ---------- numbers that count ---------- */
function parseNumText(text) {
  let m = String(text).match(/\d[\d,]*(?:\.\d+)?/); if (!m) return null;
  let raw = m[0], i = m.index;
  return { prefix: String(text).slice(0, i), suffix: String(text).slice(i + raw.length), dec: (raw.split('.')[1] || '').length, comma: raw.includes(','), value: parseFloat(raw.replace(/,/g, '')) };
}
function formatNum(p, v) { return p.prefix + v.toLocaleString('en-GB', { minimumFractionDigits: p.dec, maximumFractionDigits: p.dec, useGrouping: p.comma }) + p.suffix }
function easeOut(t) { return 1 - Math.pow(1 - t, 3) }
function tweenValue(a, b, t) { return a + (b - a) * easeOut(clamp(t, 0, 1)) }
function sameShape(a, b) { return a && b && a.prefix === b.prefix && a.suffix === b.suffix && a.dec === b.dec }
function tweenNode(el, node, p, from, to, ms = 700) {
  if (!canAnimate()) return; el._tw = true; let start = null;
  el.classList.remove('numflash'); void el.offsetWidth; el.classList.add('numflash');
  let step = ts => { if (start == null) start = ts; let t = (ts - start) / ms; node.nodeValue = formatNum(p, t >= 1 ? to : tweenValue(from, to, t)); if (t < 1) requestAnimationFrame(step); else { el._tw = false; node.nodeValue = formatNum(p, to) } };
  node.nodeValue = formatNum(p, from); requestAnimationFrame(step);
}
function countUp(el, ms = 900) {
  if (!el || !el.firstChild || el.firstChild.nodeType !== 3) return; let p = parseNumText(el.firstChild.nodeValue); if (!p) return; tweenNode(el, el.firstChild, p, 0, p.value, ms);
}
function animateNums() {
  let root = $('content'); if (!root || !root.querySelectorAll || !canAnimate()) { motion.skipNum = false; return }
  let els = [...root.querySelectorAll('.stat b, .bigmoney, .metrichead b')], prev = motion.mem[page], cur = [], skip = motion.skipNum || !prev; motion.skipNum = false;
  els.forEach((el, i) => {
    let node = el.firstChild; if (!node || node.nodeType !== 3) { cur[i] = null; return }
    if (el._tw) { cur[i] = prev && prev[i]; return }
    let p = parseNumText(node.nodeValue); cur[i] = p;
    if (!skip && p && sameShape(prev[i], p) && prev[i].value !== p.value) tweenNode(el, node, p, prev[i].value, p.value);
  });
  motion.mem[page] = cur;
}

/* ---------- page, nav, bars ---------- */
function moveNavInd() {
  let nav = $('nav'); if (!nav || !nav.querySelector || !canAnimate()) return;
  let act = nav.querySelector('button.active'); if (!act || getComputedStyle(nav).display === 'flex') return;
  let ind = document.createElement('span'); ind.className = 'navind'; nav.appendChild(ind);
  let top = act.offsetTop, h = act.offsetHeight; ind.style.height = h + 'px'; ind.style.transform = `translateY(${motion.navTop == null ? top : motion.navTop}px)`; void ind.offsetWidth; ind.style.transform = `translateY(${top}px)`; motion.navTop = top;
}
function seasonPct() { let w = g.world; return clamp(daysBetween(iso(seasonYear(), 7, 1), w.date) / 334, 0, 1) * 100 }
function motionAfter() {
  if (!g || !g.world || !canAnimate()) return;
  let bar = $('timebar'); if (bar && bar.querySelector) {
    let d = bar.querySelector('.timedate b'); if (d) { if (motion.date && motion.date !== g.world.date) { d.classList.remove('datetick'); void d.offsetWidth; d.classList.add('datetick') } motion.date = g.world.date }
    let i = bar.querySelector('.seasonbar i'); if (i) { let to = parseFloat(i.dataset.to); i.style.width = motion.pct + '%'; void i.offsetWidth; i.style.width = to + '%'; motion.pct = to }
  }
  let l = g.world.live;
  if (page === 'Matchday' && l) { let tot = l.home + l.away; if (motion.score !== null && tot > motion.score) { let s = $('content').querySelector && $('content').querySelector('.scorecentral strong'); if (s) { s.classList.remove('goalpulse'); void s.offsetWidth; s.classList.add('goalpulse') } } motion.score = tot } else motion.score = null;
  animateNums(); moveNavInd();
}
render = function () { baseMotionRender(); motionAfter() };
go = function (p) {
  let from = NAV_ORDER.indexOf(page), to = NAV_ORDER.indexOf(p); motion.dir = from >= 0 && to >= 0 && to < from ? 'l' : 'r'; motion.skipNum = true;
  baseMotionGo(p); let c = $('content'); if (c && c.classList && canAnimate()) { c.classList.remove('pagein', 'pagein-l', 'pagein-r'); void c.offsetWidth; c.classList.add('pagein', 'pagein-' + motion.dir) }
};

/* ---------- dialogs ease out, and re-rendered dialogs do not replay the entrance ---------- */
closeModal = function () {
  let m = $('modal'), ov = m && m.firstElementChild, gh = typeof document.getElementById === 'function' ? document.getElementById('modalGhost') : null;
  if (ov && gh && ov.cloneNode && canAnimate()) { gh.innerHTML = ''; let c = ov.cloneNode(true); c.classList.add('ghost'); gh.appendChild(c); setTimeout(() => { if (gh.firstChild === c) gh.innerHTML = '' }, 300) }
  baseMotionClose();
};
/* A dialog that is replaced while it is open (a settings toggle) should not replay its entrance. But several assignments in the same instant while it
   is first being built (each layer decorates it), and a close followed by a new dialog, are fresh entrances. */
if (typeof MutationObserver === 'function' && document.getElementById('modal') && document.getElementById('modal').nodeType) {
  new MutationObserver(recs => {
    let batch = new Set(), old = false;
    for (let r of recs) {
      let removed = [...r.removedNodes], visible = removed.some(n => !batch.has(n));
      if (visible) old = !!r.addedNodes.length;
      for (let n of r.addedNodes) { batch.add(n); if (old && n.classList) n.classList.add('noenter') }
    }
  }).observe(document.getElementById('modal'), { childList: true });
}

/* ---------- a press ripple on the main buttons ---------- */
if (typeof document.addEventListener === 'function') document.addEventListener('pointerdown', e => {
  if (!canAnimate()) return; let b = e.target && e.target.closest && e.target.closest('button.primary, button.motion, nav button, .tabs button, button.iconbutton'); if (!b || b.disabled) return;
  let r = b.getBoundingClientRect(), s = document.createElement('span'), size = Math.max(r.width, r.height) * 1.6; s.className = 'ripple'; s.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - r.left - size / 2}px;top:${e.clientY - r.top - size / 2}px`;
  b.appendChild(s); setTimeout(() => s.remove(), 650);
});
