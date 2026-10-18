/* Putting a player up for sale or loan is now a listing, not a button that sells him on the spot. Listed players draw far
   more interest from the market — bigger odds of a bid, and loan-listed players draw loan bids specifically — but you
   still review, accept, reject or counter every offer yourself, the same as any other incoming bid. */

function listedPlayers() { return g.squad.filter(p => p.listed && (p.listed.sale || p.listed.loan)) }
function listFor(id, kind) { let p = g.squad.find(x => x.id === id); if (!p) return; p.listed = p.listed || {}; p.listed[kind] = true; p.listed.since = g.world.date; save() }
function unlist(id) { let p = g.squad.find(x => x.id === id); if (p) { delete p.listed; save() } }
function listedDays(p) { return p.listed && p.listed.since ? Math.max(0, Math.round((Date.parse(g.world.date + 'T12:00:00Z') - Date.parse(p.listed.since + 'T12:00:00Z')) / 86400000)) : 0 }

/* ---------- the market pays attention to who is listed ---------- */
const baseTl2MakeBid = makeBid;
makeBid = function () {
  let w = g.world, date = w.date; w.bidCool = w.bidCool || {};
  let listedCands = g.squad.filter(p => p.listed && (p.listed.sale || p.listed.loan) && !(w.bidCool[p.id] > date) && !openBids().some(b => b.pid === p.id));
  if (!listedCands.length) return baseTl2MakeBid();
  let weights = listedCands.map(p => Math.pow(Math.max(1, p.rating - 25), 2) * (p.inj ? .3 : 1)), total = weights.reduce((a, b) => a + b, 0), r = rnd() * total, p = listedCands[0];
  for (let i = 0; i < listedCands.length; i++) { r -= weights[i]; if (r <= 0) { p = listedCands[i]; break } }
  let taken = new Set(openBids().map(b => b.club)), buyers = CLUBS.filter(c => c.id !== g.clubId && !taken.has(c.id) && Math.abs(c.league - tier()) <= 1);
  let bw = buyers.map(c => c.league <= tier() ? 3 : 1), bt = bw.reduce((a, b) => a + b, 0), br = rnd() * bt, buyer = buyers[0];
  for (let i = 0; i < buyers.length; i++) { br -= bw[i]; if (br <= 0) { buyer = buyers[i]; break } }
  if (!buyer) return baseTl2MakeBid();
  let wantLoan = p.listed.loan && (!p.listed.sale || rnd() < .55), close = windowCloseDate(date), left = daysBetween(date, close);
  let V = playerValue(p), fee = Math.round(V * (wantLoan ? .05 : (.8 + rnd() * .4)) * (left <= 3 ? 1.12 : 1) / 1000) * 1000;
  let max = Math.round(fee * (1.1 + rnd() * .25) / 1000) * 1000, expires = left <= 1 ? dayAdd(date, 1) : dayAdd(date, Math.min(4, Math.max(1, left)));
  let b = { id: 'B' + (w.bidSeq = (w.bidSeq || 0) + 1), pid: p.id, club: buyer.id, fee, max, date, expires, status: 'open', countered: false, deadlineWeek: left <= 3, type: wantLoan ? 'loan' : 'sale' };
  bidList().push(b); w.bids = w.bids.slice(-40);
  msg('Bid: ' + buyer.short + ' want ' + p.name + (wantLoan ? ' on loan' : ''), `${buyer.name} have seen ${p.name} is available${wantLoan ? ' on loan' : ''} and come in with ${money(fee)}${wantLoan ? ' plus his wages' : ''}.`, 'football');
  let m = g.inbox[0]; m.bidId = b.id; m.deadline = expires; m.page = 'Recruitment'; return b;
};
const baseTl2BidChance = bidChance;
bidChance = function (left) { let base = baseTl2BidChance(left); return listedPlayers().length ? clamp(base + .1 * listedPlayers().length, 0, .7) : base };

/* ---------- a page to see who is listed, and a last-resort quick sale ---------- */
function transferListCard() {
  let listed = listedPlayers(); if (!listed.length) return '';
  return `<div class="card translist"><div class="cardhead"><h2>On the market</h2><span class="eyebrow">${listed.length} LISTED</span></div><div class="pad">${listed.map(p => `<div class="listrow"><div><b class="plink" onclick="playerProfile('${p.id}')">${esc(p.name)}</b><small>${esc(p.position)} · ${p.age} · ${p.listed.sale ? 'For sale' : ''}${p.listed.sale && p.listed.loan ? ' & ' : ''}${p.listed.loan ? 'For loan' : ''} · listed ${listedDays(p)} day${listedDays(p) === 1 ? '' : 's'}</small></div><button class="ghost" onclick="unlist('${p.id}');render()">Take off the market</button></div>`).join('')}<p class="fineprint">Listed players draw far more interest from other clubs. You still decide on every offer that comes in.</p></div></div>`;
}
const baseTl2Recruitment = recruitment;
recruitment = function () { let h = baseTl2Recruitment(); if (typeof h !== 'string') return h; return transferListCard() + h };

/* ---------- replace the old instant-sell with listing as the normal route ---------- */
const basePlayerProfileTl2 = playerProfile;
playerProfile = function (id, clubId) {
  basePlayerProfileTl2(id, clubId); if (clubId) return; let h = $('modal').innerHTML; if (typeof h !== 'string') return;
  let p = g.squad.find(x => x.id === id); if (!p) return;
  let listed = p.listed, status = listed ? `<span class="chips"><span>${listed.sale ? 'Listed for sale' : ''}${listed.sale && listed.loan ? ' & ' : ''}${listed.loan ? 'listed for loan' : ''}</span></span>` : '';
  let actions = listed
    ? `<button onclick="unlist('${id}');closeModal();playerProfile('${id}')">Take off the market</button>`
    : `<button onclick="listFor('${id}','sale');closeModal();playerProfile('${id}')">List for transfer</button><button onclick="listFor('${id}','loan');closeModal();playerProfile('${id}')">List for loan</button><button class="ghost" onclick="closeModal();sellPlayer('${id}')">Quick sale (below value)</button>`;
  h = h.replace(/<button onclick="closeModal\(\);sellPlayer\('[^']*'\)">Consider sale<\/button>/, actions);
  if (status && !h.includes('Listed for')) h = h.replace('</div><div class="attrgrid">', status + '</div><div class="attrgrid">');
  $('modal').innerHTML = h;
};
const baseTl2Sell = sellPlayer;
sellPlayer = function (id) { let p = g.squad.find(x => x.id === id); if (p) p._quickSaleValue = Math.round(playerValue(p) * .72 / 1000) * 1000; return baseTl2Sell(id) };
const basePlayerValueTl2 = playerValue;
playerValue = function (p, clubId) { if (!clubId && p && p._quickSaleValue && g.squad.some(x => x.id === p.id)) { let v = p._quickSaleValue; delete p._quickSaleValue; return v } return basePlayerValueTl2(p, clubId) };
