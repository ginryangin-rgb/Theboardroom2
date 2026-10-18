/* Phase 2 — screens. Forecast, Compliance, Commercial and Ownership pages, plus the regulation preview inside signing dialogs. */
const MY_PAGES = ['Forecast', 'Compliance', 'Commercial', 'Ownership'];
const MY_LABELS = {
  Forecast: ['SEE IT COMING', 'Cash-flow forecast', 'Twelve months ahead, with what-ifs.'],
  Compliance: ['PLAY BY THE RULES', 'Financial regulation', 'Know where you stand before you spend.'],
  Commercial: ['GROW THE BRAND', 'Commercial & partners', 'Income lines, partners and the price of reputation.'],
  Ownership: ['YOUR CLUB, YOUR MONEY', 'Debt & ownership', 'Loans, investors, takeover bids and your own wealth.']
};
const NAV_ORDER = ['Overview', 'Finances', 'Forecast', 'Compliance', 'Sponsorship', 'Commercial', 'Ownership', 'Football', 'Recruitment', 'Academy', 'Stadium', 'League', 'Competitions', 'Calendar', 'News', 'Inbox', 'Matchday'];
const NAV_ICON = { Recruitment: 'Football', Competitions: 'League', Calendar: 'Overview', News: 'Inbox', Matchday: 'Football', Forecast: 'Finances', Compliance: 'League', Commercial: 'Sponsorship', Ownership: 'Stadium' };
const PAGE_BUILDERS = {}, NAV_BADGES = {}, NAV_LABEL = {};
const baseUIRender = render, baseUIShowTransfer = showTransfer;
let lastTransferId = null, loanTerm = 104;

function pct(n) { return Math.round(n * 100) + '%' }
function statusClass(s) { return s === 'breach' ? 'negative' : s === 'levy' || s === 'warn' ? 'warnc' : 'positive' }
function statusText(s) { return ({ ok: 'Compliant', warn: 'Close to the limit', levy: 'Over the limit: levy', breach: 'Breach: sanctions' })[s] }
function bar(frac, cls = '') { return `<div class="fbar ${cls}"><i style="width:${clamp(frac * 100, 0, 100)}%"></i></div>` }
function result(r, okMsg) { if (r && r.error) toast(r.error); else { if (okMsg) toast(typeof okMsg === 'function' ? okMsg(r) : okMsg) } closeModal(); render() }
function numVal(id) { return Math.round(Number($(id)?.value)) }

/* ---------- Forecast ---------- */
function forecastPage() {
  let f = fin(), sc = f.scenario, r = buildForecast(sc), base = Object.values(sc).some(Boolean) ? buildForecast({}) : null;
  let maxAbs = Math.max(1, ...r.months.map(m => Math.abs(m.end)));
  let alert = r.admin ? `<div class="notice danger"><b>Administration risk.</b> In ${new Date(r.min.date + 'T12:00:00Z').toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })} cash falls to ${money(r.min.cash)}, beyond your overdraft limit of ${money(r.limit)}. Act now.</div>`
    : r.shortfall ? `<div class="notice warning"><b>Shortfall projected.</b> Cash dips to ${money(r.min.cash)} around ${new Date(r.min.date + 'T12:00:00Z').toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })}. You are using your overdraft. Consider a sponsor, a loan or a sale before then.</div>`
      : `<div class="notice">No shortfall in the next 12 months. Lowest point: ${money(r.min.cash)} around ${dateText(r.min.date, false)}.</div>`;
  let tg = [['promoted', 'We get promoted'], ['relegated', 'We get relegated'], ['sellTop', 'Sell our best player'], ['cupRun', 'Deep cup run (4 extra home games)'], ['stand', 'Build a new stand (home end)']];
  return `${alert}<div class="stats">${[['Lowest cash', money(r.min.cash), dateText(r.min.date, false), r.min.cash < 0], ['12-month net', money(r.net12), 'cash movement', r.net12 < 0], ['Cash in 12 months', money(r.end), base ? 'vs ' + money(base.end) + ' baseline' : 'if nothing changes', r.end < 0], ['Overdraft limit', money(r.limit), 'administration below this', false]].map(([a, b, c, bad]) => `<div class="stat"><div class="label">${a}</div><b class="${bad ? 'negative' : ''}">${b}</b><small>${c}</small></div>`).join('')}</div>
  ${card('What if…', `<div class="pad scenarios">${tg.map(([k, n]) => `<label class="pauseopt"><input type="checkbox" ${sc[k] ? 'checked' : ''} onchange="setScenario('${k}',this.checked)"><span><b>${n}</b>${k === 'promoted' ? '<small>Higher central income and gates, and promotion clauses raise the wage bill sharply.</small>' : k === 'relegated' ? '<small>Lower income, parachute payments if eligible, relegation clauses cut wages only partly.</small>' : k === 'sellTop' ? '<small>Proceeds arrive immediately, his wage leaves the bill.</small>' : k === 'stand' ? '<small>Costs the project price, closes 400 seats while it is built, then adds 1,000. Extra seats only earn money if you would sell them out.</small>' : '<small>Adds home-match income in the next twelve weeks.</small>'}</span></label>`).join('')}</div>`)}
  ${card('Month by month', `<div class="tablewrap"><table class="fctable"><thead><tr><th>MONTH</th><th>INCOME</th><th>COSTS</th><th>NET</th><th>CLOSING CASH</th><th></th></tr></thead><tbody>${r.months.map(m => `<tr class="${m.end < 0 ? 'neg' : ''}"><td>${m.label}</td><td>${compact(m.inc)}</td><td>${compact(m.out)}</td><td class="${m.net < 0 ? 'negative' : 'positive'}">${m.net >= 0 ? '+' : ''}${compact(m.net)}</td><td><b class="${m.end < 0 ? 'negative' : ''}">${compact(m.end)}</b></td><td class="barcell">${bar(Math.abs(m.end) / maxAbs, m.end < 0 ? 'bad' : '')}</td></tr>`).join('')}</tbody></table></div>`)}
  ${r.oneoffs.length ? card('Known one-offs in this window', `<div class="pad">${r.oneoffs.map(([n, v]) => `<div class="row"><span>${esc(n)}</span><b class="${v < 0 ? 'negative' : 'positive'}">${money(v)}</b></div>`).join('')}</div>`) : ''}
  <p class="fineprint">The forecast uses expected values: fixtures already scheduled, current wages and sponsor schedules, and average gates. It does not predict transfers you have not made or cup draws not yet made.</p>`;
}

/* ---------- Compliance ---------- */
function whatIf() {
  let wk = numVal('wiWage') || 0, fee = numVal('wiFee') || 0, i = regImpact(wk, fee);
  $('wiOut').innerHTML = `<div class="row"><span>Now</span><b class="${statusClass(i.before.status)}">${pct(i.before.ratio)} · ${statusText(i.before.status)}</b></div><div class="row"><span>After</span><b class="${statusClass(i.after.status)}">${pct(i.after.ratio)} · ${statusText(i.after.status)}</b></div>`;
}
function compliancePage() {
  let f = fin(), r = rule(), m = metrics(true), ev = evaluate(m), w = g.world, weeksLeft = Math.max(1, Math.ceil(daysBetween(w.date, iso(seasonYear() + 1, 5, 31)) / 7));
  let scale = Math.max(ev.limit * 1.25, ev.ratio * 1.05);
  let extra = '';
  if (ev.kind === 'scr') {
    extra = tier() === 0 ? `<div class="row"><span>Multi-year allowance remaining</span><b>${money(ev.pool == null ? Math.round(r.allowance * ev.revenue) : Math.round(f.pool == null ? r.allowance * ev.revenue : f.pool))}</b></div>`
      : `<div class="row"><span>Owner equity this season</span><b>${money(m.gifts)}</b></div><div class="row"><span>Equity top-up allowance left (season)</span><b>${money(Math.round(ev.equityCap ?? r.equitySeasonCap))}</b></div>`;
  } else extra = `<div class="row"><span>Owner equity this season</span><b>${money(m.gifts)}</b></div><div class="row"><span>${r.equityTurnover ? 'Counts as turnover in full' : 'Each £1 of equity buys £' + r.equityCredit.toFixed(2) + ' of wage room'}</span><b>${f.relegatedSeason === g.season ? 'Relegation allowance in force' : ''}</b></div>`;
  let live = ev.status === 'breach' ? `<div class="notice danger"><b>On course for a breach.</b> ${esc(r.sanction)}</div>` : ev.status === 'levy' ? `<div class="notice warning"><b>Over the limit.</b> A levy of about ${money(ev.fine)} would apply. ${esc(r.sanction)}</div>` : ev.status === 'warn' ? `<div class="notice warning"><b>Close to the line.</b> Check the effect of any signing before you agree it.</div>` : `<div class="notice">You are within the rules with ${money(Math.max(0, Math.round(ev.headroom)))} of headroom this season, about ${money(Math.round(Math.max(0, ev.headroom) / weeksLeft))} a week.</div>`;
  let sanctions = [f.pendingDeduction ? `<div class="row"><span>Points deduction due at next season start</span><b class="negative">−${f.pendingDeduction}</b></div>` : '', f.embargo && embargoed() ? `<div class="row"><span>Transfer embargo until</span><b class="negative">${dateText(f.embargo.until, false)}</b></div>` : ''].join('');
  return `${live}<div class="twocol">${card(r.title + ' · ' + r.league, `<div class="pad"><div class="eyebrow">PROJECTED FOR THIS SEASON</div><div class="bigmoney ${statusClass(ev.status)}">${pct(ev.ratio)}<small>of ${ev.kind === 'scr' ? 'football revenue' : 'turnover'} · limit ${pct(ev.limit)}</small></div><div class="gauge"><i class="fill ${statusClass(ev.status)}" style="width:${clamp(ev.ratio / scale * 100, 0, 100)}%"></i><b class="mark" style="left:${ev.limit / scale * 100}%"></b></div><p class="fineprint">${statusText(ev.status)}. ${ev.kind === 'scr' ? 'Squad costs are wages plus transfer fees spread over three seasons.' : 'Wages and manager costs against turnover.'}</p><div class="row"><span>Revenue${ev.kind === 'scr' ? ' + player sales' : ''} (projected)</span><b>${money(Math.round(ev.revenue))}</b></div><div class="row"><span>${ev.kind === 'scr' ? 'Squad costs' : 'Wages + manager'} (projected)</span><b>${money(Math.round(ev.cost))}</b></div>${extra}${sanctions}</div>`)}${card('Check before you sign', `<div class="pad"><p>Test a signing or wage rise against the rules.</p><label>Extra weekly wages (£)</label><input id="wiWage" type="number" min="0" value="0" oninput="whatIf()"><label>Transfer fee (£)</label><input id="wiFee" type="number" min="0" value="0" oninput="whatIf()"><div id="wiOut" class="whatif"></div><p class="fineprint">The same preview appears inside every signing dialogue.</p></div>`)}</div>
  ${card('Rules in force', `<div class="pad"><p>${esc(r.sanction)}</p><p class="fineprint">Based on the rules agreed for English football for 2026/27 and simplified for the game. Thresholds can be edited by season in <code>rules.js</code>. In-game money amounts are scaled down to match the game economy.</p></div>`)}
  ${card('Past seasons', `<div class="tablewrap"><table><thead><tr><th>SEASON</th><th>DIVISION</th><th>REVENUE</th><th>RATIO</th><th>LIMIT</th><th>OUTCOME</th></tr></thead><tbody>${f.history.length ? [...f.history].reverse().map(h => `<tr><td>${h.season}</td><td>${DB[h.tier].name}</td><td>${compact(h.rev)}</td><td>${pct(h.ratio)}</td><td>${pct(h.limit)}</td><td class="${statusClass(h.status)}">${statusText(h.status)}${h.fine ? ' · ' + compact(h.fine) + ' levy' : ''}${h.deduction ? ' · −' + h.deduction + ' pts' : ''}${h.embargo ? ' · embargo' : ''}</td></tr>`).join('') : '<tr><td colspan="6">The first review arrives at the end of the season.</td></tr>'}</tbody></table></div>`)}`;
}

/* ---------- Ownership ---------- */
function loanQuoteUpdate() {
  let a = numVal('loanAmt'), q = a > 0 ? quoteLoan(a, loanTerm) : null;
  $('loanQuote').innerHTML = q ? `<div class="row"><span>Interest rate</span><b>${q.rate}% a year</b></div><div class="row"><span>Arrangement fee</span><b>${money(q.fee)}</b></div><div class="row"><span>Weekly repayment (about)</span><b>${money(q.weekly)}</b></div><div class="row"><span>Total interest (about)</span><b>${money(q.interestTotal)}</b></div><div class="row"><span>Covenant: keep cash above</span><b>${money(q.floor)}</b></div>` : '<p class="fineprint">Enter an amount to see the terms.</p>';
}
function doLoan() { let r = takeBankLoan(numVal('loanAmt'), loanTerm); result(r, 'Loan agreed.') }
function setLoanTerm(v) { loanTerm = Number(v); loanQuoteUpdate() }
function ownerAmt() { return numVal('ownAmt') }
function secondPick() { return $('secondPick')?.value }
function ownershipPage() {
  let f = fin(), V = clubValuation(), cap = bankCapacity(), ctl = controlShare(), offers = investorOffers(), opts = secondClubOptions();
  let bid = f.bid ? `<div class="notice warning"><b>Takeover approach from ${esc(f.bid.bidder)}.</b> They offer ${money(f.bid.offer)} for the whole club. Your ${ctl}% would pay ${money(Math.round(f.bid.offer * ctl / 100))}. Lapses ${dateText(f.bid.expires, false)}.<div class="actions"><button class="primary" onclick="askThen('Sell the club? This ends your chairmanship.','Sell the club',()=>acceptTakeover())">Accept and sell</button><button onclick="rejectTakeover()">Reject</button></div></div>` : '';
  let sold = f.sold ? `<div class="notice"><b>You sold the club</b> to ${esc(f.sold.bidder)} for ${money(f.sold.offer)} on ${dateText(f.sold.date, false)}. Your personal wealth: ${money(f.sold.wealth)}.</div>` : '';
  let para = f.parachute ? `<div class="row"><span>Parachute payments (${f.parachute.left} season${f.parachute.left > 1 ? 's' : ''} left)</span><b class="positive">${money(f.parachute.amounts[f.parachute.amounts.length - f.parachute.left])} this season</b></div>` : '';
  let loans = [...(g.debt ? [`<div class="row"><div><h3>Club overdraft facility</h3><small>${money(g.debt)} outstanding · ${(.0015 * 52 * 100).toFixed(1)}% a year</small></div><div class="actions"><button onclick="loan()">Borrow more</button><button onclick="repay()">Repay</button></div></div>`] : []), ...f.loans.map(l => `<div class="row"><div><h3>${esc(l.name)}${l.accelerated ? ' · accelerated' : ''}</h3><small>${money(l.balance)} left · ${l.rate.toFixed(1)}% ${l.type === 'bank' ? '· covenant active' : '· from your own pocket'}</small></div><button onclick="result(repayLoan('${l.id}'),'Repaid.')">Repay in full</button></div>`)];
  return `${bid}${sold}<div class="stats">${[['Club valuation', money(V), 'equity value'], ['Total debt', money(totalDebt()), 'bank, owner and facility'], ['Your control', ctl + '%', f.investors.length ? f.investors.length + ' investor(s)' : 'sole owner'], ['Personal wealth', money(f.owner.wealth), 'outside the club']].map(([a, b, c]) => `<div class="stat"><div class="label">${a}</div><b>${b}</b><small>${c}</small></div>`).join('')}</div>
  <div class="twocol">${card('Loans', `<div class="pad">${loans.length ? loans.join('') : '<p>No debt. You are free to borrow when the club needs it.</p>'}${para}<h3 style="margin-top:18px">Borrow from the bank</h3><p class="fineprint">Available: ${money(cap)}, about half of annual revenue less existing debt. Banks charge more the more indebted you are, and set a minimum-cash covenant.</p><label>Amount (£)</label><input id="loanAmt" type="number" min="1000" max="${cap}" value="${Math.round(cap / 2 / 1000) * 1000}" oninput="loanQuoteUpdate()"><label>Term</label><select onchange="setLoanTerm(this.value)"><option value="52" ${loanTerm === 52 ? 'selected' : ''}>1 year</option><option value="104" ${loanTerm === 104 ? 'selected' : ''}>2 years</option><option value="156" ${loanTerm === 156 ? 'selected' : ''}>3 years</option></select><div id="loanQuote" class="whatif"></div><button class="primary" onclick="doLoan()" ${cap < 1000 ? 'disabled' : ''}>Take the loan →</button></div>`)}
  ${card('Your own money', ownerCard(f))}</div>
  <div class="twocol">${card('Investors', `<div class="pad">${f.investors.length ? f.investors.map(i => `<div class="row"><div><h3>${esc(i.name)}</h3><small>${i.stake}% · paid ${money(i.paid)} · dividend ${money(i.weekly)}/week</small></div><button onclick="result(buyBackStake('${i.id}'),r=>'Bought out.')">Buy out</button></div>`).join('') : '<p>No outside investors.</p>'}<h3 style="margin-top:18px">Sell a stake</h3>${offers.length ? offers.map(o => `<div class="row"><div><h3>${o.stake}% to ${esc(o.name)}</h3><small>${money(o.price)} now · dividend about ${money(o.weekly)}/week</small></div><button onclick="result(sellStake(${o.stake}),'Stake sold.')">Sell</button></div>`).join('') : '<p class="fineprint">No investor will take more: you keep at least 51%.</p>'}<p class="fineprint">Selling dilutes your control and share of any sale. With less than 60% you attract more takeover interest.</p></div>`)}
  ${secondClubCard(opts)}</div>${boardPanel()}`;
}

/* ---------- Commercial ---------- */
function partnerNegotiate(id) {
  let o = partnerOffers().find(x => x.id === id); if (!o || o.closed) return;
  let cats = activeCategories(), clash = cats[o.category];
  $('modal').innerHTML = `<div class="overlay"><div class="modal"><div class="topline"><span class="eyebrow">${esc(SLOTS[o.slot][0]).toUpperCase()}</span><button class="textbutton" onclick="closeModal()">Close ×</button></div><h1>${esc(o.brand)}</h1><p>${esc(o.note)} Opening offer: ${money(o.fee)} a season. Category: ${esc(o.category)}. They want exclusivity in it.</p>${clash ? `<div class="notice danger">Exclusivity clash with ${esc(clash)}. They will not sign.</div>` : ''}<label>Annual fee you ask (£)</label><input id="pAsk" type="number" min="1" value="${o.fee}"><label>Length</label><select id="pYears"><option value="1">1 season</option><option value="2">2 seasons</option><option value="3">3 seasons</option></select><div id="pReply" class="notice">${3 - o.tries} proposals left. Push too hard and they walk.</div><button class="primary" onclick="submitPartner('${id}')">Submit proposal →</button></div></div>`;
}
function submitPartner(id) {
  let r = signPartner(id, numVal('pAsk'), Number($('pYears').value));
  if (r.ok) { closeModal(); render(); toast('Partnership signed.') } else { $('pReply').textContent = r.error; if (r.closed) { closeModal(); render(); toast(r.error) } else render() }
}
function relBar(v) { return `<div class="rel"><i style="width:${clamp(v, 0, 100)}%" class="${v < 30 ? 'bad' : v > 65 ? 'good' : ''}"></i></div>` }
function commercialPage() {
  let f = fin(), p = profileIndex(), cw = commercialWeekly(), offers = partnerOffers(), cats = activeCategories();
  let lines = Object.entries(COMMERCIAL).map(([k, c]) => {
    let lv = f.commercial[k], max = c.levels.length - 1, cost = commercialCost(k), income = cfg[tier()].income * c.levels[lv] * p * .65, nextGain = lv < max ? cfg[tier()].income * (c.levels[lv + 1] - c.levels[lv]) * p * .65 : 0, payback = nextGain > 0 ? cost / (nextGain * 48) : 0;
    return `<div class="card pad"><div class="eyebrow">LEVEL ${lv} / ${max}</div><h2 style="font-size:24px;margin:10px 0">${c.name}</h2><p>${c.desc}</p><div class="row"><span>Net income</span><b class="positive">${money(Math.round(income))}/week</b></div>${nextGain ? `<div class="row"><span>Next level adds</span><b>+${money(Math.round(nextGain))}/week · pays back in about ${payback.toFixed(1)} years</b></div>` : ''}<button class="primary investbtn" ${cost ? '' : 'disabled'} onclick="result(investCommercial('${k}'),'Investment made.')">${cost ? 'Invest ' + money(cost) + ' →' : 'Fully developed'}</button></div>`;
  }).join('');
  let core = g.sponsors.map(s => `<div class="row"><div><h3>${esc(s.name)}</h3><small>${esc(LEGACY_CATEGORY[s.id] || '')} · ${money(s.annual)} a season · ${s.years} season(s)</small></div><div class="relwrap">${relBar(f.rel[s.id] ?? 50)}<small>relationship</small></div></div>`).join('');
  let deals = f.deals.map(d => `<div class="row"><div><h3>${esc(d.brand)}</h3><small>${esc(SLOTS[d.slot][0])} · ${esc(d.category)} · ${money(d.annual)} a season · ${d.years} season(s) ${d.ethics < 0 ? '· <span class="negative">fan backlash</span>' : d.ethics > 0 ? '· <span class="positive">fan favourite</span>' : ''}</small></div><div class="relwrap">${relBar(d.rel)}<small>relationship</small></div></div>`).join('');
  let market = offers.map(o => {
    let clash = cats[o.category], slotTaken = f.deals.some(d => d.slot === o.slot), state = o.signed ? 'SIGNED' : o.closed ? 'WALKED AWAY' : clash ? 'CLASH' : slotTaken ? 'SLOT TAKEN' : 'AVAILABLE';
    return `<div class="card pad"><div class="eyebrow">${esc(SLOTS[o.slot][0]).toUpperCase()}</div><h2 style="font-size:24px;margin:10px 0">${esc(o.brand)}</h2><span class="pill ${o.ethics < 0 ? 'negative' : ''}">${state}</span> <span class="pill">${esc(o.category)}</span><div class="bigmoney">${compact(o.fee)}<small>/ season</small></div><p>${esc(o.note)}</p><p class="fineprint">Fan reaction: ${o.ethics < 0 ? 'negative' : o.ethics > 0 ? 'positive' : 'neutral'}${clash ? ' · clashes with ' + esc(clash) : ''}</p><button ${state === 'AVAILABLE' ? '' : 'disabled'} onclick="partnerNegotiate('${o.id}')">Negotiate →</button></div>`;
  }).join('');
  return `<div class="stats"><div class="stat"><div class="label">Club profile</div><b>${p.toFixed(2)}</b><small>scales every commercial fee (results, fans, mood)</small></div><div class="stat"><div class="label">Commercial income</div><b>${compact(cw.net)}</b><small>net per week from your own lines</small></div><div class="stat"><div class="label">Active partners</div><b>${g.sponsors.length + f.deals.length}</b><small>categories are exclusive</small></div><div class="stat"><div class="label">Fan mood</div><b>${Math.round(g.trust)}%</b><small>partners with a bad image cost trust</small></div></div>
  <div class="sectiontitle"><h2>Your income lines</h2></div><div class="cards">${lines}</div>
  <div class="sectiontitle"><h2>Partners</h2><button class="textbutton" onclick="go('Sponsorship')">Core partnerships ↗</button></div>${card('Relationships', `<div class="pad">${core + deals || '<p>No partners yet. Sign the core partnerships first, then add more from the market below.</p>'}<p class="fineprint">Relationships rise with a strong finish and fall with a poor one. A partner below 20 ends the deal early.</p></div>`)}
  <div class="sectiontitle"><h2>This season’s partner market</h2></div><div class="cards">${market}</div>`;
}

/* ---------- navigation, render, signing preview ---------- */
function navHtml() {
  let c = inboxCounts(), hot = c.urgent + c.decision, live = fin().live, comp = live && live.status !== 'ok';
  return NAV_ORDER.map(p => `<button class="${p === page ? 'active' : ''}" onclick="go('${p}')">${icon(NAV_ICON[p] || p)}<span>${p === 'Football' ? 'First team' : NAV_LABEL[p] || p}</span>${p === 'Academy' ? `<span class="count">${g.prospects.length}</span>` : ''}${p === 'Inbox' && hot ? `<span class="count ${c.urgent ? 'hot' : ''}">${hot}</span>` : ''}${NAV_BADGES[p] ? NAV_BADGES[p]() : ''}${p === 'Compliance' && comp ? `<span class="count ${live.status === 'breach' ? 'hot' : ''}">!</span>` : ''}</button>`).join('');
}
render = function () {
  if (!g || rollingOver) return;
  let wanted = page, mine = MY_PAGES.includes(page); if (mine) page = 'Overview';
  baseUIRender(); page = wanted;
  if (!g?.world) return;
  if (mine) {
    [$('subtitle').textContent, $('title').textContent, $('intro').textContent] = MY_LABELS[page];
    $('content').innerHTML = PAGE_BUILDERS[page]();
    $('breadcrumb').textContent = page;
    if (page === 'Ownership') loanQuoteUpdate();
    if (page === 'Compliance') whatIf();
  }
  $('nav').innerHTML = navHtml();
};
showTransfer = function (id) {
  lastTransferId = id; baseUIShowTransfer(id);
  let h = $('modal').innerHTML; if (typeof h !== 'string' || !h.includes('id="transferReply"')) return;
  h = h.replace('id="transferWage"', 'id="transferWage" oninput="regPreview()"').replace('id="transferFee"', 'id="transferFee" oninput="regPreview()"').replace('<div id="transferReply"', '<div id="regPreview" class="notice"></div><div id="transferReply"');
  $('modal').innerHTML = h; regPreview();
};
let ownerTyped = null;
function ownerCard(f) {
  let start = Math.round(cfg[tier()].cash * 2.5), w = f.owner.wealth, putIn = Math.max(0, start - w), ownerLoans = f.loans.filter(l => l.type === 'owner').reduce((s, l) => s + l.balance, 0), def = Math.min(w, Math.round(cfg[tier()].cash * .2 / 1000) * 1000), val = ownerTyped != null ? ownerTyped : def;
  return `<div class="pad"><div class="wealthrow"><div><small>YOUR PERSONAL WEALTH</small><b class="wealthnum">${money(w)}</b><em>${w < start ? '−' + money(start - w) + ' since you took over' : w > start ? '+' + money(w - start) + ' since you took over' : 'unchanged since you took over'}</em></div><div class="wealthside"><div><small>Given as equity</small><b>${money(f.owner.gifts || 0)}</b></div><div><small>Lent to the club</small><b>${money(ownerLoans)}</b></div><div><small>This season</small><b>${money(f.season.gifts)}</b></div></div></div><p class="fineprint">Equity injections count towards the financial rules (see Compliance), but fans notice if the club lives on your cash. Owner loans come back to you when the club repays them.</p><label>Amount (£)</label><input id="ownAmt" type="number" min="1000" value="${val}" oninput="ownerTyped=Number(this.value)||null"><div class="actions"><button onclick="result(injectFunds(ownerAmt(),'gift'),'Equity injected.')">Inject as equity</button><button onclick="result(injectFunds(ownerAmt(),'loan'),'Owner loan made.')">Lend interest-free</button><button onclick="result(takeDividend(ownerAmt()),'Dividend paid to you.')">Take a dividend</button></div><p class="fineprint">The amount box keeps what you type until you change it. Dividends upset supporters.</p></div>`;
}
function regPreview() {
  let d = g.world.deals[lastTransferId], el = $('regPreview'); if (!d || !el) return;
  let wage, fee;
  if ($('transferWage')?.value !== undefined && d.stage === 'player') { wage = Number($('transferWage').value) || 0; fee = d.fee || 0 } else { wage = d.player.wage || 0; fee = Number($('transferFee')?.value) || 0 }
  let i = regImpact(wage, fee), a = i.after, bad = a.status === 'breach', warn = a.status === 'warn' || a.status === 'levy';
  el.className = 'notice ' + (bad ? 'danger' : warn ? 'warning' : '');
  el.innerHTML = `<b>Regulation impact</b> · ${esc(a.title)}: ${pct(i.before.ratio)} → <b class="${statusClass(a.status)}">${pct(a.ratio)}</b> (limit ${pct(a.limit)})${bad ? '<br>This would put you on course for sanctions. ' + (a.embargo ? 'Expect a transfer embargo.' : 'Expect a levy and a points deduction.') : a.status === 'levy' ? '<br>This takes you over the limit. Owner equity covers it, but a levy of about ' + money(a.fine) + ' would apply.' : a.status === 'warn' ? '<br>This takes you to the edge of the limit.' : ''}${d.stage === 'club' ? '<br><small>Assumes his usual wage.</small>' : ''}`;
}

Object.assign(PAGE_BUILDERS, { Forecast: forecastPage, Compliance: compliancePage, Commercial: commercialPage, Ownership: ownershipPage });

function secondClubCard(opts) {
  let f = fin(), s = f.second;
  if (!s) return card('A second club', `<div class="pad"><p>Buy a club in another division as an investment, then invest in it and lend it your young players. It makes or loses money with its league position. You cannot own one in your own division.</p><select id="secondPick">${opts.slice(0, 60).map(o => `<option value="${o.id}">${esc(club(o.id).name)} · ${DB[o.t].name} · ${compact(o.price)}</option>`).join('')}</select><button style="margin-top:10px" onclick="result(buySecond(secondPick()),'Club purchased.')">Buy</button></div>`);
  let c = club(s.clubId), t = g.divisions.findIndex(d => d.includes(s.clubId)), pos = standings(t).findIndex(r => r.id === s.clubId) + 1;
  let loanable = [...g.squad].sort((a, b) => a.rating - b.rating).slice(0, 12).filter(p => !p.inj);
  return card(esc(c.name), `<div class="pad"><div class="row"><span>${DB[t].name}</span><b>${pos}th · worth about ${money(secondValue())}</b></div><div class="row"><span>Weekly result (follows league position)</span><b class="${secondWeekly() < 0 ? 'negative' : 'positive'}">${money(secondWeekly())}</b></div>
  <label>Investment level (hardens the squad each summer, up to +8)</label><select onchange="result(setSecondInvest(this.value),'Investment level set.')">${[0, 1, 2, 3].map(l => `<option value="${l}" ${s.invest === l ? 'selected' : ''}>${['None', 'Light', 'Heavy', 'Maximum'][l]}${l ? ' · ' + money(Math.round(cfg[t].income * [0, .05, .1, .18][l])) + '/week' : ''}</option>`).join('')}</select>
  <h3 style="margin-top:16px">Players on loan there (${s.loaned.length}/3)</h3>${s.loaned.map(p => `<div class="row"><div><h3>${esc(p.name)}</h3><small>${p.position} · ${p.rating.toFixed(1)} rating · wage off your bill and he develops</small></div><button onclick="result(recallLoan('${p.id}'),'Recalled.')">Recall</button></div>`).join('') || '<p class="fineprint">None.</p>'}
  ${s.loaned.length < 3 ? `<select id="loanPick">${loanable.map(p => `<option value="${p.id}">${esc(p.name)} · ${p.position} · ${Math.round(p.rating)}</option>`).join('')}</select><button style="margin-top:10px" onclick="result(loanOut($('loanPick').value),'Sent on loan.')">Send on loan</button>` : ''}
  <button style="margin-top:14px" onclick="result(sellSecond(),'Sold.')">Sell the club</button></div>`);
}
function boardPanel() {
  let f = fin(), total = 100 - controlShare(); if (!f.investors.length) return '';
  return card('Investors and board approval', `<div class="pad"><p>${total >= 20 ? 'With ' + total + '% held outside, investors can block big decisions: any group of objecting investors holding 20% or more vetoes it.' : 'Investors hold ' + total + '%. They can only block decisions once they hold 20% between them.'}</p>${f.investors.map(i => `<div class="row"><div><h3>${esc(i.name)} · ${i.stake}%</h3><small>${esc(({ prudent: 'Prudent', ambitious: 'Ambitious', balanced: 'Balanced' })[i.trait || 'balanced'])}: ${esc(TRAIT_TEXT[i.trait || 'balanced'])}</small></div></div>`).join('')}<p class="fineprint">Votes apply to loans, dividends to you, a second club, and spending over 1.5% of the club’s value (transfer fees, stadium projects, investments).</p></div>`);
}
