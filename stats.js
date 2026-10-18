/* Who's hot and who's not. Every league match in all four divisions now produces scorers, assists, clean sheets and match ratings for real players,
   so the game has a Golden Boot race, a Golden Glove race, players on fire, strikers in a drought, team form and a team of the round.
   AI matches only have scores, so their scorers are drawn (deterministically) from each club's real players, weighted by position and quality. */

const baseStatsSettle = settleLeague, baseStatsFinish = finishMatch, baseStatsComplete = completeWorldSeason;
let hnTier = null, pcache = null;

/* ---------- clubs with no player data get a squad of their own ---------- */
const FN = ['James', 'Jack', 'Harry', 'Oliver', 'Charlie', 'George', 'Callum', 'Ryan', 'Liam', 'Connor', 'Daniel', 'Lewis', 'Jordan', 'Ben', 'Tom', 'Joe', 'Luke', 'Scott', 'Marcus', 'Kieran', 'Adam', 'Josh', 'Reece', 'Jamie', 'Aaron', 'Dean', 'Nathan', 'Elliot', 'Kyle', 'Owen', 'Sam', 'Max', 'Ellis', 'Troy', 'Danny', 'Mason', 'Declan', 'Ashley', 'Tyrone', 'Femi', 'Andre', 'Mo', 'Cian', 'Rhys', 'Finn', 'Alfie', 'Noah', 'Kai'];
const SN = ['Smith', 'Jones', 'Taylor', 'Brown', 'Wilson', 'Evans', 'Walker', 'Wright', 'Hughes', 'Edwards', 'Green', 'Hall', 'Clarke', 'Harrison', 'Turner', 'Cooper', 'Morgan', 'Bell', 'Murphy', 'Bailey', 'Cole', 'Price', 'Palmer', 'Barnes', 'Fox', 'Reid', 'Gray', 'Webb', 'Hunt', 'Lowe', 'Marsh', 'Khan', 'Adeyemi', 'Okafor', 'Mensah', 'Osei', 'Silva', 'Costa', 'Novak', 'Hansen', "O'Connor", 'McGregor', 'Doyle', 'Lynch', 'Burke', 'Grant', 'Rowe', 'Shaw', 'Ward', 'Fletcher', 'Dixon', 'Hayes', 'Pearce', 'Mills', 'Stone', 'Booth', 'Lamb', 'Nash', 'Rhodes', 'Vaughan'];
const synthCache = {};
function synthSquad(clubId) {
  if (synthCache[clubId]) return synthCache[clubId]; let out = [], posList = ['GK', 'GK', 'DEF', 'DEF', 'DEF', 'DEF', 'DEF', 'DEF', 'DEF', 'MID', 'MID', 'MID', 'MID', 'MID', 'MID', 'MID', 'MID', 'FWD', 'FWD', 'FWD', 'FWD', 'FWD', 'FWD', 'FWD'], used = new Set();
  posList.forEach((pos, i) => { let h = Math.abs(hash('syn' + clubId + i)), nm = FN[h % FN.length] + ' ' + SN[Math.floor(h / 53) % SN.length], n = 0; while (used.has(nm)) nm = FN[(h + ++n * 7) % FN.length] + ' ' + SN[(Math.floor(h / 53) + n * 11) % SN.length]; used.add(nm); out.push({ id: 's' + clubId + '_' + i, name: nm, position: pos, number: String(i < 2 ? (i ? 13 : 1) : i < 9 ? i : i < 17 ? i + 1 : i + 2) }) });
  return synthCache[clubId] = out;
}
let dupIds = null;
const squadOf = id => {
  if (!dupIds) { dupIds = new Set(); let seen = new Set(); for (let c of CLUBS) for (let p of c.players) { if (seen.has(p.id)) dupIds.add(p.id); seen.add(p.id) } }   // a few players are listed at two clubs
  let ps = club(id) ? club(id).players : []; return ps.length >= 14 ? ps.map(p => dupIds.has(p.id) ? { ...p, id: p.id + '@' + id } : p) : synthSquad(id);
};

/* ---------- player lookup ---------- */
function normPos(p) { return ['GK', 'G'].includes(p) ? 'GK' : ['DEF', 'D', 'CB'].includes(p) ? 'DEF' : ['MID', 'M', 'CM'].includes(p) ? 'MID' : 'FWD' }
function pinfo(id) {
  if (!pcache) { pcache = {}; for (let c of CLUBS) for (let p of squadOf(c.id)) pcache[p.id] = { name: p.name, pos: normPos(p.position), club: c.id, num: p.number } }
  if (pcache[id]) return pcache[id]; let p = g.squad.find(x => x.id === id) || (g.prospects || []).find(x => x.id === id);
  return p ? { name: p.name, pos: normPos(p.position), club: g.clubId, num: p.number } : { name: 'Unknown', pos: 'MID', club: null };
}
const qual = id => (Math.abs(hash('q' + id)) % 1000) / 1000;
const tierOf = c => g.divisions.findIndex(d => d.includes(c));

/* ---------- storage: compact, per season ---------- */
function ps() { let w = g.world; return w.ps || (w.ps = { p: {}, t: {}, rd: { 0: [], 1: [], 2: [], 3: [] }, cur: { 0: [], 1: [], 2: [], 3: [] }, rounds: 0 }) }
function pe(id, club, tr) { let P = ps().p; let e = P[id] || (P[id] = { c: club, t: tr, g: 0, a: 0, cs: 0, ap: 0, yc: 0, rc: 0, ga: 0, f: [] }); e.c = club; if (tr != null) e.t = tr; if (e.yc == null) e.yc = 0; if (e.rc == null) e.rc = 0; if (e.ga == null) e.ga = 0; return e }
function te(club, tr) { let T = ps().t; let e = T[club] || (T[club] = { tr, w: 0, d: 0, l: 0, gf: 0, ga: 0, cs: 0, form: '', unb: 0, wst: 0 }); if (tr != null) e.tr = tr; return e }

/* ---------- picking an AI line-up and its scorers ---------- */
const xiPool = {};
function pool(clubId) {
  if (xiPool[clubId]) return xiPool[clubId]; let by = { GK: [], DEF: [], MID: [], FWD: [] }; pinfo('init');
  for (let p of squadOf(clubId)) by[normPos(p.position)].push({ id: p.id, pos: normPos(p.position), q: qual(p.id) });
  for (let k in by) by[k].sort((a, b) => b.q - a.q); return xiPool[clubId] = by;
}
function aiXI(clubId, rng) {
  let by = pool(clubId), xi = [], used = new Set();
  for (let [pos, n] of [['GK', 1], ['DEF', 4], ['MID', 4], ['FWD', 2]]) {
    let list = by[pos].filter(p => !used.has(p.id)), take = [];
    for (let p of list) { if (take.length >= n) break; if (rng() < (pos === 'GK' ? .04 : .12) && list.length > n + take.length) continue; take.push(p) }
    for (let p of list) { if (take.length >= n) break; if (!take.includes(p)) take.push(p) }
    for (let p of take) { used.add(p.id); xi.push(p) }
  }
  for (let k of ['MID', 'DEF', 'FWD']) for (let p of by[k]) { if (xi.length >= 11) break; if (!used.has(p.id)) { used.add(p.id); xi.push(p) } }
  return xi;
}
function drawGoals(xi, n, rng) {
  let out = [];
  for (let i = 0; i < n; i++) {
    let sw = xi.map(p => ({ p, w: ({ FWD: 6, MID: 2.6, DEF: .8, GK: 0 })[p.pos] * (.55 + p.q * 1.1) })), tot = sw.reduce((s, x) => s + x.w, 0), r = rng() * tot, sc = sw[0].p;
    for (let x of sw) { r -= x.w; if (r <= 0) { sc = x.p; break } }
    let aid = null; if (rng() < .7) { let aw = xi.filter(p => p.id !== sc.id && p.pos !== 'GK').map(p => ({ p, w: ({ MID: 4, FWD: 3, DEF: 1.8 })[p.pos] * (.6 + p.q) })), at = aw.reduce((s, x) => s + x.w, 0), ar = rng() * at; for (let x of aw) { ar -= x.w; if (ar <= 0) { aid = x.p.id; break } } }
    out.push({ id: sc.id, aid });
  }
  return out;
}
function drawCards(xi, rng) {
  let out = [], seen = new Set();
  for (let p of xi) { if (p.pos === 'GK') continue; let base = p.pos === 'DEF' ? .09 : p.pos === 'MID' ? .08 : .045; if (rng() < base) { let type = rng() < .06 ? 'red' : 'yellow'; out.push({ id: p.id, type }); seen.add(p.id) } }
  return out;
}

/* ---------- recording one side of one match ---------- */
function applySide(sd, tier, rng, bucket) {
  let res = sd.gf > sd.ga ? 'W' : sd.gf === sd.ga ? 'D' : 'L', perf = {}, t = te(sd.club, tier), pe_ = (id) => pe(id, sd.club, tier);
  for (let p of sd.xi) { pe_(p.id).ap++; perf[p.id] = { id: p.id, c: sd.club, pos: p.pos, r: 6 + (res === 'W' ? .3 : res === 'L' ? -.3 : 0) } }
  let cnt = {};
  for (let gl of sd.goals) { if (!gl.id) continue; pe_(gl.id).g++; cnt[gl.id] = (cnt[gl.id] || 0) + 1; if (perf[gl.id]) perf[gl.id].r += 1.1; if (gl.aid) { pe_(gl.aid).a++; if (perf[gl.aid]) perf[gl.aid].r += .7 } }
  for (let p of sd.xi) { let q = perf[p.id]; if (p.pos === 'GK') pe_(p.id).ga += sd.ga; if (sd.ga === 0 && (p.pos === 'GK' || p.pos === 'DEF')) { q.r += p.pos === 'GK' ? .8 : .5; if (p.pos === 'GK') pe_(p.id).cs++ } else if (sd.ga >= 3 && (p.pos === 'GK' || p.pos === 'DEF')) q.r -= .45 }
  for (let c of sd.cards || []) { if (!c.id) continue; let e = pe_(c.id); if (c.type === 'red') e.rc++; else e.yc++; if (perf[c.id]) perf[c.id].r -= c.type === 'red' ? .9 : .25 }
  for (let id in perf) { let q = perf[id], e = pe_(id); q.r = clamp(q.r + (rng() - .5) * .7, 4.5, 10); e.f.push(Math.round(q.r * 10)); if (e.f.length > 6) e.f.shift() }
  t[res === 'W' ? 'w' : res === 'D' ? 'd' : 'l']++; t.gf += sd.gf; t.ga += sd.ga; if (sd.ga === 0) t.cs++; t.form = (t.form + res).slice(-8); t.unb = res === 'L' ? 0 : t.unb + 1; t.wst = res === 'W' ? t.wst + 1 : 0;
  bucket.push(...Object.values(perf));
  for (let id in cnt) if (cnt[id] >= 3 && (tier === tierOf(g.clubId) || tier === 0)) { let pi = pinfo(id); addNews(`Hat-trick for ${pi.name}`, `${pi.name} scores ${cnt[id]} as ${team(sd.club).name} ${sd.gf > sd.ga ? 'win' : 'draw'} ${sd.gf}–${sd.ga}.`, 'league') }
}
function recordAI(r) {
  let tier = r.tier; if (tier < 0 || !club(r.home) || !club(r.away)) return;
  let rng = seeded(Math.abs(hash(g.season + '|' + r.home + '|' + r.away + '|' + g.week)) * 977 + 11), hx = aiXI(r.home, rng), ax = aiXI(r.away, rng);
  applySide({ club: r.home, xi: hx, gf: r.score[0], ga: r.score[1], goals: drawGoals(hx, r.score[0], rng), cards: drawCards(hx, rng) }, tier, rng, ps().cur[tier]);
  applySide({ club: r.away, xi: ax, gf: r.score[1], ga: r.score[0], goals: drawGoals(ax, r.score[1], rng), cards: drawCards(ax, rng) }, tier, rng, ps().cur[tier]);
}
function recordOwn(f, snap) {
  let tier = tierOf(g.clubId), rng = seeded(Math.abs(hash(g.season + '|' + f.id + '|own')) * 977 + 5); pinfo('init');
  for (let side of ['h', 'a']) {
    let id = side === 'h' ? f.home : f.away, xi = snap.lineup[side].map((p, k) => ({ id: p.id, pos: posOfSlot(side, k), q: qual(p.id) }));
    snap.lineup[side].forEach((p, k) => { if (!pcache[p.id]) pcache[p.id] = { name: p.name, pos: posOfSlot(side, k), club: id, num: p.num } });
    applySide({ club: id, xi, gf: side === 'h' ? snap.home : snap.away, ga: side === 'h' ? snap.away : snap.home, goals: snap.goals.filter(x => x.side === side).map(x => ({ id: x.id, aid: x.aid })), cards: (snap.cards || []).filter(x => x.side === side).map(x => ({ id: x.id, type: x.type })) }, tier, rng, ps().rd[tier]);
  }
}
settleLeague = function (f, score) {
  let w = g.world, was = f.played; if (!was) ps().cur = { 0: [], 1: [], 2: [], 3: [] };
  baseStatsSettle(f, score); if (was) return;
  let log = w.roundLog || []; for (let i = 0; i < log.length; i++) { let r = log[i]; if (!r.mine && !r.sd) { r.sd = true; recordAI(r) } }
  for (let t = 0; t < 4; t++) if (ps().cur[t].length) ps().rd[t] = ps().cur[t];   // each division keeps its own latest round
  ps().rounds++; let top = bestOfRound(tierOf(g.clubId)); if (top) addNews(`Player of the round: ${pinfo(top.id).name}`, `${pinfo(top.id).name} (${team(top.c).short}) was the standout performer in the ${DB[tierOf(g.clubId)].name}, rated ${(top.r / 10).toFixed(1)}.`, 'league');
};
finishMatch = function () {
  let l = g.world.live, f = l && g.world.fixtures.find(x => x.id === l.fixture), snap = l && l.lineup ? { lineup: l.lineup, goals: [...(l.goals || [])], cards: [...(l.cards || [])], home: l.home, away: l.away } : null;
  baseStatsFinish(); if (snap && f && f.comp === 'League') recordOwn(f, snap)
};

/* ---------- reading the numbers ---------- */
function ratingsAvg(e, n) { let f = e.f.slice(-n); return f.length ? f.reduce((s, x) => s + x, 0) / f.length / 10 : 0 }
function playersOf(tier) { return Object.entries(ps().p).filter(([id, e]) => e.t === tier).map(([id, e]) => ({ id, ...e, ...pinfo(id), c: e.c, club: e.c })) }
function topBy(tier, key, n = 10, pos) { return playersOf(tier).filter(p => p[key] > 0 && (!pos || p.pos === pos)).sort((a, b) => (b[key] - a[key]) || (a.ap - b.ap) || a.name.localeCompare(b.name)).slice(0, n) }
function onFire(tier, n = 8) { return playersOf(tier).filter(p => p.f.length >= 3).map(p => ({ ...p, avg: ratingsAvg(p, 3) })).filter(p => p.avg >= 7.2).sort((a, b) => b.avg - a.avg).slice(0, n) }
function struggling(tier, n = 8) {
  return playersOf(tier).filter(p => p.f.length >= 4 && p.ap >= 4).map(p => ({ ...p, avg: ratingsAvg(p, 4), drought: p.pos === 'FWD' && p.g === 0 && p.ap >= 6 })).filter(p => p.avg <= 6 || p.drought).sort((a, b) => (b.drought - a.drought) || (a.avg - b.avg)).slice(0, n);
}
function pointsLast(form, n = 5) { return [...form.slice(-n)].reduce((s, c) => s + (c === 'W' ? 3 : c === 'D' ? 1 : 0), 0) }
function teamsOf(tier) { return Object.entries(ps().t).filter(([id, e]) => e.tr === tier && e.form.length).map(([id, e]) => ({ id, ...e })) }
function bestOfRound(tier) { let list = (ps().rd[tier] || []).slice().sort((a, b) => b.r - a.r); return list[0] ? { ...list[0], r: Math.round(list[0].r * 10) } : null }
function teamOfRound(tier) {
  let rd = (ps().rd[tier] || []), by = pos => rd.filter(x => x.pos === pos).sort((a, b) => b.r - a.r), pick = [...by('GK').slice(0, 1), ...by('DEF').slice(0, 4), ...by('MID').slice(0, 4), ...by('FWD').slice(0, 2)];
  return pick.length >= 11 ? pick.map(x => ({ ...x, r: Math.round(x.r * 10) })) : [];
}

/* ---------- honours: the season's winners are remembered ---------- */
completeWorldSeason = function () {
  let t = tierOf(g.clubId); baseStatsComplete(); let win = (k, pos) => { let x = topBy(t, k, 1, pos)[0]; return x ? { name: x.name, club: x.c, n: x[k] } : null };
  (g.honours = g.honours || []).push({ season: g.season, tier: t, boot: win('g'), assists: win('a'), glove: win('cs', 'GK') });
};

/* ---------- the page ---------- */
const isMine = c => c === g.clubId;
function formPills(e) { return `<span class="fpills">${e.f.slice(-5).map(x => `<i class="${x >= 75 ? 'hi' : x >= 65 ? 'ok' : 'lo'}" title="${(x / 10).toFixed(1)}">${(x / 10).toFixed(1)}</i>`).join('')}</span>` }
function lbRow(p, i, key, label, max) { return `<div class="lbrow ${isMine(p.c) ? 'mine' : ''}"><span class="rk">${i + 1}</span>${badge(club(p.c), 'xs')}<div class="lbname"><b>${esc(p.name)}</b><small>${esc(team(p.c).short)} · ${p.pos} · ${p.ap} apps</small><div class="lbbar"><i style="width:${Math.max(6, p[key] / Math.max(1, max) * 100)}%"></i></div></div><span class="lbval">${p[key]}<small>${label}</small></span></div>` }
function lbCard(title, sub, rows, key, label, empty) { let max = rows[0] ? rows[0][key] : 1; return `<div class="card lb"><div class="cardhead"><h2>${title}</h2><span class="eyebrow">${sub}</span></div><div class="pad lbbody">${rows.length ? rows.map((p, i) => lbRow(p, i, key, label, max)).join('') : `<p class="emptynote">${empty}</p>`}</div></div>` }
function hotCard(title, sub, rows, kind) {
  return `<div class="card lb"><div class="cardhead"><h2>${title}</h2><span class="eyebrow">${sub}</span></div><div class="pad lbbody">${rows.length ? rows.map((p, i) => `<div class="lbrow ${isMine(p.c) ? 'mine' : ''}"><span class="rk">${kind === 'hot' ? '🔥' : '❄️'}</span>${badge(club(p.c), 'xs')}<div class="lbname"><b>${esc(p.name)}</b><small>${esc(team(p.c).short)} · ${p.pos}${p.drought ? ' · no goals in ' + p.ap + ' games' : ''}</small>${formPills(p)}</div><span class="lbval ${kind}">${p.avg.toFixed(1)}<small>avg</small></span></div>`).join('') : `<p class="emptynote">${kind === 'hot' ? 'Nobody has strung together three big performances yet.' : 'Nobody is struggling yet. Give it a few rounds.'}</p>`}</div></div>`;
}
function teamFormCard(tier) {
  let ts = teamsOf(tier); if (!ts.length) return '';
  let hot = [...ts].sort((a, b) => pointsLast(b.form) - pointsLast(a.form) || b.gf - a.gf).slice(0, 4), cold = [...ts].sort((a, b) => pointsLast(a.form) - pointsLast(b.form) || a.gf - b.gf).slice(0, 4), atk = [...ts].sort((a, b) => b.gf - a.gf)[0], def = [...ts].sort((a, b) => a.ga - b.ga)[0], cs = [...ts].sort((a, b) => b.cs - a.cs)[0], unb = [...ts].sort((a, b) => b.unb - a.unb)[0], wins = [...ts].sort((a, b) => b.wst - a.wst)[0];
  let pill = f => `<span class="fpills">${[...f.slice(-5)].map(c => `<i class="r${c}">${c}</i>`).join('')}</span>`, row = (t, sc) => `<div class="lbrow ${isMine(t.id) ? 'mine' : ''}">${badge(club(t.id), 'xs')}<div class="lbname"><b>${esc(team(t.id).short)}</b>${pill(t.form)}</div><span class="lbval">${sc}<small>pts / 5</small></span></div>`;
  let stat = (l, t, v) => t ? `<div class="kv"><span>${l}</span><b>${esc(team(t.id).short)} <em>${v}</em></b></div>` : '';
  return `<div class="card lb wide"><div class="cardhead"><h2>Team form</h2><span class="eyebrow">LAST FIVE MATCHES</span></div><div class="pad formgrid"><div><h3>🔥 In form</h3>${hot.map(t => row(t, pointsLast(t.form))).join('')}</div><div><h3>❄️ Out of form</h3>${cold.map(t => row(t, pointsLast(t.form))).join('')}</div><div class="kvs">${stat('Best attack', atk, atk.gf + ' goals')}${stat('Best defence', def, def.ga + ' conceded')}${stat('Most clean sheets', cs, cs.cs)}${stat('Longest unbeaten run', unb, unb.unb + ' games')}${stat('Longest winning run', wins, wins.wst + ' games')}</div></div></div>`;
}
function towCard(tier) {
  let xi = teamOfRound(tier); if (!xi.length) return '';
  let line = pos => `<div class="towline">${xi.filter(x => x.pos === pos).map(x => { let pi = pinfo(x.id); return `<div class="towp ${isMine(x.c) ? 'mine' : ''}"><div class="towdot" style="background:${club(x.c).colour};color:${typeof inkFor === 'function' ? inkFor(club(x.c).colour) : '#fff'}">${pi.num || ''}</div><b>${esc(pi.name.split(' ').pop())}</b><small>${(x.r / 10).toFixed(1)}</small></div>` }).join('')}</div>`;
  return `<div class="card lb wide"><div class="cardhead"><h2>Team of the round</h2><span class="eyebrow">${esc(DB[tier].name).toUpperCase()}</span></div><div class="tow">${line('FWD')}${line('MID')}${line('DEF')}${line('GK')}</div></div>`;
}
function honoursCard() {
  let h = (g.honours || []).slice(-6).reverse(); if (!h.length) return '';
  return `<div class="card"><div class="cardhead"><h2>Past winners</h2></div><div class="pad"><table><tr><th>Season</th><th>League</th><th>Golden Boot</th><th>Playmaker</th><th>Golden Glove</th></tr>${h.map(x => `<tr><td>${x.season}</td><td>${esc(DB[x.tier].name)}</td><td>${x.boot ? `${esc(x.boot.name)} <small>${x.boot.n}</small>` : '–'}</td><td>${x.assists ? `${esc(x.assists.name)} <small>${x.assists.n}</small>` : '–'}</td><td>${x.glove ? `${esc(x.glove.name)} <small>${x.glove.n}</small>` : '–'}</td></tr>`).join('')}</table></div></div>`;
}
function hotPage() {
  let t = hnTier == null ? tier() : hnTier, tabs = DB.map((d, i) => `<button class="${i === t ? 'active' : ''}" onclick="hnTier=${i};render()">${esc(d.name)}</button>`).join(''), played = ps().rounds > 0;
  return `<div class="pageactions"><div class="seg">${tabs}</div></div>
  ${played ? `<div class="hngrid">${lbCard('Golden Boot', 'GOALS', topBy(t, 'g'), 'g', 'goals', 'No goals yet.')}${lbCard('Playmakers', 'ASSISTS', topBy(t, 'a'), 'a', 'assists', 'No assists yet.')}${lbCard('Golden Glove', 'CLEAN SHEETS', topBy(t, 'cs', 10, 'GK'), 'cs', 'clean', 'No clean sheets yet.')}${hotCard('On fire', 'LAST 3 MATCHES', onFire(t), 'hot')}${hotCard('Struggling', 'COLD STREAKS', struggling(t), 'cold')}${teamFormCard(t)}${towCard(t)}</div>${honoursCard()}` : `<div class="card"><div class="pad"><p class="emptynote">The season has not started yet. As soon as the first round of matches is played, the Golden Boot race, the form guide and the team of the round appear here.</p></div></div>`}`;
}
/* ---------- navigation ---------- */
icons.Hot = '<path d="M12 2c1.4 3.2 5 5 5 9.6a5 5 0 0 1-10 0c0-2 1-3.3 2-4.3 0 1.6.8 2.7 1.6 2.7C10.2 7.9 11 5 12 2z"/><path d="M12 22a3 3 0 0 0 3-3c0-1.6-1.5-2.4-3-4-1.5 1.6-3 2.4-3 4a3 3 0 0 0 3 3z"/>';
NAV_ORDER.splice(NAV_ORDER.indexOf('League') + 1, 0, 'Hot'); NAV_LABEL.Hot = 'Hot & Not'; PAGE_BUILDERS.Hot = hotPage; MY_PAGES.push('Hot'); MY_LABELS.Hot = ['AROUND THE LEAGUE', 'Hot & Not', 'Who is on fire, who is struggling, and who is winning the awards. Every match in all four divisions counts.'];
