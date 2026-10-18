/* Delegation. Minor decisions arrive as a real queue (repairs, small sponsor and contract requests, renewals) with options,
   effects and deadlines. Hire a finance director, head of commercial and director of football and set what each may approve alone. */

const baseDelWeekly = weeklyWorld, baseDelAdvance = advanceDay, baseDelRollover = performSeasonRollover;
const DEL_ROLES = { finance: 'Finance director', commercial: 'Head of commercial', football: 'Director of football' };
const DEL_Q = [null, { name: 'Capable', wage: .012, p: .65 }, { name: 'Experienced', wage: .025, p: .8 }, { name: 'Expert', wage: .045, p: .95 }];
const DEL_LIMITS = { off: 0, low: .15, medium: .5, high: 1.5 };   // × weekly central income, per decision
const DEL_LIMIT_NAMES = { off: 'Approves nothing', low: 'Small items', medium: 'Medium items', high: 'Large items' };

function del() {
  let f = fin();
  if (!f.del) f.del = { staff: { finance: { q: 0, limit: 'low' }, commercial: { q: 0, limit: 'low' }, football: { q: 0, limit: 'low' } }, queue: [], log: [], pending: [], boost: [], seq: 0, made: 0, mistakes: 0, renewed: {} };
  return f.del;
}
function limitAmount(role) { return Math.round(cfg[tier()].income * DEL_LIMITS[del().staff[role].limit]) }
function delWeekly() { let d = del(); return Math.round(Object.values(d.staff).reduce((s, x) => s + (x.q ? cfg[tier()].wage * DEL_Q[x.q].wage : 0), 0)) }

/* ---------- effects ---------- */
function applyFx(d, o) {
  let fx = o.fx || {}, f = fin(), w = g.world, ds = del(), say = [];
  if (fx.cash) { g.cash += fx.cash; record('Decision: ' + d.title, fx.cash); say.push((fx.cash > 0 ? '+' : '') + money(fx.cash)) }
  if (fx.gamble) { let win = rnd() < fx.gamble.prob, v = win ? fx.gamble.win : fx.gamble.lose; if (v) { g.cash += v; record('Decision: ' + d.title, v) } say.push(win ? 'the counter-offer worked: +' + money(v) : 'they walked away') }
  if (fx.trust) { g.trust = clamp(g.trust + fx.trust, 5, 100); say.push('fan mood ' + (fx.trust > 0 ? '+' : '') + fx.trust) }
  if (fx.morale) g.morale = clamp(g.morale + fx.morale, 10, 100);
  if (fx.mgr) { w.managerTrust = clamp(w.managerTrust + fx.mgr, 5, 100); say.push('manager relationship ' + (fx.mgr > 0 ? '+' : '') + fx.mgr) }
  if (fx.boost) { ds.boost.push({ left: fx.boost.weeks, amount: fx.boost.amount }); say.push('extra sales of ' + money(fx.boost.amount) + '/week for ' + fx.boost.weeks + ' weeks') }
  if (fx.later && rnd() < fx.later.prob) ds.pending.push({ date: dayAdd(w.date, fx.later.days), cash: fx.later.cash, title: fx.later.title });
  if (fx.wage) { let p = g.squad.find(x => x.id === fx.wage.pid); if (p) { p.wage = Math.round(p.wage * (1 + fx.wage.pct / 100)); say.push(p.name + ' wage +' + fx.wage.pct + '%') } }
  if (fx.wageGamble) { let p = g.squad.find(x => x.id === fx.wageGamble.pid); if (p) { if (rnd() < fx.wageGamble.prob) { p.wage = Math.round(p.wage * (1 + fx.wageGamble.pct / 100)); say.push('he accepted') } else { g.morale = clamp(g.morale - 2, 10, 100); say.push('he was unhappy with the offer') } } }
  if (fx.scout) { for (let i = 0; i < fx.scout; i++) scoutPlayers(true); say.push(fx.scout + ' extra scouted targets') }
  if (fx.rest) { let p = g.squad.find(x => x.id === fx.rest); if (p) { p.rest = true; p.fit = Math.min(100, fitOf(p) + 15); say.push(p.name + ' rested') } }
  if (fx.risk) { let p = g.squad.find(x => x.id === fx.risk); if (p) p.riskNext = true }
  if (fx.fitAll) { for (let p of g.squad) if (!p.inj) p.fit = Math.min(100, fitOf(p) + fx.fitAll); say.push('squad fitness +' + fx.fitAll) }
  if (fx.renew) applyRenewal(fx.renew, say);
  return say.join(' · ');
}
function applyRenewal(r, say) {
  let f = fin();
  if (r.target === 'core') { let s = g.sponsors.find(x => x.id === r.id); if (s) { s.years += r.years; s.annual = r.annual; f.rel[r.id] = clamp((f.rel[r.id] ?? 50) + 5, 0, 100); say.push(s.name + ' renewed: ' + money(r.annual) + ' for ' + r.years + ' more season' + (r.years > 1 ? 's' : '')) } }
  else { let d = f.deals.find(x => x.id === r.id); if (d) { d.years += r.years; d.annualNext = r.annual; d.rel = clamp((d.rel || 50) + 5, 0, 100); say.push(d.brand + ' renewed: ' + money(r.annual) + ' for ' + r.years + ' more season' + (r.years > 1 ? 's' : '')) } }
}

/* ---------- templates ---------- */
const rnd2 = (a, b) => a + rnd() * (b - a);
function tplRepair(U) {
  let X = Math.round(U * rnd2(.3, 1) / 100) * 100 || 500;
  return { kind: 'finance', title: ['Pitch drainage repair', 'Floodlight repair', 'Turnstile and gate repairs'][Math.floor(rnd() * 3)], amount: X, def: 2, body: `The ground staff say a repair is needed. A full fix costs ${money(X)}.`,
    opts: [{ label: 'Approve the full repair', fx: { cash: -X }, val: 3 }, { label: 'Cheap patch (' + money(Math.round(X * .4)) + ')', fx: { cash: -Math.round(X * .4), later: { prob: .45, cash: -Math.round(X * 1.8), days: 42, title: 'The patch repair failed' } }, val: 2 }, { label: 'Defer it', fx: { trust: -2, later: { prob: .6, cash: -Math.round(X * 2.4), days: 35, title: 'Emergency repair after deferral' } }, val: 1 }] };
}
function tplInsurance(U) {
  let P = Math.round(U * rnd2(.2, .5) / 100) * 100 || 400;
  return { kind: 'finance', title: 'Insurance renewal', amount: P * 2, def: 0, body: `The annual policy is up for renewal. Standard cover costs ${money(P)}.`,
    opts: [{ label: 'Standard cover (' + money(P) + ')', fx: { cash: -P, later: { prob: .18, cash: -Math.round(P * 3.5), days: 60, title: 'Insurance shortfall on a claim' } }, val: 2 }, { label: 'Enhanced cover (' + money(Math.round(P * 1.6)) + ')', fx: { cash: -Math.round(P * 1.6) }, val: 3 }, { label: 'Minimum cover (' + money(Math.round(P * .6)) + ')', fx: { cash: -Math.round(P * .6), later: { prob: .4, cash: -P * 4, days: 60, title: 'Uninsured loss' } }, val: 1 }] };
}
function tplStewards(U) {
  let X = Math.round(U * rnd2(.15, .45) / 100) * 100 || 300;
  return { kind: 'finance', title: 'Matchday stewarding costs', amount: X, def: 1, body: `Stewarding is running over budget. The full rota costs ${money(X)} more.`,
    opts: [{ label: 'Approve the full rota', fx: { cash: -X }, val: 2 }, { label: 'Trim it to half', fx: { cash: -Math.round(X / 2), trust: -1.5, later: { prob: .3, cash: -X * 2, days: 30, title: 'Matchday incident costs' } }, val: 1 }] };
}
function tplAdBoard(U) {
  let A = Math.round(U * rnd2(.4, 1) / 100) * 100 || 500;
  return { kind: 'commercial', title: 'Local firm wants ad boards', amount: A * .5, def: 2, body: `A local business offers ${money(A)} for pitch-side ad boards this season.`,
    opts: [{ label: 'Accept ' + money(A), fx: { cash: A }, val: 2 }, { label: 'Counter at +25%', fx: { gamble: { prob: .55, win: Math.round(A * 1.25), lose: 0 } }, val: 1.5 }, { label: 'Decline', fx: {}, val: 0 }] };
}
function tplCommunity(U) {
  let C = Math.round(U * rnd2(.2, .5) / 100) * 100 || 300;
  return { kind: 'commercial', title: 'Community day request', amount: C, def: 2, body: `The council asks the club to host a community open day. Full funding is ${money(C)}.`,
    opts: [{ label: 'Fund it (' + money(C) + ')', fx: { cash: -C, trust: 3 }, val: 2 }, { label: 'Half-fund it', fx: { cash: -Math.round(C / 2), trust: 1 }, val: 1.5 }, { label: 'Decline', fx: { trust: -1 }, val: 1 }] };
}
function tplMerch(U) {
  let M = Math.round(U * rnd2(.3, .8) / 100) * 100 || 400;
  return { kind: 'commercial', title: 'Bulk merchandise order', amount: M, def: 2, body: `The kit supplier offers a bulk order for ${money(M)}. Previous orders sold through at about a 35% margin over twelve weeks.`,
    opts: [{ label: 'Order in bulk (' + money(M) + ')', fx: { cash: -M, boost: { weeks: 12, amount: Math.round(M * 1.35 / 12) } }, val: 3 }, { label: 'Smaller order', fx: { cash: -Math.round(M / 2), boost: { weeks: 12, amount: Math.round(M * .675 / 12) } }, val: 2 }, { label: 'Skip it', fx: {}, val: 0 }] };
}
function tplContract() {
  let ranked = [...g.squad].sort((a, b) => b.rating - a.rating), pool = ranked.slice(13); if (!pool.length) return null;
  let p = pool[Math.floor(rnd() * pool.length)], pct = Math.round(rnd2(8, 20)), cost = Math.round(p.wage * pct / 100);
  return { kind: 'football', title: 'Contract request: ' + p.name, amount: cost * 20, def: 2, body: `${p.name} (${p.position}, ${Math.round(p.rating)}) is asking for a ${pct}% pay rise, about ${money(cost)} a week.`,
    opts: [{ label: 'Agree the rise', fx: { wage: { pid: p.id, pct }, morale: 1 }, val: 1.5 }, { label: 'Offer half the rise', fx: { wageGamble: { pid: p.id, pct: Math.round(pct / 2), prob: .5 } }, val: 1 }, { label: 'Refuse', fx: { morale: -1 }, val: .5 }] };
}
function tplScout(U) {
  let S = Math.round(U * rnd2(.2, .5) / 100) * 100 || 300;
  return { kind: 'football', title: 'Scouting trip budget', amount: S, def: 1, body: `Your chief scout wants ${money(S)} for a trip to watch targets.`,
    opts: [{ label: 'Fund the trip (' + money(S) + ')', fx: { cash: -S, scout: 2 }, val: 2 }, { label: 'Decline', fx: {}, val: 0 }] };
}
function tplRest() {
  let tired = g.squad.filter(p => !p.inj && !p.rest && fitOf(p) < 65 && keyPlayers().slice(0, 11).includes(p.id)); if (!tired.length) return null;
  let p = tired[0];
  return { kind: 'football', title: 'Rest ' + p.name + '?', amount: 0, def: 1, body: `The medical team say ${p.name} is at ${Math.round(fitOf(p))}% fitness. Rest him for the next match?`,
    opts: [{ label: 'Rest him', fx: { rest: p.id }, val: 3 }, { label: 'Play him anyway', fx: { risk: p.id }, val: 0 }] };
}
function tplCamp(U) {
  let T = Math.round(U * rnd2(.4, .9) / 100) * 100 || 600;
  return { kind: 'football', title: 'Training camp request', amount: T, def: 1, body: `Your manager wants a short training camp. It costs ${money(T)}.`,
    opts: [{ label: 'Approve (' + money(T) + ')', fx: { cash: -T, fitAll: 12, mgr: 3 }, val: 2 }, { label: 'Decline', fx: { mgr: -3 }, val: 1 }] };
}
const TEMPLATES = { finance: [tplRepair, tplInsurance, tplStewards], commercial: [tplAdBoard, tplCommunity, tplMerch], football: [tplContract, tplScout, tplRest, tplCamp] };
function makeDecision() {
  let U = cfg[tier()].income, r = rnd(), kind = r < .35 ? 'finance' : r < .65 ? 'commercial' : 'football';
  let recent = del().queue.slice(-8).map(x => x.title);
  for (let tries = 0; tries < 10; tries++) { let t = TEMPLATES[kind][Math.floor(rnd() * TEMPLATES[kind].length)]; let d = t(U); if (d && !recent.includes(d.title)) return d }
  return null;
}

/* ---------- queue ---------- */
function queueDecision(d) {
  let ds = del(), w = g.world; d.id = 'X' + (++ds.seq); d.date = w.date; d.due = dayAdd(w.date, 14); d.status = 'open';
  ds.queue.push(d); ds.queue = ds.queue.slice(-60);
  if (delegateTry(d)) return;
  let pp = pausePrefs(), keep = pp.decisions, big = d.amount >= cfg[tier()].income * .9; if (!big) pp.decisions = false;
  msg('Decision: ' + d.title, d.body, 'finance'); pp.decisions = keep;
  let m = g.inbox[0]; m.decisionId = d.id; m.deadline = d.due; m.page = 'Staff';
}
function findDecision(id) { return del().queue.find(x => x.id === id) }
function resolveDecision(id, i, by = 'you') {
  let d = findDecision(id); if (!d || d.status !== 'open') return { error: 'Already decided.' };
  let o = d.opts[i]; if (!o) return { error: 'No such option.' };
  let said = applyFx(d, o); d.status = 'done'; d.choice = i; d.by = by; d.said = said;
  let m = g.inbox.find(x => x.decisionId === id); if (m) { m.handled = true; m.body += '  → ' + o.label + (said ? ' (' + said + ')' : '') + (by === 'default' ? ' [no decision in time]' : '') }
  save(); return { ok: true, said };
}
function answerDecision(id, i) { let r = resolveDecision(id, i, 'you'); if (r.error) toast(r.error); else toast(r.said ? 'Done: ' + r.said : 'Done.'); render() }
function decisionButtons(m) {
  let d = findDecision(m.decisionId); if (!d || d.status !== 'open') return '';
  return `<div class="decisionopts">${d.opts.map((o, i) => `<button class="${i === 0 ? 'primary' : ''}" onclick="answerDecision('${d.id}',${i})">${esc(o.label)}</button>`).join('')}</div><p class="fineprint">Decide by ${dateText(d.due, false)} or "${esc(d.opts[d.def].label)}" is applied. ${hasDelegate(d.kind) ? 'Your ' + DEL_ROLES[d.kind].toLowerCase() + ' only handles items up to ' + money(limitAmount(d.kind)) + '.' : ''}</p>`;
}
function hasDelegate(kind) { return del().staff[kind].q > 0 }
function delegateTry(d) {
  let ds = del(), st = ds.staff[d.kind]; if (!st.q) return false;
  let lim = limitAmount(d.kind); if (!lim || d.amount > lim) return false;
  let used = ds.log.filter(l => l.role === d.kind && daysBetween(l.date, g.world.date) <= 28).reduce((s, l) => s + l.amount, 0);
  if (used + d.amount > lim * 6) return false;
  let order = d.opts.map((o, i) => i).sort((a, b) => d.opts[b].val - d.opts[a].val), best = order[0], pick;
  if (rnd() < DEL_Q[st.q].p) pick = best; else { let others = order.slice(1); pick = rnd() < .6 ? others[others.length - 1] : others[Math.floor(rnd() * others.length)] }
  let r = resolveDecision(d.id, pick, 'delegate'), good = d.opts[pick].val >= d.opts[best].val;
  ds.log.unshift({ date: g.world.date, role: d.kind, title: d.title, choice: d.opts[pick].label, good, amount: d.amount, said: r.said }); ds.log = ds.log.slice(0, 40);
  ds.made++; if (!good) ds.mistakes++;
  msg('Delegated: ' + DEL_ROLES[d.kind] + ' · ' + d.title, `${DEL_ROLES[d.kind]} chose "${d.opts[pick].label}".${good ? '' : ' It was not the best option.'}${r.said ? ' (' + r.said + ')' : ''}`, 'finance'); g.inbox[0].page = 'Staff'; g.inbox[0].handled = false;
  return true;
}
function setDelegate(role, q, limit) {
  let st = del().staff[role]; if (q != null) st.q = Number(q); if (limit) st.limit = limit; save(); render();
}

/* ---------- renewals ---------- */
function renewalCheck() {
  let f = fin(), ds = del(), w = g.world, month = Number(w.date.slice(5, 7)), y = seasonYear(); if (!(month >= 1 && month <= 4)) return;
  let n = g.tables[tier()].length, frac = (position() - 1) / (n - 1), good = frac <= .35;
  let items = [...g.sponsors.filter(s => s.years === 1).map(s => ({ target: 'core', id: s.id, name: s.name, annual: s.annual, rel: f.rel[s.id] ?? 50 })), ...f.deals.filter(d => d.years === 1 && !d.annualNext).map(d => ({ target: 'deal', id: d.id, name: d.brand, annual: d.annual, rel: d.rel ?? 50 }))];
  for (let it of items) {
    let key = it.target + it.id + ':' + y; if (ds.renewed[key]) continue; ds.renewed[key] = 1;
    let base = it.annual * (.9 + it.rel / 100 * .3) * (good ? 1.05 : 1) * Math.pow(profileIndex(), .3), fees = [1, 2, 3].map(k => Math.round(base * (1 + [0, .03, .05][k - 1]) / 1000) * 1000);
    queueDecision({ kind: 'commercial', title: 'Renewal: ' + it.name, amount: it.annual * .25, def: 3, body: `${it.name} are in the final season of their deal (now ${money(it.annual)} a season) and have made a renewal offer. Relationship: ${it.rel >= 65 ? 'strong' : it.rel >= 40 ? 'steady' : 'strained'}.`,
      opts: [1, 2, 3].map(k => ({ label: `Renew for ${k} season${k > 1 ? 's' : ''} at ${money(fees[k - 1])}`, fx: { renew: { target: it.target, id: it.id, years: k, annual: fees[k - 1] } }, val: [0, 2, 3, 2.5][k] })).concat([{ label: 'Let the deal expire', fx: {}, val: 0 }]) });
  }
}

/* ---------- hooks ---------- */
weeklyWorld = function () {
  let prev = g.ledger[0]; baseDelWeekly(); if (g.ledger[0] === prev || g.ended) return;
  let ds = del(), w = g.world, wages = delWeekly(); if (wages) addLedger('Delegates’ salaries', -wages);
  for (let b of ds.boost) { addLedger('Bulk merchandise sales', b.amount); fin().season.rev.commercial += b.amount; b.left-- } ds.boost = ds.boost.filter(b => b.left > 0);
  renewalCheck();
  let open = ds.queue.filter(d => d.status === 'open').length, n = (rnd() < .55 ? 1 : 0) + (rnd() < .15 ? 1 : 0);
  for (let i = 0; i < n && open < 6; i++) { let d = makeDecision(); if (d) { queueDecision(d); open++ } }
};
advanceDay = function () {
  baseDelAdvance(); if (!g || !g.world || g.ended || !g.fin) return;
  let ds = del(), w = g.world;
  for (let p of ds.pending.filter(x => x.date <= w.date)) { g.cash += p.cash; record('Unexpected cost: ' + p.title, p.cash); msg('Cost: ' + p.title, p.title + ': an unexpected ' + money(-p.cash) + ' cost landed.', 'finance') }
  ds.pending = ds.pending.filter(x => x.date > w.date);
  for (let d of ds.queue) if (d.status === 'open' && d.due < w.date) resolveDecision(d.id, d.def, 'default');
};

/* ---------- page ---------- */
function staffPage() {
  let ds = del(), U = cfg[tier()].income, open = ds.queue.filter(d => d.status === 'open');
  let cards = Object.entries(DEL_ROLES).map(([role, name]) => {
    let st = ds.staff[role], mine = ds.log.filter(l => l.role === role).length;
    return `<div class="card pad"><div class="eyebrow">${role.toUpperCase()}</div><h2 style="font-size:22px;margin:10px 0">${name}</h2>
    <label>Quality</label><select onchange="setDelegate('${role}',this.value,null)">${DEL_Q.map((q, i) => `<option value="${i}" ${st.q === i ? 'selected' : ''}>${i ? q.name + ' · ' + money(Math.round(cfg[tier()].wage * q.wage)) + '/week' : 'Not hired'}</option>`).join('')}</select>
    <label>May approve alone</label><select onchange="setDelegate('${role}',null,this.value)" ${st.q ? '' : 'disabled'}>${Object.keys(DEL_LIMITS).map(k => `<option value="${k}" ${st.limit === k ? 'selected' : ''}>${DEL_LIMIT_NAMES[k]}${k === 'off' ? '' : ' · up to ' + money(Math.round(U * DEL_LIMITS[k]))}</option>`).join('')}</select>
    <p class="fineprint">${st.q ? `${mine} recent decisions logged. Better staff pick the best option more often; anything above the limit comes to you.` : 'Without one, every ' + role + ' decision lands in your inbox.'}</p></div>`;
  }).join('');
  let openHtml = open.length ? open.map(d => `<div class="inboxitem prio-decision"><div class="inboxbody"><div class="inboxmeta"><span class="prio prio-decision">Decision</span><span>${esc(DEL_ROLES[d.kind])}</span><span class="pill deadline">Decide by ${dateText(d.due, false)}</span></div><h3>${esc(d.title)}</h3><p>${esc(d.body)}</p><div class="decisionopts">${d.opts.map((o, i) => `<button class="${i === 0 ? 'primary' : ''}" onclick="answerDecision('${d.id}',${i})">${esc(o.label)}</button>`).join('')}</div></div></div>`).join('') : '<div class="pad"><p>Nothing waiting. Your desk is clear.</p></div>';
  let log = ds.log.map(l => `<tr><td>${dateText(l.date, false)}</td><td>${esc(DEL_ROLES[l.role])}</td><td>${esc(l.title)}</td><td>${esc(l.choice)}</td><td class="${l.good ? 'positive' : 'negative'}">${l.good ? 'Best option' : 'Not the best'}</td></tr>`).join('');
  return `<div class="stats">${[['Staff wages', money(delWeekly()) + '/wk', 'delegates’ salaries'], ['Waiting for you', String(open.length), 'decisions open'], ['Delegated', String(ds.made), 'decisions made for you'], ['Mistakes', String(ds.mistakes), ds.made ? Math.round(ds.mistakes / ds.made * 100) + '% of delegated' : 'none yet']].map(([a, b, c]) => `<div class="stat"><div class="label">${a}</div><b>${b}</b><small>${c}</small></div>`).join('')}</div>
  <div class="cards">${cards}</div>${card('Decisions waiting for you', openHtml)}
  ${card('What your delegates have done', `<div class="tablewrap"><table><thead><tr><th>DATE</th><th>WHO</th><th>DECISION</th><th>CHOSE</th><th></th></tr></thead><tbody>${log || '<tr><td colspan="5">Nothing delegated yet. Hire someone above.</td></tr>'}</tbody></table></div>`)}
  <p class="fineprint">Minor decisions arrive about once a week: repairs, insurance, small sponsor and community requests, contract requests, scouting trips and renewals. Large moves such as transfers, loans and big projects always stay with you.</p>`;
}
PAGE_BUILDERS.Staff = staffPage; MY_PAGES.push('Staff');
MY_LABELS.Staff = ['DELEGATE THE SMALL STUFF', 'Staff & decisions', 'Hire people you trust and decide what they can sign off.'];
NAV_ORDER.splice(NAV_ORDER.indexOf('Ownership') + 1, 0, 'Staff'); NAV_ICON.Staff = 'Overview';
NAV_BADGES.Staff = () => { let n = del().queue.filter(d => d.status === 'open').length; return n ? `<span class="count">${n}</span>` : '' };
