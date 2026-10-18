/* Incoming bids. Other clubs make offers for your players during transfer windows, more often and at a premium in deadline week.
   Accept, reject or counter. A counter can be met, answered halfway, or make the club walk away. */

const baseBidAdvance = advanceDay, baseBidRender = render;

function bidList() { return g.world.bids || (g.world.bids = []) }
function openBids() { return bidList().filter(b => b.status === 'open' || b.status === 'raised') }
function findBid(id) { return bidList().find(b => b.id === id) }
function bidChance(left) { return left <= 1 ? .45 : left <= 3 ? .22 : left <= 7 ? .14 : .07 }

function makeBid() {
  let w = g.world, date = w.date, close = windowCloseDate(date), left = daysBetween(date, close);
  w.bidCool = w.bidCool || {};
  let cands = g.squad.filter(p => !(w.bidCool[p.id] > date) && !openBids().some(b => b.pid === p.id));
  if (!cands.length) return null;
  let weights = cands.map(p => Math.pow(Math.max(1, p.rating - 35), 2) * (p.age < 24 ? 1.4 : p.age > 31 ? .5 : 1) * (p.inj ? .3 : 1)), total = weights.reduce((a, b) => a + b, 0), r = rnd() * total, p = cands[0];
  for (let i = 0; i < cands.length; i++) { r -= weights[i]; if (r <= 0) { p = cands[i]; break } }
  let taken = new Set(openBids().map(b => b.club));
  let buyers = CLUBS.filter(c => c.id !== g.clubId && !taken.has(c.id) && Math.abs(c.league - tier()) <= 1);
  let bw = buyers.map(c => c.league <= tier() ? 3 : 1), bt = bw.reduce((a, b) => a + b, 0), br = rnd() * bt, buyer = buyers[0];
  for (let i = 0; i < buyers.length; i++) { br -= bw[i]; if (br <= 0) { buyer = buyers[i]; break } }
  if (!buyer) return null;
  let rank = [...g.squad].sort((a, c) => c.rating - a.rating).findIndex(x => x.id === p.id) + 1, isLoan = rank > 11 && p.age <= 25 && rnd() < .4;
  let V = playerValue(p), fee = Math.round(V * (isLoan ? .04 : (.85 + rnd() * .45)) * (left <= 3 ? 1.12 : 1) / 1000) * 1000;
  let max = Math.round(fee * (1.12 + rnd() * .28) / 1000) * 1000, expires = left <= 1 ? dayAdd(date, 1) : dayAdd(date, Math.min(4, Math.max(1, left)));
  let b = { id: 'B' + (w.bidSeq = (w.bidSeq || 0) + 1), pid: p.id, club: buyer.id, fee, max, date, expires, status: 'open', countered: false, deadlineWeek: left <= 3, type: isLoan ? 'loan' : 'sale' };
  bidList().push(b); w.bids = w.bids.slice(-40);
  let key = [...g.squad].sort((a, c) => c.rating - a.rating).slice(0, 5).some(x => x.id === p.id);
  msg('Bid: ' + buyer.short + ' want ' + p.name + (isLoan ? ' on loan' : ''), isLoan ? `${buyer.name} would like to take ${p.name} (${p.position}, ${Math.round(p.rating)}, ${p.age}) on loan for the rest of the season. They pay his wages and a ${money(fee)} fee, and he gets games.` : `${buyer.name} offer ${money(fee)} for ${p.name} (${p.position}, ${Math.round(p.rating)}${p.age ? ', ' + (p.age) + ' years' : ''}).${key ? ' He is one of your best players.' : ''}${b.deadlineWeek ? ' It is deadline week, so they want an answer quickly.' : ''}`, 'football');
  let m = g.inbox[0]; m.bidId = b.id; m.deadline = expires; m.page = 'Recruitment';
  return b;
}
function bidDaily() {
  let w = g.world; if (w.bidDay === w.date) return; w.bidDay = w.date;
  let bids = bidList(), open = openBids();
  for (let b of open) if (b.expires < w.date || !windowOpen()) { b.status = 'expired'; let m = g.inbox.find(x => x.bidId === b.id); if (m) m.handled = true }
  if (!windowOpen() || g.ended || g.squad.length <= 17 || openBids().length >= 2) return;
  let left = daysBetween(w.date, windowCloseDate(w.date));
  if (rnd() < bidChance(left)) makeBid();
}
advanceDay = function () {
  baseBidAdvance(); if (!g || !g.world || g.ended) return;
  let w = g.world; bidDaily();
  if (w.autoPause && !w.pauseNote) { stopClock(); w.pauseNote = w.autoPause; render() }
};

function closeBidMessage(b, text) { let m = g.inbox.find(x => x.bidId === b.id); if (m) { m.handled = true; if (text) m.body += '  → ' + text } }
function acceptBid(id) {
  let b = findBid(id), w = g.world; if (!b || !(b.status === 'open' || b.status === 'raised')) return { error: 'That offer is no longer on the table.' };
  if (!windowOpen()) { b.status = 'expired'; return { error: 'The transfer window has closed.' } }
  if (g.squad.length <= 16) return { error: 'Keep at least 16 first-team players.' };
  let p = g.squad.find(x => x.id === b.pid); if (!p) { b.status = 'void'; return { error: 'He is no longer in your squad.' } }
  if (b.type === 'loan') { loanOutTo(p, b.club, b.fee); b.status = 'accepted'; closeBidMessage(b, 'Loaned to ' + club(b.club).short); return { ok: true, text: p.name + ' goes on loan to ' + club(b.club).short + '.' } }
  let buyer = club(b.club), key = [...g.squad].sort((a, c) => c.rating - a.rating).slice(0, 5).some(x => x.id === p.id);
  g.cash += b.fee; record('Player sale: ' + p.name, b.fee); g.squad = g.squad.filter(x => x.id !== p.id);
  w.marketOwners[p.id] = buyer.id; w.sold.push({ ...p, owner: buyer.id, ask: Math.round(b.fee * 1.15) }); w.transferred = w.transferred.filter(x => x !== p.id);
  addNews(buyer.name + ' sign ' + p.name, `${club().name} receive ${money(b.fee)} for the transfer.`, 'transfer');
  g.morale = clamp(g.morale - (key ? 4 : 1.5), 10, 100); if (key) g.trust = clamp(g.trust - 2, 5, 100);
  b.status = 'accepted'; closeBidMessage(b, 'Sold to ' + buyer.short + ' for ' + money(b.fee));
  for (let o of bidList()) if (o !== b && o.pid === p.id && (o.status === 'open' || o.status === 'raised')) { o.status = 'void'; closeBidMessage(o, 'Withdrawn: he has been sold') }
  save(); return { ok: true, text: `${p.name} sold to ${buyer.short} for ${money(b.fee)}.` };
}
function rejectBid(id) {
  let b = findBid(id), w = g.world; if (!b || !(b.status === 'open' || b.status === 'raised')) return { error: 'That offer is no longer on the table.' };
  b.status = 'rejected'; w.bidCool = w.bidCool || {}; w.bidCool[b.pid] = dayAdd(w.date, 14); closeBidMessage(b, 'Rejected');
  let p = g.squad.find(x => x.id === b.pid), buyer = club(b.club), text = 'Offer rejected.';
  if (p && buyer.league < tier() && p.age <= 28 && rnd() < .35) { g.morale = clamp(g.morale - 1.5, 10, 100); msg('Unrest: ' + p.name, p.name + ' is unhappy that you turned down a move to a bigger club. Squad morale has dipped.', 'football'); text = 'Offer rejected, but ' + p.name + ' is unhappy.' }
  save(); return { ok: true, text };
}
function counterBid(id) {
  let b = findBid(id), w = g.world; if (!b || b.status !== 'open' || b.countered) return { error: 'You cannot counter this offer.' };
  b.countered = true; let ask = Math.round(b.fee * 1.25 / 1000) * 1000, buyer = club(b.club);
  if (ask <= b.max) { b.fee = ask; let r = acceptBid(id); if (r.ok) r.text = buyer.short + ' met your price. ' + r.text; return r }
  if (rnd() < .35) { b.status = 'withdrawn'; w.bidCool = w.bidCool || {}; w.bidCool[b.pid] = dayAdd(w.date, 10); closeBidMessage(b, buyer.short + ' walked away'); save(); return { ok: true, text: buyer.short + ' walked away from the deal.' } }
  b.fee = Math.round((b.fee + b.max) / 2 / 1000) * 1000; b.status = 'raised'; b.expires = dayAdd(w.date, 2);
  let m = g.inbox.find(x => x.bidId === id); if (m) { m.body += `  → ${buyer.short} raised their offer to ${money(b.fee)}. Final offer.`; m.deadline = b.expires; m.handled = false }
  save(); return { ok: true, text: buyer.short + ' came back at ' + money(b.fee) + ' as a final offer.' };
}
function answerBid(id, act) {
  let r = act === 'accept' ? acceptBid(id) : act === 'reject' ? rejectBid(id) : counterBid(id);
  toast(r.error || r.text || 'Done.'); render();
}
function bidRowHtml(b) {
  let p = g.squad.find(x => x.id === b.pid), buyer = club(b.club); if (!p) return '';
  let ask = Math.round(b.fee * 1.25 / 1000) * 1000;
  return `<div class="decisionopts"><button class="primary" onclick="answerBid('${b.id}','accept')">Accept ${b.type === 'loan' ? 'loan · ' : ''}${money(b.fee)}</button><button onclick="answerBid('${b.id}','reject')">Reject</button>${b.countered ? '' : `<button onclick="answerBid('${b.id}','counter')">Counter at ${money(ask)}</button>`}</div><p class="fineprint">${b.status === 'raised' ? 'Their final offer. ' : ''}Lapses ${dateText(b.expires, false)}. Value to the club: about ${money(playerValue(p))}.</p>`;
}
function bidButtons(m) { let b = findBid(m.bidId); if (!b || !(b.status === 'open' || b.status === 'raised')) return ''; return bidRowHtml(b) }
function bidsCard() {
  let open = openBids(), recent = bidList().filter(b => !(b.status === 'open' || b.status === 'raised')).slice(-5).reverse();
  let line = b => { let p = g.squad.find(x => x.id === b.pid) || g.world.sold.find(x => x.id === b.pid); return `<div class="row"><span>${esc(p ? p.name : 'Player')} · ${esc(club(b.club).short)}</span><b>${money(b.fee)} · ${b.status}</b></div>` };
  return card('Offers for your players', `<div class="pad">${open.length ? open.map(b => { let p = g.squad.find(x => x.id === b.pid); return p ? `<div><h3>${esc(club(b.club).name)} want ${esc(p.name)}</h3><p>${esc(p.position)} · ${Math.round(p.rating)} rating · offer ${money(b.fee)}${b.deadlineWeek ? ' · deadline-week bid' : ''}</p>${bidRowHtml(b)}</div>` : '' }).join('') : `<p>${windowOpen() ? 'No offers right now. Good players attract interest during the window, and more of it as the deadline nears.' : 'The window is closed. Clubs can only bid when it opens.'}</p>`}${recent.length ? '<h3 style="margin-top:14px">Recent</h3>' + recent.map(line).join('') : ''}</div>`);
}
render = function () {
  baseBidRender();
  if (g && g.world && page === 'Recruitment' && typeof $('content').innerHTML === 'string') $('content').innerHTML = bidsCard() + '<div style="height:18px"></div>' + $('content').innerHTML;
};
