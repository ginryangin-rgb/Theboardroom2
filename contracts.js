/* Contracts, free agents and loans.
   Contracts end on 30 June. p.contract is the number of seasons left including the current one (1 = expires this summer).
   Players you do not renew leave. They can be signed back, or others, as free agents at any time. From January you can agree
   pre-contracts with other clubs' expiring players. Loans run in both directions. */

const baseCtrRollover = performSeasonRollover, baseCtrWeekly = weeklyWorld, baseCtrMarket = marketPlayer, baseCtrTeam = team,
  baseCtrWill = willingness, baseCtrNegotiate = negotiatePlayer, baseCtrSubmit = submitTransfer, baseCtrProcess = processDeals,
  baseCtrWindow = windowOpen, baseCtrRec = recruitment, baseCtrShow = showTransfer, baseCtrMarketList = marketList;
let forceWin = 0, freeOnly = false;

function contractYears(p) { return p.contract == null ? 2 : p.contract }
function isExpiring(p) { return contractYears(p) <= 1 && !p.loanIn }
function contractEnd(p) { return '30 Jun ' + (seasonYear() + contractYears(p)) }
function monthNow() { return Number(g.world.date.slice(5, 7)) }
function inExpiryWindow() { let m = monthNow(); return m >= 1 && m <= 6 }
function rankOf(p) { return [...g.squad].sort((a, b) => b.rating - a.rating).findIndex(x => x.id === p.id) + 1 }
function outList() { let f = fin(); return f.out || (f.out = []) }
function preList() { let f = fin(); return f.pre || (f.pre = []) }

windowOpen = function () { return forceWin > 0 || baseCtrWindow() };
team = function (id) { return id === 'FA' ? { id: 'FA', name: 'Free agent', short: 'Free agent', strength: 40 } : baseCtrTeam(id) };
marketPlayer = function (p, owner) {
  let m = baseCtrMarket(p, owner);
  if (m.owner === 'FA') { m.ask = 0; m.free = true; m.fromTier = club(owner)?.league ?? 2; m.wage = Math.round(m.wage * 1.12) }
  return m;
};
willingness = function (p) {
  if (p.owner === 'FA') { let t = p.fromTier ?? 2, ref = (g.divisions[t] || g.divisions[2])[0]; return baseCtrWill({ ...p, owner: ref }) }
  return baseCtrWill(p);
};
function seedFreeAgents() {
  let w = g.world; if (!w || w.freePool === g.season) return; w.freePool = g.season;
  let own = new Set(g.squad.map(p => p.id));
  for (let c of CLUBS) if (c.id !== g.clubId) for (let p of c.players) if (!w.marketOwners[p.id] && !own.has(p.id) && Math.abs(hash(p.id + ':fa:' + g.season)) % 100 < 5) w.marketOwners[p.id] = 'FA';
}
marketList = function () {
  seedFreeAgents();
  let list = baseCtrMarketList();
  return freeOnly ? list.filter(p => p.owner === 'FA') : list;
};

/* ---------- renewals ---------- */
function renewNeed(p) {
  let rank = rankOf(p), greed = (Math.abs(hash(p.id + 'g')) % 10) / 100;
  return Math.round(p.wage * (1.05 + (rank <= 5 ? .12 : rank <= 11 ? .05 : 0) + (p.age < 24 ? .05 : 0) + (p.leaving ? .15 : 0) + greed));
}
function offerRenewal(pid, wage, years) {
  let p = g.squad.find(x => x.id === pid); if (!p) return { error: 'He is not in your squad.' };
  if (p.loanIn) return { error: 'He is on loan: his contract belongs to his club.' };
  if (p.refuses) return { error: p.name + ' has made up his mind to leave. Talks are closed.' };
  wage = Math.round(wage); if (!Number.isFinite(wage) || wage < 1 || ![1, 2, 3, 4].includes(years)) return { error: 'Enter a weekly wage and a length.' };
  let need = renewNeed(p);
  if (wage >= need) {
    p.wage = wage; p.contract = Math.max(contractYears(p), 1 + years); p.renewed = true; p.leaving = null; p.renewTries = 0; g.morale = clamp(g.morale + 1, 10, 100);
    msg('Renewed: ' + p.name, `${p.name} signs a new deal at ${money(wage)} a week, running to ${contractEnd(p)}.`, 'football'); save();
    return { ok: true, text: p.name + ' signs until ' + contractEnd(p) + '.' };
  }
  p.renewTries = (p.renewTries || 0) + 1;
  if (p.renewTries >= 3) { p.refuses = true; msg('Contract talks collapse: ' + p.name, p.name + ' has lost patience and will leave when his contract ends.', 'football'); save(); return { error: p.name + ' has lost patience. Talks are over and he will leave.', closed: true } }
  save(); return { error: `His agent wants at least ${money(need)} a week for that deal. ${3 - p.renewTries} offer${3 - p.renewTries === 1 ? '' : 's'} left.` };
}
function renewModal(pid) {
  let p = g.squad.find(x => x.id === pid); if (!p) return;
  stopClock();
  $('modal').innerHTML = `<div class="overlay"><div class="modal"><div class="topline"><span class="eyebrow">CONTRACT TALKS</span><button class="textbutton" onclick="closeModal()">Close ×</button></div><h1>${esc(p.name)}</h1><p>${p.position} · ${p.age} years · ${Math.round(p.rating)} rating · contract ends ${contractEnd(p)} · currently ${money(p.wage)} a week${p.leaving ? '<br><b class="negative">He has agreed to join ' + esc(team(p.leaving).short) + ' in the summer, so expect to pay extra.</b>' : ''}</p><label>New weekly wage (£)</label><input id="rnWage" type="number" min="1" value="${Math.round(p.wage * 1.1)}"><label>New contract</label><select id="rnYears"><option value="1">1 more season</option><option value="2" selected>2 more seasons</option><option value="3">3 more seasons</option><option value="4">4 more seasons</option></select><div id="rnReply" class="notice">Push too hard, or lowball him, and his agent walks away.</div><div class="regpreview" id="rnPrev"></div><button class="primary" onclick="submitRenew('${pid}')">Offer →</button></div></div>`;
}
function submitRenew(pid) {
  let r = offerRenewal(pid, numVal('rnWage'), Number($('rnYears').value));
  if (r.ok) { closeModal(); render(); toast(r.text) } else { $('rnReply').textContent = r.error; if (r.closed) { closeModal(); render(); toast(r.error) } }
}

/* ---------- pre-contracts (other clubs' players, from January) ---------- */
function preEligible(p) { return p.owner !== 'FA' && p.owner !== g.clubId && !p.free && inExpiryWindow() && Math.abs(hash(p.id + 'pc' + g.season)) % 4 === 0 }
function preContractModal(id) {
  let p = marketList().find(x => x.id === id); if (!p || !preEligible(p)) return toast('That contract is not running down.');
  stopClock();
  $('modal').innerHTML = `<div class="overlay"><div class="modal"><div class="topline"><span class="eyebrow">PRE-CONTRACT</span><button class="textbutton" onclick="closeModal()">Close ×</button></div><h1>${esc(p.name)}</h1><p>${esc(team(p.owner).name)} · ${p.position} · ${p.age} years · ${Math.round(p.rating)} rating. His contract ends on 30 June. Agree terms now and he joins you for free on 1 July. His club cannot stop him.</p><label>Weekly wage (£)</label><input id="pcWage" type="number" min="1" value="${Math.round(p.wage * 1.2)}"><label>Contract length</label><select id="pcYears"><option value="2">2 years</option><option value="3" selected>3 years</option><option value="4">4 years</option></select><div id="pcReply" class="notice">${esc(willingness(p).reason)}</div><button class="primary" onclick="submitPre('${id}')">Offer terms →</button></div></div>`;
}
function submitPre(id) {
  let p = marketList().find(x => x.id === id), w = g.world, f = fin(); if (!p) return;
  if (embargoed && g.fin && embargoed()) { $('pcReply').textContent = 'Your transfer embargo stops you registering players.'; return }
  if (g.squad.length + preList().length >= 35) { $('pcReply').textContent = 'Your squad is full.'; return }
  let i = willingness(p); if (i.code === 'no') { $('pcReply').textContent = 'He considers the move a step too far.'; return }
  let wage = numVal('pcWage'), years = Number($('pcYears').value), need = Math.round(p.wage * (i.code === 'maybe' ? 1.35 : 1) * 1.1);
  w.preTries = w.preTries || {}; w.preTries[id] = (w.preTries[id] || 0) + 1;
  if (!Number.isFinite(wage) || wage < need) { if (w.preTries[id] >= 3) { closeModal(); toast(p.name + ' has lost interest.'); w.marketLock = w.marketLock || {}; return } $('pcReply').textContent = `His agent wants at least ${money(need)} a week. ${3 - w.preTries[id]} offers left.`; return }
  preList().push({ p: { ...p, owner: g.clubId }, wage, years }); w.marketOwners[p.id] = g.clubId; w.transferred.push(p.id);
  msg('Agreed: ' + p.name + ' joins in the summer', `${p.name} has agreed a pre-contract at ${money(wage)} a week for ${years} years. He joins on 1 July.`, 'football'); closeModal(); save(); render(); toast(p.name + ' will join you on 1 July.');
}

/* ---------- loans ---------- */
function loanOutTo(p, clubId, fee) {
  let date = g.world.date; g.squad = g.squad.filter(x => x.id !== p.id);
  outList().push({ p, club: clubId, fee, start: date }); g.cash += fee; if (fee) record('Loan fee received: ' + p.name, fee);
  addNews(team(clubId).name + ' take ' + p.name + ' on loan', club().name + ' send the player out for the rest of the season.', 'transfer');
  msg('On loan: ' + p.name, `${p.name} joins ${team(clubId).short} on loan until the end of the season. They pay his wages${fee ? ' and a ' + money(fee) + ' loan fee' : ''}.`, 'football'); save();
}
function loanOutModal(pid) {
  let p = g.squad.find(x => x.id === pid); if (!p) return; stopClock();
  let clubs = CLUBS.filter(c => c.id !== g.clubId && Math.abs(c.league - tier()) <= 1).sort((a, b) => Math.abs(hash(a.id + pid)) - Math.abs(hash(b.id + pid))).slice(0, 6), fee = Math.round(playerValue(p) * .04 / 1000) * 1000;
  $('modal').innerHTML = `<div class="overlay"><div class="modal"><div class="topline"><span class="eyebrow">LOAN OUT</span><button class="textbutton" onclick="closeModal()">Close ×</button></div><h1>${esc(p.name)}</h1><p>${p.position} · ${p.age} years · ${Math.round(p.rating)} rating. Out for the rest of the season: they pay his wage (${money(p.wage)}/week) and a loan fee of about ${money(fee)}. Young players develop when they play.</p><label>Send him to</label><select id="loanClub">${clubs.map(c => `<option value="${c.id}">${esc(c.name)} · ${DB[c.league].name}</option>`).join('')}</select><div id="loReply" class="notice">${windowOpen() ? 'The window is open, so a loan can be agreed.' : 'Loans can only be agreed while a window is open.'}</div><button class="primary" onclick="doLoanOut('${pid}')">Agree loan →</button></div></div>`;
}
function doLoanOut(pid) {
  let p = g.squad.find(x => x.id === pid); if (!p) return;
  let err = !windowOpen() ? 'Loans can only be agreed while a window is open.' : g.squad.length <= 16 ? 'Keep at least 16 first-team players.' : p.promisedRole === 'key' ? p.name + ' was promised a key role and refuses to go out on loan.' : outList().length >= 4 ? 'You can have four players out on loan at once.' : p.loanIn ? 'He is on loan from another club.' : null;
  if (err) { $('loReply').textContent = err; return }
  loanOutTo(p, $('loanClub').value, Math.round(playerValue(p) * .04 / 1000) * 1000); closeModal(); render(); toast(p.name + ' has gone out on loan.');
}
function recallFromLoan(pid) {
  let e = outList().find(x => x.p.id === pid); if (!e) return { error: 'Not found.' }; if (g.squad.length >= 35) return { error: 'Your squad is full.' };
  fin().out = outList().filter(x => x !== e); g.squad.push(e.p); save(); return { ok: true };
}
function loanInModal(id) {
  let p = marketList().find(x => x.id === id); if (!p) return; stopClock();
  let fee = Math.round(p.ask * .06 / 1000) * 1000, i = willingness(p);
  $('modal').innerHTML = `<div class="overlay"><div class="modal"><div class="topline"><span class="eyebrow">LOAN IN</span><button class="textbutton" onclick="closeModal()">Close ×</button></div><h1>${esc(p.name)}</h1><p>${esc(team(p.owner).name)} · ${p.position} · ${p.age} years · ${Math.round(p.rating)} rating. A loan for the rest of the season: you pay a loan fee of ${money(fee)} and his full wage of about ${money(Math.round(p.wage * (i.code === 'maybe' ? 1.2 : 1)))} a week. You can make it permanent later for ${money(p.ask)}.</p><div id="liReply" class="notice">${windowOpen() ? esc(i.reason) : 'Loans can only be agreed while a window is open.'}</div><button class="primary" onclick="doLoanIn('${id}')">Agree loan →</button></div></div>`;
}
function doLoanIn(id) {
  let p = marketList().find(x => x.id === id); if (!p) return; let i = willingness(p), fee = Math.round(p.ask * .06 / 1000) * 1000;
  let err = !windowOpen() ? 'Loans can only be agreed while a window is open.' : (g.fin && embargoed()) ? 'Your transfer embargo stops you registering players.' : g.squad.length >= 35 ? 'Your squad is full.' : i.code === 'no' ? p.name + ' does not want to drop down to your level, even on loan.' : g.cash < fee ? 'You cannot afford the loan fee.' : null;
  if (err) { $('liReply').textContent = err; return }
  g.cash -= fee; record('Loan fee: ' + p.name, -fee);
  g.squad.push({ ...p, wage: Math.round(p.wage * (i.code === 'maybe' ? 1.2 : 1)), contract: 1, loanIn: { from: p.owner, ask: p.ask }, promisedRole: 'rotation', potential: p.potential });
  addNews(club().name + ' sign ' + p.name + ' on loan', `${p.name} joins from ${team(p.owner).name} until the end of the season.`, 'transfer');
  msg('Loan agreed: ' + p.name, `${p.name} joins from ${team(p.owner).name} for the rest of the season. His wage counts towards your wage bill and the financial rules.`, 'football'); closeModal(); save(); render(); toast(p.name + ' has joined on loan.');
}
function makePermanent(pid) {
  let p = g.squad.find(x => x.id === pid); if (!p || !p.loanIn) return { error: 'He is not on loan.' };
  let cost = p.loanIn.ask; if (g.cash < cost) return { error: 'You need ' + money(cost) + '.' };
  if (typeof boardVote === 'function') { let v = boardVote('spend', cost); if (!v.ok) return { error: v.reason } }
  g.cash -= cost; record('Transfer fee: ' + p.name, -cost); delete p.loanIn; p.contract = 3; g.world.marketOwners[p.id] = g.clubId; g.world.transferred.push(p.id);
  msg('Made permanent: ' + p.name, `${p.name} signs permanently for ${money(cost)} on a contract to ${contractEnd(p)}.`, 'football'); save(); return { ok: true };
}
function sendBack(pid) { let p = g.squad.find(x => x.id === pid); if (!p || !p.loanIn) return { error: 'He is not on loan.' }; if (g.squad.length <= 16) return { error: 'Keep at least 16 first-team players.' }; g.squad = g.squad.filter(x => x.id !== pid); save(); return { ok: true } }

/* ---------- free agents and the market ---------- */
negotiatePlayer = function (id) {
  let p = marketList().find(x => x.id === id);
  if (p && p.owner === 'FA') {
    stopClock();
    if (g.fin && embargoed()) return toast('Transfer embargo: the league has barred you from registering players.');
    let d = g.world.deals[id]; if (d && d.status === 'signed') return; if (d && d.closed) return toast('These talks have broken down.');
    g.world.deals[id] = d || { player: p, status: 'club-agreed', tries: 0, stage: 'player', fee: 0 }; return showTransfer(id);
  }
  return baseCtrNegotiate(id);
};
showTransfer = function (id) {
  baseCtrShow(id); let d = g.world.deals[id], h = $('modal').innerHTML;
  if (d && d.player.owner === 'FA' && typeof h === 'string') $('modal').innerHTML = h.replace(/Club fee agreed: £0\. Now agree terms with the player\./, 'Free agent: no transfer fee. Agree terms with the player.').replace('CLUB NEGOTIATION', 'FREE AGENT').replace('PLAYER CONTRACT', 'FREE AGENT');
};
submitTransfer = function (id) {
  let d = g.world.deals[id];
  if (d && d.player.owner === 'FA') { forceWin++; try { return baseCtrSubmit(id) } finally { forceWin-- } }
  return baseCtrSubmit(id);
};
processDeals = function () {
  let all = g.world.deals, fa = {}, rest = {};
  for (let [id, d] of Object.entries(all)) (d.player.owner === 'FA' ? fa : rest)[id] = d;
  try {
    if (Object.keys(fa).length) {
      g.world.deals = fa; forceWin++; let saved = g.cash, neg = saved < 0; if (neg) g.cash = 0;   // a free agent has no fee, so an overdraft must not block him
      try { baseCtrProcess() } finally { forceWin--; if (neg) g.cash = saved + g.cash }
    }
    g.world.deals = rest; baseCtrProcess();
  } finally { g.world.deals = all }
};
recruitment = function () {
  freeOnly = marketTab === 'free'; let h; try { h = baseCtrRec() } finally { freeOnly = false }
  h = h.replace(/(<button class="[^"]*" onclick="marketTab='shortlist';render\(\)">Shortlist<\/button>)/, `$1<button class="${marketTab === 'free' ? 'active' : ''}" onclick="marketTab='free';render()">Free agents</button>`);
  let byId = {}; for (let p of baseCtrMarketList()) byId[p.id] = p;
  h = h.replace(/<tr>(?:(?!<\/tr>)[\s\S])*?<\/tr>/g, row => {
    let m = row.match(/negotiatePlayer\('([^']+)'\)/); if (!m) return row; let id = m[1], p = byId[id]; if (!p) return row;
    if (p.owner === 'FA') return row.replace(/ disabled>Approach/, '>Sign (free)').replace('>Approach<', '>Sign (free)<');
    let extra = `<button class="iconbutton" onclick="loanInModal('${id}')" ${windowOpen() ? '' : 'disabled'}>Loan</button>`;
    if (preEligible(p) && !windowOpen()) row = row.replace(new RegExp(`onclick="negotiatePlayer\\('${id}'\\)"[^>]*>Approach`), `onclick="preContractModal('${id}')">Pre-contract`);
    else if (preEligible(p)) extra += `<button class="iconbutton" onclick="preContractModal('${id}')">Pre-contract</button>`;
    return row.replace('</td></tr>', ' ' + extra + '</td></tr>');
  });
  return h;
};

/* ---------- weekly: reminders, poaching, loan development ---------- */
weeklyWorld = function () {
  let prev = g.ledger[0]; baseCtrWeekly(); if (g.ledger[0] === prev || g.ended) return;
  let w = g.world, f = fin(), md = w.date.slice(5); w.ctrFlags = w.ctrFlags || {};
  for (let e of outList()) if (e.p.rating < e.p.potential) e.p.rating = Math.min(e.p.potential, e.p.rating + (e.p.age < 25 ? .05 : .01));
  if (!(md >= '01-01' && md <= '06-30')) return;
  let exp = g.squad.filter(p => isExpiring(p) && !p.renewed), key = new Set([...g.squad].sort((a, b) => b.rating - a.rating).slice(0, 13).map(p => p.id));
  if (!w.ctrFlags.jan && exp.length) { w.ctrFlags.jan = true; msg('Contract: ' + exp.length + ' player' + (exp.length > 1 ? 's' : '') + ' out of contract this summer', exp.map(p => p.name).join(', ') + '. Without a new deal they leave on 30 June, and other clubs can already agree pre-contracts with them.', 'football'); g.inbox[0].page = 'Contracts' }
  let left = daysBetween(w.date, iso(seasonYear() + 1, 6, 30));
  for (let p of exp) if (key.has(p.id) && !p.refuses) {
    if (left <= 14 && !w.ctrFlags['u' + p.id]) { w.ctrFlags['u' + p.id] = 1; msg('Contract urgent: ' + p.name + ' expires in ' + left + ' days', p.name + ' leaves on a free transfer on 30 June unless you agree a new deal.', 'football'); g.inbox[0].page = 'Contracts' }
    else if (left <= 60 && left > 14 && !w.ctrFlags['s' + p.id]) { w.ctrFlags['s' + p.id] = 1; msg('Contract: ' + p.name + ' expires in ' + left + ' days', p.name + ' is one of your regulars and his contract is running out. Open talks before another club does.', 'football'); g.inbox[0].page = 'Contracts' }
  }
  for (let p of exp) if (!p.leaving && !p.refuses && rnd() < .02 + (key.has(p.id) ? .025 : 0)) {
    let buyers = CLUBS.filter(c => c.id !== g.clubId && Math.abs(c.league - tier()) <= 1), c = buyers[Math.floor(rnd() * buyers.length)]; if (!c) continue;
    p.leaving = c.id; msg('Contract: ' + p.name + ' agrees to join ' + c.short, `${p.name} has agreed a pre-contract with ${c.name}. He will leave on 30 June unless you can persuade him with a new deal. He will want more now.`, 'football'); g.inbox[0].page = 'Contracts';
  }
};

/* ---------- rollover: who leaves, who arrives ---------- */
performSeasonRollover = function () {
  if (typeof rollingOver !== 'undefined' && rollingOver || !g.world || !g.world.seasonComplete) return baseCtrRollover();
  let f = fin(), before = g.season, tb = tier(), exits = [];
  for (let e of outList()) if (g.squad.length < 35) g.squad.push(e.p); f.out = [];
  let stay = [], go = [];
  for (let p of g.squad) { if (p.loanIn) go.push({ p, kind: 'loanback' }); else if (p.leaving) go.push({ p, kind: 'club' }); else if (isExpiring(p) && !p.renewed) go.push({ p, kind: 'free' }); else stay.push(p) }
  let retained = [];
  for (let e of go.filter(x => x.kind !== 'loanback').sort((a, b) => b.p.rating - a.p.rating)) if (stay.length + retained.length < 18) { let p = e.p; p.contract = 2; p.wage = Math.round(p.wage * 1.12); p.leaving = null; retained.push(p); e.kept = true }
  g.squad = [...stay, ...retained]; go = go.filter(e => !e.kept);
  baseCtrRollover();
  if (g.season !== before + 1) return;
  let w = g.world;
  for (let id of Object.keys(w.marketOwners)) if (w.marketOwners[id] === 'FA') delete w.marketOwners[id];
  for (let e of go) {
    let p = e.p; if (e.kind === 'loanback') continue;
    if (e.kind === 'free') { w.marketOwners[p.id] = 'FA'; w.sold.push({ ...p, owner: 'FA', ask: 0, free: true, fromTier: tb, contract: undefined, inj: null, rest: false }); exits.push(p.name + ' (free agent)') }
    else { let c = club(p.leaving); w.marketOwners[p.id] = p.leaving; w.sold.push({ ...p, owner: p.leaving, ask: Math.round(playerValue(p) * .5 / 1000) * 1000, inj: null }); addNews(c.name + ' sign ' + p.name + ' on a free transfer', p.name + ' leaves ' + club().name + ' at the end of his contract.', 'transfer'); exits.push(p.name + ' (to ' + c.short + ')') }
  }
  w.freePool = null; seedFreeAgents();
  let joined = [];
  for (let e of preList()) { if (g.squad.length >= 35) break; g.squad.push({ ...e.p, wage: e.wage, contract: e.years, promisedRole: 'rotation', fit: 100 }); joined.push(e.p.name) }
  f.pre = [];
  for (let p of g.squad) { p.renewed = false; p.renewTries = 0; p.leaving = null; p.refuses = false }
  if (exits.length) msg('Summer exits', exits.join(', ') + '.', 'football');
  if (joined.length) msg('Summer arrivals', joined.join(', ') + ' join on free transfers.', 'football');
  let retainedNames = retained.map(p => p.name); if (retainedNames.length) msg('Squad too thin: contracts forced through', 'To avoid fielding fewer than 18 players, ' + retainedNames.join(', ') + ' were kept on new two-year deals at 12% more.', 'football');
  save();
};

/* ---------- page ---------- */
function contractsPage() {
  let f = fin(), w = g.world, exp = g.squad.filter(p => isExpiring(p) && !p.renewed), onLoan = g.squad.filter(p => p.loanIn);
  let status = p => p.loanIn ? `<span class="pill">Loan from ${esc(team(p.loanIn.from).short)}</span>` : p.refuses ? '<span class="pill negative">Leaving</span>' : p.leaving ? `<span class="pill negative">Joining ${esc(team(p.leaving).short)}</span>` : p.renewed ? '<span class="pill">Renewed</span>' : isExpiring(p) ? '<span class="pill warnc">Expiring</span>' : '';
  let rows = [...g.squad].sort((a, b) => contractYears(a) - contractYears(b) || b.rating - a.rating).map(p => `<tr><td><b>${esc(p.name)}</b><small>${p.position} · ${p.age}</small></td><td>${Math.round(p.rating)}</td><td>${money(p.wage)}</td><td>${p.loanIn ? 'End of season' : contractEnd(p)}</td><td>${status(p)}</td><td>${p.loanIn ? `<button class="iconbutton" onclick="result(makePermanent('${p.id}'),'Made permanent.')">Make permanent</button> <button class="iconbutton" onclick="result(sendBack('${p.id}'),'Sent back.')">Send back</button>` : `${p.refuses ? '' : `<button class="iconbutton" onclick="renewModal('${p.id}')">Renew</button> `}<button class="iconbutton" onclick="loanOutModal('${p.id}')">Loan out</button>`}</td></tr>`).join('');
  let out = outList().map(e => `<div class="row"><div><h3>${esc(e.p.name)}</h3><small>at ${esc(team(e.club).name)} · ${e.p.rating.toFixed(1)} rating · returns in the summer</small></div><button onclick="result(recallFromLoan('${e.p.id}'),'Recalled.')">Recall</button></div>`).join('');
  let pre = preList().map(e => `<div class="row"><div><h3>${esc(e.p.name)}</h3><small>${e.p.position} · ${Math.round(e.p.rating)} · ${money(e.wage)}/week · ${e.years} years · joins 1 July</small></div></div>`).join('');
  let warn = exp.length && inExpiryWindow() ? `<div class="notice warning"><b>${exp.length} player${exp.length > 1 ? 's' : ''} out of contract on 30 June:</b> ${esc(exp.map(p => p.name).join(', '))}. Renew them or they walk for nothing.</div>` : '';
  return `${warn}<div class="stats">${[['Out of contract', String(exp.length), 'this summer'], ['Wage bill', money(squadWages()) + '/wk', g.squad.length + ' players'], ['On loan in', String(onLoan.length), 'wages count towards the rules'], ['Out on loan / pre-contracts', outList().length + ' / ' + preList().length, 'out now / joining in July']].map(([a, b, c]) => `<div class="stat"><div class="label">${a}</div><b>${b}</b><small>${c}</small></div>`).join('')}</div>
  ${card('Squad contracts', `<div class="tablewrap"><table><thead><tr><th>PLAYER</th><th>RATING</th><th>WAGE</th><th>CONTRACT ENDS</th><th>STATUS</th><th></th></tr></thead><tbody>${rows}</tbody></table></div><div class="pad"><p class="fineprint">Contracts end on 30 June and do not renew by themselves. From January other clubs can agree pre-contracts with your expiring players. Free agents, including players you let go, can be signed at any time from the Recruitment page. Loans can be agreed in transfer windows.</p></div>`)}
  <div class="twocol">${card('Out on loan', `<div class="pad">${out || '<p>Nobody out on loan. Send young or fringe players to play and develop, and take their wages off your bill.</p>'}</div>`)}${card('Joining in the summer', `<div class="pad">${pre || '<p>No pre-contracts agreed. From January you can agree free summer moves for other clubs’ expiring players on the Recruitment page.</p>'}</div>`)}</div>`;
}
PAGE_BUILDERS.Contracts = contractsPage; MY_PAGES.push('Contracts'); MY_LABELS.Contracts = ['PEOPLE COME AND GO', 'Contracts & loans', 'Renew, release, sign and loan: contracts end on 30 June.'];
NAV_ORDER.splice(NAV_ORDER.indexOf('Football') + 1, 0, 'Contracts'); NAV_ICON.Contracts = 'Sponsorship';
NAV_BADGES.Contracts = () => { let n = g.squad.filter(p => isExpiring(p) && !p.renewed && !p.refuses).length; return n && g.world && inExpiryWindow() ? `<span class="count ${n >= 3 ? 'hot' : ''}">${n}</span>` : '' };
