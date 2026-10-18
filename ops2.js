/* Club operations: you now set what the concession stands sell and for how much, how heavily matchday is staffed
   (security, turnstiles, the ground itself), and whether the club runs official coaches for travelling fans — with
   a price you set against what it actually costs to put them on. All of it shows up in the matchday takings and
   the weekly ledger, same as everything else you already run. */

const MENU_DEFAULTS = { pie: ['Meat pie', 1.35, 4.2], burger: ['Burger', 1.9, 5.5], chips: ['Chips', .7, 3.2], hotdog: ['Hot dog', 1.1, 4.0], soft: ['Soft drink', .4, 3.0], beer: ['Beer', 1.3, 5.2], tea: ['Tea & coffee', .3, 2.6] };
const STAFF_ROLES = { security: ['Security & stewarding', '🛡️'], turnstile: ['Turnstiles & ticketing', '🎟️'], ground: ['Groundstaff', '🌱'] };
function ops() {
  if (g.ops) return g.ops; let menu = {}; for (let k in MENU_DEFAULTS) { let [name, cost, price] = MENU_DEFAULTS[k]; menu[k] = { name, cost, price } }
  return g.ops = { menu, staff: { security: 2, turnstile: 2, ground: 2 }, buses: { on: false, price: 12, hire: 420 }, incidents: 0 };
}
function setMenuPrice(k, v) { let o = ops(); if (!o.menu[k]) return; o.menu[k].price = clamp(Number(v) || 0, o.menu[k].cost + .2, o.menu[k].cost * 6); save() }
function setStaffLevel(role, v) { let o = ops(); o.staff[role] = clamp(Math.round(Number(v)), 1, 5); save() }
function setBusPrice(v) { ops().buses.price = clamp(Number(v) || 0, 3, 60); save() }
function setBusHire(v) { ops().buses.hire = clamp(Number(v) || 0, 100, 2000); save() }
function toggleBuses() { ops().buses.on = !ops().buses.on; save() }

/* ---------- concessions: how much gets sold, and at what margin ---------- */
function concessionsForecast(att = (typeof demand === 'function' ? demand().est : Math.round(g.capacity * .8))) {
  let o = ops(), lines = [], income = 0, cost = 0;
  for (let k in o.menu) { let m = o.menu[k], fair = MENU_DEFAULTS[k][2], priceGap = clamp(1 - (m.price - fair) / (fair * 1.4), .3, 1.5);
    let uptake = { pie: .42, burger: .3, chips: .5, hotdog: .22, soft: .55, beer: .38, tea: .3 }[k] * priceGap, units = Math.round(att * uptake), rev = units * m.price, cst = units * m.cost;
    lines.push({ k, name: m.name, units, rev, cst, margin: rev - cst }); income += rev; cost += cst;
  }
  return { lines, income: Math.round(income), cost: Math.round(cost), profit: Math.round(income - cost) };
}
/* ---------- staffing: cost, and what skimping on it actually risks ---------- */
function staffWeeklyCost() { let o = ops(), base = (cfg[tier()].income / 47) * .018; return Object.fromEntries(Object.keys(STAFF_ROLES).map(k => [k, Math.round(base * [0, .55, .85, 1.15, 1.55, 2.1][o.staff[k]] / 10) * 10])) }
function staffTotalWeekly() { let c = staffWeeklyCost(); return c.security + c.turnstile + c.ground }
function securityIncidentChance() { return clamp(.05 - ops().staff.security * .009, .006, .05) * (typeof rivalryToday === 'function' ? 1 : 1) }
function turnstilePenalty() { return clamp((3 - ops().staff.turnstile) * .012, 0, .03) }     // shaves a little off matchday demand when queues are bad
const baseOpsMedRed = medReduction; medReduction = function () { return baseOpsMedRed() * (1 - (ops().staff.ground - 2) * .025) };   // better groundstaff, fewer soft-pitch injuries; worse, a few more
const baseOpsDemandFn = typeof demand === 'function' ? demand : null;
if (baseOpsDemandFn) demand = function () { let d = baseOpsDemandFn(); let est = Math.round(d.est * (1 - turnstilePenalty())); return { ...d, est, fill: Math.min(1, est / Math.max(1, g.capacity)) } };

/* a security incident, rolled on home matchdays: a fine and a dent in fan mood, rarer the better staffed you are */
function opsMatchdayRoll(home) {
  if (!home) return null; if (rnd() > securityIncidentChance()) return null; let o = ops(); o.incidents++;
  let fine = Math.round(cfg[tier()].income * (.03 + rnd() * .05)); g.cash -= fine; g.trust = clamp(g.trust - 3, 5, 100);
  record('Fine: crowd safety incident', -fine); return { fine };
}

/* ---------- supporter coaches on away days: a real price against a real hire cost ---------- */
function busForecast(miles) {
  let o = ops().buses, fair = 11 + miles * .045, gap = clamp(1 - (o.price - fair) / (fair * 1.4), .25, 1.55);
  let interest = clamp(g.fans / 90000, .08, 1) * gap, seats = clamp(Math.round(interest * 220), 0, 1200), coaches = Math.max(1, Math.ceil(seats / 49));
  let income = seats * o.price, cost = coaches * o.hire, profit = income - cost;
  return { seats, coaches, income: Math.round(income), cost: Math.round(cost), profit: Math.round(profit) };
}
function busSettle(miles) { if (!ops().buses.on) return null; let f = busForecast(miles); g.cash += f.profit; record(f.profit >= 0 ? 'Supporter coaches: profit' : 'Supporter coaches: shortfall', f.profit); return f }

/* ---------- weekly ledger lines ---------- */
const baseOps2Weekly = weeklyWorld;
weeklyWorld = function () { baseOps2Weekly(); if (g.ended || !g.world) return; let c = staffWeeklyCost(); g.cash -= c.security + c.turnstile + c.ground; g.ledger[0] && g.ledger[0].items.push(['Matchday staffing', -(c.security + c.turnstile + c.ground)]); };

/* ---------- the page ---------- */
function opsPage() {
  let o = ops(), cf = concessionsForecast(), sc = staffWeeklyCost(), busF = (() => { let f = typeof nextFixture === 'function' ? nextFixture() : null; return f && f.home !== g.clubId ? busForecast(typeof milesBetween === 'function' ? milesBetween(g.clubId, f.home) : 100) : null })();
  return `
  <div class="card"><div class="cardhead"><h2>Food & drink</h2><span class="eyebrow">MATCHDAY · EST. ${money(cf.profit)} PROFIT</span></div><div class="pad">
  <table class="opstable"><tr><th>Item</th><th>Cost</th><th>Price</th><th>Units (est.)</th><th>Margin</th></tr>
  ${cf.lines.map(l => `<tr><td>${esc(l.name)}</td><td>${money(ops().menu[l.k].cost)}</td><td><input type="number" step="0.1" min="${ops().menu[l.k].cost + .2}" value="${ops().menu[l.k].price}" onchange="setMenuPrice('${l.k}',this.value)"></td><td>${l.units.toLocaleString()}</td><td>${money(l.margin)}</td></tr>`).join('')}
  </table><p class="fineprint">Price it too close to cost and you sell more but keep little; price it too high above the going rate (shown by how far each slider has crept from a fair price) and fewer fans bother. Based on an expected crowd of ${(typeof demand === 'function' ? demand().est : g.capacity).toLocaleString()}.</p></div></div>

  <div class="card"><div class="cardhead"><h2>Matchday staffing</h2><span class="eyebrow">${money(sc.security + sc.turnstile + sc.ground)}/WEEK</span></div><div class="pad opsstaff">
  ${Object.entries(STAFF_ROLES).map(([k, [name, icon]]) => `<div class="staffrow"><div class="staffname">${icon} <b>${esc(name)}</b><small>${money(sc[k])}/week</small></div><input type="range" min="1" max="5" value="${o.staff[k]}" oninput="setStaffLevel('${k}',this.value);render()"><span class="stafflevel">Level ${o.staff[k]}</span></div>`).join('')}
  <p class="fineprint">Security: thin cover risks a crowd-safety incident — a fine and a knock to fan trust — the better staffed, the rarer. Turnstiles: short-staffed gates mean queues and a slightly smaller effective crowd. Groundstaff: a well-kept pitch reduces injuries; a neglected one adds to them. ${o.incidents ? o.incidents + ' incident' + (o.incidents > 1 ? 's' : '') + ' so far this ownership.' : 'No incidents so far.'}</p></div></div>

  <div class="card"><div class="cardhead"><h2>Supporter coaches</h2><span class="eyebrow">${o.buses.on ? 'RUNNING' : 'NOT RUNNING'}</span></div><div class="pad">
  <label class="pauseopt"><span><b>Run official coaches to away games</b><small>Fans book a seat from you instead of making their own way; you set the price against what the coach actually costs to hire.</small></span><input type="checkbox" ${o.buses.on ? 'checked' : ''} onchange="toggleBuses();render()"></label>
  ${o.buses.on ? `<div class="twocol"><label>Price per seat<input type="number" min="3" max="60" value="${o.buses.price}" onchange="setBusPrice(this.value)"></label><label>Cost to hire one coach<input type="number" min="100" max="2000" value="${o.buses.hire}" onchange="setBusHire(this.value)"></label></div>
  ${busF ? `<p class="fineprint">Next away day (${busF.coaches} coach${busF.coaches > 1 ? 'es' : ''}, about ${busF.seats} seats sold): estimated ${busF.profit >= 0 ? 'profit' : 'shortfall'} of ${money(Math.abs(busF.profit))}.</p>` : `<p class="fineprint">No away fixture to estimate yet.</p>`}` : ''}
  </div></div>`;
}
icons.Operations = '<path d="M4 7h16M4 12h10M4 17h7"/>'; NAV_ORDER.push('Operations'); PAGE_BUILDERS.Operations = opsPage; MY_PAGES.push('Operations'); MY_LABELS.Operations = ['CLUB OPERATIONS', 'Operations', 'What the concession stands sell, how matchday is staffed, and whether you run the coaches.'];
