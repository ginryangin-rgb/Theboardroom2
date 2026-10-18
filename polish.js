/* Playtest polish. Everything here came from Ryan's first proper play-through: your own name and photo as chairman, square face
   frames in club colours (so a photo from another club still reads as yours), real photos in the player profile, second clubs
   that cost and earn according to who they are, Continue landing you on the inbox when something needs you and on the overview
   after a match with the takings, prize money you can see, a Finance Director who actually advises, and players you can click
   wherever their name appears. */

/* ---------- the owner: name and photo ---------- */
function owner() { return g.owner || (g.owner = { name: 'You', photo: null }) }
function ownerName() { return (g && g.owner && g.owner.name) || 'You' }
function ownerFigure(uid, size) { let o = g && g.owner; if (o && o.photo) return `<span class="person front photo"><img src="${o.photo}" alt=""></span>`; if (!window.__CLUBS__) return `<span class="person front photo"><img src="assets/portraits/chairman.jpg" alt=""></span>`; return personFront(personLook('The Chairman'), uid) }
function ownerPhotoPick(ev) {
  let file = ev.target.files && ev.target.files[0]; if (!file) return; let img = new Image(), url = URL.createObjectURL(file);
  img.onload = () => { let c = document.createElement('canvas'), s = 256, side = Math.min(img.width, img.height), sx = (img.width - side) / 2, sy = Math.max(0, (img.height - side) / 2 - img.height * .08); c.width = c.height = s; c.getContext('2d').drawImage(img, sx, sy, side, side, 0, 0, s, s); owner().photo = c.toDataURL('image/jpeg', .82); URL.revokeObjectURL(url); save(); toast('Photo saved. You are now on the wall.'); render(); if ($('modal').innerHTML.includes('ownerform')) ownerForm() };
  img.src = url;
}
function ownerSetName(v) { owner().name = (v || '').trim().slice(0, 40) || 'You'; save() }
function ownerForm() {
  let o = owner();
  $('modal').innerHTML = `<div class="overlay"><div class="modal ownerform"><div class="topline"><span class="eyebrow">THE CHAIRMAN</span><button class="textbutton" onclick="closeModal();render()">Done ×</button></div><h1>Your profile</h1><p>Your name and photo appear in the boardroom, at the negotiating table and at press conferences.</p>
  <div class="ownerrow"><div class="ownerpic">${ownerFigure('of')}</div><div class="ownerfields"><label>Name<input value="${esc(o.name)}" maxlength="40" onchange="ownerSetName(this.value)"></label><label class="filebtn">Choose a photo<input type="file" accept="image/*" onchange="ownerPhotoPick(event)"></label>${o.photo ? '<button class="ghost" onclick="owner().photo=null;save();ownerForm()">Remove photo</button>' : '<small>Square it up by picking a head-and-shoulders shot; it is cropped to a square automatically.</small>'}</div></div></div></div>`;
}

/* ---------- square face frames in club colours ---------- */
function kitColours(id) { let c = club(id) || club(); let k = id === g.clubId && g.kit && g.kit.design ? g.kit.design.home : null; return k ? [k.c1, k.c2] : [c.colour || '#1b4fa8', '#f4f5ef'] }
const basePlPortrait = portrait;
portrait = function (p) { let h = basePlPortrait(p); if (!/class="portrait photo/.test(h)) return h; let [c1, c2] = kitColours(g.clubId); return h.replace('class="portrait photo', `style="--kc1:${c1};--kc2:${c2}" class="portrait photo square`).replace('<span class="ptnum">', `<span class="ptbadge">${badge(club(), 'xs')}</span><span class="ptnum">`) };
function facePhoto(p, size = 110, clubId = g.clubId) {
  if (!window.__CLUBS__) { let src = p.photo ? p.photo : (typeof assignPortrait === 'function' && clubId === g.clubId ? (assignPortrait(p) ? 'assets/portraits/' + assignPortrait(p) + '.jpg' : null) : null); if (src) { let [c1, c2] = kitColours(clubId); return `<span class="facesq" style="width:${size}px;height:${size}px;--kc1:${c1};--kc2:${c2}"><img src="${src}" alt="">${badge(club(clubId), 'xs')}</span>` } }
  return typeof playerFace === 'function' ? playerFace(p, 'fp' + Math.abs(hash(p.id)), Math.round(size * .8)) : '';
}

/* ---------- profiles for anyone, from anywhere ---------- */
const basePlProfile = playerProfile;
playerProfile = function (id, clubId) {
  let own = g.squad.find(x => x.id === id);
  if (own || !clubId) { basePlProfile(id); let h = $('modal').innerHTML; if (typeof h === 'string' && own) { h = h.replace(/<div class="profhead">[\s\S]*?<div>/, m => m.replace(/^<div class="profhead">[\s\S]*?(?=<div>)/, `<div class="profhead">${facePhoto(own, 120)}`)); $('modal').innerHTML = h } return }
  let sq = typeof squadOf === 'function' ? squadOf(clubId) : [], p = sq.find(x => x.id === id); if (!p) return; let a = typeof attrs === 'function' ? attrs({ ...p, rating: p.rating || 60, age: p.age || 26, position: p.position || 'MID' }) : {}, pos = normPos(p.position), keys = pos === 'GK' ? ATTRS.gk : ATTRS.out, st = g.world.ps && ps().p[p.id];
  $('modal').innerHTML = `<div class="overlay"><div class="modal profile"><div class="topline"><span class="eyebrow">PLAYER PROFILE · ${esc(team(clubId).name).toUpperCase()}</span><button class="textbutton" onclick="closeModal()">Close ×</button></div><div class="profhead">${facePhoto(p, 120, clubId)}<div><h1>${esc(p.name)}</h1><p>${esc(p.position)} · ${p.age} years · ${esc(p.nationality || '')}</p><div class="chips"><span>Rating ${Math.round(p.rating)}</span><span>Value ${compact(playerValue(p))}</span>${st ? `<span>${st.g} goals · ${st.a} assists · ${st.ap} apps</span>` : ''}</div></div></div><div class="attrgrid">${keys.map(k => attrBar(k, a[k])).join('')}</div><div class="actions"><button class="primary" onclick="closeModal();go('Recruitment')">Ask the scouts</button></div></div></div>`;
};
const basePlLbRow = lbRow;
lbRow = function (p, i, key, label, max) { return basePlLbRow(p, i, key, label, max).replace('<div class="lbname">', `<div class="lbname plink" onclick="playerProfile('${p.id}','${p.c}')">`) };

/* ---------- second clubs: priced and performing like real clubs ---------- */
function secondProfile(id) { let t = g.divisions.findIndex(d => d.includes(id)), st = standings(t), pos = st.findIndex(r => r.id === id) + 1, n = st.length, c = club(id), size = clamp(((c.strength || 55) - 40) / 40, .3, 1.6); return { t, pos, n, size } }
secondClubOptions = function () { let own = tier(), list = []; g.divisions.forEach((ids, t) => { if (t === own || t < 1) return; for (let id of ids) { let { pos, n, size } = secondProfile(id); list.push({ id, t, price: Math.round(cfg[t].cash * (.7 + size * .9) * (1.25 - .5 * (pos - 1) / (n - 1)) / 1000) * 1000 }) } }); return list.sort((a, b) => a.t - b.t || b.price - a.price) };
secondValue = function () { let s = fin().second; if (!s) return 0; let { t, pos, n, size } = secondProfile(s.clubId); return Math.round(cfg[t].cash * (.7 + size * .9) * (1.25 - .5 * (pos - 1) / (n - 1)) * (1 + .04 * (g.season - s.since)) * (1 + .03 * (s.bonus || 0)) / 1000) * 1000 };
secondWeekly = function () { let s = fin().second; if (!s) return 0; let { t, pos, n, size } = secondProfile(s.clubId); let weeks = (g.season - s.since) * 47 + (g.world ? Math.floor((g.world.days || 0) / 7) : 0), settling = weeks - (s.boughtWeek || 0) < 10 ? -cfg[t].income * .12 : 0, base = cfg[t].income * (.13 - .26 * ((pos - 1) / (n - 1))) * (.6 + size * .5), noise = (seeded(Math.abs(hash(s.clubId + ':' + weeks)))() - .5) * cfg[t].income * .08; return Math.round(base + settling + noise) };
const basePlBuySecond = buySecond;
buySecond = function (id) { let r = basePlBuySecond(id); if (r && r.ok) { let s = fin().second; s.boughtWeek = (g.season - s.since) * 47 + Math.floor((g.world.days || 0) / 7); msg('Taking over ' + club(id).name, 'The first ten weeks carry integration costs: new systems, redundancies, a new board. Expect losses before the numbers turn.', 'finance') } return r };

/* ---------- a cash crisis is a decision to make, not a silent game-over ---------- */
function crisisQueued() { return (bd().items || []).some(it => it.kind === 'scenario' && it.cashCrisis && it.status === 'open') }
function cashCrisisCheck() {
  let floor = cfg[tier()].cash; if (g.cash >= -floor * .22) { if (g.cash >= -floor * .05) g.crisisWarned = false; return }
  if (g.crisisWarned || crisisQueued()) return; g.crisisWarned = true;
  let loanAmt = Math.min(typeof bankCapacity === 'function' ? bankCapacity() : floor, Math.round(-g.cash * 1.3 / 10000) * 10000), stakes = typeof investorOffers === 'function' ? investorOffers() : [], stake = stakes[0];
  let opts = [{ label: 'Take an emergency loan', sub: loanAmt ? money(loanAmt) + ' from the bank' : 'No further borrowing is available', backer: 'fd', act: loanAmt ? { t: 'loan', amount: loanAmt } : null }];
  if (stake) opts.push({ label: 'Bring in an investor', sub: `Sell a ${stake.stake}% stake for ${money(stake.price)}`, backer: 'vc', act: { t: 'stake', stake: stake.stake } });
  opts.push({ label: 'Cut costs and ride it out', sub: 'The board tightens spending across the club', backer: 'fan', act: { t: 'risk', key: 'cash' } });
  if (!loanAmt && !stake) opts.splice(0, 1);
  let it = newItem('scenario', { cashCrisis: true, title: 'Cash crisis', speaker: 'fd', line: `We are ${money(-g.cash)} overdrawn. If this gets much worse the bank will put the club into administration. We need to act now.`, side: { who: 'vc', line: 'This is the board\u2019s job as much as yours. Decide, and decide today.' }, opts });
  g.world.autoPause = { title: it.title, cat: 'boardroom', date: g.world.date };
}
const baseCrisisWeekly = weeklyWorld; weeklyWorld = function () { baseCrisisWeekly(); if (g.ended || !g.world || !g.world.date || typeof rollingOver !== 'undefined' && rollingOver) return; try { cashCrisisCheck() } catch (e) { } };

/* ---------- second clubs: the ownership clash is a decision, not a silent sale ---------- */
function secondClashQueue() {
  let f = fin(); if (!f.second || !f.secondClash) return; if ((bd().items || []).some(it => it.kind === 'scenario' && it.secondClash && it.status === 'open')) return;
  if (f.secondGrace && g.season <= f.secondGrace) return;
  let name = club(f.secondClash.clubId).name, it = newItem('scenario', { secondClash: true, title: 'A conflict of ownership', speaker: 'fd', line: `${name} now play in the same division as us this season. League rules do not allow one owner to control two clubs competing against each other.`, side: { who: 'vc', line: 'The league will not look the other way on this one.' }, opts: [{ label: 'Sell to comply', sub: 'Worth about ' + money(secondValue()), backer: 'fd', act: { t: 'secondsell' } }, { label: 'Appeal to the league', sub: 'A real chance of a season\u2019s grace; a real chance of losing it anyway, and more trust with it', backer: 'vc', act: { t: 'secondappeal' } }] });
  g.world.autoPause = { title: it.title, cat: 'boardroom', date: g.world.date };
}
const basePlWeekly = weeklyWorld; weeklyWorld = function () { basePlWeekly(); if (g.ended || !g.world) return; secondClashQueue() };

/* ---------- where Continue takes you ---------- */
const basePlFfwdEnd = ffwdEnd;
ffwdEnd = function () { basePlFfwdEnd(); let w = g.world; if (!w || !w.autoPause) return; let cat = w.autoPause.cat; if (cat === 'boardroom' || cat === 'cups') return; if (['Inbox', 'Overview'].includes(page) || !$('modal').innerHTML) { page = ['window', 'bids', 'contracts', 'decision', 'action', 'inbox'].includes(cat) ? 'Inbox' : page; render() } };
const basePlResultClose = resultClose;
resultClose = function (s) { let m = g.world && g.world.lastMatch; basePlResultClose(s); if (m && !m.gateDone && !g.ended) { m.gateDone = true;
  if (m.homeId === g.clubId) { let f = g.world.fixtures.find(x => x.id === m.id), att = Math.min(g.capacity, Number(typeof demand === 'function' ? demand().est : NaN) || Math.round(g.capacity * .8)), gate = Math.round(att * g.ticket), hosp = Math.round(((typeof std === 'function' && std().facilities && std().facilities.boxes) ? 1 : 0) * 18000 + (Number(g.hospitality) || 0) * 9000), cf = typeof concessionsForecast === 'function' ? concessionsForecast(att) : null, food = cf ? cf.profit : Math.round(att * 2), prog = Math.round(att * .55), parking = Math.round(att * .35), tv = f && typeof isLiveGame === 'function' && isLiveGame(f) ? 110000 : 0, incident = typeof opsMatchdayRoll === 'function' ? opsMatchdayRoll(true) : null; g.cash += gate + hosp + prog + parking + tv; if (cf) g.cash += cf.profit; else g.cash += food; record('Matchday gate & commercial', gate + hosp + prog + parking + tv + food); g.world.lastGate = { id: m.id, opp: m.awayId, att, gate, hosp, food, prog, parking, tv, incident, total: gate + hosp + food + prog + parking + tv, date: g.world.date } }
  else if (typeof busSettle === 'function') { let f = g.world.fixtures.find(x => x.id === m.id); if (f) busSettle(typeof milesBetween === 'function' ? milesBetween(g.clubId, f.home) : 100) }
  if (!s) { page = 'Overview'; render() } } };
function takingsCard() { let t = g.world.lastGate; if (!t || !g.world.lastMatch || t.id !== g.world.lastMatch.id || dayDiff(t.date, g.world.date) > 7) return ''; return `<div class="card takings"><div class="cardhead"><h2>Matchday takings · v ${esc(team(t.opp).short)}</h2><span class="eyebrow">${t.att.toLocaleString()} THROUGH THE GATES</span></div><div class="pad takingsgrid"><div><small>GATE</small><b>${money(t.gate)}</b></div><div><small>HOSPITALITY</small><b>${money(t.hosp)}</b></div><div><small>FOOD & DRINK</small><b>${money(t.food)}</b></div><div><small>PROGRAMMES</small><b>${money(t.prog)}</b></div><div><small>PARKING</small><b>${money(t.parking)}</b></div>${t.tv ? `<div><small>TV FACILITY FEE</small><b>${money(t.tv)}</b></div>` : ''}<div class="total"><small>TOTAL</small><b>${money(t.total)}</b></div>${t.incident ? `<p class="fineprint bad">A crowd-safety incident on the day cost a fine of ${money(t.incident.fine)} — see Operations to review your security staffing.</p>` : ''}<p class="fineprint">Food & drink reflects the prices you've set under Operations. This has all been banked already.</p></div></div>` }
function dayDiff(a, b) { return Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 86400000) }
const basePlRender = render;
render = function () { basePlRender(); if (!g || !g.world || page !== 'Overview') return; let root = $('content'); if (!root || !root.querySelector) return; let card_ = takingsCard(); if (!card_) return; let first = root.querySelector('.card'); if (first && !root.querySelector('.takings')) first.insertAdjacentHTML('beforebegin', card_) };

/* ---------- prize money ---------- */
const PRIZES = { FA: [25000, 41000, 67000, 105000, 120000, 225000, 450000, 1000000, 2000000], LC: [15000, 25000, 35000, 50000, 75000, 100000, 100000, 1000000], EU: [2100000, 2100000, 2100000, 2100000, 2100000, 2100000, 11000000, 12500000, 15000000, 25000000] };
function cupPrize(key, r) { let p = PRIZES[key]; if (!p) return 0; return p[Math.min(r, p.length - 1)] || 0 }
if (typeof cupRoad === 'function') { const basePlRoad = cupRoad; cupRoad = function (c) { let road = basePlRoad(c); road.forEach((s, r) => { let prize = cupPrize(c.key, r); if (prize && (s.state === 'won' || s.state === 'next' || s.state === 'future')) s.text = (s.text ? s.text + ' · ' : '') + (s.state === 'won' ? '+' : 'worth ') + compact(prize) }); return road } }

/* ---------- the Finance Director's advice ---------- */
function fdAdvice() {
  let out = [], f = fin(), wages = g.squad.reduce((s, p) => s + p.wage, 0), income = typeof weeklyIncome === 'function' ? weeklyIncome() : cfg[tier()].income, ratio = wages / Math.max(1, income), full = typeof demand === 'function' ? demand() / g.capacity : .8;
  if (ratio > .75) out.push({ t: 'Wages are eating ' + Math.round(ratio * 100) + '% of income', d: 'Anything above 70% is a structural loss. Sell one high earner or let the next two contracts run down.' });
  if (full > 1.02) out.push({ t: 'Demand exceeds capacity', d: 'You are turning fans away. Raise ticket prices by 5–8% or expand a stand; both pay back within the season.' });
  if (full < .7) out.push({ t: 'The ground is ' + Math.round(full * 100) + '% full', d: 'Empty seats earn nothing. Drop prices for families or run a season-ticket drive before expanding anything.' });
  if (g.cash < 0) out.push({ t: 'We are overdrawn', d: 'Interest compounds weekly. A short bank facility is cheaper than a fire sale, but only if income covers the repayments.' });
  if ((f.debt || 0) > income * 40) out.push({ t: 'Debt is above ten months of income', d: 'Prioritise repayment over signings this window; the covenant reviews are coming.' });
  if (typeof sponsorDeals === 'function') { let soon = (sponsorDeals() || []).filter(d => d.expires && d.expires - g.season <= 0); if (soon.length) out.push({ t: 'A sponsor deal expires this summer', d: 'Open renewal talks now; a club in negotiation gets 15% more than one that waits.' }) }
  if (!out.length) out.push({ t: 'The books are healthy', d: 'Keep wages under 65% of income and bank one window of surplus; that is what gets us through a bad season.' });
  return out.slice(0, 3);
}
if (typeof finances === 'function') { const basePlFin = finances; finances = function () { let h = basePlFin(); if (typeof h !== 'string') return h; let adv = fdAdvice(); return `<div class="card fdadvice"><div class="cardhead"><h2>${typeof ownerFigure === 'function' && !window.__CLUBS__ ? '<img class="fdface" src="assets/portraits/finance-director.jpg" alt="">' : ''}The Finance Director advises</h2><span class="eyebrow">MARGARET HALE</span></div><div class="pad">${adv.map(a => `<div class="advice"><b>${esc(a.t)}</b><p>${esc(a.d)}</p></div>`).join('')}</div></div>` + h } }

/* ---------- a place to edit your profile ---------- */
if (typeof PAGE_BUILDERS !== 'undefined' && PAGE_BUILDERS.Ownership) { const basePlOwn = PAGE_BUILDERS.Ownership; PAGE_BUILDERS.Ownership = function () { let h = basePlOwn(); if (typeof h !== 'string') return h; return `<div class="card ownercard"><div class="pad ownerrow"><div class="ownerpic small">${ownerFigure('op')}</div><div><div class="eyebrow">THE CHAIRMAN</div><h2>${esc(ownerName())}</h2><p class="fineprint">Your name and photo appear in the boardroom, at the negotiating table and in front of the press.</p><button onclick="ownerForm()">Edit name & photo</button></div></div></div>` + h } }
