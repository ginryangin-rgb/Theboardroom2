/* Phase 2 — financial depth. Layered on engine/app/world/pacing.
   Forecast, regulation (see rules.js), debt & ownership, commercial depth.
   All state lives in g.fin (created lazily, so older saves upgrade silently). */

const baseFinMarket = marketPlayer, baseFinRecord = record, baseFinWeekly = weeklyWorld, baseFinComplete = completeWorldSeason, baseFinRollover = performSeasonRollover,
  baseFinNegotiate = negotiatePlayer, baseFinProcessDeals = processDeals, baseFinSignOffer = signOffer, baseFinValidate = validateSave;

const GATE_REF = [38, 27, 22, 18], HOSP = [3, 2.5, 2, 1.5];
const LEGACY_CATEGORY = { shirt: 'retail', stadium: 'energy', training: 'sport & health' };
const SLOTS = { sleeve: ['Sleeve sponsor', .45], matchday: ['Matchday & ad boards', .30], kit: ['Official kit supplier', .55], digital: ['Digital & streaming partner', .35] };
const BRANDS = [
  { brand: 'Crown & Anchor Bet', category: 'betting', ethics: -2, note: 'Pays handsomely. Many supporters dislike gambling on the shirt.' },
  { brand: 'Swift Payday Loans', category: 'lending', ethics: -2, note: 'Big money, but a poor look for a community club.' },
  { brand: 'Vantage Capital Markets', category: 'finance', ethics: -1, note: 'Well funded, slightly corporate for a club with local roots.' },
  { brand: 'Summit Brewery', category: 'alcohol', ethics: -1, note: 'Traditional matchday partner, mixed reaction from families.' },
  { brand: 'Starlight Gaming', category: 'gaming', ethics: -1, note: 'Young audience, moderate backlash over loot-box marketing.' },
  { brand: 'Kestrel Motors', category: 'automotive', ethics: 0, note: 'A conventional partner with fair terms.' },
  { brand: 'Harbour Telecom', category: 'telecom', ethics: 0, note: 'A steady, uncontroversial regional brand.' },
  { brand: 'Brightwater Utilities', category: 'energy', ethics: 0, note: 'Competes with any existing energy partner.' },
  { brand: 'OakLeaf Foods', category: 'retail', ethics: 1, note: 'A local favourite. Competes with any existing retail partner.' },
  { brand: 'Velocity Sportswear', category: 'sport & health', ethics: 1, note: 'Fits the club identity, pays a little less.' },
  { brand: 'Greenfield Community Trust', category: 'charity', ethics: 2, note: 'Lower fee, but supporters love it.' }
];
const INVESTORS = ['Harbourline Capital', 'Northgate Sports Partners', 'Redstone Family Office', 'Calder & Vane Ventures', 'Fenwick Heritage Fund'];
const COMMERCIAL = {
  merch: { name: 'Merchandise & retail', levels: [0, .03, .05, .065], cost: [0, 3.5, 6, 10], desc: 'Replica kits, ranges and the club shop.' },
  tours: { name: 'Stadium tours & museum', levels: [0, .012, .02], cost: [0, 2, 4], desc: 'Matchday-independent visitor income.' },
  digital: { name: 'Digital & streaming content', levels: [0, .02, .035, .05], cost: [0, 3, 5, 8], desc: 'Subscriptions, highlights and sponsorship of content.' }
};

/* ---------- state ---------- */
function newSeasonStats() { return { rev: { gate: 0, central: 0, sponsor: 0, commercial: 0, deals: 0, prize: 0, parachute: 0, other: 0 }, wages: 0, mgr: 0, interest: 0, sales: 0, purchases: 0, gifts: 0, weeks: 0 } }
function initFin() {
  let t = tier(), econ = ECONOMY.enabled && g.season === 1 && (!g.world || g.world.days < 8) ? 1 : 0;
  if (econ) {
    // a club's stature matters as much as the division it's in: a bigger, better-supported club carries a far bigger
    // wage bill than a division rival with a fraction of the ground. Capacity is the one marker of stature every club
    // already has, so it drives this; the result is clamped so no club is absurdly rich or poor for its level.
    let capAvg = g.divisions[t].reduce((s, id) => s + (club(id).capacity || 20000), 0) / g.divisions[t].length;
    let statureMult = clamp(Math.pow((club().capacity || capAvg) / capAvg, .5), .6, 1.85);
    let total = g.squad.reduce((s, p) => s + p.wage * ECONOMY.wageScale[t], 0) * statureMult;
    // real wages are set by rank and reputation far more than by any measurable ability score, which is why a real squad's
    // top earner can be fifteen or twenty times its lowest: rank the squad by rating and give each place a share on a
    // steep curve, nudged a little further by age and position, rather than scaling off the (narrow) rating gap directly.
    let ranked = [...g.squad].sort((a, b) => b.rating - a.rating);
    let factor = p => Math.pow(ranked.indexOf(p) + 1, -.95) * (p.age < 21 ? .4 : p.age < 23 ? .65 : p.age > 33 ? .85 : 1) * (['GK', 'G'].includes(p.position) ? .8 : 1);
    let fsum = g.squad.reduce((s, p) => s + factor(p), 0), ceiling = Math.round(cfg[t].wage * ECONOMY.wageScale[t] * .16 / 100) * 100;   // even at the very biggest club, no single footballer's wage runs away unrealistically
    for (let p of g.squad) { p.wage = Math.min(ceiling, Math.max(300, Math.round(total * factor(p) / fsum / 100) * 100)); p.contract = 1 + Math.abs(hash(p.id)) % 4 }
  }
  g.fin = { econ, v: 1, season: newSeasonStats(), history: [], amort: [], loans: [], investors: [], owner: { wealth: Math.round(cfg[t].cash * 2.5), gifts: 0 }, deals: [], offers: null, offerSeason: 0, commercial: { merch: 0, tours: 0, digital: 0 }, parachute: null, embargo: null, pendingDeduction: 0, breaches: [], second: null, bid: null, bidCooldown: 0, rel: {}, pool: null, relegatedSeason: 0, warned: {}, scenario: {}, sold: null, seq: 0 };
}
function fin() { if (!g.fin) initFin(); return g.fin }
function sumRev(r) { return Object.values(r).reduce((a, b) => a + b, 0) }
function profileIndex() { let n = g.tables[tier()].length, pos = position(); return clamp(.7 + .5 * g.trust / 100 + .3 * (1 - (pos - 1) / (n - 1)), .6, 1.6) }
function gateMatch(t = tier(), cap = g.capacity, fans = g.fans, ticket = g.ticket, closed = g.upgrades.some(u => u.id === 'stand') ? 400 : 0) {
  let att = clamp(fans * (.85 + g.trust * .003) * Math.pow(GATE_REF[t] / ticket, .9), 0, cap - closed);
  return att * (ticket + 4 + g.hospitality * HOSP[t]);
}
function opsWeekly() { return fin().econ ? Math.round(ECONOMY.opsShare[tier()] * annualRevenue() / 48) : 0 }
function totalLoans() { return fin().loans.reduce((s, l) => s + l.balance, 0) }
function totalDebt() { return g.debt + totalLoans() }
function annualRevenue() {
  let f = fin(); if (f.history.length) return f.history.at(-1).rev;
  let t = tier(); return cfg[t].income * rounds() + rounds() / 2 * gateMatch() + cfg[t].sponsor * 2;
}
function perfIndex() { let n = g.tables[tier()].length; return clamp(1 - (position() - 1) / (n - 1), 0, 1) }
function clubValuation() {
  let f = fin(), ev = annualRevenue() * 1.6 * (.8 + .4 * perfIndex());
  return Math.max(Math.round((ev + g.cash - totalDebt()) / 1000) * 1000, Math.round(cfg[tier()].cash * .5));
}
function controlShare() { return 100 - fin().investors.reduce((s, i) => s + i.stake, 0) }
function fmsg(title, body, type, page, deadline) {
  msg(title, body, type || 'finance'); let m = g.inbox[0]; if (m) { if (page) m.page = page; if (deadline) m.deadline = deadline }
}
function commercialWeekly() {
  let f = fin(), base = cfg[tier()].income, p = profileIndex(), c = f.commercial;
  let merch = base * COMMERCIAL.merch.levels[c.merch] * p, tours = base * COMMERCIAL.tours.levels[c.tours] * p, digital = base * COMMERCIAL.digital.levels[c.digital] * p;
  let gross = merch + tours + digital; return { gross, cost: gross * .35, net: gross * .65 };
}
function secondWeekly() {
  let s = fin().second; if (!s) return 0;
  let t = g.divisions.findIndex(d => d.includes(s.clubId)); if (t < 0) return 0;
  let st = standings(t), pos = st.findIndex(r => r.id === s.clubId) + 1, n = st.length;
  return Math.round(cfg[t].income * (.14 - .26 * ((pos - 1) / (n - 1))));
}

marketPlayer = function (p, owner) {
  let m = baseFinMarket(p, owner);
  if (g && g.fin && g.fin.econ) m.wage = Math.round(m.wage * ECONOMY.wageScale[club(owner)?.league ?? 2]);
  return m;
};
/* ---------- ledger hooks ---------- */
record = function (name, amount) {
  baseFinRecord(name, amount);
  if (!g || !g.divisions) return;
  let f = fin(), s = f.season;
  if (/matchday receipts|match receipts/i.test(name)) s.rev.gate += amount;
  else if (/Sponsor signing advance|Annual sponsor advance|Promotion sponsor bonuses/.test(name)) s.rev.sponsor += amount;
  else if (/Season prize money/.test(name)) s.rev.prize += amount;
  else if (/^Player sale/.test(name)) s.sales += amount;
  else if (/^Transfer fee/.test(name)) { s.purchases += -amount; f.amort.push({ fee: -amount, left: 3, season: g.season }) }
};
function addLedger(name, v) {
  v = Math.round(v); if (!v) return; g.cash += v; let L = g.ledger[0]; if (L) { L.items.push([name, v]); L.net += v }
}
weeklyWorld = function () {
  let prev = g.ledger[0]; baseFinWeekly(); let L = g.ledger[0]; if (!L || L === prev || g.ended) return;
  let f = fin(), s = f.season; s.weeks++;
  for (let [n, v] of L.items) {
    if (/^Broadcast/.test(n)) s.rev.central += v; else if (/instalment$/.test(n)) s.rev.sponsor += v;
    else if (/^First-team wages/.test(n)) s.wages += -v; else if (/^Loan interest/.test(n)) s.interest += -v;
  }
  s.mgr += g.manager.wage;
  let ops = opsWeekly(); if (ops) addLedger('Club operations & matchday costs', -ops);
  // commercial lines
  let c = commercialWeekly(); if (c.gross) { addLedger('Commercial income', c.gross); addLedger('Commercial operating costs', -c.cost); s.rev.commercial += c.gross }
  for (let d of f.deals) { let pay = Math.round(d.annual / 48); addLedger(d.brand + ' partnership', pay); s.rev.deals += pay }
  if (f.parachute && f.parachute.left > 0) { let pay = Math.round(f.parachute.amounts[f.parachute.amounts.length - f.parachute.left] / 48); addLedger('Parachute payment', pay); s.rev.parachute += pay }
  let sw = secondWeekly(); if (sw) addLedger('Second club result', sw);
  if (f.second) { let ic = secondInvestWeekly(); if (ic) addLedger('Second club investment', -ic); for (let p of f.second.loaned) if (p.rating < p.potential) p.rating = Math.min(p.potential, p.rating + (p.age < 26 ? .06 : .01)) }
  for (let i of f.investors) addLedger('Investor dividend: ' + i.name, -i.weekly);
  // loans
  for (let l of f.loans) {
    let interest = Math.round(l.balance * l.rate / 100 / 52); if (interest) { addLedger('Loan interest: ' + l.name, -interest); s.interest += interest }
    if (l.type === 'bank') { let p = Math.min(l.balance, l.weeklyPrincipal * (l.accelerated ? 2 : 1)); l.balance -= p; addLedger('Loan repayment: ' + l.name, -p) }
  }
  f.loans = f.loans.filter(l => l.balance > 0 || l.type === 'owner' && l.balance > 0);
  checkCovenants(); checkOverreliance();
  if (g.cash < -cfg[tier()].cash * .5 && !g.ended) { g.ended = true; stopClock(); msg('Administration', 'The club has exceeded its overdraft facility. This career has ended.') }
  if (g.ended) return;
  regWeekly(); takeoverWeekly();
};
function checkCovenants() {
  let f = fin(), w = g.world, floor = Math.round(annualRevenue() * .04);
  for (let l of f.loans) if (l.type === 'bank') {
    if (g.cash < floor) {
      l.breachWeeks = (l.breachWeeks || 0) + 1;
      if (l.breachWeeks === 1 || l.breachWeeks % 13 === 0) {
        let fee = Math.round(l.balance * .01); addLedger('Covenant breach fee: ' + l.name, -fee); l.rate += 1.5;
        fmsg('Covenant breach: ' + l.name, 'Cash fell below the lender’s minimum of ' + money(floor) + '. A ' + money(fee) + ' fee was charged and the rate rose to ' + l.rate.toFixed(1) + '%. If this continues the lender will accelerate repayments.', 'finance', 'Ownership');
      }
      if (l.breachWeeks === 8 && !l.accelerated) { l.accelerated = true; fmsg('Lender accelerates repayments', l.name + ': repayments have doubled after eight weeks below the cash covenant.', 'finance', 'Ownership') }
    } else if (l.breachWeeks) l.breachWeeks = 0;
  }
}
function checkOverreliance() {
  let f = fin(), s = f.season;
  if (s.gifts > 0 && s.weeks >= 12 && s.gifts / Math.max(1, sumRev(s.rev)) > .35 && !f.warned['rely' + g.season]) {
    f.warned['rely' + g.season] = 1; g.trust = clamp(g.trust - 6, 5, 100);
    fmsg('Supporters worry about dependence', 'More than a third of this season’s income has come from your own pocket. Fans are asking what happens if you walk away.', 'finance', 'Ownership');
  }
}

/* ---------- forecast ---------- */
function buildForecast(scn = fin().scenario) {
  let w = g.world, f = fin(), y = seasonYear(), end1 = iso(y + 1, 5, 31), t0 = tier(), t = t0;
  let cash = g.cash, wages = squadWages(), mgr = g.manager.wage, staff = g.staff, cap = g.capacity, youth = youthCost(), rolled = false, wageMult = 1;
  let saleCash = 0, rest = { rev: 0, wages: 0, mgr: 0 }, weeks = [], oneoffs = [];
  if (scn.sellTop && g.squad.length) {
    let best = [...g.squad].sort((a, b) => b.rating - a.rating)[0], ask; try { ask = marketPlayer(best, g.clubId).ask } catch { ask = cfg[t].fee }
    saleCash = Math.round(ask * .85); wages -= best.wage; oneoffs.push(['Sale of ' + best.name, saleCash]);
  }
  let sp = g.sponsors.map(s => ({ rem: s.remaining, annual: s.annual, years: s.years, upfront: s.upfront }));
  let deals = f.deals.map(d => ({ annual: d.annual, years: d.years }));
  let loans = f.loans.map(l => ({ bal: l.balance, rate: l.rate, wp: l.weeklyPrincipal * (l.accelerated ? 2 : 1), type: l.type }));
  let para = f.parachute ? { left: f.parachute.left, amounts: f.parachute.amounts } : null;
  let divs = f.investors.reduce((s, i) => s + i.weekly, 0), secW = secondWeekly() - secondInvestWeekly();
  let standU = scn.stand && !g.upgrades.some(u => u.id === 'stand') ? upgradeOptions().find(x => x.id === 'stand') : null;
  let comm = commercialWeekly().net, endNext = iso(y + 2, 5, 31), season = 0, homeLeft = 0, cupExtra = scn.cupRun ? 4 : 0;
  let date = dayAdd(w.date, 7 - (w.days % 7)), prevDate = w.date, nextWeeks = 0;
  for (let k = 0; k < 52; k++) {
    let inc = { central: 0, gate: 0, sponsor: 0, comm: comm, deals: 0, para: 0, other: 0, prize: 0 }, cost = { wages: 0, mgr: 0, other: 0, interest: 0, repay: 0, oneoff: 0 }, startDate = date;
    if (!rolled && date > end1) {
      rolled = true; season = 1; date = dayAdd(iso(y + 1, 7, 1), 7); prevDate = iso(y + 1, 7, 1);
      deals = deals.filter(d => --d.years > 0); if (para) { para.left--; if (para.left <= 0) para = null }
      if (scn.promoted && t0 > 0) { t = t0 - 1; wageMult = wageFactor(t0, t) } else if (scn.relegated && t0 < 3) { t = t0 + 1; wageMult = wageFactor(t0, t); let a = PARACHUTE[t0]; if (a) para = { left: a.length, amounts: a.map(x => x * cfg[t0].income * 52) } }
      let prize = Math.round(cfg[t0].cash * .025 * (g.tables[t0].length - position() + 1)); inc.prize += prize; rest.rev += prize; oneoffs.push(['Season prize money', prize]);
      let off = Math.round((wages * wageMult + mgr + staff + cap * 1.1 + youth) * 6); cost.oneoff += off; oneoffs.push(['Off-season operating costs', -off]);
      let adv = 0; for (let s of sp) if (s.years > 1) { let a = Math.round(s.annual * s.upfront / 100); adv += a; s.rem = s.annual - a } else s.rem = 0;
      for (let s of sp) s.years--; if (adv) { inc.other += adv; oneoffs.push(['Sponsor advances', adv]) }
      homeLeft = (rounds() / 2 + 3) / 47; nextWeeks = 0; startDate = date;
    }
    if (k === 0) inc.other += saleCash;
    if (k === 0 && standU) { cost.oneoff += standU.cost; oneoffs.push(['New stand (home end)', -standU.cost]) }
    let capNow = cap + (standU && k >= standU.time ? 1000 : 0), closedNow = standU ? (k < standU.time ? 400 : 0) : (g.upgrades.some(u => u.id === 'stand') ? 400 : 0);
    let tt = season ? t : t0;
    inc.central = centralForecast(tt);
    let endS = season ? endNext : end1;
    for (let s of sp) { if (s.rem > 0) { let rw = Math.max(1, Math.ceil(daysBetween(date, endS) / 7)), pay = s.rem / rw; s.rem -= pay; inc.sponsor += pay } }
    for (let d of deals) inc.deals += d.annual / 48;
    if (para && para.left > 0) inc.para += para.amounts[para.amounts.length - para.left] / 48;
    let cupTie = (home) => (home ? capNow * .8 * g.ticket * .6 : 0) + cfg[tt].fee * .02, cupAvg = capNow * .8 * g.ticket * .6 * .5 + cfg[tt].fee * .03, seasonWeek = season ? nextWeeks : Math.floor((w.days + (k + 1) * 7) / 7);
    let gate = 0;
    if (!season) {
      let fx = w.fixtures.filter(x => !x.played && x.date > prevDate && x.date <= date);
      gate += fx.filter(x => x.comp === 'League' && x.home === g.clubId).length * gateMatch(tt, capNow, g.fans, g.ticket, closedNow) + fx.filter(x => x.comp !== 'League').reduce((a, x) => a + cupTie(x.home === g.clubId), 0) + (k < 12 ? cupExtra / 12 * gateMatch(tt, capNow, g.fans, g.ticket, closedNow) : 0);
    } else if (nextWeeks < 47) gate += homeLeft * gateMatch(tt, capNow, g.fans, g.ticket, closedNow);
    if (seasonWeek < 36) gate += 1.5 * cupAvg / 47;
    inc.gate = gate;
    cost.wages = wages * wageMult; cost.mgr = mgr + staff; cost.other = opsWeekly() + (typeof medWeekly === 'function' ? medWeekly() : 0) + (typeof delWeekly === 'function' ? delWeekly() : 0) + capNow * 1.1 + youth + g.debt * .0015 + (g.policy === 'push' ? cfg[tt].wage * .04 : 0) + divs;
    inc.other += secW;
    for (let l of loans) if (l.bal > 0) { cost.interest += l.bal * l.rate / 100 / 52; if (l.type === 'bank') { let p = Math.min(l.bal, l.wp); l.bal -= p; cost.repay += p } }
    let totIn = inc.central + inc.gate + inc.sponsor + inc.comm + inc.para + inc.other + inc.deals + inc.prize, totOut = cost.wages + cost.mgr + cost.other + cost.interest + cost.repay + cost.oneoff;
    cash += totIn - totOut;
    if (!season) { rest.rev += inc.central + inc.gate + inc.sponsor + inc.comm + inc.para + inc.deals; rest.wages += cost.wages; rest.mgr += mgr }
    weeks.push({ date, inc: totIn, out: totOut, net: totIn - totOut, cash });
    prevDate = date; date = dayAdd(date, 7); if (season) nextWeeks++;
  }
  // aggregate by month
  let months = [], by = {};
  for (let wk of weeks) {
    let key = wk.date.slice(0, 7), m = by[key]; if (!m) { m = by[key] = { key, label: new Date(wk.date + 'T12:00:00Z').toLocaleDateString('en-GB', { month: 'short', year: '2-digit', timeZone: 'UTC' }), inc: 0, out: 0, net: 0, end: 0 }; months.push(m) }
    m.inc += wk.inc; m.out += wk.out; m.net += wk.net; m.end = wk.cash;
  }
  let min = weeks.reduce((a, b) => b.cash < a.cash ? b : a, weeks[0]), limit = -cfg[t0].cash * .5;
  return { weeks, months, min, rest, oneoffs, net12: cash - g.cash, end: cash, limit, shortfall: min.cash < 0 ? min : null, admin: min.cash < limit ? min : null };
}
function shortfallInfo() {
  let r = buildForecast({}); if (!r.shortfall) return null;
  return { first: (r.weeks.find(x => x.cash < 0) || r.shortfall).date, date: r.shortfall.date, amount: r.shortfall.cash, month: new Date(r.shortfall.date + 'T12:00:00Z').toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }), admin: !!r.admin };
}
function setScenario(k, on) {
  let sc = fin().scenario; sc[k] = on; if (on && k === 'promoted') sc.relegated = false; if (on && k === 'relegated') sc.promoted = false; save(); render()
}

/* ---------- regulation ---------- */
function rule() { return RULES.resolve(seasonYear(), tier()) }
function amortSeason() { return fin().amort.reduce((s, a) => s + a.fee / 3, 0) }
function metrics(project = true) {
  let f = fin(), s = f.season, r = project && g.world ? buildForecast({}).rest : { rev: 0, wages: 0, mgr: 0 };
  return { rev: sumRev(s.rev) + r.rev, wages: s.wages + r.wages, mgr: s.mgr + r.mgr, amort: amortSeason(), sales: s.sales, gifts: s.gifts };
}
function evaluate(m, r = rule(), f = fin()) {
  let out = { kind: r.kind, title: r.title, league: r.league, limit: r.limit, status: 'ok', fine: 0, deduction: 0, embargo: false, excess: 0, covered: 0 };
  if (r.kind === 'scr') {
    let R = m.rev + m.sales, C = m.wages + m.amort; out.revenue = R; out.cost = C; out.ratio = R > 0 ? C / R : 0;
    out.excess = Math.max(0, C - r.limit * R); out.headroom = r.limit * R - C;
    if (out.excess > 0) {
      if (tier() === 0) {
        let pool = f.pool == null ? r.allowance * R : f.pool, used = Math.min(out.excess, pool), over = out.excess - used;
        out.pool = pool; out.fine = Math.round(used * Math.max(0, out.ratio - r.limit)); out.deduction = over > 0 ? Math.ceil(over / r.unit) * r.pointsPerUnit : 0; out.used = used; out.status = over > 0 ? 'breach' : 'levy';
      } else {
        let prior = f.history.slice(-2).reduce((s, h) => s + (h.equity || 0), 0), cap = Math.max(0, Math.min(r.equitySeasonCap, r.equity3yCap - prior));
        out.covered = Math.min(out.excess, m.gifts, cap); out.fine = Math.round(out.covered * r.levyOnEquity); let unc = out.excess - out.covered;
        out.deduction = unc > 0 ? Math.ceil(unc / r.unit) * r.pointsPerUnit : 0; out.status = unc > 0 ? 'breach' : 'levy'; out.equityCap = cap;
      }
    } else if (out.ratio >= r.limit * .93) out.status = 'warn';
  } else {
    let lim = f.relegatedSeason === g.season ? r.relegatedLimit : r.limit, W = m.wages + m.mgr, T = m.rev + (r.equityTurnover ? m.gifts : 0), allowed = lim * T + (r.equityCredit ? r.equityCredit * m.gifts : 0);
    out.limit = lim; out.revenue = T; out.cost = W; out.ratio = T > 0 ? W / T : 0; out.headroom = allowed - W; out.excess = Math.max(0, W - allowed);
    if (out.excess > 0) { out.status = 'breach'; out.embargo = true } else if (W >= allowed * .93) out.status = 'warn';
  }
  return out;
}
function regImpact(extraWeekly = 0, fee = 0) {
  let m = metrics(true), w = g.world, weeksLeft = Math.max(0, Math.ceil(daysBetween(w.date, iso(seasonYear() + 1, 5, 31)) / 7));
  let before = evaluate(m); let m2 = { ...m, wages: m.wages + extraWeekly * weeksLeft, amort: m.amort + fee / 3 };
  return { before, after: evaluate(m2), extraWeekly, fee };
}
function embargoed() { let e = fin().embargo; return !!(e && g.world.date <= e.until) }
function regWeekly() {
  let f = fin(), s = f.season, w = g.world;
  let ev = evaluate(metrics(true)), key = 'reg' + g.season; f.live = { status: ev.status, ratio: ev.ratio, limit: ev.limit };
  if (s.weeks < 8 || w.days % 28 !== 0) return;
  let pct = Math.round(ev.ratio * 100), lim = Math.round(ev.limit * 100);
  if (ev.status === 'breach' && !f.warned[key + 'b']) {
    f.warned[key + 'b'] = 1;
    fmsg('Regulation breach projected', `${ev.title}: you are on course for ${pct}% against a ${lim}% limit. ${ev.embargo ? 'A transfer embargo would follow.' : 'Expect a levy and a points deduction.'} Cut wages, sell players or find revenue before the season ends.`, 'finance', 'Compliance');
  } else if (ev.status === 'warn' && !f.warned[key + 'w']) {
    f.warned[key + 'w'] = 1;
    fmsg('Squad cost warning', `${ev.title}: projected ${pct}% against a ${lim}% limit. You are close to the line, so check before signing anyone.`, 'finance', 'Compliance');
  }
}
function regSeasonEnd() {
  let f = fin(), m = metrics(false), ev = evaluate(m), r = rule();
  let rec = { season: g.season, tier: tier(), rev: Math.round(sumRev(f.season.rev)), wages: Math.round(m.wages), ratio: ev.ratio, limit: ev.limit, status: ev.status, fine: ev.fine, deduction: ev.deduction, embargo: ev.embargo, equity: ev.covered || 0, gifts: Math.round(m.gifts) };
  f.history.push(rec); f.history = f.history.slice(-10);
  if (tier() === 0) f.pool = (f.pool == null ? r.allowance * (ev.revenue || 0) : f.pool) - (ev.used || 0);
  if (ev.fine) { g.cash -= ev.fine; baseFinRecord('Regulatory levy', -ev.fine) }
  if (ev.deduction) f.pendingDeduction = ev.deduction;
  if (ev.embargo) f.embargo = { until: iso(seasonYear() + 2, 2, 1) };
  if (ev.status === 'breach' || ev.status === 'levy') {
    f.breaches.push({ season: g.season, detail: ev.status });
    let parts = []; if (ev.fine) parts.push('a levy of ' + money(ev.fine)); if (ev.deduction) parts.push(ev.deduction + '-point deduction at the start of next season'); if (ev.embargo) parts.push('a transfer embargo through the next summer and winter windows');
    fmsg(ev.status === 'breach' ? 'Regulation breach: sanctions applied' : 'Regulation levy charged', `${ev.title}: ${Math.round(ev.ratio * 100)}% against a ${Math.round(ev.limit * 100)}% limit. ${parts.join(', ')}.`, 'finance', 'Compliance');
  }
  return ev;
}

/* ---------- debt & ownership ---------- */
function bankCapacity() { return Math.max(0, Math.round((annualRevenue() * .5 - totalDebt()) / 1000) * 1000) }
function quoteLoan(amount, weeks) {
  let rev = annualRevenue(), lev = totalDebt() / Math.max(1, rev), rate = 5.5 + [0, .5, 1.5, 2.5][tier()] + lev * 4 + Math.max(0, weeks - 52) / 52 * .5;
  let fee = Math.round(amount * .01), wp = Math.round(amount / weeks), interestTotal = Math.round(amount * rate / 100 * weeks / 52 / 2);
  return { rate: Math.round(rate * 10) / 10, fee, weekly: wp + Math.round(amount * rate / 100 / 52), principalWeekly: wp, interestTotal, floor: Math.round(rev * .04) };
}
function takeBankLoan(amount, weeks) {
  let f = fin(); amount = Math.round(amount);
  if (g.ended || !Number.isFinite(amount) || amount < 1000) return { error: 'Enter a loan amount.' };
  if (![52, 104, 156].includes(weeks)) return { error: 'Choose a term.' };
  if (amount > bankCapacity()) return { error: 'The bank will lend up to ' + money(bankCapacity()) + ' against your current revenue and existing debt.' };
  let vote = boardVote('loan', amount); if (!vote.ok) return { error: vote.reason };
  let q = quoteLoan(amount, weeks); f.seq++;
  f.loans.push({ id: 'L' + f.seq, type: 'bank', name: 'Bank loan ' + f.seq, balance: amount, rate: q.rate, weeklyPrincipal: q.principalWeekly, term: weeks });
  g.cash += amount - q.fee; baseFinRecord('Bank loan (net of fee)', amount - q.fee); save();
  return { ok: true, q };
}
function repayLoan(id, amount) {
  let f = fin(), l = f.loans.find(x => x.id === id); if (!l) return { error: 'Loan not found.' };
  amount = Math.min(Math.round(amount || l.balance), l.balance); if (g.cash < amount) return { error: 'Not enough cash.' };
  g.cash -= amount; l.balance -= amount; if (l.type === 'owner') f.owner.wealth += amount; baseFinRecord('Loan repayment: ' + l.name, -amount);
  f.loans = f.loans.filter(x => x.balance > 0); save(); return { ok: true };
}
function injectFunds(amount, kind) {
  let f = fin(); amount = Math.round(amount);
  if (!Number.isFinite(amount) || amount < 1000) return { error: 'Enter an amount.' };
  if (amount > f.owner.wealth) return { error: 'You only have ' + money(f.owner.wealth) + ' of personal wealth.' };
  f.owner.wealth -= amount; g.cash += amount;
  if (kind === 'gift') { f.season.gifts += amount; f.owner.gifts += amount; g.trust = clamp(g.trust + .5, 5, 100); baseFinRecord('Owner equity injection', amount) }
  else { f.seq++; f.loans.push({ id: 'L' + f.seq, type: 'owner', name: 'Owner loan ' + f.seq, balance: amount, rate: 0, weeklyPrincipal: 0 }); baseFinRecord('Owner loan', amount) }
  save(); return { ok: true };
}
function takeDividend(amount) {
  let f = fin(); amount = Math.round(amount); let safe = Math.round(weeklyCosts() * 13);
  if (!Number.isFinite(amount) || amount < 1000) return { error: 'Enter an amount.' };
  if (g.cash - amount < safe) return { error: 'Keep at least 13 weeks of costs (' + money(safe) + ') in the club.' };
  let vote = boardVote('dividend', amount); if (!vote.ok) return { error: vote.reason };
  g.cash -= amount; f.owner.wealth += amount; g.trust = clamp(g.trust - 2, 5, 100); baseFinRecord('Owner dividend', -amount); save(); return { ok: true };
}
function investorOffers() {
  let V = clubValuation(), perf = perfIndex(), used = 100 - controlShare();
  return [10, 20, 30].filter(s => used + s <= 49).map((s, i) => {
    let price = Math.round(V * s / 100 * (.8 + .2 * perf) / 1000) * 1000, name = INVESTORS[(g.season + i + hash(g.clubId)) % INVESTORS.length];
    return { stake: s, name, price, weekly: Math.round(price * .03 / 52) };
  });
}
function sellStake(stake) {
  let f = fin(), o = investorOffers().find(x => x.stake === stake); if (!o) return { error: 'No investor will take that stake.' };
  f.seq++; f.investors.push({ id: 'I' + f.seq, name: o.name, stake, paid: o.price, weekly: o.weekly, trait: ['prudent', 'ambitious', 'balanced'][Math.abs(hash(o.name)) % 3] });
  g.cash += o.price; f.season.gifts += o.price; baseFinRecord('Investor buy-in: ' + o.name, o.price); save(); return { ok: true, o };
}
function buyBackStake(id) {
  let f = fin(), i = f.investors.find(x => x.id === id); if (!i) return { error: 'Not found.' };
  let price = Math.round(clubValuation() * i.stake / 100 * 1.15 / 1000) * 1000; if (g.cash < price) return { error: 'You need ' + money(price) + ' in cash to buy them out.' };
  g.cash -= price; f.investors = f.investors.filter(x => x.id !== id); baseFinRecord('Investor buy-back: ' + i.name, -price); save(); return { ok: true, price };
}
const TRAIT_TEXT = { prudent: 'Blocks big spending when cash is thin, debt is high or you are close to the financial rules. Blocks heavy borrowing.', ambitious: 'Wants money reinvested: blocks dividends to you.', balanced: 'Blocks anything that leaves under six weeks of costs in the bank.' };
function boardVote(kind, amount = 0) {
  let f = fin(), inv = f.investors, total = inv.reduce((s, i) => s + i.stake, 0);
  if (total < 20) return { ok: true };
  if (kind === 'spend' && amount < clubValuation() * .015) return { ok: true };
  let c = weeklyCosts(), after = g.cash - amount, debtRatio = totalDebt() / Math.max(1, annualRevenue()), live = f.live, blockers = [];
  for (let i of inv) {
    let why = null, trait = i.trait || 'balanced';
    if (trait === 'prudent') {
      if (kind === 'spend' || kind === 'second') { if (after < c * 13) why = 'it would leave under 13 weeks of costs in the bank'; else if (debtRatio > .4) why = 'debt is already high'; else if (live && live.status !== 'ok') why = 'the club is too close to the financial rules' }
      if (kind === 'loan' && debtRatio > .3) why = 'debt is already high';
    } else if (trait === 'ambitious') { if (kind === 'dividend') why = 'they want money reinvested, not paid out' }
    else { if (kind === 'dividend' ? g.cash - amount < c * 13 : after < c * 6) why = kind === 'dividend' ? 'the club needs a bigger cash buffer' : 'cash would drop below six weeks of costs' }
    if (why) blockers.push({ name: i.name, stake: i.stake, why });
  }
  if (blockers.reduce((s, b) => s + b.stake, 0) >= 20) return { ok: false, reason: 'Investors have vetoed this: ' + blockers.map(b => b.name + ' (' + b.stake + '%) object because ' + b.why).join('; ') + '.', blockers };
  return { ok: true };
}
function takeoverWeekly() {
  let f = fin(), w = g.world;
  if (f.bid) { if (w.date > f.bid.expires) { fmsg('Takeover approach withdrawn', f.bid.bidder + ' have withdrawn their offer of ' + money(f.bid.offer) + '.', 'finance', 'Ownership'); f.bid = null; f.bidCooldown = 120 } return }
  if (f.bidCooldown > 0) { f.bidCooldown -= 7; return }
  if (w.days < 84) return;
  let p = .008 + .012 * (perfIndex() > .6) + .015 * (totalDebt() / Math.max(1, annualRevenue()) > .5) + .01 * (controlShare() < 60);
  if (rnd() < p) {
    let V = clubValuation(), bidder = INVESTORS[Math.floor(rnd() * INVESTORS.length)] + ' Group', offer = Math.round(V * (1.05 + rnd() * .45) / 1000) * 1000;
    f.bid = { bidder, offer, expires: dayAdd(w.date, 14) };
    fmsg('Takeover approach', `${bidder} have offered ${money(offer)} for the whole club. You would receive ${controlShare()}% of that. The offer lapses on ${dateText(f.bid.expires, false)}.`, 'finance', 'Ownership', f.bid.expires);
  }
}
function acceptTakeover() {
  let f = fin(), b = f.bid; if (!b || g.ended) return;
  let proceeds = Math.round(b.offer * controlShare() / 100); f.owner.wealth += proceeds; f.sold = { offer: b.offer, proceeds, date: g.world.date, bidder: b.bidder, wealth: f.owner.wealth };
  f.bid = null; g.ended = true; stopClock(); fmsg('Club sold', `You sold the club to ${b.bidder} for ${money(b.offer)}. Your share was ${money(proceeds)}, taking your personal wealth to ${money(f.owner.wealth)}. Your chairmanship is over.`, 'finance', 'Ownership'); save(); render();
}
function rejectTakeover() { let f = fin(); if (!f.bid) return; f.bid = null; f.bidCooldown = 120; save(); render(); toast('Offer rejected.') }
function secondClubOptions() {
  let own = tier(), list = [];
  g.divisions.forEach((ids, t) => { if (t === own) return; for (let id of ids) list.push({ id, t, price: Math.round(cfg[t].cash * 1.2 / 1000) * 1000 }) }); return list.filter(x => x.t >= 1).sort((a, b) => a.t - b.t);
}
function buySecond(id) {
  let f = fin(), o = secondClubOptions().find(x => x.id === id); if (!o || f.second) return { error: 'Not available.' };
  if (g.cash < o.price) return { error: 'You need ' + money(o.price) + ' in cash.' };
  let vote = boardVote('second', o.price); if (!vote.ok) return { error: vote.reason };
  g.cash -= o.price; f.second = { clubId: id, cost: o.price, since: g.season, invest: 0, bonus: 0, loaned: [] }; baseFinRecord('Purchase of ' + club(id).name, -o.price); save(); return { ok: true };
}
function secondInvestWeekly() { let s = fin().second; if (!s) return 0; let t = g.divisions.findIndex(d => d.includes(s.clubId)); return t < 0 ? 0 : Math.round(cfg[t].income * [0, .05, .10, .18][s.invest || 0]) }
function setSecondInvest(l) { let s = fin().second; if (!s) return { error: 'No second club.' }; s.invest = clamp(Number(l), 0, 3); save(); return { ok: true } }
function loanOut(pid) {
  let s = fin().second, p = g.squad.find(x => x.id === pid); if (!s || !p) return { error: 'Not available.' };
  if (s.loaned.length >= 3) return { error: 'Your second club can take three loan players.' }; if (g.squad.length <= 16) return { error: 'Keep at least 16 first-team players.' };
  g.squad = g.squad.filter(x => x.id !== pid); s.loaned.push(p); save(); return { ok: true };
}
function recallLoan(pid) { let s = fin().second; if (!s) return { error: 'No second club.' }; let p = s.loaned.find(x => x.id === pid); if (!p) return { error: 'Not found.' }; if (g.squad.length >= 35) return { error: 'Your squad is full.' }; s.loaned = s.loaned.filter(x => x.id !== pid); g.squad.push(p); save(); return { ok: true } }
function recallAll() { let s = fin().second; if (s) for (let p of [...s.loaned]) { s.loaned = s.loaned.filter(x => x !== p); if (g.squad.length < 35) g.squad.push(p) } }
function secondValue() { let s = fin().second; if (!s) return 0; let t = g.divisions.findIndex(d => d.includes(s.clubId)), pos = standings(t).findIndex(r => r.id === s.clubId) + 1; return Math.round(cfg[t].cash * 1.2 * (pos <= 6 ? 1.2 : pos > 16 ? .85 : 1) * (1 + .04 * (g.season - s.since)) * (1 + .03 * (s.bonus || 0)) / 1000) * 1000 }
function sellSecond() { let f = fin(); if (!f.second) return { error: 'No second club.' }; recallAll(); let v = secondValue(); g.cash += v; baseFinRecord('Sale of ' + club(f.second.clubId).name, v); f.second = null; save(); return { ok: true, v } }

/* ---------- commercial ---------- */
function commercialCost(key) { let c = COMMERCIAL[key], lv = fin().commercial[key]; return lv >= c.levels.length - 1 ? 0 : Math.round(cfg[tier()].income * c.cost[lv + 1]) }
function investCommercial(key) {
  let f = fin(), c = COMMERCIAL[key], cost = commercialCost(key); if (!cost) return { error: 'Already at the highest level.' }; if (g.cash < cost) return { error: 'You need ' + money(cost) + '.' };
  let vote = boardVote('spend', cost); if (!vote.ok) return { error: vote.reason };
  g.cash -= cost; f.commercial[key]++; baseFinRecord(c.name + ' investment', -cost); save(); return { ok: true, cost };
}
function activeCategories() { let f = fin(), cats = {}; for (let s of g.sponsors) cats[LEGACY_CATEGORY[s.id] || s.id] = s.name; for (let d of f.deals) cats[d.category] = d.brand; return cats }
function partnerOffers() {
  let f = fin(); if (f.offers && f.offerSeason === g.season) return f.offers;
  let slots = Object.keys(SLOTS), seed = Math.abs(hash(g.clubId + ':' + g.season)), pool = [...BRANDS], offers = [], t = tier();
  for (let i = 0; i < 4; i++) {
    let b = pool.splice((seed + i * 7) % pool.length, 1)[0], slot = slots[i % slots.length];
    let fee = Math.round(cfg[t].sponsor * SLOTS[slot][1] * profileIndex() * (1 + .12 * -b.ethics) / 1000) * 1000;
    offers.push({ id: 'O' + g.season + '-' + i, ...b, slot, fee, rel: 50, tries: 0, closed: false });
  }
  f.offers = offers; f.offerSeason = g.season; return offers;
}
function offerCeiling(o, years) { return o.fee * (1.06 + (years - 1) * .05) * (.85 + o.rel / 100 * .3) }
function signPartner(id, annual, years) {
  let f = fin(), o = partnerOffers().find(x => x.id === id); if (!o) return { error: 'Offer not found.' }; if (o.closed) return { error: o.brand + ' have walked away.' };
  if (g.ended) return { error: 'Career ended.' };
  if (!Number.isFinite(annual) || annual <= 0 || ![1, 2, 3].includes(years)) return { error: 'Enter valid terms.' };
  let cats = activeCategories(); if (cats[o.category]) return { error: `Exclusivity clash: your ${cats[o.category]} agreement already covers the ${o.category} category.` };
  if (f.deals.some(d => d.slot === o.slot)) return { error: 'You already have a ' + SLOTS[o.slot][0].toLowerCase() + '.' };
  let ceil = offerCeiling(o, years);
  if (annual > ceil) {
    o.tries++; o.rel -= 10;
    if (o.tries >= 3 || o.rel <= 15) { o.closed = true; save(); return { error: o.brand + ' have lost patience and walked away.', closed: true } }
    save(); return { error: `${o.brand} would consider ${money(Math.floor(ceil / 1000) * 1000)} on those terms. They are getting impatient (${3 - o.tries} proposal${3 - o.tries === 1 ? '' : 's'} left).` };
  }
  f.seq++; f.deals.push({ id: 'D' + f.seq, brand: o.brand, category: o.category, slot: o.slot, annual: Math.round(annual), years, ethics: o.ethics, rel: o.rel, signed: g.season });
  o.closed = true; o.signed = true;
  if (o.ethics) g.trust = clamp(g.trust + o.ethics * 2, 5, 100);
  fmsg('Commercial agreement signed', `${o.brand}: ${money(annual)} a season for ${years} season${years > 1 ? 's' : ''} as ${SLOTS[o.slot][0].toLowerCase()}.${o.ethics < 0 ? ' Some supporters are unhappy about the link.' : o.ethics > 0 ? ' Supporters like the fit.' : ''}`, 'sponsorship', 'Commercial'); save(); return { ok: true };
}
signOffer = function (id, annual, upfront, years) {
  let cats = activeCategories(), cat = LEGACY_CATEGORY[id];
  if (cat && cats[cat] && !g.sponsors.some(s => s.id === id)) return { error: `Exclusivity clash: your ${cats[cat]} agreement already covers the ${cat} category.` };
  let r = baseFinSignOffer(id, annual, upfront, years); if (r.ok) fin().rel[id] = 50; return r;
};
function commercialSeasonEnd() {
  let f = fin(), n = g.tables[tier()].length, pos = position(), frac = (pos - 1) / (n - 1), delta = frac <= .4 ? 6 : frac >= .7 ? -6 : 0;
  for (let d of f.deals) { d.rel = clamp((d.rel || 50) + delta + (d.ethics < 0 ? d.ethics * 2 : d.ethics), 0, 100); if (d.ethics) g.trust = clamp(g.trust + (d.ethics < 0 ? d.ethics * 1.5 : d.ethics * .5), 5, 100) }
  for (let s of g.sponsors) f.rel[s.id] = clamp((f.rel[s.id] ?? 50) + delta, 0, 100);
  for (let d of [...f.deals]) if (d.rel < 20) { f.deals = f.deals.filter(x => x !== d); fmsg('Sponsor ends partnership', `${d.brand} have terminated their agreement early after a disappointing relationship with the club.`, 'sponsorship', 'Commercial') }
  for (let s of [...g.sponsors]) if ((f.rel[s.id] ?? 50) < 20) { g.sponsors = g.sponsors.filter(x => x !== s); fmsg('Sponsor ends partnership', `${s.name} have terminated their agreement early after a disappointing relationship with the club.`, 'sponsorship', 'Sponsorship') }
  if (f.season.gifts / Math.max(1, sumRev(f.season.rev)) > .35) g.trust = clamp(g.trust - 3, 5, 100);
}

/* ---------- promotion / relegation wage clauses ---------- */
function wageLevel(t) { return cfg[t].wage * (fin().econ ? ECONOMY.wageScale[t] : 1) }
function wageFactor(from, to) { if (to === from) return 1; let r = wageLevel(to) / wageLevel(from); return Math.pow(r, to < from ? .6 : .3) }

/* ---------- season hooks ---------- */
completeWorldSeason = function () { baseFinComplete(); if (g.world.seasonComplete && !fin().season.closed) { fin().season.closed = true; regSeasonEnd(); commercialSeasonEnd(); save() } };
performSeasonRollover = function () {
  let before = g.season, tb = tier(); baseFinRollover(); if (g.season === before) return;
  let f = fin(), t = tier();
  f.amort = f.amort.map(a => ({ ...a, left: a.left - 1 })).filter(a => a.left > 0);
  f.deals = f.deals.map(d => { let n = { ...d, years: d.years - 1 }; if (n.annualNext) { n.annual = n.annualNext; delete n.annualNext } return n }).filter(d => d.years > 0);
  if (f.parachute) { f.parachute.left--; if (f.parachute.left <= 0) f.parachute = null }
  f.season = newSeasonStats(); f.warned = {}; f.offers = null;
  if (t !== tb) {
    let k = wageFactor(tb, t); for (let p of g.squad) p.wage = Math.round(p.wage * k);
    fmsg(t < tb ? 'Promotion wage rises' : 'Relegation wage reductions', t < tb ? `Promotion clauses and the new level mean the first-team wage bill rises by ${Math.round((k - 1) * 100)}% to ${money(squadWages())} a week. Review the forecast and compliance screens.` : `Relegation clauses cut the first-team wage bill by ${Math.round((1 - k) * 100)}% to ${money(squadWages())} a week. Costs still outrun income for a while, so check the forecast.`, 'finance', 'Forecast');
  }
  if (t > tb) { let a = PARACHUTE[tb]; if (a) { f.parachute = { left: a.length, amounts: a.map(x => Math.round(x * cfg[tb].income * 52)) }; fmsg('Parachute payments agreed', 'Relegation brings ' + a.length + ' seasons of parachute payments, starting at ' + money(f.parachute.amounts[0]) + ' in the first year.', 'finance', 'Ownership') } if (t === 2 && tb === 1) f.relegatedSeason = g.season }
  if (f.second && f.second.invest && f.second.bonus < 8) { let add = Math.min(f.second.invest * 1.5, 8 - f.second.bonus); g.strengths[f.second.clubId] = (g.strengths[f.second.clubId] ?? team(f.second.clubId).strength) + add; f.second.bonus += add }
  if (f.second && g.divisions[t].includes(f.second.clubId)) { f.secondClash = { clubId: f.second.clubId, division: t } }
  if (f.pendingDeduction && myrow()) { myrow().pts -= f.pendingDeduction; fmsg('Points deduction applied', `${f.pendingDeduction} points have been deducted for last season’s breach of the financial rules.`, 'finance', 'Compliance'); f.pendingDeduction = 0 }
  save();
};
negotiatePlayer = function (id) {
  if (g.fin && embargoed()) return toast('Transfer embargo: the league has barred you from registering players until ' + dateText(g.fin.embargo.until, false) + '.');
  return baseFinNegotiate(id);
};
processDeals = function () {
  if (g.fin && embargoed()) for (let [id, d] of Object.entries(g.world.deals)) if (d.status === 'awaiting' && d.respondOn <= g.world.date) { d.status = 'rejected'; d.closed = true; d.reply = 'The league’s transfer embargo prevents this registration. No money was spent.'; msg('Transfer talks ended', d.player.name + ': ' + d.reply, 'football') }
  return baseFinProcessDeals();
};
validateSave = function (x) { baseFinValidate(x); if (x.fin && (typeof x.fin !== 'object' || !Array.isArray(x.fin.loans) || !Array.isArray(x.fin.investors) || !x.fin.season || !x.fin.owner)) throw Error('Invalid finance state'); return true };

const baseFinUpgrade = upgrade, baseFinSubmitTransfer = submitTransfer;
upgrade = function (id) { let u = upgradeOptions().find(x => x.id === id); if (u && g.fin) { let v = boardVote('spend', u.cost); if (!v.ok) return toast(v.reason) } return baseFinUpgrade(id) };
submitTransfer = function (id) {
  let d = g.world.deals[id];
  if (d && d.stage === 'club' && g.fin) { let fee = Math.round(Number($('transferFee').value)); if (Number.isFinite(fee) && fee > 0) { let v = boardVote('spend', fee); if (!v.ok) return toast(v.reason) } }
  return baseFinSubmitTransfer(id);
};
