/* The manager now comes to you with his own transfer business during an open window: a player he wants signed, one he'd
   take on loan, or one of the current squad he thinks should go. You can approve it, turn it down, or simply ignore it
   and go do your own business through Recruitment instead \u2014 he still does his job either way, he just works for you. */

function mgrReqs() { return (g.world.mgrReqs = g.world.mgrReqs || []) }
function weakestLine() {
  let xi = [...g.squad].sort((a, b) => b.rating - a.rating).slice(0, 11), lines = { GK: [], DEF: [], MID: [], FWD: [] };
  for (let p of xi) (lines[normPos(p.position)] || lines.MID).push(p.rating);
  let avg = k => lines[k].length ? lines[k].reduce((a, b) => a + b, 0) / lines[k].length : 999;
  return Object.keys(lines).filter(k => k !== 'GK').sort((a, b) => avg(a) - avg(b))[0];
}
function mgrSellCandidate() {
  let xi = new Set([...g.squad].sort((a, b) => b.rating - a.rating).slice(0, 11).map(p => p.id));
  let bench = g.squad.filter(p => !xi.has(p.id) && !p.listed && !p.loanIn);
  if (!bench.length) return null; return bench.sort((a, b) => a.rating - b.rating)[0];
}
function mgrTargetFor(line) {
  let list = marketList().filter(p => normPos(p.position) === line && willingness(p).code !== 'no' && p.ask <= g.cash * 1.3);
  let weak = weakestLine(), xi = [...g.squad].sort((a, b) => b.rating - a.rating).slice(0, 11), worst = xi.filter(p => normPos(p.position) === line).sort((a, b) => a.rating - b.rating)[0];
  list = list.filter(p => !worst || p.rating > worst.rating + 3);
  return list.sort((a, b) => b.rating - a.rating)[0] || null;
}
function mgrRequestCheck() {
  let w = g.world; if (!w || g.ended || w.live || !windowOpen()) return;
  if (w.mgrReqCool && daysBetween(w.mgrReqCool, w.date) < 18) return;
  if (mgrReqs().some(r => r.status === 'open')) return;
  if (rnd() > .1) return;
  let kinds = ['buy', 'loan', 'sell'].filter(k => k !== 'sell' || mgrSellCandidate()).filter(k => k === 'sell' || mgrTargetFor(weakestLine()));
  if (!kinds.length) return; let kind = kinds[Math.floor(rnd() * kinds.length)]; w.mgrReqCool = w.date;
  if (kind === 'sell') {
    let p = mgrSellCandidate(); if (!p) return;
    let req = { id: 'MR' + (w.mgrReqSeq = (w.mgrReqSeq || 0) + 1), kind, pid: p.id, status: 'open', date: w.date, name: p.name };
    mgrReqs().push(req);
    msg('The manager wants to sell ' + p.name, `${g.manager.name} feels ${p.name} isn\u2019t part of his plans and would like him moved on. He suggests listing him for sale.`, 'football');
  } else {
    let line = weakestLine(), p = mgrTargetFor(line); if (!p) return;
    let req = { id: 'MR' + (w.mgrReqSeq = (w.mgrReqSeq || 0) + 1), kind, pid: p.id, status: 'open', date: w.date, name: p.name, fee: p.ask, line };
    mgrReqs().push(req);
    msg(`The manager wants to ${kind === 'loan' ? 'take ' + p.name + ' on loan' : 'sign ' + p.name}`, `${g.manager.name} thinks ${line.toLowerCase()} is the squad\u2019s weak link and has identified ${p.name} (${team(p.owner).name}, ${Math.round(p.rating)} rated) as the answer. Estimated cost: ${money(p.ask)}${kind === 'loan' ? ' in loan fees' : ''}.`, 'football');
  }
}
function mgrReqAnswer(id, approve) {
  let req = mgrReqs().find(x => x.id === id); if (!req || req.status !== 'open') return;
  req.status = approve ? 'approved' : 'declined';
  if (!approve) { g.world.managerTrust = clamp((g.world.managerTrust || 70) - 2, 5, 100); return }
  if (req.kind === 'sell') { let p = g.squad.find(x => x.id === req.pid); if (p && !p.listed) listFor(p.id, 'sale') }
  else if (req.kind === 'loan') { if (typeof doLoanIn === 'function') doLoanIn(req.pid) }
  else { if (typeof negotiatePlayer === 'function') negotiatePlayer(req.pid) }
}
const baseMrAdvance = advanceDay;
advanceDay = function () { baseMrAdvance(); if (!g || !g.world || g.ended) return; mgrRequestCheck() };
function mgrReqCard() {
  let open = mgrReqs().filter(r => r.status === 'open'); if (!open.length) return '';
  let row = r => {
    let label = r.kind === 'sell' ? `Sell ${r.name}` : r.kind === 'loan' ? `Take ${r.name} on loan (${money(r.fee)})` : `Sign ${r.name} (est. ${money(r.fee)})`;
    return `<div class="hirerow"><div><b>${esc(label)}</b><small>The manager's own suggestion \u00b7 ${dateText(r.date, false)}</small></div><div><button class="primary" onclick="mgrReqAnswer('${r.id}',true);render()">Approve</button> <button class="ghost" onclick="mgrReqAnswer('${r.id}',false);render()">Decline</button></div></div>`;
  };
  return `<div class="card pad"><div class="eyebrow">FROM THE MANAGER</div><h2 style="font-size:20px;margin:10px 0 4px">Transfer business</h2><p class="fineprint" style="margin-top:0">You can also just go and do your own business through Recruitment instead.</p>${open.map(row).join('')}</div>`;
}
const baseMrRecruitment = recruitment;
recruitment = function () { let h = baseMrRecruitment(); if (typeof h !== 'string') return h; return (mgrReqCard() || '') + h };
