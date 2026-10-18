/* Press conferences. After big moments a journalist asks you a question and you choose an answer. Each answer moves something:
   supporter trust, board confidence, the manager's trust in you, or dressing-room morale. There is always a safe answer, and a
   brave one, and a cheap one. About eight a season. "No comment" is always available and never free. */

const basePcResultClose = resultClose, basePcCloseBoard = closeBoardroom, basePcComplete = completeWorldSeason;
let pcQueue = [], pcOpen = null;
const JOURNOS = ['Sam Kerrigan, Evening Post', 'Priya Sethi, The Athletic Review', 'Tom Whitlow, local radio', 'Dani Moore, Sky Sports News', 'Harry Bell, fanzine'];
const PRESS = {
  bigwin: { q: 'That was some result. Is this the day the season turned?', a: [{ t: 'One result. The work carries on tomorrow.', fx: { board: 2, mgr: 2 }, note: 'Measured. The board like calm.' }, { t: 'This club is going places and today proved it.', fx: { fans: 3, board: -1, morale: 2 }, note: 'The fans loved it; the board heard a promise.' }, { t: 'Credit to the manager. That was his win.', fx: { mgr: 5, fans: 1 }, note: 'The manager will remember that.' }] },
  bigloss: { q: 'A heavy defeat. Does the manager keep your backing?', a: [{ t: 'He has my full backing.', fx: { mgr: 5, board: -1, fans: -1 }, note: 'Loyal. Supporters wanted more fire.' }, { t: 'Everyone at this club is accountable, including him.', fx: { fans: 2, mgr: -6, morale: -2 }, note: 'The headline writes itself. The dressing room heard it too.' }, { t: 'I will not discuss the manager after one game.', fx: { board: 1, fans: -2 }, note: 'Safe, but supporters felt stonewalled.' }] },
  derbywin: { q: 'Bragging rights are yours. A message for the rivals?', a: [{ t: 'We respect them. Today was ours.', fx: { fans: 2, board: 1 }, note: 'Classy. Everyone nodded.' }, { t: 'This city is ours.', fx: { fans: 5, board: -2 }, note: 'The fans sang it all night; the board winced.' }, { t: 'Three points, same as any other game.', fx: { fans: -2, mgr: 1 }, note: 'Supporters felt you missed the moment.' }] },
  derbyloss: { q: 'Beaten by your rivals. What do you say to supporters?', a: [{ t: 'I am as hurt as they are. We will put it right.', fx: { fans: 2, morale: 1 }, note: 'Honest. It landed.' }, { t: 'The players let the badge down today.', fx: { fans: 3, morale: -5, mgr: -2 }, note: 'The fans agreed. The players did not.' }, { t: 'It is one game of forty-six.', fx: { fans: -3, board: 1 }, note: 'True, and nobody wanted to hear it.' }] },
  signing: { q: 'A big fee. Is the club overreaching?', a: [{ t: 'It is within our plan and within the rules.', fx: { board: 3 }, note: 'The board heard discipline.' }, { t: 'You have to speculate to accumulate.', fx: { fans: 2, board: -3 }, note: 'Supporters cheered; the finance director did not.' }, { t: 'Ask me in May.', fx: { fans: -1, mgr: 1 }, note: 'Non-committal. The manager liked the cover.' }] },
  sale: { q: 'Fans are angry about the sale. Did you cash in?', a: [{ t: 'The money will be reinvested in the squad.', fx: { fans: 2, mgr: 2, promise: 'reinvest' }, note: 'You have made a promise. The fans will check.' }, { t: 'No player is bigger than the club.', fx: { fans: -1, board: 2 }, note: 'The board approved.' }, { t: 'It was the right deal at the right time.', fx: { fans: -2, board: 1 }, note: 'Cold, and it sounded cold.' }] },
  slump: { q: 'Four without a win. Is there a crisis?', a: [{ t: 'No crisis. Hard work and we come through it.', fx: { board: 1, morale: 1 }, note: 'Steady hands.' }, { t: 'I have spoken to the players. They know what is needed.', fx: { morale: -2, fans: 2, mgr: -2 }, note: 'The manager did not enjoy being bypassed.' }, { t: 'I will make changes if I have to.', fx: { fans: 3, mgr: -5, board: -1 }, note: 'Everyone heard a threat.' }] },
  preseason: { q: 'What is the target this season?', a: [{ t: 'To be better than last season.', fx: { board: 2 }, note: 'Sensible. Expectations stayed where they were.' }, { t: 'Promotion. Nothing less.', fx: { fans: 4, board: -2, pressure: 1 }, note: 'The fans are buzzing. The target just went up.' }, { t: 'I do not set targets in public.', fx: { fans: -2, board: 1 }, note: 'The journalists groaned.' }] },
  budget: { q: 'Supporters say you are not spending. Are you?', a: [{ t: 'We spend what the club earns. That is how you survive.', fx: { board: 3, fans: -1 }, note: 'The bank manager smiled.' }, { t: 'There will be money for the manager this window.', fx: { fans: 3, mgr: 3, promise: 'spend' }, note: 'You have made a promise.' }, { t: 'Spending is not the same as improving.', fx: { board: 1, fans: -2 }, note: 'Clever. Nobody was convinced.' }] },
  nocomment: { t: 'No comment.', fx: { fans: -2 }, note: 'The room went quiet. Supporters noticed.' }
};
function pcPush(kind, extra = {}) { if (!PRESS[kind] || pcQueue.some(x => x.kind === kind)) return; if ((g.world.pcCount || 0) >= 14) return; pcQueue.push({ kind, ...extra }) }
function pcShow() {
  if (pcOpen || !pcQueue.length || g.world.live || resultOpen || ($('modal').innerHTML && $('modal').innerHTML.length > 0)) return; let it = pcQueue.shift(); pcOpen = it; let P = PRESS[it.kind], who = JOURNOS[Math.abs(hash(g.world.date + it.kind)) % JOURNOS.length]; g.world.pcCount = (g.world.pcCount || 0) + 1;
  $('modal').innerHTML = `<div class="overlay"><div class="modal pressconf"><div class="pcroom"><div class="pcback">${Array.from({ length: 10 }, () => `<span>${badge(club(), 'xs')}</span>`).join('')}</div><div class="pcdesk">${typeof ownerFigure === 'function' ? ownerFigure('pcc') : personFront(personLook('The Chairman'), 'pcc')}<div class="pcmics"><i></i><i></i><i></i></div></div></div><div class="eyebrow">PRESS CONFERENCE · ${dateText(g.world.date, false).toUpperCase()}</div><p class="pcwho">${esc(who)}</p><h1>“${esc(P.q)}”</h1><div class="pcanswers">${P.a.map((a, i) => `<button onclick="pcAnswer(${i})">${esc(a.t)}</button>`).join('')}<button class="ghost" onclick="pcAnswer(-1)">${esc(PRESS.nocomment.t)}</button></div></div></div>`;
}
function pcAnswer(i) {
  let it = pcOpen; if (!it) return; let P = PRESS[it.kind], a = i < 0 ? PRESS.nocomment : P.a[i], fx = a.fx || {}, lines = [];
  if (fx.fans) { g.trust = clamp(g.trust + fx.fans, 5, 100); lines.push(`Supporters ${fx.fans > 0 ? '+' : ''}${fx.fans}`) } if (fx.board && typeof conf === 'function') { conf().confidence = clamp(conf().confidence + fx.board, 0, 100); lines.push(`Board ${fx.board > 0 ? '+' : ''}${fx.board}`) }
  if (fx.mgr) { g.world.managerTrust = clamp(g.world.managerTrust + fx.mgr, 5, 100); lines.push(`Manager ${fx.mgr > 0 ? '+' : ''}${fx.mgr}`) } if (fx.morale) { g.morale = clamp(g.morale + fx.morale, 10, 100); lines.push(`Dressing room ${fx.morale > 0 ? '+' : ''}${fx.morale}`) }
  if (fx.pressure && typeof expectedPos === 'function') { g.world.boardTarget = 'Challenge for promotion'; lines.push('Target raised') } if (fx.promise) { (g.world.pressPromises = g.world.pressPromises || []).push({ kind: fx.promise, season: g.season, spentAt: fin().season.purchases || 0 }) }
  if (typeof fb === 'function') fb().buzz = clamp(fb().buzz + (fx.fans || 0) * .02, -1, 1);
  (g.world.pressLog = g.world.pressLog || []).push({ date: g.world.date, q: P.q, a: a.t }); g.world.pressLog = g.world.pressLog.slice(-30); addNews('Chairman: “' + a.t + '”', `Asked: ${P.q}`, 'club');
  $('modal').innerHTML = `<div class="overlay"><div class="modal pressconf"><div class="eyebrow">PRESS CONFERENCE</div><h1>“${esc(a.t)}”</h1><p>${esc(a.note)}</p><div class="effects">${lines.map(l => `<span>${esc(l)}</span>`).join('') || '<span>No effect</span>'}</div><div class="actions"><button class="primary" onclick="pcOpen=null;closeModal();render();pcShow()">Leave the room →</button></div></div></div>`; save();
}
/* ---------- when the press want you ---------- */
function pcAfterMatch(m) {
  if (!m || m.pcChecked) return; m.pcChecked = true; let mine = m.homeId === g.clubId, own = mine ? m.home : m.away, opp = mine ? m.away : m.home, oppId = mine ? m.awayId : m.homeId, derby = typeof rivalryLevel === 'function' && rivalryLevel(g.clubId, oppId) >= 2, form = (myrow().form || []).slice(-4);
  if (derby && own > opp) pcPush('derbywin'); else if (derby && opp > own) pcPush('derbyloss'); else if (own - opp >= 3) pcPush('bigwin'); else if (opp - own >= 3) pcPush('bigloss');
  else if (form.length === 4 && !form.includes('W')) pcPush('slump');
}
resultClose = function (s) { let m = g.world && g.world.lastMatch; basePcResultClose(s); if (m && !g.ended) { pcAfterMatch(m); pcShow() } };
closeBoardroom = function (...a) { basePcCloseBoard(...a); pcShow() };
const basePcFinishDeal = finishDeal;
finishDeal = function (d, p) { let before = d.status, r = basePcFinishDeal(d, p); if (before !== 'signed' && d.status === 'signed' && (d.fee || 0) >= cfg[tier()].fee * 1.2) pcPush('signing'); return r };
const basePcAccept = acceptBid;
acceptBid = function (id) { let b = findBid(id), p = b && g.squad.find(x => x.id === b.pid), key = p && rankOf(p) <= 4; let r = basePcAccept(id); if (r && !r.error && key && b.type !== 'loan') pcPush('sale'); return r };
const basePcSetup = setupWorld;
setupWorld = function (...a) { let r = basePcSetup(...a); pcQueue = []; if (g.season > 1) pcPush('preseason'); return r };
completeWorldSeason = function () {
  basePcComplete(); let P = g.world.pressPromises || []; for (let pr of P) if (pr.season === g.season && !pr.checked) { pr.checked = true; let spent = (fin().season.purchases || 0) - (pr.spentAt || 0); if (spent < cfg[tier()].fee * .5) { g.trust = clamp(g.trust - 4, 5, 100); msg('A promise to the press, unkept', `You told the press the club would ${pr.kind === 'reinvest' ? 'reinvest the money' : 'spend this window'}. It did not, and supporters remember.`, 'club') } }
};
