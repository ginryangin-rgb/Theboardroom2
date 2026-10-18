/* Negotiations in the boardroom.
   When you make an offer for a player, and when a club bids for one of yours, you sit across the table from the other side and haggle live:
   they answer in the room, their patience runs down if you lowball them, they counter, and they can walk away. Prices are the same hidden
   prices as before (the selling club's floor, the player's wage floor, the buyer's ceiling), and a finished deal is completed by the existing
   signing code. Every incoming offer is a mandatory board matter: time cannot move on until it has been answered. */

const baseNegBid = makeBid, baseNegOpenBoard = openBoardroom, baseNegBidButtons = bidButtons, baseNegRec = recruitment;
MEMBERS.dof = { name: 'Gary Pell', role: 'Director of Football', ini: 'GP', colour: '#4f9d7a' };
const EXEC_NAMES = ['Alan Whitcombe', 'Richard Lowe', 'Helen Marsh', 'David Okafor', 'Susan Pryce', 'Mark Ellery', 'Janet Cole', 'Peter Vane', 'Anita Rao', 'Graham Tully', 'Colin Mercer', 'Joan Hartley'];
const execName = (id, k) => EXEC_NAMES[Math.abs(hash(String(id) + k)) % EXEC_NAMES.length];
let neg = { kind: null, id: null };

/* ---------- the other side's answers: pure, so they can be tested ---------- */
function feeFloor(p) { return p.ask * (.9 + (Math.abs(hash(p.id)) % 10) / 100) }
function wageNeed(p, role) { let i = willingness(p); return Math.round(p.wage * (i.code === 'maybe' ? 1.35 : 1) * (role === 'rotation' ? 1.15 : role === 'key' ? .95 : 1)) }
function newTalk(demand, patience = 3) { return { round: 1, patience, demand, hist: [] } }
function step(st, floor, gap) {
  let move = gap > .12 ? .35 : .55; st.demand = Math.max(Math.ceil(floor / 100) * 100, Math.round((st.demand - (st.demand - floor) * move) / 100) * 100); return st.demand;
}
function mood(st) { return st.patience > 2 ? '😊' : st.patience > 1 ? '😐' : '😠' }
function feeResponse(floor, ask, st, offer) {
  if (offer >= floor) return { type: 'accept', line: offer >= ask ? 'We would not say no to that. Done.' : 'That is acceptable. We have a deal on the fee.' };
  let gap = (floor - offer) / floor; st.patience -= gap > .25 ? 2 : gap > .12 ? 1.5 : 1;
  if (st.patience <= 0) return { type: 'walk', line: 'This is a waste of everyone’s time. We are walking away from the table.' };
  st.round++; let d = Math.ceil(step(st, floor, gap) / 1000) * 1000; st.demand = d;
  return { type: 'counter', demand: d, line: gap > .25 ? `That is nowhere near. We could do ${money(d)}, and not a penny less than that for long.` : d <= Math.ceil(floor / 1000) * 1000 ? `We have gone as far as we can. ${money(d)} and he is yours.` : `We can move a little: ${money(d)}.` };
}
function wageResponse(need, st, offer) {
  if (offer >= need) return { type: 'accept', line: 'That works for my client. We have terms.' };
  let gap = (need - offer) / need; st.patience -= gap > .25 ? 2 : gap > .12 ? 1.5 : 1;
  if (st.patience <= 0) return { type: 'walk', line: 'My client is insulted. We are finished here.' };
  st.round++; let d = Math.ceil(step(st, need, gap) / 100) * 100; st.demand = d;
  return { type: 'counter', demand: d, line: gap > .25 ? `He will not play for that. ${money(d)} a week.` : d <= Math.ceil(need / 100) * 100 ? `That is the best I can do for you: ${money(d)} a week.` : `Closer. He would want ${money(d)} a week.` };
}
function bidResponse(b, ask, st) {
  if (ask <= b.max) return { type: 'accept', price: ask, line: 'You drive a hard bargain, but we will pay it.' };
  let gap = (ask - b.max) / b.max; st.patience -= gap > .3 ? 2 : gap > .15 ? 1.5 : 1;
  if (st.patience <= 0) return { type: 'walk', line: 'That is more than he is worth to us. We are withdrawing our interest.' };
  st.round++; b.fee = Math.min(b.max, Math.round((b.fee + (b.max - b.fee) * .55) / 1000) * 1000);
  return { type: 'counter', offer: b.fee, final: b.fee >= b.max * .98, line: b.fee >= b.max * .98 ? `${money(b.fee)} is our final offer.` : `We can improve it to ${money(b.fee)}.` };
}

/* ---------- the room ---------- */
function seat(k, who, extra = '') { return `<div class="seat ${k} ${extra}"><div class="av" style="background:${who.colour};color:${who.ink || '#fff'}">${esc(who.ini)}</div><small>${esc(who.role)}</small></div>` }
function oppSeats(id, roles) {
  let c = club(id) || team(id), col = /^#[0-9a-f]{6}$/i.test(c.colour || '') ? c.colour : '#6b7a82', ink = inkFor(col);
  return roles.map((role, i) => { let nm = execName(id, role); return { ini: nm.split(' ').map(s => s[0]).join(''), colour: col, ink, role: role + (i ? '' : ' · ' + (c.short || '')), name: nm } });
}
function negHtml(o) {
  let us = [{ ...MEMBERS.you, role: 'Chairman' }, MEMBERS.fd, MEMBERS.dof], opp = o.opp, bub = (cls, who, txt) => `<div class="bubble ${cls}"><b>${esc(who)}</b><p>${txt}</p></div>`;
  let seats = opp.map((w, i) => seat('s-o' + (i + 1), w, o.speaker === 'opp' && i === 0 ? 'speaking' : '')).join('') + us.map((w, i) => seat('s-u' + (i + 1), w, o.speaker === 'us' && i === 0 ? 'speaking' : '')).join('');
  let pat = o.st ? `<div class="patience" title="Their patience"><span>${mood(o.st)} Patience</span>${[1, 2, 3].map(n => `<i class="${o.st.patience >= n ? 'on' : o.st.patience > n - 1 ? 'half' : ''}"></i>`).join('')}</div>` : '';
  let hist = o.st && o.st.hist.length ? `<div class="negtrack">${o.st.hist.map((h, i) => `<span class="rd"><em>Round ${i + 1}</em><b>You ${esc(h.you)}</b><i>→</i><b class="them">${esc(h.them)}</b></span>`).join('')}</div>` : '';
  let stamp = o.result ? `<div class="stamp ${o.result.tone}">${esc(o.result.stamp)}</div>` : '';
  return `<div class="overlay boardoverlay"><div class="meeting negmeeting"><div class="meetinghead"><div><div class="eyebrow">${esc(o.eyebrow)} · ${dateText(g.world.date, false).toUpperCase()}</div><h1>${esc(o.title)}</h1><p class="negsub">${o.sub}</p></div>${pat}</div>
  <div class="room negroom"><div class="wall"><div class="plaque">${o.plaque}</div></div><div class="table"><span class="paper p1"></span><span class="paper p2"></span><span class="paper p3"></span></div>${seats}${stamp}</div>
  ${o.bubbles.slice(0, 1).map(b => bub(b.cls, b.who, b.txt)).join('')}${o.bubbles.length > 1 ? `<div class="advgrid">${o.bubbles.slice(1).map(b => bub(b.cls, b.who, b.txt)).join('')}</div>` : ''}${hist}${o.panel}</div></div>`;
}
function advice(lines) { return lines.map(l => ({ cls: 'side', who: l[0], txt: esc(l[1]) })) }
function whyChip(w, fee) {
  if (typeof regImpact !== 'function') return ''; let i = regImpact(w, fee), a = i.after, bad = a.status === 'breach', warn = a.status === 'warn' || a.status === 'levy';
  return `<div class="regchip ${bad ? 'bad' : warn ? 'warn' : ''}">Squad costs ${pct(i.before.ratio)} → <b>${pct(a.ratio)}</b> (limit ${pct(a.limit)})${bad ? ' · sanctions likely' : warn ? ' · at the limit' : ''}</div>`;
}
function negOpenCheck(p, d) {
  if (!p) return 'The player is no longer on the market.';
  if (d && d.status === 'signed') return 'He has already signed.';
  if (d && d.closed) return 'These talks have broken down. Revisit the player next season.';
  if (p.owner !== 'FA' && !windowOpen()) return 'The transfer window is closed. Add the player to your shortlist for the next window.';
  if (g.fin && embargoed()) return 'Transfer embargo: the league has barred you from registering players until ' + dateText(g.fin.embargo.until, false) + '.';
  if (g.squad.length >= 35) return 'Your first-team squad is full.';
  if (willingness(p).code === 'no') return p.name + ' will not consider a move down to your level.';
  return null;
}
function openNegotiation(id) {
  stopClock(); let p = marketList().find(x => x.id === id), d = g.world.deals[id], err = negOpenCheck(p, d); if (err) return toast(err);
  if (d && d.status === 'awaiting') return showTransfer(id);
  if (!d) d = g.world.deals[id] = p.owner === 'FA' ? { player: p, status: 'club-agreed', tries: 0, stage: 'player', fee: 0 } : { player: p, status: 'club', tries: 0, stage: 'club' };
  neg = { kind: d.stage === 'club' ? 'fee' : 'wage', id }; negView();
}
function finishDeal(d, p) {
  d.status = 'awaiting'; d.respondOn = g.world.date; let cash0 = g.cash; processDeals();
  for (let m of g.inbox) if (/^Transfer update: /.test(m.title) && m.title.includes(p.name) && !m.handled) m.handled = true; g.world.autoPause = null; g.world.pauseReason = null; g.world.pauseNote = null; return cash0;
}
function negView(msgText) {
  let d = g.world.deals[neg.id], p = d.player, o;
  let plaque = `${esc(club().name)} <span class="vs">v</span> ${esc(team(p.owner).name)}`;
  if (neg.kind === 'fee') {
    let floor = feeFloor(p); d.neg = d.neg || newTalk(p.ask); let st = d.neg; if (!st.said) st.said = `“We value ${p.name} at ${money(p.ask)}. We have other interest, so I would not wait.”`;
    let def = Math.round(p.ask * .92 / 1000) * 1000;
    o = { eyebrow: 'TRANSFER TALKS', title: p.name, sub: `${esc(p.position)} · ${p.age} years · ${Math.round(p.rating)} rating · ${esc(team(p.owner).name)} · asking ${money(p.ask)}`, plaque, opp: oppSeats(p.owner, ['Chairman', 'Sporting Director']), speaker: 'opp', st,
      bubbles: [{ cls: '', who: execName(p.owner, 'Chairman') + ', ' + team(p.owner).short, txt: esc(msgText || st.said) }, ...advice([['Gary Pell, Director of Football', `He is worth about ${money(p.ask)} on the market. Clubs usually come down a little, but not far.`], ['Margaret Hale, Finance Director', `We have ${money(g.cash)} in the bank. A fee of ${money(def)} is ${Math.round(def / Math.max(1, g.cash) * 100)}% of it.`]])],
      panel: `<div class="negpanel"><label>Your offer for the club (£)</label><input id="negAmt" type="number" min="0" value="${st.last || def}"><div class="presets"><button onclick="negPreset(1)">Asking ${compact(p.ask)}</button><button onclick="negPreset(.92)">−8%</button><button onclick="negPreset(.85)">−15%</button><button onclick="negPreset(.75)">−25%</button>${st.hist.length ? `<button class="primary" onclick="negAcceptDemand()">Accept their ${money(st.demand)}</button>` : ''}</div><div class="negbtns"><button class="primary" onclick="negOffer()">Make the offer →</button><button onclick="negWalk()">Leave the table</button></div><div id="negErr" class="negative boarderr"></div></div>` };
  } else {
    let role = d.role || 'first', need = wageNeed(p, role); d.wneg = d.wneg || newTalk(Math.ceil(wageNeed(p, 'first') * 1.3 / 100) * 100); let st = d.wneg; if (!st.said) st.said = `“${p.name} is a player in demand. We are looking at ${money(st.demand)} a week.”`;
    let def = Math.round(wageNeed(p, 'first') * 1.1 / 100) * 100;
    o = { eyebrow: 'CONTRACT TALKS', title: p.name, sub: `Fee agreed${d.fee ? ': ' + money(d.fee) : ' (free agent)'} · now the contract · ${esc(p.position)}, ${p.age}, ${Math.round(p.rating)} rating`, plaque, opp: [{ ini: 'AG', colour: '#7a6a8a', role: 'Agent', name: 'Agent' }, { ini: (p.name.split(' ')[0] || 'P')[0] + (p.name.split(' ').pop() || 'P')[0], colour: '#586b75', role: 'The player', name: p.name }], speaker: 'opp', st,
      bubbles: [{ cls: '', who: 'His agent', txt: esc(msgText || st.said) }, ...advice([['Margaret Hale, Finance Director', `His current wage is ${money(p.wage)}. Every extra £1,000 a week is £52,000 a year on the bill.`], ['Gary Pell, Director of Football', 'Promising a bigger role costs less in wages but you must keep the promise.']])],
      panel: `<div class="negpanel"><div class="negrow"><div><label>Weekly wage (£)</label><input id="negAmt" type="number" min="1" value="${st.last || def}" oninput="negChip()"></div><div><label>Length</label><select id="negYears"><option value="2">2 years</option><option value="3" selected>3 years</option><option value="4">4 years</option></select></div><div><label>Promised role</label><select id="negRole"><option value="rotation">Rotation player</option><option value="first" selected>First-team regular</option><option value="key">Key player</option></select></div></div><div id="negChip">${whyChip(def, d.fee || 0)}</div>${st.hist.length ? `<div class="presets"><button class="primary" onclick="negAcceptDemand()">Accept his ${money(st.demand)}</button></div>` : ''}<div class="negbtns"><button class="primary" onclick="negOffer()">Make the offer →</button><button onclick="negWalk()">Leave the table</button></div><div id="negErr" class="negative boarderr"></div></div>` };
  }
  $('modal').innerHTML = negHtml(o);
}
function negChip() { let d = g.world.deals[neg.id], w = numVal('negAmt') || 0, el = $('negChip'); if (el) el.innerHTML = whyChip(w, d.fee || 0) }
function negPreset(f) { let p = g.world.deals[neg.id].player, el = $('negAmt'); if (el) el.value = Math.round(p.ask * f / 1000) * 1000 }
function negErr(t) { let e = $('negErr'); if (e) e.textContent = t }
function negResult(o) {
  let d = g.world.deals[neg.id], p = d.player, plaque = `${esc(club().name)} <span class="vs">v</span> ${esc(team(p.owner).name)}`;
  $('modal').innerHTML = negHtml({ eyebrow: o.eyebrow, title: p.name, sub: o.sub, plaque, opp: o.opp, speaker: 'us', st: null, result: { stamp: o.stamp, tone: o.tone }, bubbles: [{ cls: 'you', who: o.who, txt: o.text }], panel: `<div class="actions"><button class="primary" onclick="closeBoardroom()">Close the meeting →</button></div>` });
  if (typeof SFX !== 'undefined') { if (o.tone === 'good') SFX.gavel(); else SFX.card() }
}
function commitFee(d, p, fee) {
  d.fee = fee; d.stage = 'club'; finishDeal(d, p);
  if (d.stage === 'player') { delete d.neg; neg.kind = 'wage'; negView(`“Fee agreed at ${money(fee)}. I have asked the agent to join us.”`); return true }
  negErr(d.reply || 'The deal could not be completed.'); return false;
}
function negOffer() {
  let d = g.world.deals[neg.id], p = d.player;
  if (neg.kind === 'fee') {
    let st = d.neg, v = Math.round(Number($('negAmt').value));
    if (!Number.isFinite(v) || v < 1) return negErr('Enter a transfer fee.'); if (v > g.cash) return negErr('You cannot afford that. You have ' + money(g.cash) + '.');
    if (typeof boardVote === 'function') { let vote = boardVote('spend', v); if (!vote.ok) return negErr(vote.reason) }
    st.last = v; let r = feeResponse(feeFloor(p), p.ask, st, v);
    if (r.type === 'accept') { st.hist.push({ you: money(v), them: 'Accepted' }); return commitFee(d, p, v) }
    if (r.type === 'walk') { st.hist.push({ you: money(v), them: 'Walked away' }); d.closed = true; d.status = 'rejected'; d.reply = 'The selling club walked away from the table.'; msg('Transfer talks ended', p.name + ': ' + d.reply, 'football'); save(); return negResult({ eyebrow: 'TALKS COLLAPSED', sub: 'The selling club walked away.', opp: oppSeats(p.owner, ['Chairman', 'Sporting Director']), stamp: 'TALKS COLLAPSED', tone: 'bad', who: 'Chairman', text: `${team(p.owner).short} have walked away. You can revisit ${p.name} next season.` }) }
    st.hist.push({ you: money(v), them: money(r.demand) }); st.said = `“${r.line}”`; save(); return negView(`“${r.line}”`);
  }
  let st = d.wneg, wage = Math.round(Number($('negAmt').value)), years = Number($('negYears').value), role = $('negRole').value;
  if (!Number.isFinite(wage) || wage < 1 || wage > cfg[tier()].cash * .05) return negErr('Enter a weekly wage up to ' + money(Math.round(cfg[tier()].cash * .05)) + '.');
  if (d.fee > 0 && g.cash < d.fee) return negErr('You can no longer afford the agreed fee.');
  st.last = wage; d.role = role; let need = wageNeed(p, role), r = wageResponse(need, st, wage);
  if (r.type === 'accept') {
    st.hist.push({ you: money(wage), them: 'Accepted' }); d.wage = wage; d.years = years; d.role = role; finishDeal(d, p);
    if (d.status === 'signed') { save(); return negResult({ eyebrow: 'DEAL DONE', sub: `${money(d.fee || 0)} fee · ${money(wage)} a week · ${years} years`, opp: [{ ini: 'AG', colour: '#7a6a8a', role: 'Agent', name: 'Agent' }], stamp: 'DEAL DONE', tone: 'good', who: 'Motion carried', text: `${p.name} signs for ${club().name}${d.fee ? ' for ' + money(d.fee) : ' on a free transfer'}, on ${money(wage)} a week until ${contractEnd(g.squad.find(x => x.id === p.id) || { contract: years })}.` }) }
    return negErr(d.reply || 'The deal could not be completed.');
  }
  if (r.type === 'walk') { st.hist.push({ you: money(wage), them: 'Walked away' }); d.closed = true; d.status = 'rejected'; d.reply = 'The agent walked away.'; msg('Transfer talks ended', p.name + ': ' + d.reply, 'football'); save(); return negResult({ eyebrow: 'TALKS COLLAPSED', sub: 'The agent walked away.', opp: [{ ini: 'AG', colour: '#7a6a8a', role: 'Agent', name: 'Agent' }], stamp: 'TALKS COLLAPSED', tone: 'bad', who: 'Director of Football', text: `${p.name}’s agent has walked away. The club has agreed a fee but we have no player.` }) }
  st.hist.push({ you: money(wage), them: money(r.demand) }); st.said = `“${r.line}”`; save(); negView(`“${r.line}”`);
}
function negAcceptDemand() {
  let d = g.world.deals[neg.id], st = neg.kind === 'fee' ? d.neg : d.wneg; let el = $('negAmt'); if (el) el.value = st.demand; negOffer();
}
function negWalk() { let d = g.world.deals[neg.id]; closeBoardroom(); if (d && d.status !== 'signed') { d.neg && (d.neg.said = null) } }

/* ---------- incoming offers: mandatory, and negotiated across the table ---------- */
function bidOpen(b) { return !!b && (b.status === 'open' || b.status === 'raised') }
makeBid = function () {
  let b = baseNegBid(); if (!b) return b; let buyer = club(b.club), p = g.squad.find(x => x.id === b.pid), key = g.world.autoPause;
  let it = newItem('bid', { title: `${buyer.short} want ${p.name}${b.type === 'loan' ? ' on loan' : ''}`, bidId: b.id, urgent: true, speaker: 'dof', line: '', side: null, opts: [{ label: 'Hear the offer', act: { t: 'bid' } }] });
  let m = g.inbox.find(x => x.bidId === b.id); if (m) m.boardId = it.id; g.world.autoPause = { title: 'Offer: ' + it.title, cat: 'boardroom', date: g.world.date };
  return b;
};
const baseValidItem = itemValid;
itemValid = function (it) { if (it.kind === 'bid') return it.status === 'open' && bidOpen(findBid(it.bidId)); return baseValidItem(it) };
openBoardroom = function (id) {
  let it = id ? findItem(id) : boardPending()[0];
  if (it && it.kind === 'bid' && it.status === 'open') { stopClock(); if (!bidOpen(findBid(it.bidId))) { it.status = 'moot'; return openBoardroom() } return openBidTalks(it.bidId) }
  return baseNegOpenBoard(id);
};
function bidHistoryState(b) { return b.neg || (b.neg = newTalk(b.fee)) }
function openBidTalks(id) {
  stopClock(); let b = findBid(id); if (!bidOpen(b)) return; neg = { kind: 'bid', id }; bidView();
  if (typeof SFX !== 'undefined' && !neg.pinged) { neg.pinged = true; SFX.gavel() }
}
function bidView(msgText) {
  let b = findBid(neg.id), p = g.squad.find(x => x.id === b.pid), buyer = club(b.club), st = bidHistoryState(b), loan = b.type === 'loan', V = playerValue(p);
  let bigger = buyer.league < tier() && p.age <= 28, ask = Math.round(Math.max(b.fee * 1.25, V) / 1000) * 1000;
  let o = { eyebrow: loan ? 'LOAN REQUEST' : 'OFFER RECEIVED', title: `${buyer.short} want ${p.name}${loan ? ' on loan' : ''}`, sub: `${esc(p.position)} · ${p.age} years · ${Math.round(p.rating)} rating · offer ${money(b.fee)} · worth about ${money(V)} to us`, plaque: `${esc(buyer.name)} <span class="vs">at</span> ${esc(club().name)}`, opp: oppSeats(buyer.id, ['Chairman', 'Sporting Director']), speaker: 'opp', st,
    bubbles: [{ cls: '', who: execName(buyer.id, 'Chairman') + ', ' + buyer.short, txt: esc(msgText || `“${loan ? `We would like ${p.name} on loan for the rest of the season. We will pay his wages and ${money(b.fee)}.` : `We are prepared to pay ${money(b.fee)} for ${p.name}.`}${b.deadlineWeek ? ' We need an answer quickly, it is deadline week.' : ''}”`) }, ...advice([['Margaret Hale, Finance Director', loan ? `A loan takes ${money(p.wage)} a week off the wage bill.` : `${money(b.fee)} is ${Math.round(b.fee / Math.max(1, V) * 100)}% of what he is worth to us, ${money(V)}.`], ['Gary Pell, Director of Football', bigger ? `${p.name} will want this move, because ${buyer.short} play at a higher level. Turning it down will upset him.` : `We have ${g.squad.length} players. Selling leaves us ${g.squad.length - 1}.`]])],
    panel: `<div class="negpanel"><label>${loan ? 'Loan fee you ask' : 'Your price'} (£)</label><input id="negAmt" type="number" min="1" value="${st.last || ask}"><div class="presets"><button onclick="bidPreset(1.1)">+10%</button><button onclick="bidPreset(1.25)">+25%</button><button onclick="bidPreset(1.5)">+50%</button><button class="primary" onclick="bidAccept()">Accept ${money(b.fee)}</button></div><div class="negbtns"><button class="primary" onclick="bidCounter()">Counter-offer →</button><button onclick="bidReject()">Reject the offer</button></div><div id="negErr" class="negative boarderr"></div></div>` };
  $('modal').innerHTML = negHtml(o);
}
function bidPreset(f) { let b = findBid(neg.id), el = $('negAmt'); if (el) el.value = Math.round(b.fee * f / 1000) * 1000 }
function bidDone(tone, stamp, text, sub) {
  let b = findBid(neg.id), buyer = club(b.club);
  $('modal').innerHTML = negHtml({ eyebrow: tone === 'good' ? 'DEAL DONE' : 'MEETING CLOSED', title: stamp, sub, plaque: `${esc(buyer.name)} <span class="vs">at</span> ${esc(club().name)}`, opp: oppSeats(buyer.id, ['Chairman']), speaker: 'us', st: null, result: { stamp, tone }, bubbles: [{ cls: 'you', who: 'Motion carried', txt: esc(text) }], panel: `<div class="actions"><button class="primary" onclick="closeBoardroom()">Close the meeting →</button></div>` });
  if (typeof SFX !== 'undefined') { if (tone === 'good') SFX.gavel() }
}
function bidAccept() {
  let b = findBid(neg.id), buyer = club(b.club), r = acceptBid(b.id); if (r.error) return negErr(r.error); save(); bidDone('good', b.type === 'loan' ? 'LOANED OUT' : 'DEAL DONE', r.text, `${money(b.fee)} · ${buyer.short}`);
}
function bidReject() {
  let b = findBid(neg.id), r = rejectBid(b.id); if (r.error) return negErr(r.error); save(); bidDone('bad', 'OFFER REJECTED', r.text, 'Time can move on');
}
function bidCounter() {
  let b = findBid(neg.id), st = bidHistoryState(b), ask = Math.round(Number($('negAmt').value)), buyer = club(b.club), w = g.world;
  if (!Number.isFinite(ask) || ask < 1) return negErr('Enter a price.'); if (ask < b.fee) return negErr('That is less than they have already offered.');
  st.last = ask; let r = bidResponse(b, ask, st);
  if (r.type === 'accept') { st.hist.push({ you: money(ask), them: 'Accepted' }); b.fee = ask; let a = acceptBid(b.id); if (a.error) return negErr(a.error); save(); return bidDone('good', b.type === 'loan' ? 'LOANED OUT' : 'DEAL DONE', `${buyer.short} met your price. ${a.text}`, `${money(ask)} · ${buyer.short}`) }
  if (r.type === 'walk') { st.hist.push({ you: money(ask), them: 'Walked away' }); b.status = 'withdrawn'; w.bidCool = w.bidCool || {}; w.bidCool[b.pid] = dayAdd(w.date, 10); closeBidMessage(b, buyer.short + ' walked away'); save(); return bidDone('bad', 'THEY WALKED AWAY', `${buyer.short} withdrew their interest after you pushed too hard.`, 'Time can move on') }
  st.hist.push({ you: money(ask), them: money(r.offer) }); save(); bidView(`“${r.line}”`);
}
bidButtons = function (m) { let b = findBid(m.bidId); if (!bidOpen(b)) return ''; return `<div class="actions"><button class="primary" onclick="openBidTalks('${b.id}')">Negotiate with ${esc(club(b.club).short)} →</button></div><p class="fineprint">Every offer has to be answered before time moves on. Lapses ${dateText(b.expires, false)}.</p>` };
bidRowHtml = function (b) { if (!bidOpen(b) || !g.squad.find(x => x.id === b.pid)) return ''; return `<div class="decisionopts"><button class="primary" onclick="openBidTalks('${b.id}')">Negotiate →</button></div><p class="fineprint">${b.status === 'raised' ? 'Their final offer. ' : ''}Offer ${money(b.fee)}${b.type === 'loan' ? ' (loan)' : ''}. Value to the club about ${money(playerValue(g.squad.find(x => x.id === b.pid)))}.</p>` };

/* ---------- the Recruitment screen opens the room ---------- */
recruitment = function () { return baseNegRec().replace(/negotiatePlayer\('([^']+)'\)/g, "openNegotiation('$1')").replace(/showTransfer\('([^']+)'\)/g, "openNegotiation('$1')") };
