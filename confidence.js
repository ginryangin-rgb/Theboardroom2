/* Board confidence. The other directors, your investors and the bank keep a running view of you. Results against the board's target,
   the finances, the supporters and the rules all move it every week. Fall far enough and you get a warning, then a vote of no
   confidence: with a big enough stake you survive it (at a price); otherwise you are removed and the career ends. */

const baseCfWeekly = weeklyWorld, baseCfComplete = completeWorldSeason, baseCfSetup = setupWorld;
function conf() { let w = g.world; if (w.confidence == null) w.confidence = 60; if (!w.confLog) w.confLog = []; return w }
function expectedPos() { let t = tier(), n = g.tables[t].length, target = g.world.boardTarget || ''; return /promotion/i.test(target) ? Math.max(2, Math.round(n * .2)) : /title|champion/i.test(target) ? 1 : /survive|safety/i.test(target) ? n - 4 : Math.ceil(n / 2) }
function confidenceFactors() {
  let f = fin(), t = tier(), n = g.tables[t].length, pos = position(), played = myrow().p, exp = expectedPos(), out = [];
  if (played >= 4) { let d = (exp - pos) / n; out.push({ k: 'results', label: `League: ${pos}${ord(pos)} against a target of ${exp}${ord(exp)}`, v: Math.round(clamp(d * 3.2, -1.2, 1.2) * 100) / 100 }) }
  let cashR = g.cash / Math.max(1, cfg[t].cash); out.push({ k: 'cash', label: g.cash < 0 ? 'Overdrawn' : cashR > .6 ? 'Healthy cash' : 'Cash is tight', v: g.cash < 0 ? -.6 : cashR > .6 ? .15 : -.15 });
  if (f.live && f.live.status) out.push({ k: 'rules', label: f.live.status === 'breach' ? 'Breaching the financial rules' : f.live.status === 'warn' || f.live.status === 'levy' ? 'Close to the financial limit' : 'Within the financial rules', v: f.live.status === 'breach' ? -.9 : f.live.status === 'ok' ? .1 : -.25 });
  let mood = typeof fanMood === 'function' ? fanMood() : g.trust; out.push({ k: 'fans', label: mood < 45 ? 'Supporters are angry' : mood >= 70 ? 'Supporters are happy' : 'Supporters are content', v: mood < 45 ? -.4 : mood >= 70 ? .2 : 0 });
  if (totalDebt() > cfg[t].cash * 1.2) out.push({ k: 'debt', label: 'Heavy debt', v: -.3 });
  if (g.world.promises && g.world.promises.kept === false) out.push({ k: 'promise', label: 'A broken promise to the manager', v: -.2 });
  return out;
}
function confidenceWord(c) { return c >= 80 ? 'Full backing' : c >= 65 ? 'Supportive' : c >= 50 ? 'Steady' : c >= 35 ? 'Concerned' : c >= 20 ? 'Alarmed' : 'Open revolt' }
weeklyWorld = function () {
  baseCfWeekly(); if (g.ended || !g.world) return; let w = conf(), fs = confidenceFactors(), delta = fs.reduce((s, x) => s + x.v, 0) + (w.confidence < 50 ? .08 : -.05);   // drift back towards the middle
  w.confidence = clamp(Math.round((w.confidence + delta) * 10) / 10, 0, 100); w.confLog.push(Math.round(w.confidence)); w.confLog = w.confLog.slice(-60);
  if (w.confidence < 35 && !w.confWarned) { w.confWarned = true; msg('The board is concerned', `Board confidence has fallen to ${Math.round(w.confidence)}. ${fs.filter(x => x.v < 0).map(x => x.label).join('. ')}. Turn it around or the directors will act.`, 'club'); if (typeof pressQueue === 'function') pressQueue({ head: 'PRESSURE MOUNTS ON THE BOARD', sub: `Directors at ${club().name} are said to be losing patience with the chairman.`, body: `Sources close to the boardroom describe confidence as "${confidenceWord(w.confidence).toLowerCase()}". ${fs.filter(x => x.v < 0).map(x => x.label.toLowerCase()).join(', ')}. One director said the next few weeks would be decisive.`, tone: 'bad', kind: 'club', scene: 'match', score: '' }) }
  if (w.confidence >= 50) w.confWarned = false;
  if (w.confidence < 15) { w.confLow = (w.confLow || 0) + 1; if (w.confLow >= 3 && !w.noConfidence) noConfidenceVote() } else w.confLow = 0;
};
function noConfidenceVote() {
  let w = conf(), share = typeof controlShare === 'function' ? controlShare() : 100; w.noConfidence = true; stopClock();
  if (share >= 75) {
    w.confidence = 40; w.confLow = 0; w.noConfidence = false; g.trust = clamp(g.trust - 8, 5, 100); let f = fin(), penalty = Math.round(cfg[tier()].cash * .05 / 1000) * 1000; g.cash -= penalty; record('Boardroom settlement', -penalty);
    msg('Vote of no confidence survived', `With ${share}% of the club you cannot be removed, but the directors forced concessions: a ${money(penalty)} settlement for departing board members and a public apology to supporters. Confidence resets to 40. Do not let it happen again.`, 'club');
    $('modal').innerHTML = `<div class="overlay"><div class="modal"><div class="eyebrow">THE BOARD</div><h1>Vote of no confidence</h1><p>The directors moved against you. With <b>${share}%</b> of the club you survived, but two board members resigned, you have paid a ${money(penalty)} settlement and supporters have read every word in the press. Confidence resets to 40.</p><div class="actions"><button class="primary" onclick="closeModal()">Carry on</button></div></div></div>`; save(); return;
  }
  g.ended = true; save();
  $('modal').innerHTML = `<div class="overlay"><div class="modal sacked"><div class="eyebrow">THE BOARD</div><h1>You have been removed</h1><p>With ${share}% of the club you could not block the vote. The directors and investors removed you as chairman of ${esc(club().name)} on ${dateText(g.world.date, false)}, after ${g.season} season${g.season > 1 ? 's' : ''}.</p><p class="fineprint">${confidenceFactors().filter(x => x.v < 0).map(x => x.label).join(' · ') || 'A run of poor results was the final straw.'}</p><div class="actions"><button class="primary" onclick="newGame()">Start a new career</button>${typeof legacyPage === 'function' ? '<button onclick="closeModal();go(\'Legacy\')">See your legacy</button>' : ''}</div></div></div>`;
  addNews(`${club().short} remove their chairman`, 'The board voted the chairman out after a collapse in confidence.', 'club');
}
completeWorldSeason = function () { baseCfComplete(); let w = conf(), pos = position(), exp = expectedPos(); let d = pos <= exp ? 6 + Math.min(6, exp - pos) : -(6 + Math.min(10, pos - exp)); w.confidence = clamp(w.confidence + d, 0, 100); msg('Board confidence at season end', `${d >= 0 ? 'Up' : 'Down'} ${Math.abs(d)} to ${Math.round(w.confidence)}: ${pos}${ord(pos)} against a target of ${exp}${ord(exp)}.`, 'club') };
setupWorld = function (...a) { let keep = g.world && g.world.confidence; let r = baseCfSetup(...a); if (keep != null) { g.world.confidence = keep; g.world.confLog = [] } return r };

/* ---------- display ---------- */
function confidenceCard() {
  let w = conf(), c = Math.round(w.confidence), fs = confidenceFactors(), log = w.confLog.slice(-26), pts = log.map((v, i) => `${(i / Math.max(1, log.length - 1) * 100).toFixed(1)},${(100 - v).toFixed(1)}`).join(' ');
  return `<div class="card confcard"><div class="cardhead"><h2>Board confidence</h2><span class="eyebrow ${c < 35 ? 'negative' : ''}">${confidenceWord(c).toUpperCase()}</span></div><div class="pad confbody"><div class="confgauge"><b class="${c < 35 ? 'bad' : c < 50 ? 'mid' : 'good'}">${c}</b><div class="moodbar"><i class="${c < 35 ? 'bad' : c < 50 ? 'mid' : 'good'}" style="width:${c}%"></i></div>${log.length > 2 ? `<svg class="spark" viewBox="0 0 100 100" preserveAspectRatio="none"><polyline points="${pts}" fill="none" stroke="currentColor" stroke-width="3"/></svg>` : ''}</div><div class="conffactors">${fs.map(x => `<div class="cf ${x.v > 0 ? 'up' : x.v < 0 ? 'down' : ''}"><span>${x.v > 0 ? '▲' : x.v < 0 ? '▼' : '•'}</span>${esc(x.label)}</div>`).join('')}</div><p class="fineprint">Target this season: finish ${expectedPos()}${ord(expectedPos())} or better. Below 35 the board warns you; below 15 for three weeks they call a vote. With 75% or more of the club you survive a vote, at a price.</p></div></div>`;
}
const baseCfOwnership = ownershipPage;
ownershipPage = function () { return confidenceCard() + baseCfOwnership() }; PAGE_BUILDERS.Ownership = ownershipPage;
const baseCfRender = render;
render = function () { baseCfRender(); if (!g || !g.world || page !== 'Overview') return; let root = $('content'); if (!root || !root.querySelector) return; let st = root.querySelector('.stats'); if (st && !root.querySelector('.confcard')) { let d = document.createElement('div'); d.innerHTML = confidenceCard(); d.firstChild.classList.add('compact'); st.insertAdjacentElement('afterend', d.firstChild) } };
