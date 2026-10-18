/* Before kick-off you now see both line-ups and give the players a few words; during the match the manager makes his own
   changes instead of waiting to be told, using the same three-substitution budget the chairman can still dip into. */

const TALKS = {
  fire: { label: 'Fire them up', sub: 'Demand a big performance from the first whistle' },
  calm: { label: 'Keep it calm', sub: 'Steady heads, no need to rush it' },
  plan: { label: 'Stick to the plan', sub: 'Trust the shape the manager has set' },
  trust: { label: 'Leave it to the manager', sub: 'Say nothing — this is his afternoon' },
};
function sheetXI(f, side) { let l = { fixture: f.id }, res = lineupFor(l); return { xi: res[side], shape: res.shapes ? res.shapes[side] : null } }
function sheetRow(p, k, side) { let pos = typeof posOfSlot === 'function' ? posOfSlot(side, k) : ''; return `<div class="sheetrow"><span class="sheetnum">${esc(p.num || '')}</span><span class="sheetname">${esc(p.name)}${p.cap ? ' <b class="capbadge">C</b>' : ''}</span><span class="sheetpos">${esc(pos)}</span></div>` }
function preMatchSheet(id) {
  let f = g.world.fixtures.find(x => x.id === id); if (!f) return; stopClock();
  let mine = f.home === g.clubId ? 'h' : 'a', home = sheetXI(f, 'h'), away = sheetXI(f, 'a');
  $('modal').innerHTML = `<div class="overlay"><div class="modal teamsheet"><div class="eyebrow">TEAM NEWS · ${dateText(f.date, false).toUpperCase()}</div><h1>${esc(team(f.home).name)} v ${esc(team(f.away).name)}</h1>
  <div class="sheetcols"><div class="sheetteam"><div class="sheethead">${teamBadge(f.home)}<b>${esc(team(f.home).short)}</b><small>${esc(home.shape || '')}</small></div>${home.xi.map((p, k) => sheetRow(p, k, 'h')).join('')}</div>
  <div class="sheetteam"><div class="sheethead">${teamBadge(f.away)}<b>${esc(team(f.away).short)}</b><small>${esc(away.shape || '')}</small></div>${away.xi.map((p, k) => sheetRow(p, k, 'a')).join('')}</div></div>
  <div class="talkbox"><h2>A word before kick-off</h2><div class="talkopts">${Object.entries(TALKS).map(([k, t]) => `<button onclick="matchTalkPick('${id}','${k}')"><b>${esc(t.label)}</b><small>${esc(t.sub)}</small></button>`).join('')}</div></div>
  <div class="actions"><button class="ghost" onclick="cancelPreMatch()">Back to club</button></div></div></div>`;
}
function matchTalkPick(id, tone) {
  let rng = rnd, effects = { fire: rng() < .68 ? { boost: .2, note: 'The dressing room erupts — they look up for this.' } : { boost: -.1, note: 'It backfires a little: a few players look overhyped early on.' }, calm: { boost: .07, note: 'A measured word. Calm heads all round.' }, plan: { boost: .11, note: 'No theatrics — just the shape, repeated until it sticks.' }, trust: { boost: 0, note: 'The chairman says nothing. The manager takes it from here.' } };
  let e = effects[tone] || effects.trust; if (tone === 'trust') g.world.managerTrust = clamp((g.world.managerTrust || 70) + 2, 5, 100);
  pendingTalk = { tone, boost: e.boost, note: e.note }; beginMatch(id, true);
}
function cancelPreMatch() { sheetShownFor = null; closeModal() }
let pendingTalk = null, sheetShownFor = null;
const baseMd2Begin = beginMatch;
beginMatch = function (id, attend) {
  if (attend && sheetShownFor !== id) { sheetShownFor = id; return preMatchSheet(id) }
  sheetShownFor = null; let talk = pendingTalk; pendingTalk = null; baseMd2Begin(id, attend); let l = g.world.live; if (l && talk) { l.teamTalk = talk; l.commentary.unshift({ minute: 0, text: talk.note }) }
};
const baseMd2Rates = liveRates;
liveRates = function (l) {
  let r = baseMd2Rates(l); if (!l.teamTalk || l.minute > 22 || !l.teamTalk.boost) return r;
  let mine = l.teamTalk.ownSide || (l.teamTalk.ownSide = (g.world.fixtures.find(x => x.id === l.fixture) || {}).home === g.clubId ? 'h' : 'a');
  let fade = 1 - l.minute / 22; if (mine === 'h') r.hr *= (1 + l.teamTalk.boost * fade); else r.ar *= (1 + l.teamTalk.boost * fade);
  return r;
};

/* ---------- the manager makes his own changes ---------- */
function mgrSubsFor(l, side) { l.mgrSubs = l.mgrSubs || { h: 0, a: 0 }; return l.mgrSubs[side] }
function mgrSubsLeft(l, side) { return 3 - mgrSubsFor(l, side) }
function benchForSide(l, side) {
  let f = g.world.fixtures.find(x => x.id === l.fixture); if (!f) return []; let id = side === 'h' ? f.home : f.away;
  let full = id === g.clubId ? [...g.squad].filter(p => !p.inj) : (typeof squadOf === 'function' ? squadOf(id) : []);
  let xi = l.lineup[side] || [], onIds = new Set(xi.map(p => p.id)), out = new Set((l.subsOff || []).map(p => p.id));
  return full.filter(p => !onIds.has(p.id) && !out.has(p.id)).sort((a, b) => b.rating - a.rating);
}
function doAnySub(l, side, offIdx, onPlayer, auto) {
  let f = g.world.fixtures.find(x => x.id === l.fixture), xi = l.lineup[side]; if (offIdx == null || offIdx < 0 || !xi[offIdx] || !onPlayer) return false;
  let off = xi[offIdx], num = Number(onPlayer.number) || 12; while (xi.some(x => x.num === num)) num++;
  xi[offIdx] = { id: onPlayer.id, name: onPlayer.name, sur: surname(onPlayer.name), num, subbedOn: true };
  l.mgrSubs = l.mgrSubs || { h: 0, a: 0 }; l.mgrSubs[side] = (l.mgrSubs[side] || 0) + 1;
  (l.subsOff = l.subsOff || []).push({ id: off.id, name: off.name, sur: off.sur, num: off.num, side });
  l.commentary.unshift({ minute: l.minute, text: `Substitution for ${esc(team(side === 'h' ? f.home : f.away).short)}: ${esc(onPlayer.name)} replaces ${esc(off.name)}.` });
  if (typeof pitch !== 'undefined' && pitch && pitch.fixture) pitch.fixture = null; return true;
}
function managerSubCheck(l) {
  if (!l || l.minute < 55) return; l.lastMgrSub = l.lastMgrSub || { h: -99, a: -99 };
  for (let side of ['h', 'a']) {
    if (mgrSubsLeft(l, side) <= 0 || l.minute - l.lastMgrSub[side] < 7) continue;
    let own = side === 'h' ? l.home : l.away, opp = side === 'h' ? l.away : l.home, diff = own - opp;
    let base = l.minute >= 85 ? .05 : l.minute >= 75 ? .055 : l.minute >= 65 ? .04 : .018;
    let chance = base * (diff < 0 ? 1.7 : diff > 0 && l.minute < 78 ? .45 : 1);
    if (rnd() > chance) continue;
    let bench = benchForSide(l, side); if (!bench.length) continue;
    let xi = l.lineup[side], kind = diff < 0 ? 'attack' : (diff > 0 && l.minute >= 75) ? 'defend' : 'fresh', onPlayer, offIdx;
    let slots = xi.map((p, k) => ({ p, k, pos: posOfSlot(side, k) })).filter(x => x.pos !== 'GK');
    if (kind === 'attack') { onPlayer = bench.find(p => normPos(p.position) !== 'GK') || bench[0]; let fwdMid = slots.filter(x => x.pos === 'MID' || x.pos === 'FWD'); offIdx = (fwdMid.at(-1) || slots.at(-1)).k }
    else if (kind === 'defend') { onPlayer = bench.find(p => normPos(p.position) === 'DEF' || normPos(p.position) === 'MID') || bench[0]; let fwd = slots.filter(x => x.pos === 'FWD'); offIdx = (fwd[0] || slots.at(-1)).k }
    else { onPlayer = bench[0]; offIdx = slots[Math.floor(rnd() * slots.length)].k }
    l.lastMgrSub[side] = l.minute; doAnySub(l, side, offIdx, onPlayer, true);
  }
}
const baseMd2Tick = tickMatch;
tickMatch = function (delegate = false) { baseMd2Tick(delegate); let l = g.world.live; if (l) managerSubCheck(l) };

/* ---------- the chairman's own substitution shares the same budget ---------- */
subsLeft = function (l) { let f = g.world.fixtures.find(x => x.id === l.fixture), mine = f && f.home === g.clubId ? 'h' : 'a'; return mgrSubsLeft(l, mine) };
const baseMd2MakeSub = makeSub;
makeSub = function () { let l = g.world.live, f = g.world.fixtures.find(x => x.id === l.fixture), mine = f.home === g.clubId ? 'h' : 'a'; baseMd2MakeSub(); l.mgrSubs = l.mgrSubs || { h: 0, a: 0 }; l.mgrSubs[mine] = (l.mgrSubs[mine] || 0) + 1 };

