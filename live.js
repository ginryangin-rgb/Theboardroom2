/* The live match. While you watch, the page is no longer rebuilt every game minute: the score, the clock, the stat bars and the
   commentary update in place, so nothing flickers. The clock runs second by second, a goal gets a full-screen GOAL with a roar and a
   commentator, shots, corners and cards are called with real players' names, and the whistles blow. */

const baseLiveRender = render, baseLiveTick = tickMatch, baseLivePlay = playMatch, baseLiveFinish = finishMatch, baseLiveBegin = beginMatch, baseLiveEnd = ffwdEnd, baseLiveSpeed = matchSpeed;
let liveTick = false, liveClock = { t0: 0, ms: 900 }, liveFeedTop = null, clockOn = false, goalTimer = null;

/* ---------- pure pieces (tested) ---------- */
function crowdLevel(l) {
  let f = g.world.fixtures.find(x => x.id === l.fixture) || {}, home = f.home === g.clubId, v = l.viz || {}, min = l.minute, own = home ? 'h' : 'a';
  let att = clamp(g.fans / Math.max(1, g.capacity), .2, 1.2), level = .28 + .22 * att * (home ? 1 : .55);
  if (v.ball && v.side) { let depth = dirOf(v.side, min) > 0 ? v.ball.x : 1 - v.ball.x, press = Math.max(0, depth - .5) * 2; level += v.side === own ? .16 * press : .1 * press * (home ? 1 : .6) }
  if (min > 75 && Math.abs(l.home - l.away) <= 1) level += .12;
  let last = (l.goals || []).at(-1); if (last && min - last.min < 4) level += .3 * (1 - (min - last.min) / 4);
  return clamp(level, .1, 1);
}
function clockText(min, sec) { return String(min).padStart(2, '0') + ':' + String(sec).padStart(2, '0') }
/* ---------- running season totals, shown live the moment they happen ---------- */
function seasonSoFar(id, key) { return (typeof ps === 'function' && g.world.ps && ps().p[id] && ps().p[id][key]) || 0 }
function ordSuffix(n) { return (n % 100 >= 11 && n % 100 <= 13) ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10 < 4 ? n % 10 : 0] }
function tallyPhrase(n, noun) { return `${n}${ordSuffix(n)} ${noun} of the season`; }
function goalInfo(l, side) {
  let f = g.world.fixtures.find(x => x.id === l.fixture), id = side === 'h' ? f.home : f.away, gl = (l.goals || []).at(-1) || {}, own = id === g.clubId;
  let goalsTally = gl.id ? seasonSoFar(gl.id, 'g') + l.goals.filter(x => x.id === gl.id).length : 0;
  let assistTally = gl.aid ? seasonSoFar(gl.aid, 'a') + l.goals.filter(x => x.aid === gl.aid).length : 0;
  let concedeSide = side === 'h' ? 'a' : 'h', keeper = l.lineup && l.lineup[concedeSide] && l.lineup[concedeSide][0], concededNow = side === 'h' ? l.home : l.away;
  let concedeTally = keeper ? seasonSoFar(keeper.id, 'ga') + concededNow : 0;
  return { team: team(id).name, short: team(id).short, teamId: id, scorer: gl.name || '', sur: gl.sur || '', num: gl.num || 0, min: l.minute, score: `${team(f.home).short} ${l.home} – ${l.away} ${team(f.away).short}`, own, goalsTally, assistTally, assister: gl.aname || '', asur: gl.asur || '', keeper: keeper ? keeper.name : '', keeperSur: keeper ? keeper.sur : '', concedeTally };
}
function sayShort(l, side, i) { let p = playerAt(l, i); return p ? p.sur : 'A forward' }
function eventLines(l, ev) {
  let f = g.world.fixtures.find(x => x.id === l.fixture), v = l.viz, out = [], sideId = s => s === 'h' ? f.home : f.away, ownSide = f.home === g.clubId ? 'h' : 'a';
  if (!ev.scored) {
    let shotSide = ev.shot.h && ev.shot.a ? ownSide : ev.shot.h ? 'h' : ev.shot.a ? 'a' : null;
    if (shotSide) { let who = sayShort(l, shotSide, v.shooter ?? v.owner), on = ev.sot[shotSide]; out.push({ kind: 'shot', side: shotSide, own: shotSide === ownSide, on, text: on ? `${who} lets fly and the keeper has to save it.` : `${who} shoots, but it flashes wide.` }) }
    let cSide = ev.corner.h && ev.corner.a ? ownSide : ev.corner.h ? 'h' : ev.corner.a ? 'a' : null;
    if (cSide && !shotSide) out.push({ kind: 'corner', side: cSide, own: cSide === ownSide, text: `Corner to ${team(sideId(cSide)).short}. ${sayShort(l, cSide, v.shooter ?? v.owner)} will take it.` });
    let c = ev.card;
    if (c && c.type === 'yellow' && !c.second) { let tally = seasonSoFar(c.id, 'yc') + l.cards.filter(x => x.id === c.id && x.type === 'yellow').length; out.push({ kind: 'card', side: c.side, own: c.side === ownSide, text: `Yellow card for ${esc(c.name)} (${team(sideId(c.side)).short}) &mdash; his ${tallyPhrase(tally, 'booking')} this season.` }) }
    else if (c && c.type === 'red') { let tally = seasonSoFar(c.id, 'rc') + l.cards.filter(x => x.id === c.id && x.type === 'red').length; out.push({ kind: 'red', side: c.side, own: c.side === ownSide, text: `${c.second ? 'A second yellow, and ' : 'RED CARD! '}${esc(c.name)} (${team(sideId(c.side)).short}) is sent off${c.second ? '' : '!'} &mdash; his ${tallyPhrase(tally, 'red card')} this season.` }) }
  }
  return out;
}
function summaryLine(l, kind) {
  let f = g.world.fixtures.find(x => x.id === l.fixture), s = l.stats, mins = Math.max(1, s.mins), ph = Math.round(s.poss[0] / mins);
  return `${kind}: ${team(f.home).short} ${l.home}, ${team(f.away).short} ${l.away}. ${team(f.home).short} have had ${ph}% of the ball and ${Math.max(s.h.shots, l.home)} shots to ${Math.max(s.a.shots, l.away)}.`;
}

/* ---------- events: lines, sounds, the goal ---------- */
function pushLine(l, text) { l.commentary.unshift({ minute: l.minute, text }); l.commentary = l.commentary.slice(0, 35) }
function liveEvents(l, ev) {
  audioUnlockSoft();
  if (ev.scored) {
    let info = goalInfo(l, ev.scored); showGoal(info); SFX.goal(info.own, info.sur); shake();
    if (info.keeper) pushLine(l, `${esc(info.keeper)} has now conceded ${info.concedeTally} this season.`);
    return;
  }
  let fast = (l.speed || 2) >= 4;
  for (let e of eventLines(l, ev)) {
    pushLine(l, e.text);
    if (e.kind === 'shot') { SFX.shot(e.on, e.own); }
    else if (e.kind === 'corner') { SFX.corner(); }
    else if (e.kind === 'card') SFX.card();
    else if (e.kind === 'red') { SFX.card(); setTimeout(() => SFX.card(), 260) }
  }
  if (l.halftime && !l._ht) { l._ht = true; let t = summaryLine(l, 'Half-time'); pushLine(l, t); SFX.halfTime() }
}
function audioUnlockSoft() { if (typeof audioUnlock === 'function') audioUnlock() }
function shake() { let m = $('content').querySelector && $('content').querySelector('.matchview'); if (m && m.classList) { m.classList.remove('shake'); void m.offsetWidth; m.classList.add('shake') } }
function showGoal(info) {
  if (typeof document.createElement !== 'function' || !document.body) return;
  let el = document.getElementById('goalfx'); if (!el) { el = document.createElement('div'); el.id = 'goalfx'; document.body.appendChild(el) }
  let letters = 'GOAL!'.split('').map((c, i) => `<span style="animation-delay:${i * 70}ms">${c}</span>`).join('');
  el.className = 'goalfx ' + (info.own ? 'own' : 'opp');
  let tallyLine = info.scorer ? `${esc(info.scorer.split(' ').pop())} · ${tallyPhrase(info.goalsTally, 'goal')}` : '';
  if (info.assister) tallyLine += ` &nbsp;·&nbsp; assist: ${esc(info.asur)} (${tallyPhrase(info.assistTally, 'assist')})`;
  el.innerHTML = `<div class="gfflash"></div><div class="gfrays"></div><div class="gfcard"><div class="gfcrest">${typeof teamBadge === 'function' ? teamBadge(info.teamId) : ''}</div><div class="gftext">${letters}</div><div class="gfsub">${info.scorer ? `<b>${esc(info.scorer)}</b> ${info.num ? '#' + info.num + ' ' : ''}· ${info.min}'` : esc(info.team)}</div><div class="gfscore">${esc(info.score)}</div>${tallyLine ? `<div class="gftally">${tallyLine}</div>` : ''}</div>`;
  void el.offsetWidth; el.classList.add('show'); clearTimeout(goalTimer); goalTimer = setTimeout(() => el.classList.remove('show'), info.own ? 3600 : 2600);
}

/* ---------- in-place updates ---------- */
function liveUpdate() {
  let l = g.world && g.world.live; if (!l || page !== 'Matchday') return false; let root = $('content'); if (!root || !root.querySelector) return false;
  let sc = root.querySelector('.scorecentral strong'); if (!sc) return false;
  sc.innerHTML = `${l.home} <span>–</span> ${l.away}`; liveClock.t0 = typeof performance !== 'undefined' ? performance.now() : 0; liveClock.ms = Math.max(70, 900 / (l.speed || 2));
  let rows = root.querySelectorAll('.statspanel .statrow'), data = statRows(l, l.home, l.away);
  rows.forEach((r, i) => {
    let d = data[i]; if (!d) return; let bs = r.querySelectorAll('.sv b'), t = (Number(d[3]) + Number(d[4])) || 1; if (bs.length > 1) { bs[0].textContent = d[1]; bs[1].textContent = d[2] }
    let h = r.querySelector('.statbar i.h'), a = r.querySelector('.statbar i.a'); if (h && a) { h.style.width = (Number(d[3]) / t * 100) + '%'; a.style.width = (Number(d[4]) / t * 100) + '%' }
  });
  let feed = root.querySelector('.matchfeed');
  if (feed) {
    let idx = liveFeedTop ? l.commentary.indexOf(liveFeedTop) : -1;
    if (idx < 0 && liveFeedTop) feed.innerHTML = l.commentary.map(e => feedRow(e)).join('');
    else if (idx > 0) { feed.insertAdjacentHTML('afterbegin', l.commentary.slice(0, idx).map(e => feedRow(e, true)).join('')); while (feed.children && feed.children.length > 35) feed.removeChild(feed.lastChild) }
    liveFeedTop = l.commentary[0];
  }
  syncCrowd(); return true;
}
function feedRow(e, isNew) { return `<div class="row${isNew ? ' newline' : ''}${/^GOAL!/.test(e.text) ? ' goalline' : ''}"><b>${e.minute}′</b><p>${esc(e.text)}</p></div>` }
function liveDecorate() {
  let l = g.world && g.world.live; if (!l || page !== 'Matchday') { liveFeedTop = null; if (typeof SFX !== 'undefined') SFX.crowdOff(); return }
  let root = $('content'); if (!root || !root.querySelector) return;
  let small = root.querySelector('.scorecentral small'); if (small) small.innerHTML = `<span class="liveclock">${clockText(l.minute, 0)}</span>${l.paused ? ' · ' + (l.minute === 45 ? 'HALF-TIME' : 'PAUSED') : ' · LIVE'}`;
  liveFeedTop = l.commentary[0]; liveClock.t0 = typeof performance !== 'undefined' ? performance.now() : 0; liveClock.ms = Math.max(70, 900 / (l.speed || 2));
  startClock(); syncCrowd();
}
function startClock() {
  if (clockOn || typeof requestAnimationFrame !== 'function') return; clockOn = true;
  let loop = () => {
    let l = g.world && g.world.live; if (!l) { clockOn = false; return }
    let frac = l.paused ? 0 : clamp((performance.now() - liveClock.t0) / liveClock.ms, 0, .999), txt = clockText(l.minute, Math.floor(frac * 60)), root = $('content');
    let c = root && root.querySelector && root.querySelector('.liveclock'); if (c && c.textContent !== txt) c.textContent = txt; if (pitch.el) { let b = pitch.el.querySelector('.sbclock'); if (b && b.textContent !== txt) b.textContent = txt }
    requestAnimationFrame(loop);
  }; requestAnimationFrame(loop);
}
function syncCrowd() {
  if (typeof SFX === 'undefined') return; let l = g.world && g.world.live;
  if (l && !l.paused && page === 'Matchday') SFX.crowdOn(crowdLevel(l)); else SFX.crowdOff();
}

/* ---------- wiring ---------- */
render = function () {
  let l = g.world && g.world.live;
  if (liveTick && l && !(l.halftime && l.paused) && l.minute < 90 && page === 'Matchday') return;   // the tick updates the page in place
  baseLiveRender(); liveDecorate();
};
tickMatch = function (delegate = false) {
  if (!delegate) liveTick = true;
  try { baseLiveTick(delegate) } finally { liveTick = false }
  if (!delegate && g.world.live) liveUpdate();
};
playMatch = function () {
  let l = g.world.live, start = l && l.minute === 0 && l.paused, resume = l && l.minute === 45 && l.paused && l.halftime;
  audioUnlockSoft(); baseLivePlay();
  if (start) { SFX.kickoff(); pushLine(l, `We are underway at ${team((g.world.fixtures.find(x => x.id === l.fixture) || {}).home).stadium || 'the ground'}.`) }
  else if (resume) SFX.kickoff();
};
beginMatch = function (id, attend = true) { baseLiveBegin(id, attend); let l = g.world.live; if (l) l.attend = attend; liveFeedTop = null };
finishMatch = function () {
  let l = g.world.live, attended = l && l.attend, f = l && g.world.fixtures.find(x => x.id === l.fixture); baseLiveFinish();
  if (attended && l) { SFX.fullTime(); SFX.crowdOff() }
};
ffwdEnd = function () { let had = ffwd.on; baseLiveEnd(); if (had && g.world && g.world.autoPause && g.world.autoPause.cat !== 'boardroom') SFX.ping() };

matchSpeed = function (v) { baseLiveSpeed(v); let l = g.world.live; if (l) { liveClock.ms = Math.max(70, 900 / (l.speed || 2)); liveClock.t0 = performance.now() } };
