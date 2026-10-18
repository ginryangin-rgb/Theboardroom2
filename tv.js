/* TV rights. The flat weekly broadcast cheque is replaced by a real system:
   the league sells its rights in three-season deals and the clubs vote on the package (bigger clubs carry more weight);
   the money arrives as an equal share every week, a merit payment for where you finish, and a facility fee for each match chosen for live TV
   (which can move the kick-off to a Friday night or a Monday); and the club can run its own streaming service.
   An average club still earns the same in total as before, so the economy stays balanced. What changes is who earns more, and why. */

const baseTVSettle = settleLeague, baseTVComplete = completeWorldSeason, baseTVSetup = setupWorld, baseTVWeekly = weeklyWorld, baseTVOpen = openBoardroom, baseTVDecision = matchDecision, baseTVValid = itemValid;
const DEALS = {
  premium: { name: 'Pitchside Sports', tag: 'Pay-TV exclusive', factor: 1.08, slots: 1.3, exposure: .85, bonus: false, blurb: 'The biggest cheque and the most live games, but behind a paywall: less free exposure and more moved kick-offs.' },
  balanced: { name: 'Meridian Broadcasting', tag: 'Balanced package', factor: 1, slots: 1, exposure: 1, bonus: false, blurb: 'A fair price, a fair number of live games and decent reach.' },
  streaming: { name: 'StreamNation', tag: 'Streaming-first', factor: .93, slots: .8, exposure: 1.3, bonus: true, blurb: 'A lower guarantee and fewer live games, but huge reach and a bonus if the league’s audience grows.' }
};
const SPLIT = { equal: .68, merit: .20, facility: .12 }, BASE_SLOTS = [10, 7, 4, 3], WEEKS = 47;
const CLUB_PEN = [0, .006, .013, .022], CLUB_COST = [0, .03, .06, .10], PRICES = [[4.99, 1.25, 'Budget'], [7.99, 1, 'Standard'], [11.99, .72, 'Premium']];
const KICKOFFS = { '-1': 'Friday night', '0': 'Saturday early kick-off', '1': 'Sunday 4pm', '2': 'Monday night' };
let tvPick = null, tvResult = null;

/* ---------- state ---------- */
function tv() {
  if (!g.tv) g.tv = { deal: { type: 'balanced', since: g.season, end: g.season, market: 1, factor: 1 }, history: [], picks: { season: 0, list: [] }, club: { level: 0, price: 1 }, acc: { season: g.season, equal: 0, merit: 0, facility: 0, club: 0, bonus: 0 } };
  if (g.tv.acc.season !== g.season) g.tv.acc = { season: g.season, equal: 0, merit: 0, facility: 0, club: 0, bonus: 0 };
  return g.tv;
}
const tvExposure = () => DEALS[tv().deal.type].exposure;
const yearsLeft = () => Math.max(0, tv().deal.end - g.season + 1);

/* ---------- the money (pure, so it can be tested) ---------- */
function meritFor(t, pos, n, factor) { let pool = cfg[t].income * WEEKS * SPLIT.merit * factor, w = (n - pos + 1) / ((n + 1) / 2); return Math.round(pool * w / 1000) * 1000 }
function marketFor(season, t) { return .92 + seeded(Math.abs(hash('tvm' + season + t)) + 3)() * .30 }
function dealOffers(t = tier(), season = g.season) { let m = marketFor(season, t); return Object.entries(DEALS).map(([k, d]) => ({ type: k, ...d, factor: Math.round(m * d.factor * 100) / 100, market: Math.round(m * 100) / 100 })) }
function pctRank(id, t = tier()) { let fol = g.divisions[t].map(x => ({ id: x, n: followersOf(x) })).sort((a, b) => b.n - a.n), i = fol.findIndex(x => x.id === id); return i < 0 ? .5 : 1 - i / Math.max(1, fol.length - 1) }
function tvVote(choice, t = tier()) {
  let rng = seeded(Math.abs(hash('tvv' + g.season + t)) * 7 + 1), voters = g.divisions[t].map(id => {
    let p = pctRank(id, t), w = 1 + p; if (id === g.clubId) return { id, choice, w, me: true };
    let r = rng(), pr = p > .66 ? [.5, .3, .2] : p > .33 ? [.3, .45, .25] : [.22, .4, .38]; return { id, w, choice: r < pr[0] ? 'premium' : r < pr[0] + pr[1] ? 'balanced' : 'streaming' };
  }), tally = { premium: 0, balanced: 0, streaming: 0 }; voters.forEach(v => tally[v.choice] += v.w);
  let winner = Object.keys(tally).sort((a, b) => tally[b] - tally[a] || (a === 'balanced' ? -1 : 1))[0]; return { voters, tally, winner, carried: winner === choice };
}
centralWeekly = function () { let T = tv(), amt = Math.round(cfg[tier()].income * SPLIT.equal * T.deal.factor); T.acc.equal += amt; return amt };
centralForecast = function (t) { return cfg[t].income * tv().deal.factor };
function liveSlots(t = tier()) { return Math.max(1, Math.round(BASE_SLOTS[t] * DEALS[tv().deal.type].slots * clamp(.6 + .9 * pctRank(g.clubId, t), .6, 1.6))) }
const facilityBase = (t = tier()) => cfg[t].income * WEEKS * SPLIT.facility * tv().deal.factor / BASE_SLOTS[t];

/* ---------- live games: chosen, moved and paid ---------- */
function weekday(d) { return new Date(d + 'T12:00:00Z').getUTCDay() }
function tvPicks() {
  let w = g.world, T = tv(), t = tier(); if (T.picks.season === g.season && T.picks.list.length) return; let rng = seeded(Math.abs(hash('tvp' + g.season + g.clubId)) * 5 + 2), n = liveSlots(t);
  let own = w.fixtures.filter(f => !f.played && f.comp === 'League' && (f.home === g.clubId || f.away === g.clubId) && f.date >= dayAdd(w.date, 10)), maxF = Math.max(...CLUBS.map(c => followersOf(c.id)));
  let scored = own.map(f => { let opp = f.home === g.clubId ? f.away : f.home; return { f, s: rivalryLevel(g.clubId, opp) * 3 + followersOf(opp) / maxF * 2 + rng() * 1.3, opp } }).sort((a, b) => b.s - a.s), chosen = [];
  for (let c of scored) { if (chosen.length >= n) break; if (chosen.every(x => Math.abs(daysBetween(x.f.date, c.f.date)) > 9)) chosen.push(c) }
  let cupDates = new Set(Object.values(w.cups || {}).flatMap(c => c.dates || [])), allOwn = w.fixtures.filter(f => f.home === g.clubId || f.away === g.clubId), base = facilityBase(t);
  for (let c of chosen) {
    let f = c.f, wd = weekday(f.date), opts = wd === 6 ? [[0, .3], [1, .35], [2, .2], [-1, .15]] : [[0, 1]], r = rng(), shift = 0, acc = 0; for (let [s, p] of opts) { acc += p; if (r < acc) { shift = s; break } }
    let nd = dayAdd(f.date, shift), clash = shift !== 0 && (allOwn.some(x => x !== f && Math.abs(daysBetween(x.date, nd)) <= 1) || [...cupDates].some(d => Math.abs(daysBetween(d, nd)) <= 1) || nd <= dayAdd(w.date, 1)); if (clash) { shift = 0; nd = f.date }
    let appeal = (pctRank(g.clubId, t) + pctRank(c.opp, g.divisions.findIndex(d => d.includes(c.opp)) < 0 ? t : g.divisions.findIndex(d => d.includes(c.opp)))) / 2, label = wd === 6 ? KICKOFFS[shift] : wd === 0 ? 'Sunday 4pm' : 'Midweek live';
    f.tv = { fee: Math.round(base * (.8 + .5 * appeal) / 100) * 100, slot: label, orig: f.date, paid: false }; f.date = nd;
  }
  w.fixtures.sort((a, b) => a.date.localeCompare(b.date)); T.picks = { season: g.season, list: chosen.map(c => c.f.id) };
  if (chosen.length) { let d = DEALS[T.deal.type]; addNews(`${d.name} announce their live picks`, `${chosen.length} of ${club().short}’s league games will be shown live this season.`, 'league'); msg('Live TV picks', `${d.name} will show ${chosen.length} of your league games live. Kick-offs may move to Friday night, Sunday or Monday. Each pays a facility fee. See the Broadcasting page.`, 'club') }
}
settleLeague = function (f, score) {
  let was = f.played; baseTVSettle(f, score); if (was || !f.tv || f.tv.paid) return; f.tv.paid = true; let fee = f.tv.fee, T = tv(); g.cash += fee; record('Broadcast facility fee', fee); T.acc.facility += fee; if (typeof fin === 'function') fin().season.rev.central += fee;
  if (typeof fb === 'function') fb().buzz = clamp(fb().buzz + .06 * DEALS[T.deal.type].exposure, -1, 1); msg('Live TV facility fee', `${DEALS[T.deal.type].name} paid ${money(fee)} to show the game live.`, 'club');
};
matchDecision = function (f) {
  baseTVDecision(f); if (f.played || !f.tv) return; let h = $('modal').innerHTML; if (typeof h !== 'string' || !h.includes('<div class="eyebrow">MATCHDAY')) return;
  $('modal').innerHTML = h.replace('<div class="eyebrow">MATCHDAY', `<div class="tvtag">📺 LIVE ON ${esc(DEALS[tv().deal.type].name.toUpperCase())} · ${esc(f.tv.slot)} · facility fee ${money(f.tv.fee)}</div><div class="eyebrow">MATCHDAY`);
};

/* ---------- the season ---------- */
function tvSeasonStart() {
  if (!g.world) return; let T = tv(); if (g.season > T.deal.end) { let b = bd(); if (!b.items.some(i => i.kind === 'tvdeal' && i.status === 'open')) { let it = newItem('tvdeal', { title: 'League TV rights: new deal', urgent: true, speaker: 'com', line: '', side: null, opts: [] }); msg('The league sells its TV rights', `The ${DB[tier()].name} is selling its broadcast rights for the next three seasons. The clubs vote, and your vote counts.`, 'club'); g.inbox[0].boardId = it.id; g.world.autoPause = { title: 'TV rights vote', cat: 'boardroom', date: g.world.date } } }
  else tvPicks();
}
setupWorld = function (...a) { let r = baseTVSetup(...a); tvSeasonStart(); return r };
completeWorldSeason = function () {
  let t = tier(), pos = position(), n = g.tables[t].length, T = tv(), d = T.deal; baseTVComplete();
  let amt = meritFor(t, pos, n, d.factor); g.cash += amt; record('Broadcast merit payment', amt); T.acc.merit += amt; if (typeof fin === 'function') fin().season.rev.central += amt;
  addNews('TV merit payment', `${club().short} receive ${money(amt)} in merit payments for finishing ${pos}${ord(pos)}.`, 'league'); msg('TV merit payment', `Finishing ${pos}${ord(pos)} earns ${money(amt)} from the league’s TV pool.`, 'club');
  if (DEALS[d.type].bonus) { let bonus = Math.round(cfg[t].income * WEEKS * .06 * (.4 + seeded(Math.abs(hash('tvb' + g.season)))() * 1.6) / 1000) * 1000; g.cash += bonus; record('Broadcast subscriber bonus', bonus); T.acc.bonus += bonus; if (typeof fin === 'function') fin().season.rev.central += bonus; msg('Subscriber bonus', `StreamNation’s audience grew and the league shares a ${money(bonus)} bonus.`, 'club') }
  T.last = { ...T.acc, pos, season: g.season };
};
/* club streaming runs each week alongside everything else */
function clubSubs() { let c = tv().club; if (!c.level) return 0; return Math.round(fb().online * CLUB_PEN[c.level] * PRICES[c.price][1] * (.7 + fanMood() / 200) * (tv().deal.type === 'streaming' ? 1.25 : 1)) }
function clubWeekly() { let c = tv().club, subs = clubSubs(), income = subs * PRICES[c.price][0] * 12 / 52, cost = cfg[tier()].income * CLUB_COST[c.level]; return { subs, income: Math.round(income), cost: Math.round(cost), net: Math.round(income - cost) } }
weeklyWorld = function () {
  baseTVWeekly(); if (g.ended || !g.world) return; let c = tv().club; if (!c.level) return; let w = clubWeekly(); if (typeof addLedger === 'function') { addLedger('Club streaming subscriptions', w.income); addLedger('Club streaming operations', -w.cost) } tv().acc.club += w.net;
};
function tvClubInvest() { let c = tv().club; if (c.level >= 3) return toast('The streaming service is already at its top level.'); let cost = Math.round(cfg[tier()].income * [2, 4, 8][c.level] / 1000) * 1000; if (!spend(cost)) return; c.level++; msg('Club streaming upgraded', `Your streaming service is now level ${c.level}.`, 'club'); save(); render() }
function tvPrice(i) { tv().club.price = i; save(); render() }

/* ---------- the vote ---------- */
itemValid = function (it) { if (it.kind === 'tvdeal') return it.status === 'open'; return baseTVValid(it) };
openBoardroom = function (id) { let it = id ? findItem(id) : boardPending()[0]; if (it && it.kind === 'tvdeal' && it.status === 'open') { stopClock(); return tvRoom(it.id) } return baseTVOpen(id) };
function tvRoom(itemId) { tvPick = { item: itemId, choice: null }; tvRoomView() }
function offerCard(o, cur) {
  let t = tier(), per = cfg[t].income * WEEKS * o.factor, slots = Math.max(1, Math.round(BASE_SLOTS[t] * o.slots * clamp(.6 + .9 * pctRank(g.clubId, t), .6, 1.6))), delta = Math.round((o.factor / cur - 1) * 100);
  return `<button class="tvoffer ${tvPick.choice === o.type ? 'on' : ''}" onclick="tvChoose('${o.type}')"><span class="tvtagline">${o.tag}</span><b>${o.name}</b><span class="tvmoney">${money(Math.round(per / 1000) * 1000)}<small>/season per club</small></span><span class="tvdelta ${delta >= 0 ? 'up' : 'down'}">${delta >= 0 ? '+' : ''}${delta}% on your current deal</span><ul><li>📺 About <b>${slots}</b> of your games live</li><li>🌍 Reach ${'●'.repeat(Math.round(o.exposure * 3))}${'○'.repeat(5 - Math.round(o.exposure * 3))}</li>${o.bonus ? '<li>🎁 Subscriber bonus at season end</li>' : ''}</ul><p>${o.blurb}</p></button>`;
}
function tvRoomView() {
  let t = tier(), offers = dealOffers(t), cur = tv().deal.factor;
  $('modal').innerHTML = `<div class="overlay boardoverlay"><div class="meeting tvmeeting"><div class="meetinghead"><div><div class="eyebrow">LEAGUE TV RIGHTS · ${esc(DB[t].name.toUpperCase())}</div><h1>The league sells its broadcast rights</h1><p class="negsub">A three-season package, voted on by the clubs. Bigger clubs carry more weight. Market conditions this cycle: <b>${Math.round((offers[1].market - 1) * 100) >= 0 ? '+' : ''}${Math.round((offers[1].market - 1) * 100)}%</b> on the current price.</p></div><div class="kitlaunchtop"><button class="primary" onclick="tvCast()" ${tvPick.choice ? '' : 'disabled'}>Cast the club’s vote →</button>${tvPick.choice ? '' : '<small>Choose a package first</small>'}</div></div>
  <div class="tvoffers">${offers.map(o => offerCard(o, cur)).join('')}</div><p class="fineprint">Big clubs tend to back the pay-TV package; smaller clubs lean towards balanced or streaming. You vote, the others vote, and the league adopts whichever has the most weight.</p></div></div>`;
}
function tvChoose(type) { tvPick.choice = type; tvRoomView() }
function tvCast() {
  let t = tier(), v = tvVote(tvPick.choice, t), offers = dealOffers(t), won = offers.find(o => o.type === v.winner), T = tv(), old = T.deal;
  T.history.push({ type: old.type, name: DEALS[old.type].name, from: old.since, to: g.season - 1, factor: old.factor });
  T.deal = { type: won.type, since: g.season, end: g.season + 2, market: won.market, factor: won.factor }; T.picks = { season: 0, list: [] };
  let it = findItem(tvPick.item); if (it) it.status = 'done'; g.world.autoPause = null; g.world.pauseNote = null; for (let m of g.inbox) if (m.boardId === tvPick.item) m.handled = true;
  tvPicks(); addNews(`${DB[t].name} agrees a new TV deal`, `${won.name} win the rights for three seasons. The package is worth ${money(Math.round(cfg[t].income * WEEKS * won.factor / 1000) * 1000)} per club per season.`, 'league'); save(); tvResult = { v, won, mine: tvPick.choice }; tvResultView();
  if (typeof SFX !== 'undefined') SFX.gavel();
}
function tvResultView() {
  let { v, won, mine } = tvResult, t = tier(), tot = Object.values(v.tally).reduce((a, b) => a + b, 0), col = { premium: '#e0584c', balanced: '#e6b43c', streaming: '#4fa8e8' }, ordered = [...v.voters].sort((a, b) => b.w - a.w);
  $('modal').innerHTML = `<div class="overlay boardoverlay"><div class="meeting tvmeeting"><div class="meetinghead"><div><div class="eyebrow">THE VOTE · ${esc(DB[t].name.toUpperCase())}</div><h1>${v.carried ? '✅ Your vote carried' : '🗳️ You were outvoted'}</h1><p class="negsub">${v.carried ? `The clubs backed ${won.name}, as you did.` : `You backed ${DEALS[mine].name}, but the league adopted ${won.name}.`}</p></div></div>
  <div class="tvtally">${Object.entries(DEALS).map(([k, d]) => `<div class="tvrow ${k === won.type ? 'win' : ''}"><span>${d.name}</span><div class="moodbar"><i style="width:${v.tally[k] / tot * 100}%;background:${col[k]}"></i></div><b>${Math.round(v.tally[k] / tot * 100)}%</b></div>`).join('')}</div>
  <div class="voters">${ordered.map((x, i) => `<span class="voter ${x.me ? 'me' : ''}" style="border-color:${col[x.choice]};animation-delay:${i * 45}ms" title="${esc(team(x.id).name)}: ${DEALS[x.choice].name}">${esc(team(x.id).short)}</span>`).join('')}</div>
  <div class="effects"><span>💷 <b>${money(Math.round(cfg[t].income * WEEKS * won.factor / 1000) * 1000)}</b> a season per club</span><span>📺 About <b>${liveSlots(t)}</b> of your games live each season</span><span>🌍 Reach <b>${'●'.repeat(Math.round(won.exposure * 3))}${'○'.repeat(5 - Math.round(won.exposure * 3))}</b></span><span>📅 Runs until the end of season <b>${g.season + 2}</b></span></div>
  <div class="actions"><button class="primary" onclick="closeBoardroom()">Close the meeting →</button></div></div></div>`;
}

/* ---------- the page ---------- */
function tvExpected() {
  let t = tier(), T = tv(), d = T.deal, n = g.tables[t].length, pos = position(), picks = g.world.fixtures.filter(f => f.tv), cw = clubWeekly();
  return { equal: Math.round(cfg[t].income * SPLIT.equal * d.factor * WEEKS), merit: meritFor(t, pos, n, d.factor), facility: picks.reduce((s, f) => s + f.tv.fee, 0), club: cw.net * WEEKS, total: Math.round(cfg[t].income * WEEKS * d.factor) };
}
function tvPage() {
  let T = tv(), d = T.deal, D = DEALS[d.type], t = tier(), n = g.tables[t].length, pos = position(), ex = tvExpected(), acc = T.acc, picks = g.world.fixtures.filter(f => f.tv).sort((a, b) => a.date.localeCompare(b.date)), cw = clubWeekly(), left = yearsLeft();
  let row = (label, paid, exp, note, cls = '') => `<div class="tvbreak ${cls}"><div><b>${label}</b><small>${note}</small></div><div class="tvbar"><i style="width:${exp > 0 ? clamp(paid / exp * 100, 0, 100) : 0}%"></i></div><div class="tvnums"><b>${money(paid)}</b><small>of about ${money(exp)}</small></div></div>`;
  let ladder = [1, Math.max(2, Math.round(n * .25)), Math.round(n * .5), Math.round(n * .75), n].map(p => `<div class="ladrow ${p === pos ? 'me' : ''}"><span>${p}${ord(p)}</span><div class="tvbar"><i style="width:${meritFor(t, p, n, d.factor) / meritFor(t, 1, n, d.factor) * 100}%"></i></div><b>${money(meritFor(t, p, n, d.factor))}</b></div>`).join('');
  let games = picks.length ? picks.map(f => { let opp = f.home === g.clubId ? f.away : f.home; return `<div class="tvgame ${f.played ? 'done' : ''}">${teamBadge(opp)}<div><b>${f.home === g.clubId ? '' : '@ '}${esc(team(opp).short)}${rivalryLevel(g.clubId, opp) ? ' 🔥' : ''}</b><small>${dateText(f.date, false)} · ${esc(f.tv.slot)}</small></div><span class="tvfee">${f.tv.paid ? '✓ ' : ''}${money(f.tv.fee)}</span></div>` }).join('') : '<p class="emptynote">No live games picked yet this season.</p>';
  let cl = T.club;
  return `<div class="card tvhero"><div class="tvhl"><span class="eyebrow">${esc(D.tag.toUpperCase())}</span><h2>${esc(D.name)}</h2><p>${D.blurb}</p><div class="chips"><span>${left} season${left === 1 ? '' : 's'} left</span><span>Reach ${'●'.repeat(Math.round(D.exposure * 3))}${'○'.repeat(5 - Math.round(D.exposure * 3))}</span><span>${Math.round((d.factor - 1) * 100) >= 0 ? '+' : ''}${Math.round((d.factor - 1) * 100)}% vs the old flat cheque</span></div></div><div class="tvhr"><small>EXPECTED THIS SEASON</small><b>${money(ex.equal + ex.merit + ex.facility + Math.max(0, ex.club))}</b><em>${left > 0 ? 'The league renegotiates after season ' + d.end : 'A new deal is voted on at the start of next season'}</em></div></div>
  <div class="card"><div class="cardhead"><h2>Where the money comes from</h2><span class="eyebrow">THIS SEASON</span></div><div class="pad">${row('Equal share', acc.equal, ex.equal, 'Paid every week to every club in the division')}${row('Merit payment', acc.merit, ex.merit, `Paid at season end. At ${pos}${ord(pos)} today`)}${row('Live TV facility fees', acc.facility, ex.facility, `${picks.length} game${picks.length === 1 ? '' : 's'} chosen for live coverage`)}${cl.level ? row('Club streaming (net)', acc.club, Math.max(1, ex.club), `${cw.subs.toLocaleString()} subscribers`) : ''}${D.bonus ? row('Subscriber bonus', acc.bonus, Math.round(cfg[t].income * WEEKS * .07), 'Paid at season end if the league’s audience grows') : ''}</div></div>
  <div class="tvtwo"><div class="card"><div class="cardhead"><h2>What each place is worth</h2><span class="eyebrow">MERIT PAYMENT</span></div><div class="pad">${ladder}<p class="fineprint">Every place climbed is worth about <b>${money(Math.round((meritFor(t, 1, n, d.factor) - meritFor(t, n, n, d.factor)) / (n - 1) / 1000) * 1000)}</b>.</p></div></div>
  <div class="card"><div class="cardhead"><h2>Live on TV</h2><span class="eyebrow">${picks.length} GAMES</span></div><div class="pad tvgames">${games}</div></div></div>
  <div class="card"><div class="cardhead"><h2>Your own streaming service</h2><span class="eyebrow">CLUB TV</span></div><div class="pad"><p class="fineprint">Friendlies, cup ties and highlights, sold direct to your followers. It pays when the following is big enough, and not before. ${T.deal.type === 'streaming' ? 'StreamNation’s platform lifts uptake by a quarter.' : ''}</p><div class="pips big">${[0, 1, 2].map(i => `<i class="${i < cl.level ? 'on' : ''}"></i>`).join('')}<span>${['Not launched', 'Level 1', 'Level 2', 'Level 3'][cl.level]}</span></div>${cl.level ? `<div class="tvclub"><div><small>SUBSCRIBERS</small><b>${cw.subs.toLocaleString()}</b></div><div><small>REVENUE / WEEK</small><b>${money(cw.income)}</b></div><div><small>RUNNING COST / WEEK</small><b>${money(cw.cost)}</b></div><div><small>NET / WEEK</small><b class="${cw.net >= 0 ? 'positive' : 'negative'}">${cw.net >= 0 ? '+' : ''}${money(cw.net)}</b></div></div><div class="chips pricechips"><span>Monthly price</span>${PRICES.map((p, i) => `<button class="${cl.price === i ? 'on' : ''}" onclick="tvPrice(${i})">£${p[0]} · ${p[2]}</button>`).join('')}</div>` : ''}${cl.level < 3 ? `<button class="primary" onclick="tvClubInvest()">${cl.level ? 'Upgrade' : 'Launch'} · ${money(Math.round(cfg[tier()].income * [2, 4, 8][cl.level] / 1000) * 1000)}</button>` : '<button disabled>Fully upgraded</button>'}</div></div>
  ${T.history.length ? `<div class="card"><div class="cardhead"><h2>Past deals</h2></div><div class="pad"><table><tr><th>Deal</th><th>Seasons</th><th>vs old flat cheque</th></tr>${T.history.slice().reverse().map(h => `<tr><td>${esc(h.name)}</td><td>${h.from}–${h.to}</td><td>${Math.round((h.factor - 1) * 100) >= 0 ? '+' : ''}${Math.round((h.factor - 1) * 100)}%</td></tr>`).join('')}</table></div></div>` : ''}`;
}
icons.Broadcasting = '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M8 3l4 3 4-3"/><path d="M8 21h8"/>';
NAV_ORDER.splice(NAV_ORDER.indexOf('Commercial') + 1, 0, 'Broadcasting'); PAGE_BUILDERS.Broadcasting = tvPage; MY_PAGES.push('Broadcasting');
MY_LABELS.Broadcasting = ['THE MONEY ON THE SCREEN', 'TV & broadcasting', 'The league’s rights deal, your merit payments, live games and your own streaming service.'];
