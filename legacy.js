/* Legacy. Achievements that unlock as you play, a hall of fame of titles, promotions, cups, record signings and best seasons,
   the Golden Boot winners you have had, every manager you have employed, and a celebration scene when something big is won.
   Also: the squad cards now show each player's drawn face in the club's kit. */

const baseLgComplete = completeWorldSeason, baseLgWeekly = weeklyWorld, baseLgFinishMatch = finishMatch, baseLgResultClose = resultClose, baseLgCloseBoard = closeBoardroom, baseLgFinishDeal = finishDeal, baseLgRollover = performSeasonRollover;
const ACH = [
  ['first-win', '🥇', 'First blood', 'Win your first match as chairman'], ['ten-wins', '🔟', 'Double figures', 'Win ten league matches in a season'], ['derby', '🔥', 'Bragging rights', 'Win a derby'], ['clean-5', '🧤', 'Fortress', 'Five clean sheets in a season'],
  ['hat-trick', '🎩', 'Hat-trick hero', 'One of your players scores three in a game'], ['unbeaten-10', '🛡️', 'Unbeatable', 'Ten league games unbeaten'], ['promotion', '⬆️', 'Going up', 'Win promotion'], ['playoffs', '🏟️', 'Wembley winners', 'Win promotion through the play-offs'],
  ['title', '🏆', 'Champions', 'Win a league title'], ['cup-run', '🎯', 'Giant-killers', 'Knock a higher-division club out of a cup'], ['cup-final', '🏅', 'Final day', 'Reach a cup final'], ['cup-win', '🥂', 'Silverware', 'Win a cup'],
  ['europe', '🌍', 'European nights', 'Qualify for Europe'], ['profit', '💷', 'In the black', 'End a season with more cash than you started it'], ['rules', '📏', 'By the book', 'A full season within the financial rules with no warnings'], ['sellout', '🎟️', 'Full house', 'A sell-out crowd'],
  ['record', '💎', 'Record signing', 'Break the club transfer record under you'], ['academy', '🌱', 'Homegrown', 'Promote an academy graduate who plays 20 league games'], ['loyal', '🧓', 'Long service', 'Keep the same manager for three seasons'], ['build', '🏗️', 'Master builder', 'Complete five stadium projects'],
  ['followers', '📱', 'Big club', 'Reach a million followers'], ['kit-hit', '👕', 'Fashion house', 'A kit that 80% of supporters like'], ['survive', '😮‍💨', 'Survivor', 'Survive a vote of no confidence'], ['decade', '📅', 'The long game', 'Complete ten seasons']
];
function ach() { return g.ach || (g.ach = {}) }
function unlock(id) { let a = ach(); if (a[id]) return; let d = ACH.find(x => x[0] === id); if (!d) return; a[id] = { season: g.season, date: g.world ? g.world.date : '' }; msg('Achievement: ' + d[2], d[3] + '.', 'club'); toast('🏅 ' + d[2]); if (typeof SFX !== 'undefined') SFX.ping(); save() }
function hof() { return g.hof || (g.hof = { trophies: [], seasons: [], managers: [], signings: [], best: null }) }
/* ---------- watchers ---------- */
finishMatch = function () {
  let l = g.world.live, f = l && g.world.fixtures.find(x => x.id === l.fixture); baseLgFinishMatch(); let m = g.world.lastMatch; if (!m || !f) return;
  let mine = m.homeId === g.clubId, own = mine ? m.home : m.away, opp = mine ? m.away : m.home, oppId = mine ? m.awayId : m.homeId;
  if (own > opp) { unlock('first-win'); if (typeof rivalryLevel === 'function' && rivalryLevel(g.clubId, oppId) >= 2) unlock('derby') }
  if ((m.goals || []).filter(x => x.side === (mine ? 'h' : 'a')).some((x, i, arr) => arr.filter(y => y.id === x.id).length >= 3)) unlock('hat-trick');
  if (f.comp !== 'League' && own > opp) { let ot = g.divisions.findIndex(d => d.includes(oppId)); if (ot >= 0 && ot < tier()) unlock('cup-run'); if (f.round === 'Final') unlock('cup-win'); if (/Semi/.test(f.round) && f.winner === g.clubId) unlock('cup-final') }
  if (m.attendance == null && mine && g.last && g.last.attendance >= g.capacity * .98) unlock('sellout');
  let r = myrow(); if (r.w >= 10) unlock('ten-wins'); let form = r.form || []; if (form.length >= 10 && !form.slice(-10).includes('L')) unlock('unbeaten-10'); if (typeof te === 'function') { let t = te(g.clubId); if (t && t.cs >= 5) unlock('clean-5') }
};
completeWorldSeason = function () {
  let cash0 = g.world.cashAtStart, pos = position(), t = tier(); baseLgComplete(); let H = hof(), w = g.world, f = fin();
  let move = (g.pendingMoves || []).find(x => x.id === g.clubId), up = move && move.to < move.from;
  let season = { season: g.season, league: DB[t].name, pos, pts: myrow().pts, w: myrow().w, d: myrow().d, l: myrow().l, gf: myrow().gf, ga: myrow().ga, up, poWon: !!w.poWon, cash: g.cash, fans: g.fans, followers: typeof fb === 'function' ? fb().online : 0, manager: g.manager.name, cups: Object.values(w.cups).filter(c => c.winner === g.clubId).map(c => c.name) };
  H.seasons.push(season); if (!H.best || pos < H.best.pos || (pos === H.best.pos && t < H.best.tier)) H.best = { ...season, tier: t };
  if (pos === 1) { unlock('title'); H.trophies.push({ season: g.season, name: DB[t].name + ' champions', icon: '🏆' }) } if (up) { unlock('promotion'); if (w.poWon) { unlock('playoffs'); H.trophies.push({ season: g.season, name: DB[t].name + ' play-off winners', icon: '🏟️' }) } }
  for (let c of season.cups) H.trophies.push({ season: g.season, name: c + ' winners', icon: '🥂' }); if (w.nextQualification) unlock('europe');
  if (cash0 != null && g.cash > cash0) unlock('profit'); if (f.live && f.live.status === 'ok' && !(f.breaches || []).some(b => b.season === g.season) && !w.ruleWarned) unlock('rules');
  if (!H.managers.length || H.managers.at(-1).name !== g.manager.name) H.managers.push({ name: g.manager.name, from: g.season, to: g.season, seasons: 1 }); else { H.managers.at(-1).to = g.season; H.managers.at(-1).seasons++ } if (H.managers.at(-1).seasons >= 3) unlock('loyal');
  if (typeof fb === 'function' && fb().online >= 1e6) unlock('followers'); if (g.kit && g.kit.reaction && g.kit.reaction.like >= 80) unlock('kit-hit'); if (g.std && g.std.history.length >= 5) unlock('build'); if (H.seasons.length >= 10) unlock('decade');
  let acad = g.squad.filter(p => p.academy && (p.apps || 0) >= 20); if (acad.length) unlock('academy');
  if (pos === 1 || up) w.celebrate = w.celebrate || { kind: pos === 1 ? 'title' : 'promotion', title: pos === 1 ? 'CHAMPIONS' : 'PROMOTED', sub: pos === 1 ? DB[t].name + ' winners ' + seasonYear() + '/' + String(seasonYear() + 1).slice(2) : `${DB[t - 1].name} football next season` };
  celebrateShow();
};
const baseLgSetup = setupWorld; setupWorld = function (...a) { let r = baseLgSetup(...a); g.world.cashAtStart = g.cash; return r };
finishDeal = function (d, p) { let before = d.status, r = baseLgFinishDeal(d, p); if (before !== 'signed' && d.status === 'signed') { let H = hof(), fee = d.fee || 0; if (fee > 0 && (!H.signings.length || fee > Math.max(...H.signings.map(s => s.fee)))) { if (H.signings.length) unlock('record'); H.signings.push({ season: g.season, name: p.name, fee, from: team(p.owner).short }); H.signings = H.signings.sort((a, b) => b.fee - a.fee).slice(0, 10) } else if (fee > 0) { H.signings.push({ season: g.season, name: p.name, fee, from: team(p.owner).short }); H.signings = H.signings.sort((a, b) => b.fee - a.fee).slice(0, 10) } } return r };
weeklyWorld = function () { baseLgWeekly(); if (g.ended || !g.world) return; if (g.world.noConfidence === false && g.inbox.some(x => /survived/.test(x.title))) unlock('survive'); if (fin().live && fin().live.status !== 'ok') g.world.ruleWarned = true };
/* ---------- celebration ---------- */
function celebrateShow() {
  let w = g.world, c = w && w.celebrate; if (!c || $('modal').innerHTML || resultOpen || w.live) return; w.celebrate = null; save();
  let confetti = Array.from({ length: 70 }, (_, i) => `<i style="left:${(i * 7.3) % 100}%;animation-delay:${(i % 10) * .25}s;animation-duration:${3 + (i % 5) * .6}s;background:${['#ffd54a', '#fff', club().colour || '#1b4fa8', '#f5a623', '#7bd88f'][i % 5]}"></i>`).join('');
  let shirt = g.kit && g.kit.design && typeof shirtSvg === 'function' ? shirtSvg(g.kit.design.home, 'cel', g.kit.sponsor ? g.kit.sponsor.name : '', true, 150) : '';
  $('modal').innerHTML = `<div class="overlay celebrate"><div class="confetti">${confetti}</div><div class="celcard"><div class="celcrest">${teamBadge(g.clubId)}</div><h1>${esc(c.title)}</h1><h2>${esc(c.sub)}</h2><div class="celrow">${shirt}<div class="trophy">🏆</div></div><p>${esc(club().name)} · ${esc(g.manager.name)} · ${g.fans.toLocaleString()} supporters</p><div class="actions"><button class="primary" onclick="closeModal();render();pressShow&&pressShow()">Lift the trophy →</button></div></div></div>`;
  if (typeof SFX !== 'undefined' && SFX.ready && SFX.ready()) { roar(); setTimeout(roar, 1200) }
}
resultClose = function (s) { baseLgResultClose(s); celebrateShow() }; closeBoardroom = function (...a) { baseLgCloseBoard(...a); celebrateShow() };
/* ---------- the page ---------- */
function legacyPage() {
  let H = hof(), a = ach(), got = ACH.filter(x => a[x[0]]), left = ACH.filter(x => !a[x[0]]), honours = (g.honours || []).filter(h => h.boot && g.hof);
  let trophies = H.trophies.length ? `<div class="trophyrow">${H.trophies.slice().reverse().map(t => `<div class="trophy-card"><span>${t.icon}</span><b>${esc(t.name)}</b><small>Season ${t.season}</small></div>`).join('')}</div>` : '<p class="emptynote">The cabinet is empty. Every chairman starts that way.</p>';
  let seasons = H.seasons.length ? `<table><tr><th>Season</th><th>League</th><th>Pos</th><th>W-D-L</th><th>GF-GA</th><th>Manager</th><th>Cups</th><th>Followers</th></tr>${H.seasons.slice().reverse().map(s => `<tr class="${s.pos === 1 ? 'gold' : s.up ? 'up' : ''}"><td>${s.season}</td><td>${esc(s.league)}</td><td>${s.pos}${ord(s.pos)}${s.up ? ' ⬆️' : ''}${s.poWon ? ' 🏟️' : ''}</td><td>${s.w}-${s.d}-${s.l}</td><td>${s.gf}-${s.ga}</td><td>${esc(s.manager)}</td><td>${s.cups.map(esc).join(', ') || '–'}</td><td>${s.followers ? (typeof nf === 'function' ? nf(s.followers) : s.followers) : '–'}</td></tr>`).join('')}</table>` : '<p class="emptynote">Your first season is still being written.</p>';
  return `<div class="legacyhero card"><div><span class="eyebrow">YOUR LEGACY</span><h2>${esc(club().name)} under your chairmanship</h2><p>Season ${g.season} · ${H.trophies.length} trophies · ${got.length}/${ACH.length} achievements${H.best ? ` · best finish ${H.best.pos}${ord(H.best.pos)} in the ${esc(H.best.league)}` : ''}</p></div><div class="legacynums"><div><b>${H.trophies.length}</b><small>trophies</small></div><div><b>${H.seasons.filter(s => s.up).length}</b><small>promotions</small></div><div><b>${got.length}</b><small>achievements</small></div><div><b>${H.managers.length || 1}</b><small>managers</small></div></div></div>
  <div class="card"><div class="cardhead"><h2>Trophy cabinet</h2></div><div class="pad">${trophies}</div></div>
  <div class="card"><div class="cardhead"><h2>Achievements</h2><span class="eyebrow">${got.length} OF ${ACH.length}</span></div><div class="pad achgrid">${got.map(x => `<div class="achv on"><span>${x[1]}</span><div><b>${x[2]}</b><small>${x[3]} · season ${a[x[0]].season}</small></div></div>`).join('')}${left.map(x => `<div class="achv"><span>${x[1]}</span><div><b>${x[2]}</b><small>${x[3]}</small></div></div>`).join('')}</div></div>
  <div class="card"><div class="cardhead"><h2>Season by season</h2></div><div class="pad">${seasons}</div></div>
  <div class="tvtwo"><div class="card"><div class="cardhead"><h2>Record signings</h2></div><div class="pad">${H.signings.length ? H.signings.map((s, i) => `<div class="lbrow"><span class="rk">${i + 1}</span><div class="lbname"><b>${esc(s.name)}</b><small>from ${esc(s.from)} · season ${s.season}</small></div><span class="lbval">${compact(s.fee)}</span></div>`).join('') : '<p class="emptynote">No fees paid yet.</p>'}</div></div>
  <div class="card"><div class="cardhead"><h2>Managers</h2></div><div class="pad">${(H.managers.length ? H.managers : [{ name: g.manager.name, from: g.season, to: g.season, seasons: 1 }]).slice().reverse().map(m => `<div class="lbrow"><div class="lbname"><b>${esc(m.name)}</b><small>Season${m.from === m.to ? ' ' + m.from : 's ' + m.from + '–' + m.to}</small></div><span class="lbval">${m.seasons}<small>seasons</small></span></div>`).join('')}</div></div></div>
  ${(g.honours || []).length ? `<div class="card"><div class="cardhead"><h2>Golden Boots in your divisions</h2></div><div class="pad"><table><tr><th>Season</th><th>League</th><th>Top scorer</th><th>Playmaker</th><th>Golden Glove</th></tr>${g.honours.slice().reverse().map(x => `<tr><td>${x.season}</td><td>${esc(DB[x.tier].name)}</td><td>${x.boot ? esc(x.boot.name) + ' <small>' + x.boot.n + '</small>' : '–'}</td><td>${x.assists ? esc(x.assists.name) + ' <small>' + x.assists.n + '</small>' : '–'}</td><td>${x.glove ? esc(x.glove.name) + ' <small>' + x.glove.n + '</small>' : '–'}</td></tr>`).join('')}</table></div></div>` : ''}`;
}
icons.Legacy = '<path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0z"/><path d="M7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3"/>';
NAV_ORDER.splice(NAV_ORDER.indexOf('Hot') + 1, 0, 'Legacy'); PAGE_BUILDERS.Legacy = legacyPage; MY_PAGES.push('Legacy'); MY_LABELS.Legacy = ['WHAT YOU LEAVE BEHIND', 'Legacy', 'Trophies, achievements and every season under your chairmanship.'];
/* ---------- portraits: every squad card shows the player's face in the kit ---------- */
portrait = function (p) {
  if (!window.__CLUBS__) {
    if (p.photo) { let c = typeof PHOTO_CREDITS !== 'undefined' && PHOTO_CREDITS[p.id]; return `<div class="portrait photo"><img src="${esc(p.photo)}" alt="${esc(p.name)}" loading="lazy" onerror="this.parentNode.outerHTML=portraitDrawn(${JSON.stringify(p.id)})"><span class="ptnum">${esc(p.number || '')}</span><small class="credit" title="${c ? esc(c[0] + ', ' + c[1] + ' \u2014 Wikimedia Commons') : 'Wikimedia Commons'}">Photo: ${c ? esc(c[1]) : 'Wikimedia Commons'}</small></div>` }
    let rid = typeof assignPortrait === 'function' ? assignPortrait(p) : null;
    if (rid) return `<div class="portrait photo fictional"><img src="assets/portraits/${rid}.jpg" alt="" loading="lazy" onerror="this.parentNode.outerHTML=portraitDrawn(${JSON.stringify(p.id)})"><span class="ptnum">${esc(p.number || '')}</span><small class="credit">AI-generated face</small></div>`;
  }
  return portraitDrawn(p.id);
};
function portraitDrawn(id) { let p = g.squad.find(x => x.id === id) || { id, name: 'Player', age: 25 }; let k = g.kit && g.kit.design ? g.kit.design.home : { pattern: 'solid', c1: club().colour || '#1b4fa8', c2: '#f6f6f2', c3: '#f6f6f2' }; return `<div class="portrait drawn">${personFront({ name: p.name, male: true, nochair: true, kit: k, age: p.age }, 'pt' + Math.abs(hash(p.id)))}<span class="ptnum">${esc(p.number || '')}</span></div>` };
