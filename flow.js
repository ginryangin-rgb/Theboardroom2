/* Continue flow. One button fast-forwards time behind a live feed of news, messages and results, then lands you back on the
   Overview. When your team plays you get the matchday prompt, then a full-time screen with scores from around the leagues,
   then back to the Overview. */

const baseFlowRender = render, baseFlowFinish = finishMatch, baseFlowSim = simulate, baseFlowSettle = settleLeague;
let ffwd = { on: false }, resultOpen = false, flowSeen = new WeakSet();
const baseFlowStop = stopClock;
/* Anything else that stops the clock (opening a negotiation, a match prompt…) must also end the run, or the interface is left 'running'. */
stopClock = function () { baseFlowStop(); if (ffwd.on && !ffwd.inTick) ffwdEnd() };

simulate = function (a, b, table) {
  let r = baseFlowSim(a, b, table);
  if (g && g.world) (g.world.roundLog || (g.world.roundLog = [])).push({ home: a, away: b, score: r, tier: g.tables.indexOf(table) });
  return r;
};
settleLeague = function (f, score) {
  if (g.world) { g.world.roundLog = []; g.world.beforePos = position(); g.world.beforePts = myrow().pts }
  let r = baseFlowSettle(f, score);
  if (g.world && g.world.roundLog) g.world.roundLog.push({ home: f.home, away: f.away, score, tier: tier(), mine: true });
  return r;
};

render = function () {
  if (ffwd.on && ffwd.mode === 'screen') return;
  if (ffwd.on && ffwd.quiet && g && g.world) { $('timebar').innerHTML = timebarHtml(); $('date').textContent = dateText(g.world.date, false); return }   // days tick quietly: only the bar changes, the page does not flicker or jump
  let y = window.scrollY || 0; baseFlowRender(); if (y > 0 && window.scrollTo) window.scrollTo(0, y);
};
const baseFlowGo = go;
go = function (p) { baseFlowGo(p); let c = $('content'); if (c && c.classList) { c.classList.remove('pagein'); void c.offsetWidth; c.classList.add('pagein') } };

function continueRun() {
  ensureWorld(); let w = g.world;
  if (ffwd.on) return;
  if (g.ended || w.live || w.ready || w.seasonComplete) return advance();
  stopClock(); w.pauseNote = null; w.pauseReason = null; resultClose(true);
  flowSeen = new WeakSet(); for (let n of w.news) flowSeen.add(n); for (let m of g.inbox) flowSeen.add(m);
  ffwd = { on: true, mode: prefs().runView === 'screen' ? 'screen' : 'page', feed: [], start: w.date, days: 0, lastLedger: g.ledger[0], inTick: false };
  if (ffwd.mode === 'screen') ffwdPaint();
  clockTimer = setInterval(ffwdTick, SPEED_MS[speedNow()]);
  render();
}
function nextDay() {
  ensureWorld(); let w = g.world; if (ffwd.on) ffwdEnd();
  if (g.ended || w.live || w.ready || w.seasonComplete) return advance();
  w.pauseNote = null; w.pauseReason = null; advanceDay();
  if (w.autoPause) w.pauseNote = w.autoPause;
  render();
}
function ffwdRestart() { if (ffwd.on && clockTimer) { clearInterval(clockTimer); clockTimer = setInterval(ffwdTick, SPEED_MS[speedNow()]) } }
const baseSetSpeed = setSpeed;
setSpeed = function (n) { baseSetSpeed(n); ffwdRestart(); if (ffwd.on && ffwd.mode === 'screen') ffwdPaint() };

function feedPush(kind, title, text, tag) { ffwd.feed.unshift({ kind, title, text, tag, date: g.world.date, t: ffwd.days }); ffwd.feed = ffwd.feed.slice(0, 80) }
function ffwdTick() {
  if (!ffwd.on) return;
  let w = g.world; ffwd.inTick = true; ffwd.quiet = ffwd.mode === 'page' && (w.days + 1) % 7 !== 0;   // refresh the whole page once a week
  try { advanceDay() } finally { ffwd.inTick = false; ffwd.quiet = false }
  ffwd.days++;
  for (let n of [...w.news].reverse()) if (!flowSeen.has(n)) { flowSeen.add(n); feedPush('news', n.title, n.body, n.kind) }
  for (let m of [...g.inbox].reverse()) if (!flowSeen.has(m)) { flowSeen.add(m); prepareMessage(m); feedPush('inbox', m.title, m.body, m.priority) }
  let L = g.ledger[0]; if (L && L !== ffwd.lastLedger) { ffwd.lastLedger = L; feedPush('money', 'Weekly accounts', 'Net ' + (L.net >= 0 ? '+' : '') + money(L.net) + ' · cash ' + money(g.cash), 'money') }
  if (ffwd.mode === 'screen') ffwdPaint(); else $('timebar').innerHTML = timebarHtml();
  if (!clockTimer || g.ended || w.ready || w.live || w.seasonComplete || w.autoPause || w.pauseReason) ffwdEnd();
}
function ffwdEnd() {
  if (!ffwd.on) return;
  if (clockTimer) { clearInterval(clockTimer); clockTimer = null }
  let w = g.world, screen = ffwd.mode === 'screen'; ffwd.on = false;
  if (screen) { $('ffwd').className = 'ffwd'; $('ffwd').innerHTML = ''; page = 'Overview' }
  if (w.autoPause) w.pauseNote = w.autoPause;
  save(); render();
}
function ffwdStop() { ffwdEnd() }
function ffwdPaint() {
  let w = g.world, seasonStart = iso(seasonYear(), 7, 1), done = clamp(daysBetween(seasonStart, w.date) / 334, 0, 1), nf = nextFixture(), sp = speedNow();
  let icon = k => ({ news: '◆', inbox: '✉', money: '£' })[k] || '•';
  $('ffwd').className = 'ffwd on';
  $('ffwd').innerHTML = `<div class="ffwdcard"><div class="ffwdhead"><div><div class="eyebrow">TIME IS PASSING</div><h1>${dateText(w.date)}</h1><p>${esc(windowState())}${nf ? ' · Next: ' + esc(team(nf.home === g.clubId ? nf.away : nf.home).short) + ' ' + (nf.home === g.clubId ? '(H)' : '(A)') + ' on ' + dateText(nf.date, false) : ''}</p></div><div class="ffwdctl"><div class="speedgroup pace"><span class="pacelabel">Pace</span>${[1, 2, 4].map(n => `<button class="${sp === n ? 'active' : ''}" onclick="setSpeed(${n})">${'▸'.repeat(n === 4 ? 3 : n)}</button>`).join('')}</div><button class="primary" onclick="ffwdStop()">Stop here</button></div></div><div class="fbar"><i style="width:${done * 100}%"></i></div><div class="ffwdbody"><div class="ffwdfeed">${ffwd.feed.length ? ffwd.feed.map(x => `<div class="feeditem ${x.kind} ${x.tag}${x.t === ffwd.days ? ' new' : ''}"><span class="feedicon">${icon(x.kind)}</span><div><b>${esc(x.title)}</b><p>${esc(x.text)}</p></div><small>${dateText(x.date, false)}</small></div>`).join('') : '<p class="fineprint">Quiet so far. News, messages and results will appear here as the days pass.</p>'}</div>${ffwdSide()}</div></div>`;
}

function ffwdSide() {
  let st = standings(), pos = position(), mine = st.findIndex(r => r.id === g.clubId), rows = st.slice(0, 5).map((r, i) => [i + 1, r]);
  if (mine >= 5) rows.push(null, [mine + 1, st[mine]]);
  let open = g.fin && g.fin.del ? g.fin.del.queue.filter(d => d.status === 'open').length : 0, inj = g.squad.filter(p => p.inj).length;
  return `<div class="ffwdside"><h3>${esc(DB[tier()].name)}</h3>${rows.map(r => r ? `<div class="trow ${r[1].id === g.clubId ? 'me' : ''}"><span>${r[0]}</span><span>${esc(club(r[1].id).short)}</span><b>${r[1].pts}</b></div>` : '<div class="trow gap"><span>…</span></div>').join('')}<h3 style="margin-top:16px">Your club</h3><div class="trow"><span></span><span>Cash</span><b>${compact(g.cash)}</b></div><div class="trow"><span></span><span>Injured</span><b>${inj}</b></div><div class="trow"><span></span><span>Decisions waiting</span><b>${open}</b></div><div class="trow"><span></span><span>Position</span><b>${pos}</b></div></div>`;
}

/* ---------- full-time screen ---------- */
finishMatch = function () {
  let w = g.world, live = w.live, was = !!live; baseFlowFinish();
  if (was && w.lastMatch) { page = 'Overview'; render(); resultOpen = true; resultPaint() }
};
function resultClose(silent) { if (!resultOpen) return; resultOpen = false; if (!ffwd.on) { $('ffwd').className = 'ffwd'; $('ffwd').innerHTML = '' } if (!silent) { page = 'Overview'; render() } }
function resultPaint() {
  let w = g.world, m = w.lastMatch, f = { home: m.homeId, away: m.awayId }, mine = m.homeId === g.clubId, own = mine ? m.home : m.away, opp = mine ? m.away : m.home;
  let res = own > opp ? 'Win' : own === opp ? (m.winner ? (m.winner === g.clubId ? 'Won on penalties' : 'Lost on penalties') : 'Draw') : 'Defeat', comp = m.comp === 'League' ? DB[tier()].name : (w.cups[m.comp]?.name || m.comp);
  let cupTies = m.comp !== 'League' && w.cups[m.comp] ? (w.cups[m.comp].results || []).filter(x => x.round === m.round && !(x.home === g.clubId || x.away === g.clubId)).map(x => ({ home: x.home, away: x.away, score: x.score })) : [];
  let log = (w.roundLog || []).filter(r => !r.mine), mineRows = log.filter(r => r.tier === tier()), others = [0, 1, 2, 3].filter(t => t !== tier());
  let row = r => `<div class="row scorerow"><span>${esc(team(r.home).short)}</span><b>${r.score[0]} – ${r.score[1]}</b><span>${esc(team(r.away).short)}</span></div>`;
  let cupLine = m.comp !== 'League' ? (m.winner ? (m.winner === g.clubId ? 'Through to the next round' + (typeof cupPrize === 'function' && w.cups[m.comp] ? ' — ' + compact(cupPrize(m.comp, w.cups[m.comp].round)) + ' prize money banked.' : '.') : 'Knocked out.') : 'The tie is still alive.') : '';
  let posLine = m.comp === 'League' ? `League position ${w.beforePos} → <b>${position()}</b> · ${myrow().pts} points` : '';
  let injured = (med().recent || []); let news = w.news.slice(0, 4);
  $('ffwd').className = 'ffwd on result';
  $('ffwd').innerHTML = `<div class="ffwdcard"><div class="eyebrow">FULL TIME · ${esc(comp).toUpperCase()} · ${esc(m.round || '')}</div><div class="resultscore"><div class="team">${teamBadge(m.homeId)}<div>${esc(team(m.homeId).short)}</div></div><div class="big">${m.home} – ${m.away}</div><div class="team">${teamBadge(m.awayId)}<div>${esc(team(m.awayId).short)}</div></div></div><p class="resultline"><b class="${res === 'Win' ? 'positive' : res === 'Defeat' ? 'negative' : ''}">${res}</b>${m.penalties ? ' on penalties' : ''}. ${cupLine} ${posLine}</p>${(m.goals && m.goals.length) ? `<p class="scorers">${m.goals.map(x => `<span class="${x.side === 'h' ? 'sh' : 'sa'}">⚽ ${esc(x.name || 'Goal')} ${x.min}′</span>`).join('')}</p>` : ''}${m.stats ? statsHtml(m, true, m.homeId, m.awayId) : ''}${injured.length ? `<div class="notice warning"><b>Injury news:</b> ${esc(injured.join(', '))}</div>` : ''}
  <div class="twocol"><div>${cupTies.length ? `<h3>Other ties in the ${esc(m.round || 'round')}</h3>${cupTies.slice(0, 14).map(row).join('')}` : ''}${mineRows.length ? `<h3>Around the ${esc(DB[tier()].name)}</h3>${mineRows.map(row).join('')}` : ''}${others.some(t => log.some(r => r.tier === t)) ? others.filter(t => log.some(r => r.tier === t)).map(t => `<details class="bundle"><summary><b>${esc(DB[t].name)}</b><small>${log.filter(r => r.tier === t).length} results</small></summary>${log.filter(r => r.tier === t).map(row).join('')}</details>`).join('') : ''}</div><div><h3>Latest news</h3>${news.map(n => `<div class="feeditem news"><span class="feedicon">◆</span><div><b>${esc(n.title)}</b><p>${esc(n.body)}</p></div></div>`).join('') || '<p class="fineprint">No news.</p>'}</div></div>
  <div class="actions"><button class="primary" onclick="resultClose()">Back to the overview →</button></div></div>`;
}
