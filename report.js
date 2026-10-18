/* Match reports, substitutions and the front page.
   After every match your players are rated and a written report says who shone and who hid. You can tell the manager to bench or
   start anyone next time, and he honours it in the next line-up. While watching, you can demand a substitution (up to three).
   And when something big happens (an unexpected win, a derby, a hammering, a cup upset, a big signing) a newspaper spins onto the screen. */

const baseRepFinish = finishMatch, baseRepResultPaint = resultPaint, baseRepLineup = lineupFor, baseRepMatchPage = matchPage, baseRepClose = resultClose, baseRepCloseBoard = closeBoardroom, baseRepFinishDeal = finishDeal;
let subDraft = null;

/* ---------- ratings ---------- */
function rateOwn(l, f) {
  let mine = f.home === g.clubId ? 'h' : 'a', ownG = mine === 'h' ? l.home : l.away, oppG = mine === 'h' ? l.away : l.home, res = ownG > oppG ? 'W' : ownG === oppG ? 'D' : 'L', xi = l.lineup[mine], rng = seeded(Math.abs(hash(f.id + '|rate')) * 7 + 3), goals = (l.goals || []).filter(x => x.side === mine);
  return xi.map((p, k) => {
    let pos = posOfSlot(mine, k), sp = g.squad.find(x => x.id === p.id), gl = goals.filter(x => x.id === p.id).length, as = goals.filter(x => x.aid === p.id).length, r = 6 + (res === 'W' ? .35 : res === 'L' ? -.35 : 0) + gl * 1.1 + as * .7;
    if (oppG === 0 && (pos === 'GK' || pos === 'DEF')) r += pos === 'GK' ? .8 : .5; if (oppG >= 3 && (pos === 'GK' || pos === 'DEF')) r -= .5; if (pos === 'FWD' && !gl && !as && ownG === 0) r -= .4;
    if (sp) r += ((sp.rating || 60) - cfg[tier()].quality) * .02 + ((sp.fitness ?? 100) - 85) * .01; r += (rng() - .5) * 1.3; if (p.subbedOn) r = 6 + (r - 6) * .6;
    return { id: p.id, name: p.name, sur: p.sur, num: p.num, pos, r: Math.round(clamp(r, 4, 10) * 10) / 10, g: gl, a: as, off: p.subbedOff || null };
  }).concat((l.subsOff || []).map(p => ({ ...p, off: true })));
}
function reportText(m, ratings) {
  let mine = m.homeId === g.clubId, own = mine ? m.home : m.away, opp = mine ? m.away : m.home, oppName = team(mine ? m.awayId : m.homeId).short, res = own > opp ? 'W' : own === opp ? 'D' : 'L', sorted = [...ratings].sort((a, b) => b.r - a.r), best = sorted[0], second = sorted[1], worst = sorted.at(-1), gk = ratings.find(p => p.pos === 'GK'), scorers = ratings.filter(p => p.g), fw = ratings.filter(p => p.pos === 'FWD');
  let open = res === 'W' ? (own - opp >= 3 ? `A statement win. ${club().short} swept ${oppName} aside ${own}–${opp}` : `A deserved ${own}–${opp} win over ${oppName}`) : res === 'D' ? (own ? `Honours even at ${own}–${opp} against ${oppName}` : `A goalless stalemate with ${oppName}`) : (opp - own >= 3 ? `A chastening afternoon. ${oppName} ran out ${opp}–${own} winners` : `A narrow ${opp}–${own} defeat to ${oppName}`);
  let star = best.r >= 7.5 ? ` ${best.name} was the standout performer (${best.r}), ${best.g >= 2 ? `with ${best.g} goals` : best.g ? 'scoring once' : best.a ? `providing ${best.a === 1 ? 'the assist' : best.a + ' assists'}` : best.pos === 'GK' ? 'keeping a clean sheet' : 'controlling the game'}${second && second.r >= 7.2 ? `, well supported by ${second.name} (${second.r})` : ''}.` : best.r >= 6.8 ? ` ${best.name} (${best.r}) was the pick of a modest bunch.` : ' Nobody covered themselves in glory.';
  let poor = worst.r <= 5.5 ? ` ${worst.name} had a day to forget (${worst.r})${worst.pos === 'GK' && opp >= 2 ? ' and will not want to see the goals again' : worst.pos === 'FWD' ? ' and barely had a touch in the box' : ''}.` : '';
  let strikers = res !== 'W' && fw.length && !scorers.some(p => p.pos === 'FWD') && own <= 1 ? ` The forwards ${fw.map(p => p.sur).join(' and ')} drew a blank.` : '';
  let keeper = gk && opp === 0 && res !== 'L' ? ` ${gk.name} kept a clean sheet.` : gk && opp >= 3 ? ` Three or more conceded again raises questions about the defence.` : '';
  return open + '.' + star + poor + strikers + keeper;
}
finishMatch = function () {
  let l = g.world.live, f = l && g.world.fixtures.find(x => x.id === l.fixture), snap = l && l.lineup && f ? { ratings: rateOwn(l, f), f } : null; baseRepFinish();
  let m = g.world.lastMatch; if (!snap || !m) return; m.ratings = snap.ratings; m.report = reportText(m, snap.ratings); applyInstructions(m); pressCheckMatch(m, f);
};

/* ---------- bench / start next time ---------- */
function instr() { return g.world.instr || (g.world.instr = { bench: [], start: [] }) }
function setInstr(id, kind) { let I = instr(); I.bench = I.bench.filter(x => x !== id); I.start = I.start.filter(x => x !== id); if (kind) I[kind].push(id); save(); if (resultOpen) resultPaint(); else render() }
function applyInstructions(m) { let I = g.world.instr; if (!I) return; if (I.used) { g.world.instr = null } }
lineupFor = function (l) {
  let I = g.world.instr, res = baseRepLineup(l); if (!I || (!I.bench.length && !I.start.length)) return res; let f = g.world.fixtures.find(x => x.id === l.fixture); if (!f) return res; let mine = f.home === g.clubId ? 'h' : 'a', xi = res[mine], fit = g.squad.filter(p => !p.inj), normP = p => normPos(p.position);
  let pool = fit.filter(p => !xi.some(x => x.id === p.id) && !I.bench.includes(p.id)).sort((a, b) => b.rating - a.rating), used = new Set(xi.map(x => x.id));
  for (let k = 0; k < xi.length; k++) if (I.bench.includes(xi[k].id)) { let pos = posOfSlot(mine, k), rep = pool.find(p => normP(p) === pos && !used.has(p.id)) || pool.find(p => normP(p) !== 'GK' && pos !== 'GK' && !used.has(p.id)); if (rep) { used.add(rep.id); xi[k] = { id: rep.id, name: rep.name, sur: surname(rep.name), num: Number(rep.number) || 20 + k, in: true } } }
  for (let id of I.start) { if (xi.some(x => x.id === id)) continue; let p = fit.find(x => x.id === id); if (!p) continue; let pos = normP(p), k = xi.findIndex((x, i) => posOfSlot(mine, i) === pos && !I.start.includes(x.id) && !x.in); if (k < 0) k = xi.findIndex((x, i) => i > 0 && !I.start.includes(x.id) && !x.in && pos !== 'GK'); if (k >= 0) xi[k] = { id: p.id, name: p.name, sur: surname(p.name), num: Number(p.number) || 20 + k, in: true } }
  let nums = new Set(); for (let p of xi) { while (nums.has(p.num)) p.num++; nums.add(p.num) }
  I.used = true; return res;
};
const baseRepBegin = beginMatch;
beginMatch = function (id, attend) { let I = g.world.instr; baseRepBegin(id, attend); let l = g.world.live; if (l && I && (I.bench.length || I.start.length)) { let names = [...I.bench.map(x => (g.squad.find(p => p.id === x) || {}).name).filter(Boolean)]; l.commentary.unshift({ minute: 0, text: `Team news: the chairman asked for changes${names.length ? ' and ' + names.join(', ') + (names.length > 1 ? ' are' : ' is') + ' left out' : ''}.` }); if (!attend && g.world.lastMatch) g.world.instr = null } };
resultClose = function (s) { if (g.world && g.world.instr && g.world.instr.used) g.world.instr = null; baseRepClose(s); pressShow() };

/* ---------- the report on the full-time screen ---------- */
function reportHtml(m) {
  if (!m.ratings) return ''; let I = instr(), sorted = [...m.ratings].sort((a, b) => b.r - a.r), cls = r => r >= 7.5 ? 'top' : r >= 6.5 ? 'ok' : r >= 5.6 ? 'meh' : 'poor';
  let row = p => { let inSquad = g.squad.some(x => x.id === p.id), b = I.bench.includes(p.id), s = I.start.includes(p.id); return `<div class="rrow ${cls(p.r)}"><span class="rnum">${p.num || ''}</span><div class="rname"><b>${esc(p.name)}</b><small>${p.pos}${p.g ? ' · ⚽×' + p.g : ''}${p.a ? ' · 🅰×' + p.a : ''}${p.off ? ' · subbed' : ''}</small></div><span class="rr">${p.r.toFixed(1)}</span>${inSquad ? `<div class="racts"><button class="${b ? 'on' : ''}" onclick="setInstr('${p.id}','${b ? '' : 'bench'}')" title="Leave out of the next match">${b ? '✓ Benched' : 'Bench'}</button><button class="${s ? 'on' : ''}" onclick="setInstr('${p.id}','${s ? '' : 'start'}')" title="Must start the next match">${s ? '✓ Starts' : 'Start'}</button></div>` : ''}</div>` };
  let used = new Set(m.ratings.map(p => p.id)), unused = g.squad.filter(p => !used.has(p.id)).sort((a, b) => b.rating - a.rating), ub = p => { let s = I.start.includes(p.id); return `<button class="chip ${s ? 'on' : ''}" onclick="setInstr('${p.id}','${s ? '' : 'start'}')">${s ? '✓ ' : ''}${esc(p.name.split(' ').pop())} <small>${normPos(p.position)} ${Math.round(p.rating)}${p.inj ? ' · inj' : ''}</small></button>` };
  return `<div class="report"><h3>Match report</h3><p class="reporttext">${esc(m.report || '')}</p><div class="ratings">${sorted.map(row).join('')}</div>${unused.length ? `<div class="unused"><span>Did not play · tap to start next time</span><div class="chiprow">${unused.map(ub).join('')}</div></div>` : ''}<p class="fineprint">Bench or Start tells your manager what to do next match. He will keep the shape and find the best replacement.</p></div>`;
}
resultPaint = function () { baseRepResultPaint(); let m = g.world.lastMatch, el = $('ffwd'); if (!m || !m.ratings || typeof el.innerHTML !== 'string') return; el.innerHTML = el.innerHTML.replace('<div class="twocol">', reportHtml(m) + '<div class="twocol">') };

/* ---------- substitutions while watching ---------- */
function subsLeft(l) { return 3 - (l.subs || 0) }
function benchFor(l) { let f = g.world.fixtures.find(x => x.id === l.fixture), mine = f.home === g.clubId ? 'h' : 'a', xi = l.lineup[mine], out = new Set((l.subsOff || []).map(p => p.id)); return g.squad.filter(p => !p.inj && !xi.some(x => x.id === p.id) && !out.has(p.id)).sort((a, b) => b.rating - a.rating) }
function openSub() {
  let l = g.world.live; if (!l) return; if (l.minute < 1) return toast('Wait for kick-off.'); if (subsLeft(l) <= 0) return toast('All three substitutions have been used.'); if (!l.paused) playMatch();
  let f = g.world.fixtures.find(x => x.id === l.fixture), mine = f.home === g.clubId ? 'h' : 'a', xi = l.lineup[mine], bench = benchFor(l); subDraft = { off: xi[xi.length - 1].id, on: bench[0] && bench[0].id };
  $('modal').innerHTML = `<div class="overlay"><div class="modal submodal"><div class="eyebrow">${l.minute}′ · SUBSTITUTION ${l.subs ? l.subs + 1 : 1} OF 3</div><h1>Demand a change</h1><p>Your manager is in the dugout. Tell him who comes off and who goes on.</p><div class="subrow"><div><label>Off</label><select id="subOff" size="8">${xi.map((p, k) => `<option value="${p.id}" ${p.id === subDraft.off ? 'selected' : ''}>${p.num} ${esc(p.name)} · ${posOfSlot(mine, k)}</option>`).join('')}</select></div><div class="subarrow">⇄</div><div><label>On</label><select id="subOn" size="8">${bench.map(p => `<option value="${p.id}" ${p.id === subDraft.on ? 'selected' : ''}>${esc(p.name)} · ${normPos(p.position)} · ${Math.round(p.rating)}</option>`).join('') || '<option disabled>Nobody fit on the bench</option>'}</select></div></div><p class="fineprint">The manager accepts, though he would rather pick his own team. Manager trust −1.</p><div class="actions"><button class="primary" onclick="makeSub()" ${bench.length ? '' : 'disabled'}>Make the substitution →</button><button onclick="closeModal()">Leave it</button></div></div></div>`;
}
function makeSub() {
  let l = g.world.live, offId = $('subOff').value, onId = $('subOn').value, f = g.world.fixtures.find(x => x.id === l.fixture), mine = f.home === g.clubId ? 'h' : 'a', xi = l.lineup[mine], k = xi.findIndex(p => p.id === offId), p = g.squad.find(x => x.id === onId); if (k < 0 || !p) return;
  let off = xi[k]; (l.subsOff = l.subsOff || []).push({ id: off.id, name: off.name, sur: off.sur, num: off.num, pos: posOfSlot(mine, k), r: 6, g: (l.goals || []).filter(x => x.side === mine && x.id === off.id).length, a: (l.goals || []).filter(x => x.side === mine && x.aid === off.id).length, subbedOff: true });
  let num = Number(p.number) || 12; while (xi.some(x => x.num === num)) num++; xi[k] = { id: p.id, name: p.name, sur: surname(p.name), num, subbedOn: true }; l.subs = (l.subs || 0) + 1; g.world.managerTrust = clamp(g.world.managerTrust - 1, 5, 100);
  l.commentary.unshift({ minute: l.minute, text: `Substitution for ${club().short}: ${p.name} replaces ${off.name}. The chairman's call, by all accounts.` }); l.stamina = Math.min(100, (l.stamina || 100) + 4);
  if (pitch.el) { pitch.fixture = null } closeModal(); save(); render(); if (typeof SFX !== 'undefined') SFX.card(); if (typeof liveDecorate === 'function') liveDecorate();
}
matchPage = function () {
  let h = baseRepMatchPage(), l = g.world.live; if (!l || typeof h !== 'string') return h;
  h = h.replace(/<label>Match speed <select onchange="matchSpeed\(this\.value\)">[\s\S]*?<\/select><\/label>/, `<div class="speedseg" role="group" aria-label="Match speed"><span>Speed</span>${[1, 2, 4, 8].map(n => `<button class="${l.speed === n ? 'on' : ''}" onclick="matchPace(${n})">${n}×</button>`).join('')}</div>`); let f = g.world.fixtures.find(x => x.id === l.fixture), own = f && (f.home === g.clubId || f.away === g.clubId); if (!own) return h; return h.replace('<div class="speedseg"', `<button class="subbtn" onclick="openSub()" ${subsLeft(l) <= 0 || l.minute < 1 ? 'disabled' : ''}>⇄ Substitution <small>${subsLeft(l)} left</small></button><div class="speedseg"`) };

/* ---------- the front page ---------- */
function pressQueue(story) { (g.world.press = g.world.press || []).push({ ...story, date: g.world.date }); addNews(story.head, story.sub, story.kind || 'club') }
function oppStrength(id) { return g.strengths[id] ?? team(id).strength ?? 55 }
function pressCheckMatch(m, f) {
  let mine = m.homeId === g.clubId, own = mine ? m.home : m.away, opp = mine ? m.away : m.home, oppId = mine ? m.awayId : m.homeId, oppT = g.divisions.findIndex(d => d.includes(oppId)), gap = oppStrength(oppId) - (squadRating() || 60), derby = typeof rivalryLevel === 'function' ? rivalryLevel(g.clubId, oppId) : 0, star = m.ratings && [...m.ratings].sort((a, b) => b.r - a.r)[0], scorers = (m.goals || []).filter(x => x.side === (mine ? 'h' : 'a')), hat = scorers.length ? Object.entries(scorers.reduce((o, x) => (o[x.name] = (o[x.name] || 0) + 1, o), {})).find(([, n]) => n >= 3) : null;
  let cupUpset = m.comp !== 'League' && oppT >= 0 && oppT < tier() && own > opp, shock = own > opp && (gap >= 8 || (oppT >= 0 && oppT < tier())), big = own - opp >= 4, hammer = opp - own >= 4, derbyWin = derby >= 2 && own > opp, derbyLoss = derby >= 2 && opp - own >= 2;
  if (!(cupUpset || shock || big || hammer || derbyWin || derbyLoss || hat)) return; let us = club().short, them = team(oppId).short, score = `${own}–${opp}`;
  let s = cupUpset ? { head: `${us.toUpperCase()} SHOCK ${them.toUpperCase()}`, sub: `${DB[oppT].name} side dumped out ${score} in the ${m.round || 'cup'}.`, tone: 'good' } : derbyWin ? { head: own - opp >= 3 ? 'DERBY DEMOLITION' : 'BRAGGING RIGHTS', sub: `${us} beat bitter rivals ${them} ${score}.`, tone: 'good' } : shock ? { head: 'GIANT-KILLERS', sub: `Nobody gave ${us} a chance against ${them}. They won ${score}.`, tone: 'good' } : hat ? { head: `${hat[0].split(' ').pop().toUpperCase()} HAT-TRICK HERO`, sub: `${hat[0]} scores ${hat[1]} as ${us} ${own > opp ? 'win' : 'draw'} ${score} against ${them}.`, tone: 'good' } : big ? { head: 'ROUT', sub: `${us} run riot against ${them}, ${score}.`, tone: 'good' } : derbyLoss ? { head: 'DERBY DAY DISASTER', sub: `${them} humble ${us} ${opp}–${own}. The fans want answers.`, tone: 'bad' } : { head: 'HUMILIATION', sub: `${us} torn apart ${opp}–${own} by ${them}. Questions for the board.`, tone: 'bad' };
  s.body = s.tone === 'good' ? `${star ? star.name + ' led the way with a ' + star.r.toFixed(1) + ' rating' : 'The whole team stood up'}${scorers.length ? ', with goals from ' + [...new Set(scorers.map(x => x.sur || x.name))].join(', ') : ''}. ${derby ? 'The away end sang long after the whistle.' : 'Supporters streamed out in disbelief at what they had seen.'}` : `${star ? star.name + ' (' + star.r.toFixed(1) + ') was one of few to emerge with credit' : 'Nobody emerged with credit'}. The manager faces questions, and the chairman's phone will be busy tonight.`;
  s.kind = 'league'; s.scene = 'match'; s.score = score; s.opp = oppId; s.minutes = scorers.map(x => x.min); pressQueue(s);
}
finishDeal = function (d, p) { let before = d.status, r = baseRepFinishDeal(d, p); if (before !== 'signed' && d.status === 'signed') { let t = tier(), fee = d.fee || 0, big = fee >= cfg[t].fee * 1.4 || p.rating >= cfg[t].quality + 8, record_ = fee > Math.max(0, ...g.transactions.filter(x => /^Transfer fee/.test(x.name) && x.amount !== -fee).map(x => -x.amount)); if (big) pressQueue({ head: fee ? (record_ ? 'RECORD SIGNING' : 'STATEMENT SIGNING') : 'FREE TRANSFER COUP', sub: `${club().short} land ${p.name}${fee ? ' in a ' + money(fee) + ' deal' : ' on a free'} from ${team(p.owner).name}.`, body: `The ${p.age}-year-old ${(p.position || '').toLowerCase() === 'gk' ? 'goalkeeper' : p.position === 'DEF' ? 'defender' : p.position === 'MID' ? 'midfielder' : 'forward'} arrives on ${money(d.wage)} a week until ${contractEnd(g.squad.find(x => x.id === p.id) || { contract: d.years || 3 })}. "A player of real quality," said the chairman. Season ticket sales are expected to jump.`, tone: 'good', kind: 'transfer', scene: 'signing', pid: p.id }) } return r };
closeBoardroom = function (...a) { baseRepCloseBoard(...a); pressShow() };
function gzCategory(s) { return s.kind === 'transfer' ? 'Transfer news' : s.kind === 'league' ? 'Football' : 'Club ownership' }
function gzParagraphs(body) {
  let sentences = (body || '').match(/[^.!?]+[.!?]+/g) || [body || '']; if (sentences.length <= 2) return sentences.map(x => x.trim()).filter(Boolean);
  let mid = Math.ceil(sentences.length / 2); return [sentences.slice(0, mid).join(' ').trim(), sentences.slice(mid).join(' ').trim()];
}
function gzHero(s) {
  if (s.scene === 'signing') { let ok = g.kit && g.kit.design && typeof shirtSvg === 'function'; return ok ? { html: shirtSvg(g.kit.design.home, 'press', g.kit.sponsor ? g.kit.sponsor.name : '', true, 190), caption: 'The new signing is unveiled at the club.' } : { img: 'assets/scenes/newspaper-boardroom.webp', caption: 'The new signing is unveiled at the club.' } }
  if (s.scene === 'match') return { html: `<div class="pressscore">${badge(club(), 'sm')}<b>${esc(s.score || '')}</b>${s.opp ? teamBadge(s.opp) : ''}</div>`, caption: 'Celebrations at full-time.' };
  return { img: 'assets/scenes/newspaper-boardroom.webp', caption: 'Decisions made upstairs will shape the club\u2019s future on the pitch.' };
}
function gzTicker() { return (g.world.news || []).slice(0, 4).map(n => n.title) }
function gzSideStories(excludeTitle) { return (g.world.news || []).filter(n => n.title !== excludeTitle).slice(0, 3).map(n => ({ category: n.kind === 'transfer' ? 'Transfer watch' : n.kind === 'league' ? 'Around the grounds' : 'Club news', headline: n.title, summary: (n.text || n.body || '').slice(0, 110) })) }
function gzMatch() {
  let f = typeof nextFixture === 'function' ? nextFixture() : null; if (!f) return null;
  return { label: 'Next fixture', home: team(f.home).short, away: team(f.away).short, score: 'v', detail: `${dateText(f.date, false)} · ${f.comp === 'League' ? DB[tier()].name : f.comp}` };
}
function gzBriefs() {
  let briefs = [];
  briefs.push({ category: 'Academy', headline: `${g.prospects.length} prospects on the books`, summary: `The development squad awaits its next graduate to senior football.` });
  briefs.push({ category: 'Finance desk', headline: g.cash >= 0 ? 'The books are in the black' : 'Cash flow under scrutiny', summary: `${club().name} report ${money(g.cash)} in the bank this week.` });
  briefs.push({ category: 'Manager\u2019s view', headline: `${g.manager.name} plans ahead`, summary: g.manager.caretaker ? 'A caretaker continues while the board searches for a permanent appointment.' : 'Preparation continues as the next fixture approaches.' });
  return briefs;
}
function pressShow() {
  let q = g.world && g.world.press; if (!q || !q.length || g.world.live || $('modal').innerHTML || resultOpen) return; let s = q.shift(); save();
  let hero = gzHero(s), paras = gzParagraphs(s.body), ticker = gzTicker(), stories = gzSideStories(s.head), match = gzMatch(), briefs = gzBriefs();
  $('modal').innerHTML = `<div class="overlay pressoverlay"><div class="gznews">
  <div class="gzbrand"><div class="gznote">Inside the game.<br>Behind the decisions.</div><div class="gzmark">B</div><div><div class="gzname">THE BOARDROOM</div><div class="gzsub">FOOTBALL CLUB OWNER</div></div><div class="gznote right">Football · Finance<br>People · Ambition</div></div>
  <div class="gzdateline"><span>${esc(dateText(s.date, false))}</span><span>THE BOARDROOM GAZETTE</span><span>Season ${g.season} · ${esc(DB[tier()].name)}</span></div>
  ${ticker.length ? `<div class="gzticker"><b>IN THE NEWS</b><span>${ticker.map(esc).join(' &nbsp;/&nbsp; ')}</span></div>` : ''}
  <div class="gzcontent"><article><div class="gzkicker">${esc(gzCategory(s))}</div><h1 class="${s.tone === 'bad' ? 'bad' : ''}">${esc(s.head)}</h1><p class="gzdeck">${esc(s.sub)}</p><div class="gzbyline">By the football desk</div>
  <figure class="gzhero">${hero.img ? `<img src="${esc(hero.img)}" alt="">` : hero.html}<figcaption class="gzcaption">${esc(hero.caption)}</figcaption></figure>
  <div class="gzbody">${paras.map(p => `<p>${esc(p)}</p>`).join('')}</div></article>
  <aside class="gzside"><h2 class="gzsectitle">Around the grounds</h2>${stories.map(st => `<div class="gzstory"><div class="gztag">${esc(st.category)}</div><h2>${esc(st.headline)}</h2><p>${esc(st.summary)}</p></div>`).join('') || '<p class="gzcaption">Nothing else to report today.</p>'}
  ${match ? `<section class="gzscorebox"><h2 class="gzsectitle">${esc(match.label)}</h2><div class="gzfixture"><span>${esc(match.home)}</span><b>${esc(match.score)}</b><span>${esc(match.away)}</span></div><div class="gzfxdate">${esc(match.detail)}</div></section>` : ''}</aside></div>
  <section class="gzbottom">${briefs.map(b => `<div class="gzbrief"><div class="gztag">${esc(b.category)}</div><h3>${esc(b.headline)}</h3><p>${esc(b.summary)}</p></div>`).join('')}</section>
  <div class="gzfoot"><span>The Boardroom · Football Club Owner</span><span>Season ${g.season} · ${esc(club().name)} edition</span></div>
  <div class="gzactions"><button class="primary" onclick="closeModal();pressShow()">Fold the paper →</button></div></div></div>`;
  if (typeof SFX !== 'undefined') { if (s.tone === 'good') SFX.ping() }
}

function matchPace(n) { matchSpeed(n); let root = $('content'); if (root && root.querySelectorAll) root.querySelectorAll('.speedseg button').forEach(b => b.classList.toggle('on', b.textContent === n + '×')) }
