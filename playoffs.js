/* Play-offs. The Championship and League One send 3rd to 6th, League Two 4th to 7th, into two-leg semi-finals and a final at Wembley.
   Only the top two (three in League Two) go up directly; the last place goes to the play-off winner. If you are in them, you play them
   through the normal match engine after the league season ends; otherwise they are settled for you and reported. */

const basePoComplete = completeWorldSeason, basePoEvents = eventsToday, basePoResolve = resolveCupGame, basePoDecision = matchDecision, basePoLeagues = leagues;
const PO_SLOTS = { 1: [3, 6], 2: [3, 6], 3: [4, 7] }, PO_DIRECT = { 1: 2, 2: 2, 3: 3 };
function poContenders(d) { let s = standings(d), [a, b] = PO_SLOTS[d]; return s.slice(a - 1, b).map(r => r.id) }
function poPairs(ids) { return [[ids[0], ids[3]], [ids[1], ids[2]]] }   // 3rd v 6th, 4th v 5th; higher side at home in the second leg
function simulatePlayoffs(d) {
  let ids = poContenders(d), pairs = poPairs(ids), winners = [], legs = [];
  for (let [hi, lo] of pairs) { let l1 = rawScore(lo, hi), l2 = rawScore(hi, lo), agg = [l1[1] + l2[0], l1[0] + l2[1]], w = agg[0] > agg[1] ? hi : agg[0] < agg[1] ? lo : (rnd() > .5 ? hi : lo); winners.push(w); legs.push({ hi, lo, l1, l2, agg, w }) }
  let fs = rawScore(winners[0], winners[1]), champ = fs[0] > fs[1] ? winners[0] : fs[0] < fs[1] ? winners[1] : (rnd() > .5 ? winners[0] : winners[1]);
  return { div: d, legs, final: { home: winners[0], away: winners[1], score: fs, penalties: fs[0] === fs[1] }, winner: champ };
}
function poInit() {
  let w = g.world, d = tier(), ids = poContenders(d), pairs = poPairs(ids), start = w.date > iso(seasonYear() + 1, 5, 31) ? w.date : iso(seasonYear() + 1, 5, 31), d1 = dayAdd(start, 2), d2 = dayAdd(start, 5), d3 = dayAdd(start, 12);
  let cup = { key: 'PO', name: DB[d].name + ' play-offs', rounds: ['Semi-final, first leg', 'Semi-final, second leg', 'Final'], dates: [], round: 0, draw: pairs, winners: [], results: [], aggregates: {}, pairs, pending: true };
  w.cups.PO = cup; w.po = { div: d, pending: true, mine: true, pairs };
  for (let [hi, lo] of pairs) { let mine = hi === g.clubId || lo === g.clubId, f1 = { id: 'PO-1-' + hi + '-' + lo, date: d1, comp: 'PO', round: cup.rounds[0], home: lo, away: hi, played: false }, f2 = { id: 'PO-2-' + hi + '-' + lo, date: d2, comp: 'PO', round: cup.rounds[1], home: hi, away: lo, played: false }; if (mine) w.fixtures.push(f1, f2); else { cup.other = { f1, f2 } } }
  w.poFinalDate = d3; w.fixtures.sort((a, b) => a.date.localeCompare(b.date)); save();
  msg('Play-offs!', `${club().short} finished ${position()}${ord(position())} and are in the ${DB[d].name} play-offs. Semi-final first leg ${dateText(d1, false)}, second leg ${dateText(d2, false)}, final at Wembley ${dateText(d3, false)}.`, 'football');
  addNews(`${DB[d].name} play-off line-up confirmed`, pairs.map(([hi, lo]) => `${team(hi).short} v ${team(lo).short}`).join(' · '), 'league');
}
completeWorldSeason = function () {
  let w = g.world, d = tier();
  if (d > 0 && !w.po) { let ids = poContenders(d); if (ids.includes(g.clubId)) { poInit(); stopClock(); render(); return } else w.po = { div: d, pending: false, mine: false } }
  if (w.po && w.po.pending) return;   // still playing them
  let r = basePoComplete(); poAfterFinish(); return r;
};
eventsToday = function () { let w = g.world; if (w.po && w.po.pending && !w.fixtures.some(f => !f.played && f.date <= w.date)) return false; return basePoEvents() };
resolveCupGame = function (cup, f, score = null, quiet = false) {
  if (!cup || cup.key !== 'PO') return basePoResolve(cup, f, score, quiet);
  let w = g.world, [a, b] = score || rawScore(f.home, f.away); f.played = true; f.score = [a, b]; f.penalties = false; cup.results.push({ ...f });
  if (/first leg/.test(f.round)) { cup.aggregates[f.home] = a; cup.aggregates[f.away] = b; cup.round = 1; if (cup.other && !cup.other.f1.played) { let o = cup.other.f1, s = rawScore(o.home, o.away); o.played = true; o.score = s; cup.results.push({ ...o }); cup.aggregates[o.home] = s[0]; cup.aggregates[o.away] = s[1] } return }
  if (/second leg/.test(f.round)) {
    let aggH = (cup.aggregates[f.home] || 0) + a, aggA = (cup.aggregates[f.away] || 0) + b, winner = aggH > aggA ? f.home : aggH < aggA ? f.away : (rnd() > .5 ? f.home : f.away); f.penalties = aggH === aggA; f.winner = winner; f.aggregate = [aggH, aggA]; cup.winners.push(winner);
    let o = cup.other && cup.other.f2; if (o && !o.played) { let s = rawScore(o.home, o.away); o.played = true; o.score = s; let oh = (cup.aggregates[o.home] || 0) + s[0], oa = (cup.aggregates[o.away] || 0) + s[1], ow = oh > oa ? o.home : oh < oa ? o.away : (rnd() > .5 ? o.home : o.away); o.winner = ow; o.aggregate = [oh, oa]; cup.results.push({ ...o }); cup.winners.push(ow) }
    cup.round = 2; let [w1, w2] = cup.winners;
    if (winner === g.clubId) { let final = { id: 'PO-3-' + w1 + '-' + w2, date: w.poFinalDate, comp: 'PO', round: 'Final', home: w1, away: w2, played: false }; w.fixtures.push(final); w.fixtures.sort((x, y) => x.date.localeCompare(y.date)); msg('Through to Wembley!', `${club().short} win the semi-final ${aggH}–${aggA} on aggregate${f.penalties ? ' (on penalties)' : ''}. The final against ${team(winner === w1 ? w2 : w1).name} is on ${dateText(w.poFinalDate, false)}.`, 'football'); if (typeof pressQueue === 'function') pressQueue({ head: 'WEMBLEY BOUND', sub: `${club().short} reach the ${DB[tier()].name} play-off final.`, body: `A ${aggH}–${aggA} aggregate win sends the club to Wembley with promotion ninety minutes away.`, tone: 'good', kind: 'league', scene: 'match', score: `${aggH}–${aggA}` }) }
    else { let s = rawScore(w1, w2), champ = s[0] > s[1] ? w1 : s[0] < s[1] ? w2 : (rnd() > .5 ? w1 : w2); cup.winner = champ; w.po.winner = champ; w.po.pending = false; cup.pending = false; msg('Play-off heartbreak', `${club().short} lose the semi-final ${aggH}–${aggA} on aggregate${f.penalties ? ' on penalties' : ''}. ${team(champ).name} went on to win the final ${s[0]}–${s[1]} and are promoted.`, 'football'); addNews(`${team(champ).name} win the play-off final`, `${team(w1).short} ${s[0]}–${s[1]} ${team(w2).short} at Wembley.`, 'league') }
    return;
  }
  // the final
  let winner = a > b ? f.home : a < b ? f.away : (rnd() > .5 ? f.home : f.away); f.penalties = a === b; f.winner = winner; cup.winner = winner; w.po.winner = winner; w.po.pending = false; cup.pending = false;
  if (winner === g.clubId) { w.poWon = true; msg('PROMOTED!', `${club().name} win the play-off final ${a}–${b}${f.penalties ? ' on penalties' : ''} at Wembley and are promoted to the ${DB[tier() - 1].name}!`, 'football'); if (typeof pressQueue === 'function') pressQueue({ head: 'PROMOTED!', sub: `${club().short} win the play-off final ${a}–${b} at Wembley.`, body: `The richest game in football, and ${club().short} won it. ${DB[tier() - 1].name} football next season.`, tone: 'good', kind: 'league', scene: 'match', score: `${a}–${b}` }); if (typeof celebrate === 'function') w.celebrate = { kind: 'promotion', title: 'PROMOTED', sub: `Play-off winners · ${DB[tier() - 1].name} next season` } }
  else { msg('Play-off final defeat', `${team(f.home).name} ${a}–${b} ${team(f.away).name}${f.penalties ? ' (penalties)' : ''}. So close. Another season in the ${DB[tier()].name}.`, 'football'); if (typeof pressQueue === 'function') pressQueue({ head: 'WEMBLEY HEARTBREAK', sub: `${club().short} lose the play-off final ${f.home === g.clubId ? a + '–' + b : b + '–' + a}.`, body: 'Ninety minutes from promotion, and it was not to be. The chairman faces a summer of rebuilding.', tone: 'bad', kind: 'league', scene: 'match', score: `${a}–${b}` }) }
  addNews(`${team(winner).name} win the ${DB[tier()].name} play-off final`, `${team(f.home).short} ${a}–${b} ${team(f.away).short} at Wembley.`, 'league');
};
function poAfterFinish() {
  let w = g.world; if (!w || w.poFixed === g.season) return; w.poFixed = g.season; let results = w.poResults = [];
  for (let d = 1; d < 4; d++) {
    let s = standings(d), direct = s.slice(0, PO_DIRECT[d]).map(r => r.id), winner;
    if (w.po && w.po.div === d && w.po.winner) winner = w.po.winner; else { let r = simulatePlayoffs(d); winner = r.winner; results.push(r); addNews(`${team(winner).name} win the ${DB[d].name} play-off final`, `${team(r.final.home).short} ${r.final.score[0]}–${r.final.score[1]} ${team(r.final.away).short} at Wembley${r.final.penalties ? ', on penalties' : ''}.`, 'league') }
    g.pendingMoves = g.pendingMoves.filter(m => !(m.from === d && m.to === d - 1)); for (let id of [...direct, winner]) g.pendingMoves.push({ id, from: d, to: d - 1 });
  }
  let mine = g.pendingMoves.find(m => m.id === g.clubId), h = g.history[0]; if (h && h.season === g.season) { if (mine && mine.to < mine.from) h.text = w.poWon ? 'Promoted via the play-offs' : position() === 1 ? 'League champions' : 'Promotion secured'; else if (!mine && /Promotion/.test(h.text)) h.text = 'Season complete' }
};
matchDecision = function (f) { basePoDecision(f); if (f.played || f.comp !== 'PO') return; let h = $('modal').innerHTML; if (typeof h !== 'string') return; $('modal').innerHTML = h.replace('<div class="eyebrow">MATCHDAY', `<div class="derbytag l3">🏆 ${esc(f.round.toUpperCase())}${f.round === 'Final' ? ' · WEMBLEY' : ''}</div><div class="eyebrow">MATCHDAY`) };
leagues = function () { return basePoLeagues().replace('Promotion places are direct in this edition; play-offs are not simulated.', 'The Championship and League One send 3rd–6th into the play-offs, League Two 4th–7th; the winner takes the last promotion place.').replace('Top three promoted.', 'Top two promoted, plus the play-off winner.').replace('Top four promoted.', 'Top three promoted, plus the play-off winner.') };
