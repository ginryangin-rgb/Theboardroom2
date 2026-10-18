/* Phase 1 — pacing and inbox.
   Layered on top of engine.js / app.js / world.js, same pattern as world.js.
   Adds: speed controls (pause / 1x / 2x / 4x), "continue to next event", auto-pause settings,
   inbox priorities, bundling, search, handled state, deadlines, and early warnings. */

const SPEED_MS = { 1: 700, 2: 300, 4: 120 };   // pace of Continue, in ms per game day
const PAUSE_DEFAULTS = { transfers: true, contracts: true, decisions: true, finance: true, injuries: false, window: false, board: false, cups: false, scouts: false, academy: false, projects: false };   // stop only for things that need you
const PAUSE_LABELS = {
  transfers: ['Transfer replies & bids', 'A club or player responds to your offer, or another club bids for one of your players.'],
  contracts: ['Contracts', 'A player’s contract is running out, he agrees to leave, or a renewal needs you.'],
  decisions: ['Bigger decisions', 'A sizeable repair, request or renewal needs you. Small ones never interrupt.'],
  finance: ['Cash & regulation warnings', 'Your forecast shows a shortfall, or you are about to breach the financial rules.'],
  injuries: ['Key injuries & squad crises', 'A first-team regular is injured, or too few players are fit.'],
  window: ['Windows & deadlines', 'A window opens or closes, or a deadline is a week away.'],
  board: ['Board messages', 'Season reviews and new appointments.'],
  cups: ['Cup draws', 'A domestic or European draw is made.'],
  scouts: ['Scout reports', 'Your scouts send new recommendations.'],
  academy: ['Academy news', 'Youth intakes, age reviews and graduates.'],
  projects: ['Stadium projects', 'Construction milestones and completions.']
};
const PRIORITY = {
  urgent: { label: 'Urgent', order: 0 },
  decision: { label: 'Needs decision', order: 1 },
  routine: { label: 'Routine', order: 2 },
  news: { label: 'News', order: 3 }
};
const CAT_LABEL = { contracts: 'Contracts', injuries: 'Injuries', medical: 'Medical', decisions: 'Decisions', transfers: 'Transfers', window: 'Transfer window', board: 'Board', finance: 'Finance', cups: 'Cups', scouts: 'Scouting', academy: 'Academy', projects: 'Stadium', results: 'Results', general: 'Club' };
const CAT_PAGE = { contracts: 'Contracts', injuries: 'Medical', medical: 'Medical', decisions: 'Staff', transfers: 'Recruitment', window: 'Recruitment', scouts: 'Recruitment', finance: 'Finances', academy: 'Academy', projects: 'Stadium', cups: 'Competitions', board: 'Overview', results: 'Matchday', general: 'Overview' };

let inboxFilter = { prio: 'all', q: '', showHandled: false };
let pacingInboxSeq = 0;
const basePacingMsg = msg, basePacingAdvanceDay = advanceDay, basePacingAdvance = advance, basePacingRender = render;

function classifyMessage(title, body, type) {
  let t = title || '', b = body || '', cat = 'general', priority = 'routine';
  if (/^Administration$/.test(t)) { cat = 'board'; priority = 'urgent' }
  else if (/^Cash warning/.test(t)) { cat = 'finance'; priority = 'urgent' }
  else if (/^Transfer window closes in/.test(t)) { cat = 'window'; priority = 'urgent' }
  else if (/^Contract urgent: /.test(t)) { cat = 'contracts'; priority = 'urgent' }
  else if (/^Contract: /.test(t)) { cat = 'contracts'; priority = 'decision' }
  else if (/^Board matter: /.test(t)) { cat = 'board'; priority = 'urgent' }
  else if (/^Bid: /.test(t)) { cat = 'transfers'; priority = 'decision' }
  else if (/^Squad crisis/.test(t)) { cat = 'injuries'; priority = 'urgent' }
  else if (/^Injury: /.test(t)) { cat = 'injuries'; priority = 'decision' }
  else if (/^Minor injury: |^Returns: |^Setback: |^Manager unhappy/.test(t)) { cat = 'medical'; priority = 'routine' }
  else if (/^Decision: /.test(t)) { cat = 'decisions'; priority = 'decision' }
  else if (/^Delegated: |^Cost: /.test(t)) { cat = 'decisions'; priority = 'routine' }
  else if (/^Regulation breach/.test(t)) { cat = 'finance'; priority = 'urgent' }
  else if (/^Takeover approach$/.test(t)) { cat = 'board'; priority = 'urgent' }
  else if (/^Squad cost warning|^Covenant breach|^Lender accelerates/.test(t)) { cat = 'finance'; priority = 'decision' }
  else if (/^Transfer update/.test(t)) { cat = 'transfers'; priority = 'decision' }
  else if (/^Scout report/.test(t)) { cat = 'scouts'; priority = 'decision' }
  else if (/^Youth intake ready/.test(t)) { cat = 'academy'; priority = 'decision' }
  else if (/window/i.test(t) && /registration/i.test(b)) { cat = 'window'; priority = 'news' }
  else if (/^Transfer|^Player sold/.test(t)) cat = 'transfers';
  else if (/ draw$/.test(t)) { cat = 'cups'; priority = 'news' }
  else if (/^Board|^Welcome|new season|manager appointed/i.test(t)) cat = 'board';
  else if (/Commercial|loan/i.test(t)) cat = 'finance';
  else if (type === 'academy' || /Youth|Academy/.test(t)) cat = 'academy';
  else if (type === 'stadium' || /Project|repairs/.test(t)) cat = 'projects';
  else if (/\d\s*[–-]\s*\d/.test(b) || /Three points/.test(t)) cat = 'results';
  return { cat, priority };
}
function windowCloseDate(date = g.world.date) {
  let y = Number(date.slice(0, 4)), md = date.slice(5);
  if (md >= '06-15' && md <= '09-01') return iso(y, 9, 1);
  if (md >= '01-01' && md <= '02-01') return iso(y, 2, 1);
  return null;
}
const URGENT_CONSEQUENCE = [
  [/^Transfer window closes/, 'Unfinished talks end at the deadline and no one can be registered until the next window.'],
  [/^Cash warning/, 'Wages and costs push the club towards its overdraft limit. Cut costs, raise income or sell a player.'],
  [/^Board matter/, 'Time cannot move on until the board has answered. Attend the meeting.'],
  [/^Contract urgent/, 'He leaves on a free transfer on 30 June unless you agree a new deal.'],
  [/^Squad crisis/, 'With too few fit players, your results will suffer. Rest tired players, rush back or buy cover.'],
  [/^Regulation breach/, 'Sanctions apply at the end of the season: a levy, a points deduction or a transfer embargo.'],
  [/^Takeover approach$/, 'The offer lapses. Rejecting keeps the club; accepting ends your chairmanship.'],
  [/^Administration/, 'The club has failed. This career has ended.']
];
function prepareMessage(m) {
  if (!m.id) m.id = 'm' + Date.now().toString(36) + (pacingInboxSeq++);
  if (!m.priority) { let c = classifyMessage(m.title, m.body, m.type); m.priority = c.priority; m.cat = c.cat }
  if (m.handled === undefined) m.handled = false;
}
function prefs() {
  if (!g.prefs) g.prefs = { pauseOn: { ...PAUSE_DEFAULTS }, speed: 2, runView: 'page' };
  for (let k in PAUSE_DEFAULTS) if (!(k in g.prefs.pauseOn)) g.prefs.pauseOn[k] = PAUSE_DEFAULTS[k];
  return g.prefs;
}
function pausePrefs() { return prefs().pauseOn }

msg = function (title, body, type = 'inbox') {
  basePacingMsg(title, body, type);
  let m = g.inbox[0]; if (!m) return;
  prepareMessage(m);
  if (m.priority === 'urgent') m.deadline = m.deadline || (g.world ? (m.cat === 'window' ? windowCloseDate() : null) : null);
  if (g.world && pausePrefs()[m.cat]) g.world.autoPause = { title: m.title, cat: m.cat, date: g.world.date };
};

advanceDay = function () {
  let w = g.world; if (!w) return basePacingAdvanceDay();
  w.autoPause = null;
  basePacingAdvanceDay();
  if (!g.world || g.ended) return;
  w = g.world;
  let close = windowCloseDate();
  if (close && windowOpen()) {
    let left = daysBetween(w.date, close);
    w.warned = w.warned || {};
    if (left <= 7 && left > 0 && !w.warned[close]) {
      w.warned[close] = true;
      msg('Transfer window closes in ' + left + (left === 1 ? ' day' : ' days'), 'Registrations close on ' + dateText(close, false) + '. Finish any open negotiations before then.', 'football');
    }
  }
  if (w.days % 7 === 0) {
    let info = typeof shortfallInfo === 'function' ? shortfallInfo() : (forecast() < 0 ? { amount: forecast(), month: 'the next 13 weeks', admin: false } : null);
    if (info && (!w.lastCashWarning || daysBetween(w.lastCashWarning, w.date) >= 84 || (info.admin && !w.cashAdminWarned && daysBetween(w.lastCashWarning, w.date) >= 14))) {
      w.lastCashWarning = w.date; if (info.admin) w.cashAdminWarned = true;
      msg('Cash warning: shortfall projected', 'Your forecast shows cash falling to ' + money(info.amount) + ' around ' + info.month + '.' + (info.admin ? ' That is beyond your overdraft limit, so the club would enter administration.' : ' You would be living in your overdraft.') + ' Open the forecast to see what could change it.', 'finance');
      g.inbox[0].page = 'Forecast';
    }
  }
  if (w.autoPause) { stopClock(); w.pauseNote = w.autoPause; render() }
};

advance = function () {
  if (g?.world) g.world.pauseNote = null;
  basePacingAdvance();
  if (clockTimer) restartClock();
};
function speedNow() { return g && SPEED_MS[prefs().speed] ? prefs().speed : 2 }
function restartClock() { if (clockTimer) clearInterval(clockTimer); clockTimer = setInterval(advanceDay, SPEED_MS[speedNow()]) }
function setSpeed(n) {
  ensureWorld(); prefs().speed = n; g.world.pauseNote = null; save(); render();
}
function setRunView(v) { prefs().runView = v; save(); pauseSettings() }
function pauseGame() { stopClock(); render() }
function nextEvent() {
  ensureWorld(); let w = g.world;
  if (g.ended || w.live || w.ready || w.seasonComplete) return advance();
  stopClock(); w.pauseNote = null; w.pauseReason = null;
  let real = render, n = 0; render = () => { };
  try {
    while (n++ < 200) {
      advanceDay();
      if (w.ready || w.live || w.seasonComplete || g.ended || w.autoPause || w.pauseReason) break;
    }
  } finally { render = real }
  if (w.autoPause) w.pauseNote = w.autoPause;
  save(); render();
}
function togglePauseSetting(k) { let p = pausePrefs(); p[k] = !p[k]; save(); pauseSettings() }
function pauseSettings() {
  let p = pausePrefs();
  $('modal').innerHTML = `<div class="overlay"><div class="modal"><div class="topline"><span class="eyebrow">AUTO-PAUSE</span><button class="textbutton" onclick="closeModal()">Close ×</button></div><h1>How time runs</h1><p>Continue runs day by day and stops when you press Stop, on a match day, or for anything ticked below.</p><div class="pauseopt" style="cursor:default"><span><b>While time runs</b><small><label><input type="radio" name="rv" ${prefs().runView !== 'screen' ? 'checked' : ''} onchange="setRunView('page')"> Stay on my page, with a news ticker</label><br><label><input type="radio" name="rv" ${prefs().runView === 'screen' ? 'checked' : ''} onchange="setRunView('screen')"> Show the full live screen (table, news, results)</label></small></span></div>${Object.keys(PAUSE_LABELS).map(k => `<label class="pauseopt"><input type="checkbox" ${p[k] ? 'checked' : ''} onchange="togglePauseSetting('${k}')"><span><b>${PAUSE_LABELS[k][0]}</b><small>${PAUSE_LABELS[k][1]}</small></span></label>`).join('')}<div class="actions"><button class="primary" onclick="closeModal()">Done</button></div></div></div>`;
}

function timebarHtml() {
  let w = g.world, running = !!clockTimer, sp = speedNow();
  let gate = w.live ? ['Match in progress', 'Matchday'] : w.seasonComplete ? ['Next season →', ''] : w.ready ? ['Matchday →', ''] : null;
  let nf = nextFixture();
  let state = g.ended ? 'Career ended' : (typeof ffwd !== 'undefined' && ffwd.on) ? 'Running day by day' : 'Paused';
  let run = typeof ffwd !== 'undefined' && ffwd.on;
  let paceHtml = `<div class="speedgroup pace" role="group" aria-label="Pace"><span class="pacelabel">Pace</span>${[1, 2, 4].map(n => `<button class="${sp === n ? 'active' : ''}" onclick="setSpeed(${n})" title="${['', 'Relaxed', 'Normal', '', 'Fast'][n]} pace">${'▸'.repeat(n === 4 ? 3 : n)}</button>`).join('')}</div>`;
  let controls = g.ended ? '' : gate
    ? `<button class="primary" onclick="advance()">${gate[0]}</button>`
    : run ? `<button class="primary stopbtn" onclick="ffwdStop()">■ Stop</button>${paceHtml}`
      : `<button onclick="nextDay()" title="Advance exactly one day">Next day ▸</button><button class="primary bigcontinue" onclick="continueRun()" title="Run day by day until something needs you or it is match day">Continue ▶▶</button>${paceHtml}`;
  let ticker = run && ffwd.feed && !ffwd.feed.length ? '<div class="tickerline"><span class="tick">Time is passing…</span></div>' : run && ffwd.feed && ffwd.feed.length ? `<div class="tickerline">${ffwd.feed.slice(0, 3).map(x => `<span class="tick ${x.kind}">${esc(x.title)}</span>`).join('')}</div>` : '';
  let note = w.pauseNote ? `<div class="pausenote"><b>⏸ Paused:</b> ${esc(w.pauseNote.title)} <button class="textbutton" onclick="go('Inbox')">Open inbox →</button></div>` : '';
  return `<div class="timebarrow"><div class="timedate"><b>${dateText(w.date)}</b><small>${esc(windowState())}${nf ? ' · Next: ' + esc(team(nf.home === g.clubId ? nf.away : nf.home).short) + ' ' + (nf.home === g.clubId ? '(H)' : '(A)') + ' ' + dateText(nf.date, false) : ''} · ${state}</small></div><div class="timectl">${controls}${typeof soundButton === 'function' ? soundButton() : ''}<button class="iconbutton" onclick="pauseSettings()" title="Auto-pause settings" aria-label="Auto-pause settings">⚙ Auto-pause</button></div></div><div class="seasonbar" title="Season progress"><i data-to="${clamp(daysBetween(iso(seasonYear(), 7, 1), w.date) / 334, 0, 1) * 100}" style="width:${clamp(daysBetween(iso(seasonYear(), 7, 1), w.date) / 334, 0, 1) * 100}%"></i></div><div class="timeslot">${(typeof boardSlot === 'function' && boardSlot()) || ticker || note || '<span class="timehint">Next day steps one day. Continue runs until a match day, or something needs you.</span>'}</div>`;
}

/* ---------- Inbox ---------- */
function inboxCounts() {
  let c = { all: 0, urgent: 0, decision: 0, routine: 0, news: 0 };
  for (let m of g.inbox) { prepareMessage(m); if (!m.handled && m.deadline && g.world && m.deadline < g.world.date) m.handled = true; if (m.handled) continue; c.all++; c[m.priority]++ }
  return c;
}
function handleMessage(id) { let m = g.inbox.find(x => x.id === id); if (m) m.handled = true; save(); render() }
function openMessage(id) { let m = g.inbox.find(x => x.id === id); if (m) { m.handled = true; save() } go(m?.page || CAT_PAGE[m?.cat] || 'Overview') }
function handleAllRoutine() { let n = 0; for (let m of g.inbox) if (!m.handled && (m.priority === 'routine' || m.priority === 'news')) { m.handled = true; n++ } save(); render(); toast(n + ' routine item' + (n === 1 ? '' : 's') + ' marked as handled.') }
function setInboxFilter(k, v) { inboxFilter[k] = v; render() }
function msgDate(m) { return m.date ? dateText(m.date, false) : 'Season ' + m.season + ' · Week ' + m.week }
function inboxRow(m) {
  let cons = m.priority === 'urgent' ? (URGENT_CONSEQUENCE.find(([r]) => r.test(m.title)) || [])[1] : '';
  let dl = m.deadline ? `<span class="pill deadline">Deadline ${dateText(m.deadline, false)}${g.world ? ' · ' + Math.max(0, daysBetween(g.world.date, m.deadline)) + ' days' : ''}</span>` : '';
  return `<div class="inboxitem prio-${m.priority} ${m.handled ? 'handled' : ''}"><span class="itemicon">${icon(({ academy: 'Academy', stadium: 'Stadium', football: 'Football', sponsorship: 'Sponsorship' })[m.type] || 'Inbox')}</span><div class="inboxbody"><div class="inboxmeta"><span class="prio prio-${m.priority}">${PRIORITY[m.priority].label}</span><span>${CAT_LABEL[m.cat] || 'Club'}</span><span>${msgDate(m)}</span>${dl}</div><h3>${esc(m.title)}</h3><p>${esc(m.body)}</p>${cons ? `<p class="consequence"><b>If ignored:</b> ${esc(cons)}</p>` : ''}${m.handled ? '' : (m.decisionId && typeof decisionButtons === 'function') ? decisionButtons(m) : (m.bidId && typeof bidButtons === 'function') ? bidButtons(m) : (m.boardId && typeof boardButtons === 'function') ? boardButtons(m) : `<div class="actions"><button onclick="openMessage('${m.id}')">${m.priority === 'news' || m.priority === 'routine' ? 'Open' : 'Act now'} →</button><button class="textbutton" onclick="handleMessage('${m.id}')">Mark handled</button></div>`}</div></div>`;
}
function inboxPage() {
  let c = inboxCounts(), f = inboxFilter, q = f.q.trim().toLowerCase();
  let list = g.inbox.filter(m => (f.showHandled || !m.handled) && (f.prio === 'all' || m.priority === f.prio) && (!q || (m.title + ' ' + m.body).toLowerCase().includes(q)));
  list.sort((a, b) => PRIORITY[a.priority].order - PRIORITY[b.priority].order);
  let tabs = [['all', 'All'], ['urgent', 'Urgent'], ['decision', 'Needs decision'], ['routine', 'Routine'], ['news', 'News']].map(([k, n]) => `<button class="${f.prio === k ? 'active' : ''}" onclick="setInboxFilter('prio','${k}')">${n}<span class="count ${k === 'urgent' && c.urgent ? 'hot' : ''}">${c[k]}</span></button>`).join('');
  let html = '', i = 0;
  while (i < list.length) {
    let m = list[i];
    if (m.priority !== 'urgent' && !m.handled) {
      let group = [m], j = i + 1;
      while (j < list.length && !list[j].handled && list[j].priority === m.priority && list[j].cat === m.cat) group.push(list[j++]);
      if (group.length >= 3) {
        html += `<details class="bundle"><summary><span class="prio prio-${m.priority}">${PRIORITY[m.priority].label}</span><b>${group.length} ${CAT_LABEL[m.cat] || 'club'} updates</b><small>${esc(group[0].title)}${group.length > 1 ? ' and ' + (group.length - 1) + ' more' : ''}</small></summary>${group.map(inboxRow).join('')}</details>`;
        i = j; continue;
      }
    }
    html += inboxRow(m); i++;
  }
  return `<div class="inboxtools"><div class="tabs">${tabs}</div><div class="marketfilters"><input aria-label="Search inbox" placeholder="Search inbox…" value="${esc(f.q)}" onchange="setInboxFilter('q',this.value)"><label><input type="checkbox" ${f.showHandled ? 'checked' : ''} onchange="setInboxFilter('showHandled',this.checked)"> Show handled</label><button onclick="handleAllRoutine()" ${c.routine + c.news ? '' : 'disabled'}>Mark all routine as handled</button></div></div>${card(list.length + (list.length === 1 ? ' message' : ' messages'), list.length ? html : '<div class="pad"><p>Nothing here. Your desk is clear.</p></div>')}`;
}

render = function () {
  if (!g || rollingOver) return;
  basePacingRender();
  if (!g?.world) return;
  inboxCounts();
  $('timebar').innerHTML = timebarHtml();
  if (page === 'Inbox') {
    $('content').innerHTML = inboxPage();
    $('intro').textContent = 'Urgent items first. Routine items are bundled so you can clear them in one click.';
  }
  if (page === 'Calendar' && typeof $('content').innerHTML === 'string')
    $('content').innerHTML = $('content').innerHTML.replace(/<label>Calendar pace[\s\S]*?<\/label>/, '');
  let c = inboxCounts(), hot = c.urgent + c.decision;
  if (hot && typeof $('nav').innerHTML === 'string')
    $('nav').innerHTML = $('nav').innerHTML.replace('<span>Inbox</span>', `<span>Inbox</span><span class="count ${c.urgent ? 'hot' : ''}">${hot}</span>`);
};
