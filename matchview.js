/* Match view: live stats and a bird's-eye pitch with moving dots.
   The match engine only models goals, so shots, possession, corners, fouls and the dots are generated from the same scoring
   rates. They use their own seeded random numbers, so watching a match never changes its result. */

const baseViewTick = tickMatch, baseViewRender = render;
const VW = 105, VH = 68;
const FORM = {
  h: [[.04, .5, 'g'], [.2, .12, 'd'], [.2, .37, 'd'], [.2, .63, 'd'], [.2, .88, 'd'], [.4, .12, 'm'], [.4, .38, 'm'], [.4, .62, 'm'], [.4, .88, 'm'], [.57, .38, 'f'], [.57, .62, 'f']],
  a: [[.04, .5, 'g'], [.2, .12, 'd'], [.2, .37, 'd'], [.2, .63, 'd'], [.2, .88, 'd'], [.38, .25, 'm'], [.38, .5, 'm'], [.38, .75, 'm'], [.55, .15, 'f'], [.55, .5, 'f'], [.55, .85, 'f']]
};
const ROLE_W = { g: .06, d: .72, m: .92, f: 1 };
const NUMBERS = { h: [1, 2, 5, 4, 3, 7, 6, 8, 11, 9, 10], a: [1, 2, 5, 4, 3, 8, 6, 10, 11, 9, 7] };
/* ---------- real players in the line-ups ---------- */
const POS = { g: ['GK', 'G'], d: ['DEF', 'D', 'CB'], m: ['MID', 'M', 'CM'], f: ['FWD', 'F', 'ST'] };
function surname(n) { let p = String(n || '').trim().split(/\s+/); return p.length > 1 && /^(jr|sr|ii|iii)\.?$/i.test(p.at(-1)) ? p.at(-2) : p.at(-1) || '' }
function pickXI(players, shape, shortName) {
  let by = { g: [], d: [], m: [], f: [] }, used = new Set(), out = [];
  for (let p of players) for (let k of ['g', 'd', 'm', 'f']) if (POS[k].includes(p.position)) { by[k].push(p); break }
  let all = [...players];
  for (let [k, n] of [['g', 1], ['d', shape[1]], ['m', shape[2]], ['f', shape[3]]]) {
    let take = by[k].filter(p => !used.has(p.id)).slice(0, n);
    for (let p of all) { if (take.length >= n) break; if (!used.has(p.id) && !take.includes(p) && !(k === 'g') && !POS.g.includes(p.position)) take.push(p) }
    for (let p of take) { used.add(p.id); out.push(p) }
  }
  let nums = new Set(), free = 30;
  return out.map((p, i) => { let n = Number(p.number); if (!n || nums.has(n)) { n = i + 1; while (nums.has(n)) n = ++free } nums.add(n); return { id: p.id, name: p.name, sur: surname(p.name), num: n } });
}
function lineupFor(l) {
  let f = g.world.fixtures.find(x => x.id === l.fixture) || { home: g.clubId, away: g.clubId }, res = {};
  for (let [side, id, shape] of [['h', f.home, [1, 4, 4, 2]], ['a', f.away, [1, 4, 3, 3]]]) {
    let players = id === g.clubId ? [...g.squad].filter(p => !p.inj).sort((a, b) => b.rating - a.rating) : (typeof squadOf === 'function' ? squadOf(id) : (club(id)?.players || []));
    let xi = players.length >= 11 ? pickXI(players, shape) : [];
    while (xi.length < 11) { let n = xi.length + 1; xi.push({ id: 'x' + n, name: team(id).short + ' ' + n, sur: team(id).short + ' ' + n, num: n }) }
    res[side] = xi.slice(0, 11);
  }
  return res;
}
function playerAt(l, i) { return l.lineup && l.lineup[i < 11 ? 'h' : 'a'][i < 11 ? i : i - 11] }
let pitch = { fixture: null, el: null, dots: [], ball: null };

function seeded(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296 } }
function newStats() { return { h: { shots: 0, sot: 0, corners: 0, fouls: 0, yellow: 0, red: 0 }, a: { shots: 0, sot: 0, corners: 0, fouls: 0, yellow: 0, red: 0 }, poss: [0, 0], mins: 0 } }
function liveRates(l) {
  let f = g.world.fixtures.find(x => x.id === l.fixture), home = f.home === g.clubId;
  matchCtx++; let own = squadRating() + (g.manager.skill - 60) * .12 + (g.morale - 65) * .06; matchCtx--;
  let oppId = home ? f.away : f.home, opp = g.strengths[oppId] ?? team(oppId).strength, adv = home ? 1.18 : 1;
  let or = clamp(1.3 + (own - opp) * .04, .25, 3.5) * adv, pr = clamp(1.15 - (own - opp) * .035, .2, 3.4);
  if (l.mentality === 'attacking') { or *= 1.3; pr *= 1.22 } if (l.mentality === 'defensive') { or *= .7; pr *= .72 }
  if (l.tempo === 'high') { or *= 1.12; pr *= 1.08 } if (l.minute > 65 && l.stamina < 65) pr *= 1.2;
  return { hr: home ? or : pr, ar: home ? pr : or, ownSide: home ? 'h' : 'a' };
}
function statStep(l) {
  ensureViz(l); let st = l.stats, m = l.minute + 1, rng = seeded(Math.abs(hash(l.fixture)) * 977 + m * 31 + 7), r = liveRates(l);
  let possH = clamp(50 + (r.hr - r.ar) * 13, 30, 72); st.poss[0] += possH; st.poss[1] += 100 - possH; st.mins++; l.viz.possH = possH;
  for (let [k, rate] of [['h', r.hr], ['a', r.ar]]) {
    let s = st[k];
    if (rng() < rate / 90 * 7.2) {
      s.shots++; let on = rng() < .37; if (on) s.sot++;
    }
    if (rng() < rate / 90 * 3.4) s.corners++;
    if (rng() < .115) {
      s.fouls++;
      if (rng() < .11) { let p = cardPlayer(l, k, rng), already = p && l.cards.find(c => c.id === p.id && c.type !== 'red');
        if (p) { if (already) { already.type = 'red'; s.yellow = Math.max(0, s.yellow - 1); s.red++; l.cards.push({ id: p.id, side: k, name: p.name, sur: p.sur, min: m, type: 'red', second: true }) }
          else if (rng() < .045) { s.red++; l.cards.push({ id: p.id, side: k, name: p.name, sur: p.sur, min: m, type: 'red' }) }
          else { s.yellow++; l.cards.push({ id: p.id, side: k, name: p.name, sur: p.sur, min: m, type: 'yellow' }) } }
        else s.yellow++;
      }
    }
  }
}
/* a fallback scorer for the rare tick where both sides score together and only one gets a dramatised sequence */
function goalScorerIdx(l, side) {
  if (!l.lineup) return side === 'h' ? 9 : 20; let xi = l.lineup[side]; if (!xi || xi.length < 11) return side === 'h' ? 9 : 20;
  let base = side === 'h' ? 0 : 11, weights = xi.map((p, k) => { let pos = posOfSlot(side, k); return pos === 'GK' ? .05 : pos === 'DEF' ? .5 : pos === 'MID' ? 1.3 : 2 }), total = weights.reduce((a, b) => a + b, 0), r = rnd() * total;
  for (let k = 0; k < xi.length; k++) { r -= weights[k]; if (r <= 0) return base + k } return base + xi.length - 1;
}
/* picks a real outfield player for a card, favouring defenders and midfielders */
function cardPlayer(l, side, rng) {
  if (!l.lineup) return null; let xi = l.lineup[side]; if (!xi || xi.length < 11) return null;
  let weights = xi.map((p, k) => { let pos = posOfSlot(side, k); return pos === 'GK' ? .15 : pos === 'DEF' ? 1.3 : pos === 'MID' ? 1.15 : .7 }), total = weights.reduce((a, b) => a + b, 0), r = rng() * total;
  for (let k = 0; k < xi.length; k++) { r -= weights[k]; if (r <= 0) return xi[k] } return xi[xi.length - 1];
}
/* ---------- bird's-eye model ---------- */
function ensureViz(l) {
  if (!l.stats) l.stats = newStats();
  if (!l.lineup) l.lineup = lineupFor(l);
  if (!l.goals) l.goals = [];
  if (!l.cards) l.cards = [];
  if (!l.viz) { l.viz = { ball: { x: .5, y: .5 }, owner: 9, side: 'h', d: [], flash: 0, possH: 50, pass: null, path: [], evt: null, cele: null, half: 1, mode: 'play' }; kickoff(l.viz, l, 'h') }
}
function dirOf(side, minute) { return (side === 'h' ? 1 : -1) * (minute > 45 ? -1 : 1) }
function slot(i) { let side = i < 11 ? 'h' : 'a', k = i < 11 ? i : i - 11; return { side, k, u: FORM[side][k][0], y: FORM[side][k][1], role: FORM[side][k][2] } }
function ballU(v, side, minute) { return dirOf(side, minute) > 0 ? v.ball.x : 1 - v.ball.x }
function xOf(side, u, minute) { return dirOf(side, minute) > 0 ? u : 1 - u }
function kickoff(v, l, kick) {
  let min = l.minute || 0; v.d = [];
  for (let i = 0; i < 22; i++) { let s = slot(i), u = Math.min(s.u, .46); if (s.side === kick && s.role === 'f') u = s.k % 2 ? .5 : .47; v.d.push([xOf(s.side, u, min + 1), s.y]) }
  v.side = kick; v.owner = kick === 'h' ? 9 : 19; v.ball = { x: .5, y: .5 }; v.pass = null; v.path = [{ x: .5, y: .5 }]; v.cele = null; v.mode = 'play';
}
function nearestTo(v, idxs, pt) { let best = idxs[0], bd = 9; for (let i of idxs) { let d = Math.hypot(v.d[i][0] - pt.x, v.d[i][1] - pt.y); if (d < bd) { bd = d; best = i } } return best }
function teamIdx(side) { return side === 'h' ? [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10] : [11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21] }
function targetFor(v, i, l, rng) {
  let s = slot(i), min = l.minute, bu = ballU(v, s.side, min), w = ROLE_W[s.role], has = v.side === s.side;
  let du = clamp((bu - .5) * .62, -.12, .34) * w + (has ? .07 : -.04) * w * (s.role === 'g' ? 0 : 1), u = clamp(s.u + du, s.role === 'g' ? .02 : .06, s.role === 'g' ? .1 : .93);
  let spread = has ? 1.12 : .9, y = .5 + (s.y - .5) * spread + (v.ball.y - s.y) * (s.role === 'g' ? .1 : .2 * w);
  if (v.mode === 'corner' && has && (s.role === 'f' || (s.role === 'd' && s.k % 2 === 0))) { u = .88; y = .38 + (s.k % 4) * .08 }
  return { x: xOf(s.side, u, min), y: clamp(y, .04, .96) };
}
function stepDots(v, l, rng, fast) {
  let min = l.minute, press = new Set(), opp = v.side === 'h' ? 'a' : 'h';
  if (!fast) { let idx = teamIdx(opp).filter(i => slot(i).role !== 'g').sort((a, b) => Math.hypot(v.d[a][0] - v.ball.x, v.d[a][1] - v.ball.y) - Math.hypot(v.d[b][0] - v.ball.x, v.d[b][1] - v.ball.y)); idx.slice(0, 2).forEach(i => press.add(i)) }
  for (let i = 0; i < 22; i++) {
    let t = targetFor(v, i, l, rng), d = v.d[i];
    if (i === v.owner) t = { x: v.ball.x - dirOf(slot(i).side, min) * .012, y: v.ball.y };
    else if (press.has(i)) t = { x: d[0] + (v.ball.x - d[0]) * .5, y: d[1] + (v.ball.y - d[1]) * .5 };
    else if (v.cele && slot(i).side === v.cele.side && slot(i).role !== 'g') { let sc = v.d[v.cele.i]; t = { x: sc[0] + (rng() - .5) * .07, y: sc[1] + (rng() - .5) * .09 } }
    let sx = fast === true ? .5 : fast || .06, sy = fast === true ? .5 : (fast ? fast * 1.2 : .07);
    d[0] = clamp(d[0] + clamp(t.x - d[0], -sx, sx) + (rng() - .5) * .004, .01, .99); d[1] = clamp(d[1] + clamp(t.y - d[1], -sy, sy) + (rng() - .5) * .004, .02, .98);
  }
}
function pickReceiver(v, l, rng) {
  let side = v.side, min = l.minute, dir = dirOf(side, min), o = v.d[v.owner], ou = ballU(v, side, min), cands = [];
  for (let i of teamIdx(side)) { if (i === v.owner) continue; let s = slot(i); if (s.role === 'g' && ou > .3) continue; let d = v.d[i], dist = Math.hypot(d[0] - o[0], d[1] - o[1]); if (dist > .34 || dist < .03) continue; let gain = (d[0] - o[0]) * dir; cands.push({ i, w: Math.exp(3 * gain) / Math.pow(dist + .05, 1.1) * (s.role === 'g' ? .3 : 1) }) }
  if (!cands.length) return null;
  let tot = cands.reduce((a, c) => a + c.w, 0), r = rng() * tot; for (let c of cands) { r -= c.w; if (r <= 0) return c.i } return cands[0].i;
}
/* An attack builds from wherever the ball is: a few quick passes up into the box, then the finish. Each hop is a believable pass. */
function attackPath(v, l, side, rng, ends) {
  let min = l.minute, atk = teamIdx(side).filter(i => slot(i).role === 'm' || slot(i).role === 'f'), pts = [], u = ballU(v, side, min), y = v.ball.y, used = new Set(), hops = 0;
  let place = (pt) => { let i = nearestTo(v, atk.filter(a => !used.has(a)), pt); used.add(i); v.d[i] = [pt.x, pt.y]; pts.push({ x: pt.x, y: pt.y, who: i }) };
  while (u < .76 && hops < 3) { u = Math.min(.8, u + .17 + rng() * .1); y = clamp(y + (rng() - .5) * .34, .14, .86); place({ x: xOf(side, u, min), y }); hops++ }
  place({ x: xOf(side, .84 + rng() * .06, min), y: .5 + (rng() - .5) * .36 });
  return { pts, shooter: pts[pts.length - 1].who, path: [...pts.map(p => ({ x: p.x, y: p.y })), ...ends] };
}
function vizStep(l, ev) {
  let v = l.viz, min = l.minute, rng = seeded(Math.abs(hash(l.fixture)) * 131 + min * 17 + 3);
  v.evt = null; v.pass = null; v.path = [];
  if (v.flash > 0) v.flash--;
  if (min >= 46 && v.half === 1) { v.half = 2; kickoff(v, l, 'a'); return }
  if (v.cele && v.flash === 0) { kickoff(v, l, v.cele.side === 'h' ? 'a' : 'h'); return }
  v.mode = 'play';
  let o = v.d[v.owner], side = v.side;
  if (ev.scored) {
    let sc = ev.scored, dir = dirOf(sc, min), goal = { x: dir > 0 ? 1.0 : 0.0, y: .5 + (rng() - .5) * .1 }, atk = attackPath(v, l, sc, rng, [goal]);
    v.pass = { from: atk.path[atk.path.length - 2], to: goal }; v.path = atk.path; v.ball = goal; v.owner = atk.shooter; v.side = sc; v.evt = 'GOAL!'; v.shooter = atk.shooter; v.flash = 3; v.cele = { side: sc, i: atk.shooter };
    stepDots(v, l, rng, true); return;
  }
  let shotSide = ev.shot.h && ev.shot.a ? (rng() < .5 ? 'h' : 'a') : ev.shot.h ? 'h' : ev.shot.a ? 'a' : null;
  if (shotSide) {
    let dir = dirOf(shotSide, min), other = shotSide === 'h' ? 'a' : 'h', gk = other === 'h' ? 0 : 11, tgt = { x: dir > 0 ? .995 : .005, y: .5 + (rng() - .5) * .22 }, keep = { x: v.d[gk][0], y: v.d[gk][1] };
    let atk = attackPath(v, l, shotSide, rng, [tgt, keep]);
    v.pass = { from: atk.path[atk.path.length - 3], to: tgt }; v.path = atk.path; v.ball = keep; v.owner = gk; v.side = other; v.evt = 'SHOT'; v.shooter = atk.shooter; stepDots(v, l, rng, .16); return;
  }
  let cornerSide = ev.corner.h && ev.corner.a ? (rng() < .5 ? 'h' : 'a') : ev.corner.h ? 'h' : ev.corner.a ? 'a' : null;
  if (cornerSide) {
    let dir = dirOf(cornerSide, min), flag = { x: dir > 0 ? .995 : .005, y: rng() < .5 ? .03 : .97 }, atk = attackPath(v, l, cornerSide, rng, [flag]), taker = nearestTo(v, teamIdx(cornerSide).filter(i => slot(i).role === 'm'), flag);
    v.side = cornerSide; v.owner = taker; v.ball = flag; v.path = atk.path; v.pass = { from: atk.path[atk.path.length - 2], to: flag }; v.mode = 'corner'; v.evt = 'CORNER'; v.shooter = taker; v.d[taker] = [flag.x, flag.y]; stepDots(v, l, rng, .16); return;
  }
  if (rng() < .2) v.want = rng() * 100 < v.possH ? 'h' : 'a'; if (!v.want) v.want = 'h';
  let ownerSide = slot(v.owner).side;
  if (ownerSide !== v.want) {
    let opp = v.want, nearest = nearestTo(v, teamIdx(opp).filter(i => slot(i).role !== 'g'), { x: o[0], y: o[1] });
    v.pass = { from: { x: o[0], y: o[1] }, to: { x: v.d[nearest][0], y: v.d[nearest][1] } }; v.owner = nearest; v.side = opp; v.ball = { x: v.d[nearest][0], y: v.d[nearest][1] }; v.path = [v.ball];
  } else {
    let ou = ballU(v, side, min), r = rng();
    if (r < .22 && ou < .75) { let dir = dirOf(side, min), nx = clamp(o[0] + dir * (.03 + rng() * .04), .03, .97); v.d[v.owner] = [nx, clamp(o[1] + (rng() - .5) * .06, .05, .95)]; v.ball = { x: v.d[v.owner][0] + dir * .012, y: v.d[v.owner][1] }; v.path = [v.ball] }
    else {
      let rc = pickReceiver(v, l, rng);
      if (rc == null) { v.ball = { x: o[0], y: o[1] }; v.path = [v.ball] }
      else { let d = v.d[rc], dir = dirOf(side, min), lead = { x: clamp(d[0] + dir * .02, .02, .98), y: d[1] }; v.pass = { from: { x: o[0], y: o[1] }, to: lead }; v.owner = rc; v.ball = lead; v.path = [lead] }
    }
  }
  stepDots(v, l, rng, false);
}

const baseViewBegin = beginMatch;
beginMatch = function (id, attend = true) { baseViewBegin(id, attend); if (g.world.live) ensureViz(g.world.live) };
tickMatch = function (delegate = false) {
  let w = g.world, l = w.live; if (!l) return baseViewTick(delegate);
  ensureViz(l); let before = { h: l.home, a: l.away }, st = l.stats, c0 = { sh: [st.h.shots, st.a.shots], co: [st.h.corners, st.a.corners], on: [st.h.sot, st.a.sot], yc: [st.h.yellow, st.a.yellow], rc: [st.h.red, st.a.red], cardIdx: l.cards.length };
  statStep(l); baseViewTick(delegate);
  // the data must be recorded even on the tick that ends the match (e.g. a 90th-minute winner), which is exactly the
  // tick where w.live stops being l — so goals are recorded against l directly, never gated on the match still being live
  let newCards = l.cards.slice(c0.cardIdx);
  let ev = { scored: l.home > before.h ? 'h' : l.away > before.a ? 'a' : null, shot: { h: st.h.shots > c0.sh[0], a: st.a.shots > c0.sh[1] }, corner: { h: st.h.corners > c0.co[0], a: st.a.corners > c0.co[1] }, sot: { h: st.h.sot > c0.on[0], a: st.a.sot > c0.on[1] }, yellow: { h: st.h.yellow > c0.yc[0], a: st.a.yellow > c0.yc[1] }, red: { h: st.h.red > c0.rc[0], a: st.a.red > c0.rc[1] }, card: newCards.at(-1) || null };
  let stillLive = w.live === l;
  vizStep(l, ev);   // always runs: it decides who had the ball for this goal, which recordGoal needs even on the tick that ends the match
  let hGoals = l.home - before.h, aGoals = l.away - before.a;
  for (let gN = 0; gN < hGoals; gN++) recordGoal(l, { ...ev, scored: 'h' }); for (let gN = 0; gN < aGoals; gN++) recordGoal(l, { ...ev, scored: 'a' });
  if (stillLive && !delegate) { if (typeof liveEvents === 'function') liveEvents(l, ev); if (page === 'Matchday') paintPitch(l) }
};
/* the scorer is the player who actually took the shot on the pitch; most goals also get an assist */
function posOfSlot(side, k) { let mids = side === 'h' ? 4 : 3; return k < 1 ? 'GK' : k < 5 ? 'DEF' : k < 5 + mids ? 'MID' : 'FWD' }
function recordGoal(l, ev) {
  if (!ev.scored) return; let v = l.viz, side = ev.scored, idx = v.cele ? v.cele.i : v.owner;
  // vizStep's dramatised owner belongs to whichever side it actually simulated for this tick; on the rare occasion both
  // sides score in the same tick, the other side's goal needs its own scorer picked directly rather than being left blank
  if (!(idx >= 0) || (idx < 11 ? 'h' : 'a') !== side) idx = goalScorerIdx(l, side);
  let who = playerAt(l, idx); if (!who || !who.name) who = (l.lineup && l.lineup[side] || []).find(p => p && p.name) || null;
  let f = g.world.fixtures.find(x => x.id === l.fixture), id = ev.scored === 'h' ? f.home : f.away;
  if (!who || !who.name) { let fn = typeof firstNames !== 'undefined' ? firstNames : ['Sam'], sn = typeof surnames !== 'undefined' ? surnames : ['Walker']; let nm = fn[Math.abs(hash(l.fixture + l.minute + side)) % fn.length] + ' ' + sn[Math.abs(hash(l.fixture + l.minute + side + 'x')) % sn.length]; who = { id: 'synth-' + Math.abs(hash(nm)), name: nm, sur: nm.split(' ').pop(), num: 9 + Math.abs(hash(nm)) % 15 } }
  let rng = seeded(Math.abs(hash(l.fixture + '|as|' + l.minute)) * 13 + 7), assist = null;
  if (rng() < .72) {
    let pool = [], total = 0; for (let k = 1; k < 11; k++) { let gi = (side === 'h' ? 0 : 11) + k; if (gi === idx) continue; let pos = posOfSlot(side, k), w = pos === 'MID' ? 4 : pos === 'FWD' ? 3 : 1.5; pool.push([k, w]); total += w }
    let r = rng() * total; for (let [k, w] of pool) { r -= w; if (r <= 0) { assist = l.lineup[side][k]; break } }
  }
  l.goals.push({ min: l.minute, side, id: who ? who.id : null, name: who ? who.name : '', sur: who ? who.sur : '', num: who ? who.num : 0, aid: assist ? assist.id : null, aname: assist ? assist.name : '', asur: assist ? assist.sur : '' });
  if (l.commentary[0] && /^GOAL!/.test(l.commentary[0].text)) {
    let tally = who && typeof seasonSoFar === 'function' ? seasonSoFar(who.id, 'g') + l.goals.filter(x => x.id === who.id).length : null;
    let aTally = assist && typeof seasonSoFar === 'function' ? seasonSoFar(assist.id, 'a') + l.goals.filter(x => x.aid === assist.id).length : null;
    l.commentary[0].text = `GOAL! ${team(id).name}${who ? ' — ' + who.name : ''}${tally ? ' (his ' + tally + ordSuffix(tally) + ' of the season)' : ''}${assist ? ' (assist: ' + assist.sur + (aTally ? ', ' + aTally + ordSuffix(aTally) + ' of the season' : '') + ')' : ''}. ${l.home}–${l.away}.`;
  }
}

/* ---------- stats panel ---------- */
function statRows(l, hg, ag) {
  let s = l.stats || newStats(), mins = Math.max(1, s.mins), ph = Math.round(s.poss[0] / mins), pa = 100 - ph;
  let shH = Math.max(s.h.shots, hg), shA = Math.max(s.a.shots, ag), sotH = Math.max(s.h.sot, hg), sotA = Math.max(s.a.sot, ag);
  return [['Possession', ph + '%', pa + '%', ph, pa], ['Shots', shH, shA, shH, shA], ['On target', sotH, sotA, sotH, sotA], ['Expected goals', (l.homeXg || 0).toFixed(2), (l.awayXg || 0).toFixed(2), l.homeXg || 0, l.awayXg || 0],
    ['Corners', s.h.corners, s.a.corners, s.h.corners, s.a.corners], ['Fouls', s.h.fouls, s.a.fouls, s.h.fouls, s.a.fouls], ['Yellow cards', s.h.yellow, s.a.yellow, s.h.yellow, s.a.yellow]];
}
function statsHtml(l, compact, homeId, awayId) {
  let rows = statRows(l, l.home, l.away);
  return `<div class="statspanel"><div class="statshead"><b>${esc(team(homeId).short)}</b><span>Match stats</span><b>${esc(team(awayId).short)}</b></div>${rows.map(([n, a, b, x, y]) => { let t = (Number(x) + Number(y)) || 1; return `<div class="statrow"><div class="sv"><b>${a}</b><span>${n}</span><b>${b}</b></div><div class="statbar"><i class="h" style="width:${Number(x) / t * 100}%"></i><i class="a" style="width:${Number(y) / t * 100}%"></i></div></div>` }).join('')}</div>`;
}

/* ---------- pitch ---------- */
function teamColour(id, fallback) { let c = team(id)?.colour; return /^#[0-9a-f]{6}$/i.test(c || '') ? c : fallback }
function colourDist(a, b) { let p = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16)); let x = p(a), y = p(b); return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]) }
function inkFor(c) { let p = [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16)); return (p[0] * .299 + p[1] * .587 + p[2] * .114) > 150 ? '#111' : '#fff' }
function pitchColours(f) { let h = teamColour(f.home, '#f5a623'), a = teamColour(f.away, '#8aa0a8'); if (colourDist(h, a) < 90) a = inkFor(h) === '#111' ? '#1d3a8a' : '#e8edf0'; return [h, a] }
function buildPitch(l, f) {
  if (typeof document.createElement !== 'function') return null;
  let [hc, ac] = pitchColours(f), players = '';
  for (let i = 0; i < 22; i++) { let c = i < 11 ? hc : ac, pl = playerAt(l, i), n = pl ? pl.num : NUMBERS[i < 11 ? 'h' : 'a'][i < 11 ? i : i - 11]; players += `<g class="pl ${i < 11 ? 'h' : 'a'}${i === 0 || i === 11 ? ' gk' : ''}"><circle r="1.9" fill="${c}" stroke="${i === 0 || i === 11 ? '#ffd54a' : '#ffffffcc'}" stroke-width=".45"/><text y=".6" text-anchor="middle" font-size="1.75" font-weight="700" fill="${inkFor(c)}">${n}</text></g>` }
  let stripes = ''; for (let k = 0; k < 14; k++) stripes += `<rect x="${k * VW / 14}" y="0" width="${VW / 14}" height="${VH}" fill="${k % 2 ? '#1f5a34' : '#22633a'}"/>`;
  let el = document.createElement('div'); el.className = 'pitchbox';
  el.innerHTML = `<svg viewBox="-3 -3 ${VW + 6} ${VH + 6}" role="img" aria-label="Bird’s-eye view of the match"><rect x="-3" y="-3" width="${VW + 6}" height="${VH + 6}" rx="3" fill="#174a2a"/><g>${stripes}</g><g fill="none" stroke="#ffffff66" stroke-width=".4"><rect x=".3" y=".3" width="${VW - .6}" height="${VH - .6}"/><line x1="${VW / 2}" y1=".3" x2="${VW / 2}" y2="${VH - .3}"/><circle cx="${VW / 2}" cy="${VH / 2}" r="9.15"/><rect x=".3" y="13.85" width="16.5" height="40.3"/><rect x="${VW - 16.8}" y="13.85" width="16.5" height="40.3"/><rect x=".3" y="24.85" width="5.5" height="18.3"/><rect x="${VW - 5.8}" y="24.85" width="5.5" height="18.3"/><path d="M16.8 27.2 A9.15 9.15 0 0 1 16.8 40.8"/><path d="M${VW - 16.8} 27.2 A9.15 9.15 0 0 0 ${VW - 16.8} 40.8"/></g><g fill="#ffffff22" stroke="#ffffff77" stroke-width=".3"><rect x="-2.2" y="29.2" width="2.5" height="9.6"/><rect x="${VW - .3}" y="29.2" width="2.5" height="9.6"/></g><circle cx="${VW / 2}" cy="${VH / 2}" r=".5" fill="#ffffff88"/><line class="passline" x1="0" y1="0" x2="0" y2="0" stroke="#fff" stroke-width=".4" stroke-dasharray="1 .8" opacity="0"/>${players}<g class="ball"><ellipse class="ballshadow" cx=".25" cy="1.1" rx="1.1" ry=".5" fill="#0007"/><circle class="ballcore" r="1" cx="0" cy="0" fill="#fff" stroke="#111" stroke-width=".3"/></g><text class="carrierlabel" x="0" y="0" text-anchor="middle" font-size="2" font-weight="700" fill="#fff" stroke="#000" stroke-width=".45" paint-order="stroke"></text><text class="evt" x="${VW / 2}" y="${VH / 2 - 14}" text-anchor="middle" font-size="5" font-weight="800" fill="#ffd54a" opacity="0"></text></svg><div class="scorebug"><b class="sbt">${esc(team(f.home).abbr || team(f.home).short.slice(0, 3).toUpperCase())}</b><b class="sbs sbh">0</b><i class="sbclock">00:00</i><b class="sbs sba">0</b><b class="sbt">${esc(team(f.away).abbr || team(f.away).short.slice(0, 3).toUpperCase())}</b></div><div class="pitchcap"><span><i style="background:${hc}"></i>${esc(team(f.home).short)}</span><span class="phase"></span><span><i style="background:${ac}"></i>${esc(team(f.away).short)}</span></div>`;
  return { fixture: l.fixture, el, dots: [...el.querySelectorAll('g.pl')], ball: el.querySelector('g.ball'), core: el.querySelector('.ballcore'), label: el.querySelector('.carrierlabel'), sbh: el.querySelector('.sbh'), sba: el.querySelector('.sba'), line: el.querySelector('.passline'), evt: el.querySelector('.evt'), phase: el.querySelector('.phase'), timers: [], names: [team(f.home).short, team(f.away).short] };
}
function paintPitch(l) {
  if (!pitch.el || !l.viz) return; let v = l.viz, tick = Math.max(60, Math.min(900, 900 / (l.speed || 2)) * .92);
  pitch.el.style.setProperty('--tick', Math.round(tick) + 'ms');
  if (pitch.sbh) { pitch.sbh.textContent = l.home; pitch.sba.textContent = l.away }
  if (pitch.label) { let who = playerAt(l, v.owner), od = v.d[v.owner]; pitch.label.textContent = who ? who.sur : ''; pitch.label.style.transform = `translate(${(od[0] * VW).toFixed(2)}px,${(od[1] * VH - 3.3).toFixed(2)}px)` }
  if (v.pass && pitch.core) { pitch.core.classList.remove('hop'); void pitch.core.getBoundingClientRect(); pitch.core.classList.add('hop') }
  pitch.dots.forEach((c, i) => { c.style.transform = `translate(${(v.d[i][0] * VW).toFixed(2)}px,${(v.d[i][1] * VH).toFixed(2)}px)`; c.classList.toggle('carrier', i === v.owner) });
  for (let t of pitch.timers) clearTimeout(t); pitch.timers = [];
  let path = v.path && v.path.length ? v.path : [v.ball];
  path.forEach((pt, k) => { let set = () => { pitch.ball.style.transform = `translate(${(pt.x * VW).toFixed(2)}px,${(pt.y * VH).toFixed(2)}px)` }; if (k === 0) set(); else pitch.timers.push(setTimeout(set, tick * .85 * k / path.length)) });
  if (v.pass && pitch.line) {
    pitch.line.setAttribute('x1', (v.pass.from.x * VW).toFixed(2)); pitch.line.setAttribute('y1', (v.pass.from.y * VH).toFixed(2)); pitch.line.setAttribute('x2', (v.pass.to.x * VW).toFixed(2)); pitch.line.setAttribute('y2', (v.pass.to.y * VH).toFixed(2));
    pitch.line.style.transition = 'none'; pitch.line.style.opacity = '.85'; void pitch.line.getBoundingClientRect(); pitch.line.style.transition = `opacity ${Math.round(tick * .9)}ms ease-out`; pitch.line.style.opacity = '0';
  }
  if (pitch.evt) { pitch.evt.textContent = v.evt || ''; pitch.evt.style.transition = 'none'; pitch.evt.style.opacity = v.evt ? '1' : '0'; if (v.evt) { void pitch.evt.getBoundingClientRect(); pitch.evt.style.transition = `opacity ${Math.round(tick * 2.2)}ms ease-out`; pitch.evt.style.opacity = '0' } }
  if (pitch.phase) pitch.phase.textContent = v.mode === 'corner' ? 'Corner' : v.cele ? 'Goal!' : pitch.names[v.side === 'h' ? 0 : 1] + ' in possession';
  pitch.el.classList.toggle('goalflash', v.flash > 0);
}
function mountPitch(st, f) {
  let slotEl = document.getElementById('pitchslot'); if (!slotEl || typeof slotEl.appendChild !== 'function' || !st.viz) return;
  if (!pitch.el || pitch.fixture !== st.fixture) pitch = buildPitch(st, f) || { fixture: null, el: null, dots: [], ball: null };
  if (!pitch.el) return;
  if (pitch.el.parentNode !== slotEl) { slotEl.appendChild(pitch.el); void pitch.el.offsetWidth }
  paintPitch(st);
}


render = function () {
  baseViewRender();
  if (!g || !g.world || page !== 'Matchday' || typeof $('content').innerHTML !== 'string') return;
  if (g.world.live) ensureViz(g.world.live);
  let st = g.world.live || g.world.lastMatch; if (!st || !st.stats) return;
  let live = !!g.world.live, f = live ? g.world.fixtures.find(x => x.id === st.fixture) : { home: st.homeId, away: st.awayId };
  if (!f) return;
  let marker = '<div class="columns" style="margin-top:22px">', html = $('content').innerHTML;
  if (!html.includes(marker)) return;
  $('content').innerHTML = html.replace(marker, `<div class="matchview"><div class="matchpitch"><div id="pitchslot"></div></div>${statsHtml(st, false, f.home, f.away)}</div>` + marker);
  mountPitch(st, f);
};
