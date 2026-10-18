/* The fan base. How many people follow the club worldwide, who they are, whether they are happy, and how to make the club bigger.
   Regular supporters (g.fans) still fill the ground; followers are the wider audience that buys shirts, streams matches and joins as members.
   Five groups of supporters want different things, so a kit, a ticket price or a sponsor never pleases everyone. Derbies matter more than other games. */

const baseFansWeekly = weeklyWorld, baseFansSettle = settleLeague, baseFansComplete = completeWorldSeason, baseFansDecision = matchDecision;
const LEVELS = [['Local club', 0], ['Regional favourite', 60000], ['National name', 250000], ['Continental draw', 1200000], ['Global brand', 6000000]];
const SEGMENTS = {
  loyal: { name: 'Loyal locals', icon: '🏠', share: .30, wants: 'Tradition, fair prices, and a club that looks after its town.' },
  casual: { name: 'Casual fans', icon: '🎟️', share: .22, wants: 'Winning football and a good day out.' },
  families: { name: 'Families & juniors', icon: '🧒', share: .14, wants: 'Affordable tickets, safe sponsors and things for the kids.' },
  young: { name: 'Young followers', icon: '📱', share: .18, wants: 'Bold kits, stars to follow and a club that is online.' },
  overseas: { name: 'Overseas fans', icon: '🌍', share: .16, wants: 'Success, stars and a club they can follow from abroad.' }
};
const PROG = {
  community: { name: 'Community foundation', icon: '🤝', desc: 'Schools, food banks and coaching across your town.', effect: 'Loyal locals and families warm to the club; the regular crowd grows slowly.' },
  juniors: { name: 'Junior supporters’ scheme', icon: '🧒', desc: 'Cheap junior tickets, a kids’ zone and school visits.', effect: 'Grows the regular crowd for years to come and lifts families.' },
  digital: { name: 'Digital & social media', icon: '📱', desc: 'A content team, streaming and a membership app.', effect: 'Followers worldwide grow faster and membership income rises.' },
  fanzone: { name: 'Fan zone & matchday experience', icon: '🎶', desc: 'A pre-match fan park, music, food and a better atmosphere.', effect: 'Casual fans and families enjoy the day, and the atmosphere lifts.' }
};
const FAIR_TICKET = [38, 27, 22, 18];

/* ---------- state ---------- */
function fbBase(id) { let c = club(id); return Math.round(c.capacity * [40, 22, 12, 7][c.league] * (BRAND[id] || 1) * (.85 + (Math.abs(hash('fb' + id)) % 30) / 100)) }
function fb() {
  if (!g.fb) g.fb = { online: fbBase(g.clubId), base: fbBase(g.clubId), prog: { community: 0, juniors: 0, digital: 0, fanzone: 0 }, buzz: 0, derby: {}, hist: [] };
  return g.fb;
}
const progCost = (lvl) => Math.round(cfg[tier()].income * [2, 4.5, 9][lvl] / 1000) * 1000;
function fbInvest(k) {
  let f = fb(), lvl = f.prog[k]; if (lvl >= 3) return toast('That programme is already at its top level.'); if (!spend(progCost(lvl))) return;
  f.prog[k]++; msg(PROG[k].name + ' expanded', `The club has invested in its ${PROG[k].name.toLowerCase()}. ${PROG[k].effect}`, 'club'); save(); render();
}
function fbLevel(n) { let i = 0; LEVELS.forEach((l, k) => { if (n >= l[1]) i = k }); return { i, name: LEVELS[i][0], next: LEVELS[i + 1] || null, from: LEVELS[i][1] } }
function followersOf(id) { return id === g.clubId ? fb().online : Math.round(fbBase(id) * (.8 + (g.strengths[id] ?? 55) / 150)) }
function fbRank() {
  let mine = fb().online, all = CLUBS.map(c => c.id).filter(id => id !== g.clubId).map(followersOf), t = tier(), div = g.divisions[t].filter(id => id !== g.clubId).map(followersOf);
  return { national: all.filter(n => n > mine).length + 1, nationalOf: CLUBS.length, division: div.filter(n => n > mine).length + 1, divisionOf: g.divisions[t].length };
}

/* ---------- who the supporters are, and whether they are happy ---------- */
function recentForm() { let f = (myrow().form || []).slice(-5); return f.length ? f.reduce((s, c) => s + (c === 'W' ? 3 : c === 'D' ? 1 : 0), 0) / (f.length * 3) : .5 }
function starCount() { return g.squad.filter(p => p.rating >= cfg[tier()].quality + 9).length }
function segmentMoods() {
  let f = fb(), p = f.prog, fair = FAIR_TICKET[tier()], price = clamp(100 - (g.ticket / fair - 1) * 110, 15, 100), form = recentForm() * 100, kit = g.kit && g.kit.reaction ? g.kit.reaction.like : 55, eth = (g.kit && g.kit.sponsor && g.kit.sponsor.ethics) || 0, stars = Math.min(starCount(), 4), aff = g.aff || {};
  let m = {
    loyal: .55 * g.trust + .2 * price + .15 * kit + .1 * form + 5 * p.community + (aff.feeder ? 3 : 0) + eth * 5,
    casual: .3 * form + .25 * price + .2 * g.trust + .1 * kit + 6 * p.fanzone + 8,
    families: .3 * price + .3 * g.trust + .1 * kit + 8 * p.juniors + 5 * p.community + 4 * p.fanzone + eth * 6 + 14,
    young: .3 * kit + .25 * form + .15 * g.trust + 9 * p.digital + stars * 5 + 14,
    overseas: .3 * form + 8 * p.digital + stars * 6 + (aff.partner ? 12 : 0) + 24
  };
  for (let k in m) m[k] = Math.round(clamp(m[k], 5, 99)); return m;
}
function segmentShares() {
  let f = fb(), aff = g.aff || {}, o = SEGMENTS.overseas.share + f.prog.digital * .02 + (aff.partner ? .03 : 0), s = { ...Object.fromEntries(Object.entries(SEGMENTS).map(([k, v]) => [k, v.share])), overseas: o };
  s.loyal = SEGMENTS.loyal.share - (o - SEGMENTS.overseas.share); return s;
}
function fanMood() { let m = segmentMoods(), s = segmentShares(); return Math.round(Object.keys(m).reduce((t, k) => t + m[k] * s[k], 0)) }
const moodWord = n => n >= 82 ? 'Ecstatic' : n >= 70 ? 'Happy' : n >= 58 ? 'Content' : n >= 45 ? 'Restless' : n >= 30 ? 'Angry' : 'Furious';
const moodFace = n => n >= 82 ? '🤩' : n >= 70 ? '😀' : n >= 58 ? '🙂' : n >= 45 ? '😕' : n >= 30 ? '😠' : '🤬';

/* ---------- the weekly tick ---------- */
weeklyWorld = function () {
  baseFansWeekly(); if (g.ended || !g.world) return; let f = fb(), t = tier(), n = g.tables[t].length, r = myrow(), succ = r.p ? (1 - (position() - 1) / (n - 1)) - .5 : 0, stars = Math.min(starCount(), 4), aff = g.aff || {};
  let rate = .0006 + .0014 * succ + f.prog.digital * .0006 + f.prog.fanzone * .0002 + f.buzz * .0009 + stars * .0003 + (aff.partner ? .0006 : 0), noise = (seeded(Math.abs(hash(g.season + ':' + g.world.days + 'fb')))() - .5) * .0006;
  if (typeof tvExposure === 'function' && rate > 0) rate *= tvExposure();
  f.online = Math.max(1000, Math.round(f.online * (1 + rate + noise))); f.buzz *= .93;
  let mood = fanMood(); g.fans = Math.round(clamp(g.fans * (1 + f.prog.community * .0002 + f.prog.juniors * .0003 + f.prog.fanzone * .0001 + (mood - 60) / 100 * .0005), 500, g.capacity * 1.5));
  if (typeof addLedger === 'function') addLedger('Membership & digital income', f.online * (1.2 + .9 * f.prog.digital) / 52 * (mood / 70));
  if (typeof kitWeek === 'function') kitWeek();
};
completeWorldSeason = function () { let f = fb(); baseFansComplete(); f.hist.push({ season: g.season, online: f.online, fans: g.fans, mood: fanMood() }); f.hist = f.hist.slice(-12) };

/* ---------- derbies ---------- */
function derbyOf(f) { let opp = f.home === g.clubId ? f.away : f.home; return { opp, level: rivalryLevel(g.clubId, opp) } }
settleLeague = function (f, score) {
  let was = f.played, own = f.home === g.clubId || f.away === g.clubId; baseFansSettle(f, score); if (was || !own) return;
  let { opp, level } = derbyOf(f); if (!level) return; let mine = f.home === g.clubId ? score[0] : score[1], theirs = f.home === g.clubId ? score[1] : score[0], res = mine > theirs ? 'W' : mine === theirs ? 'D' : 'L', d = fb().derby[opp] || (fb().derby[opp] = [0, 0, 0]);
  d[res === 'W' ? 0 : res === 'D' ? 1 : 2]++; g.trust = clamp(g.trust + (res === 'W' ? 1.8 : res === 'L' ? -2.2 : 0) * level, 5, 100); fb().buzz = clamp(fb().buzz + (res === 'W' ? .12 : res === 'L' ? -.1 : 0) * level, -1, 1);
  if (f.home === g.clubId) { let extra = Math.round(g.fans * .08 * level * g.ticket); g.cash += extra; record('Derby day receipts', extra); msg('Derby day receipts', `A full house and a big away following: ${money(extra)} extra.`, 'club') }
  addNews(res === 'W' ? `Derby delight for ${club().short}` : res === 'L' ? `Derby heartbreak for ${club().short}` : `Honours even in the ${DERBY_NAME(g.clubId, opp).toLowerCase()}`, `${team(f.home).name} ${score[0]}–${score[1]} ${team(f.away).name}. ${res === 'W' ? 'Bragging rights are yours.' : res === 'L' ? 'The rivals will enjoy this one.' : 'Nobody can claim the bragging rights.'}`, 'league');
};
matchDecision = function (f) {
  baseFansDecision(f); if (f.played) return; let { opp, level } = derbyOf(f); if (!level) return; let h = $('modal').innerHTML;
  if (typeof h === 'string' && h.includes('<div class="eyebrow">MATCHDAY')) $('modal').innerHTML = h.replace('<div class="eyebrow">MATCHDAY', `<div class="derbytag l${level}">🔥 ${DERBY_NAME(g.clubId, opp)} · ${esc(team(opp).short)}</div><div class="eyebrow">MATCHDAY`);
};

/* ---------- the page ---------- */
const nf = n => n >= 1e6 ? (n / 1e6).toFixed(n >= 1e7 ? 1 : 2) + 'm' : n >= 1e4 ? Math.round(n / 1000) + 'k' : n.toLocaleString();
function moodBar(n) { return `<div class="moodbar"><i style="width:${n}%" class="${n >= 70 ? 'good' : n >= 45 ? 'mid' : 'bad'}"></i></div>` }
function progCard(k) {
  let f = fb(), P = PROG[k], lvl = f.prog[k], cost = lvl < 3 ? progCost(lvl) : 0;
  return `<div class="progcard"><div class="progtop"><span class="progicon">${P.icon}</span><div><h3>${P.name}</h3><p>${P.desc}</p></div></div><div class="pips">${[0, 1, 2].map(i => `<i class="${i < lvl ? 'on' : ''}"></i>`).join('')}<span>${['Not started', 'Level 1', 'Level 2', 'Maxed'][lvl]}</span></div><p class="fineprint">${P.effect}</p>${lvl < 3 ? `<button class="primary" onclick="fbInvest('${k}')" ${g.cash < cost ? 'disabled' : ''}>Invest ${money(cost)}</button>` : '<button disabled>Fully invested</button>'}</div>`;
}
function fansPage() {
  let f = fb(), lv = fbLevel(f.online), rk = fbRank(), mood = fanMood(), seg = segmentMoods(), sh = segmentShares(), toNext = lv.next ? clamp((f.online - lv.from) / (lv.next[1] - lv.from), 0, 1) : 1, att = g.last && g.last.attendance, weakest = Object.entries(seg).sort((a, b) => a[1] - b[1])[0];
  let kitCard = g.kit && g.kit.design ? `<div class="card"><div class="cardhead"><h2>This season’s kit</h2><span class="eyebrow">${g.season ? 'SEASON ' + g.kit.season : ''}</span></div><div class="pad kitrow">${typeof shirtSvg === 'function' ? shirtSvg(g.kit.design.home, 'fans-h', g.kit.sponsor ? g.kit.sponsor.name : '') + shirtSvg(g.kit.design.away, 'fans-a', g.kit.sponsor ? g.kit.sponsor.name : '') : ''}<div><div class="bigpct">${g.kit.reaction ? g.kit.reaction.like : '–'}<small>% liked it</small></div><p>${g.kit.reaction ? esc(g.kit.reaction.verdict) : ''}</p>${g.kit.sponsor ? `<p class="fineprint">Shirt sponsor: <b>${esc(g.kit.sponsor.name)}</b> (${esc(g.kit.sponsor.sector)})</p>` : ''}${g.kit.sales ? `<p class="fineprint">Kit sales so far: ${money(g.kit.sales.total - g.kit.sales.left)} of about ${money(g.kit.sales.total)}</p>` : ''}</div></div></div>` : '';
  return `  <div class="card fanhero"><div class="fhmain"><span class="eyebrow">FOLLOWERS WORLDWIDE</span><div class="fhnum" data-count="${f.online}">${nf(f.online)}</div><div class="fhlevel"><b>${lv.name}</b>${lv.next ? `<span>${nf(Math.max(0, lv.next[1] - f.online))} to ${lv.next[0]}</span>` : '<span>The top of the ladder</span>'}</div><div class="ladder"><i style="width:${Math.round(toNext * 100)}%"></i></div></div>
  <div class="fhstats"><div><b>#${rk.division}</b><small>of ${rk.divisionOf} in your division</small></div><div><b>#${rk.national}</b><small>of ${rk.nationalOf} in the country</small></div><div><b>${g.fans.toLocaleString()}</b><small>regular supporters</small></div><div><b>${Math.round(g.fans * .55).toLocaleString()}</b><small>season-ticket holders</small></div></div></div>
  <div class="card"><div class="cardhead"><h2>Fan mood</h2><span class="moodbig">${moodFace(mood)} ${moodWord(mood)} <b>${mood}</b></span></div><div class="pad"><div class="seggrid">${Object.entries(SEGMENTS).map(([k, s]) => `<div class="segcard ${k === weakest[0] && seg[k] < 60 ? 'weak' : ''}"><div class="segtop"><span>${s.icon}</span><b>${s.name}</b><em>${Math.round(sh[k] * 100)}% of the fanbase</em></div><div class="segmood">${moodFace(seg[k])} <b>${seg[k]}</b> <small>${moodWord(seg[k])}</small></div>${moodBar(seg[k])}<p class="fineprint">${s.wants}</p></div>`).join('')}</div>${seg[weakest[0]] < 60 ? `<p class="callout">Your <b>${SEGMENTS[weakest[0]].name.toLowerCase()}</b> are the least happy. ${SEGMENTS[weakest[0]].wants}</p>` : ''}</div></div>
  <div class="card"><div class="cardhead"><h2>Make the club bigger</h2><span class="eyebrow">INVEST IN THE FAN BASE</span></div><div class="pad proggrid">${Object.keys(PROG).map(progCard).join('')}</div></div>${kitCard}
  ${f.hist.length ? `<div class="card"><div class="cardhead"><h2>Growth by season</h2></div><div class="pad"><table><tr><th>Season</th><th>Followers</th><th>Regulars</th><th>Mood</th></tr>${f.hist.slice().reverse().map(h => `<tr><td>${h.season}</td><td>${nf(h.online)}</td><td>${h.fans.toLocaleString()}</td><td>${moodFace(h.mood)} ${h.mood}</td></tr>`).join('')}</table></div></div>` : ''}`;
}
icons.Fans = '<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.2c3 .3 5 2.3 5 5.8"/>';
NAV_ORDER.splice(NAV_ORDER.indexOf('Stadium') + 1, 0, 'Fans'); PAGE_BUILDERS.Fans = fansPage; MY_PAGES.push('Fans'); MY_LABELS.Fans = ['THE SUPPORTERS', 'Fans', 'Every supporter is a customer, a voice and a reason to win. Make the club bigger and keep them on side.'];
