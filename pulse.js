/* The Daily. While time runs with Continue, a box slides out beside the page with what is happening: the headlines of the day, your next fixtures,
   the big games and latest results around your division, and who is hot. When time stops it shrinks to a pill you can open any time. */

const baseTickPulse = ffwdTick, baseEndPulse = ffwdEnd, basePausePulse = pauseSettings;
let pulse = { open: false, min: false, seen: new Set(), fresh: 0, hideTimer: null, el: null };
const pulseOn = () => prefs().pulse !== false;
const ord = n => (n % 100 >= 11 && n % 100 <= 13) ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10 < 4 ? n % 10 : 0];

/* ---------- what goes in the box (pure, so it can be tested) ---------- */
function tablePos(id) { let t = g.divisions.findIndex(d => d.includes(id)); if (t < 0) return 0; return g.tables[t].slice().sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf).findIndex(r => r.id === id) + 1 }
function pulseFixtures() {
  let w = g.world, out = []; for (let f of w.fixtures.filter(x => !x.played && x.date >= w.date).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 3)) {
    let opp = f.home === g.clubId ? f.away : f.home, days = daysBetween(w.date, f.date), lvl = rivalryLevel(g.clubId, opp);
    out.push({ id: f.id, opp, home: f.home === g.clubId, date: f.date, days, comp: f.comp === 'League' ? DB[tier()].name : (w.cups[f.comp] ? w.cups[f.comp].name : f.comp), derby: lvl, pos: tablePos(opp), miles: f.home === g.clubId ? 0 : milesBetween(g.clubId, f.home) });
  }
  return out;
}
function pulseRound() {
  let t = tier(), round = (g.schedules && g.schedules[t] && g.schedules[t][g.week - 1]) || [], n = g.tables[t].length;
  let games = round.filter(([a, b]) => a !== g.clubId && b !== g.clubId).map(([a, b]) => { let pa = tablePos(a), pb = tablePos(b), lvl = rivalryLevel(a, b); return { a, b, pa, pb, derby: lvl, top: pa <= 4 && pb <= 4, drop: pa > n - 5 && pb > n - 5, score: lvl * 10 + (pa <= 6 && pb <= 6 ? 6 : 0) + (pa > n - 6 && pb > n - 6 ? 3 : 0) + (n - pa) / n + (n - pb) / n } }).sort((x, y) => y.score - x.score);
  let last = (g.world.roundLog || []).filter(r => !r.mine && r.tier === t).map(r => ({ a: r.home, b: r.away, s: r.score })).sort((x, y) => (y.s[0] + y.s[1]) - (x.s[0] + x.s[1]));
  return { next: games.slice(0, 5), last: last.slice(0, 5) };
}
function pulseHot() {
  if (typeof topBy !== 'function' || !g.world.ps || !g.world.ps.rounds) return null; let t = tier(), boot = topBy(t, 'g', 1)[0], fire = onFire(t, 1)[0], mine = playersOf(t).filter(p => p.c === g.clubId).sort((a, b) => b.g - a.g || b.a - a.a)[0];
  return { boot, fire, mine };
}
function pulseHeadlines() { return (typeof ffwd !== 'undefined' && ffwd.feed ? ffwd.feed : []).filter(x => ['news', 'inbox', 'money'].includes(x.kind)).slice(0, 5) }
const dayTxt = d => d <= 0 ? 'Today' : d === 1 ? 'Tomorrow' : `In ${d} days`;

/* ---------- drawing ---------- */
function pulseHtml() {
  let w = g.world, fx = pulseFixtures(), rd = pulseRound(), hot = pulseHot(), hl = pulseHeadlines(), seen = pulse.seen, fresh = k => { let f = !seen.has(k); seen.add(k); if (f) pulse.fresh++; return f ? ' fresh' : '' };
  let icon = k => k === 'news' ? '📰' : k === 'money' ? '💷' : '✉️';
  let head = hl.map(x => `<div class="pcard${fresh(x.title + x.t)}"><span class="pi">${icon(x.kind)}</span><div><b>${esc(x.title)}</b><small>${esc(String(x.text || '').slice(0, 110))}</small></div></div>`).join('') || '<p class="emptynote">A quiet day. Nothing to report yet.</p>';
  let fix = fx.map(f => `<div class="pcard${fresh('fx' + f.id + f.days)}${f.days <= 1 ? ' soon' : ''}"><span class="pi">${teamBadge(f.opp)}</span><div><b>${f.home ? '' : '@ '}${esc(team(f.opp).short)}${f.derby ? ' <em class="dtag">🔥 derby</em>' : ''}</b><small>${dayTxt(f.days)} · ${esc(f.comp)} · ${f.home ? 'Home' : f.miles + ' miles away'}${f.pos ? ' · they are ' + f.pos + ord(f.pos) : ''}</small></div></div>`).join('');
  let around = rd.next.length ? rd.next.map(x => `<div class="pgame${x.derby ? ' derby' : x.top ? ' big' : ''}"><span>${esc(team(x.a).short)} <small>${x.pa}${ord(x.pa)}</small></span><i>v</i><span><small>${x.pb}${ord(x.pb)}</small> ${esc(team(x.b).short)}</span>${x.derby ? '<em>🔥</em>' : x.top ? '<em>⭐</em>' : x.drop ? '<em>⚠️</em>' : ''}</div>`).join('') : rd.last.map(x => `<div class="pgame"><span>${esc(team(x.a).short)}</span><b>${x.s[0]} – ${x.s[1]}</b><span>${esc(team(x.b).short)}</span></div>`).join('');
  let hotHtml = hot ? [hot.boot && `<div class="pcard"><span class="pi">👟</span><div><b>${esc(hot.boot.name)}</b><small>Leads the Golden Boot · ${hot.boot.g} goals for ${esc(team(hot.boot.c).short)}</small></div></div>`, hot.fire && `<div class="pcard"><span class="pi">🔥</span><div><b>${esc(hot.fire.name)}</b><small>On fire · ${hot.fire.avg.toFixed(1)} average, ${esc(team(hot.fire.c).short)}</small></div></div>`, hot.mine && hot.mine.g + hot.mine.a > 0 && `<div class="pcard mine"><span class="pi">⭐</span><div><b>${esc(hot.mine.name)}</b><small>Your top contributor · ${hot.mine.g} goals, ${hot.mine.a} assists</small></div></div>`].filter(Boolean).join('') : '';
  return `<div class="phead"><span class="plive"></span><b>The Daily</b><span class="pdate">${dateText(w.date, false)}</span><button title="Minimise" onclick="pulseMin(true)">–</button><button title="Close" onclick="pulseClose()">×</button></div><div class="pbody"><section><h4>Headlines</h4>${head}</section><section><h4>Your fixtures</h4>${fix}</section><section><h4>${rd.next.length ? 'Big games this round · ' + esc(DB[tier()].name) : 'Latest results · ' + esc(DB[tier()].name)}</h4><div class="pgames">${around || '<p class="emptynote">Nothing scheduled.</p>'}</div></section>${hotHtml ? `<section><h4>Hot right now</h4>${hotHtml}</section>` : ''}</div>`;
}
function pulseEl() {
  if (pulse.el) return pulse.el; if (typeof document.createElement !== 'function' || !document.body) return null;
  let el = document.createElement('div'); el.id = 'pulse'; el.className = 'pulse'; document.body.appendChild(el); pulse.el = el; return el;
}
function pulseDraw() {
  let el = pulseEl(); if (!el || !g.world) return;
  if (pulse.min) { el.className = 'pulse min show'; el.innerHTML = `<button class="ppill" onclick="pulseMin(false)">📰 The Daily${pulse.fresh ? ` <b>${pulse.fresh} new</b>` : ''}</button>` }
  else { pulse.fresh = 0; el.className = 'pulse show'; el.innerHTML = pulseHtml() }
}
function pulseMin(v) { pulse.min = v; if (!v) { pulse.fresh = 0; clearTimeout(pulse.hideTimer) } pulseDraw() }
function pulseClose() { pulse.open = false; clearTimeout(pulse.hideTimer); let el = pulseEl(); if (el) { el.className = 'pulse'; el.innerHTML = '' } }
function pulseToggle() { if (pulse.open && !pulse.min) return pulseClose(); pulse.open = true; pulse.min = false; pulseDraw() }

/* ---------- wiring: appears when time starts running, shrinks when it stops ---------- */
ffwdTick = function () {
  baseTickPulse(); if (!pulseOn() || typeof ffwd === 'undefined' || !ffwd.on || ffwd.mode !== 'page' || !g.world) return;
  if (!pulse.open) { pulse.open = true; pulse.min = false; clearTimeout(pulse.hideTimer); pulse.seen = new Set(pulse.seen.size > 400 ? [] : [...pulse.seen]) } if (!pulse.min) pulseDraw();
};
ffwdEnd = function () {
  let was = typeof ffwd !== 'undefined' && ffwd.on; baseEndPulse(); if (!was || !pulse.open) return;
  clearTimeout(pulse.hideTimer); pulse.hideTimer = setTimeout(() => { if (pulse.open && !pulse.min) { pulse.min = true; pulse.fresh = 0; pulseDraw() } }, 7000); pulseDraw();
};
pauseSettings = function () {
  basePausePulse(); let h = $('modal').innerHTML; if (typeof h === 'string') { let i = h.indexOf('<div class="actions"><button class="primary" onclick="closeModal()">Done'); if (i > 0) $('modal').innerHTML = h.slice(0, i) + `<div class="pauseopt" style="cursor:default"><span><b>The Daily</b><small><label><input type="checkbox" ${pulseOn() ? 'checked' : ''} onchange="prefs().pulse=this.checked;save();if(!this.checked)pulseClose()"> Show the news box while time runs</label></small></span></div>` + h.slice(i) }
};
