/* Loans, properly. A parent club can say no to letting a player leave at all, not just the player turning his nose up at
   your level; a loan can be recalled mid-season if the player is needed back or has impressed too much to let go
   cheaply; and making a loan permanent is a live negotiation against a price that moves with form, not a number
   frozen on the day he arrived. Alongside it, a full rewrite of player valuations: based on the player's own club's
   level, not yours, with a smooth age curve instead of a single cliff at 22. */

/* ---------- realistic valuations ---------- */
const basePlayerValue = playerValue;
function ageValueMult(age) {
  if (age <= 17) return .5; if (age <= 20) return .55 + (age - 17) * .1; if (age <= 26) return .85 + (age - 20) * .038;
  if (age <= 29) return 1.08 - (age - 26) * .05; if (age <= 32) return .93 - (age - 29) * .11; if (age <= 35) return .6 - (age - 32) * .13; return .18;
}
playerValue = function (p, clubId) {
  let ownerId = clubId || p.owner || (g.squad.some(x => x.id === p.id) ? g.clubId : null);
  let t = ownerId != null ? g.divisions.findIndex(d => d.includes(ownerId)) : -1; if (t < 0) t = tier();
  let gap = (p.rating || 50) - cfg[t].quality, base = cfg[t].fee * Math.pow(1.058, clamp(gap, -30, 30));
  let years = typeof contractYears === 'function' ? contractYears(p) : 2, contractMult = clamp(.45 + years * .22, .45, 1.15);
  let v = base * ageValueMult(p.age || 24) * contractMult;
  return Math.max(20000, Math.round(v / 10000) * 10000);
};

/* ---------- a parent club can say no ---------- */
function teammateRating(pl, ownerId) { if (pl.rating != null) return pl.rating; let t = g.divisions.findIndex(d => d.includes(ownerId)); if (t < 0) t = 2; return clamp(cfg[t].quality - 9 + Math.abs(hash(pl.id)) % 190 / 10, 30, 94) }
function parentLoanView(p) {
  let ownerId = p.owner, raw = typeof squadOf === 'function' ? squadOf(ownerId) : [], squad = raw.map(x => ({ ...x, rating: teammateRating(x, ownerId) })), myRating = p.rating != null ? p.rating : teammateRating(p, ownerId);
  let avg = squad.length ? squad.reduce((s, x) => s + x.rating, 0) / squad.length : myRating;
  let rankAbove = squad.filter(x => x.rating > myRating).length, thin = squad.filter(x => x.position === p.position).length <= 3; p = { ...p, rating: myRating };
  if (rankAbove <= 2) return rnd() < .1 ? { code: 'maybe', reason: 'he is important to them, but they would listen to an approach' } : { code: 'no', reason: 'he is one of their best players — they will not loan him anywhere' };
  if (thin && rankAbove <= 5) return { code: 'maybe', reason: 'they are short in his position and may want him available' };
  if (p.rating > avg + 4 && rnd() < .4) return { code: 'maybe', reason: 'they would rather keep an option to recall him' };
  return { code: 'yes', reason: '' };
}
const baseLn2LoanIn = doLoanIn;
doLoanIn = function (id) {
  let p = (typeof marketList === 'function' ? marketList() : []).find(x => x.id === id); if (!p) return baseLn2LoanIn(id);
  let parent = parentLoanView(p);
  if (parent.code === 'no') { let box = $('liReply'); if (box) box.textContent = `${p.name}'s club will not loan him out: ${parent.reason}.`; return }
  if (parent.code === 'maybe' && rnd() < .55) { let box = $('liReply'); if (box) box.textContent = `${team(p.owner).name} are reluctant: ${parent.reason}. They turn down the approach this time.`; return }
  let r = baseLn2LoanIn(id); let sq = g.squad.find(x => x.id === id); if (sq) { sq.loanWatch = { form: 0, apps: 0 }; sq.loanIn.recallRisk = parent.code === 'maybe' ? .55 : .2 } return r;
};

/* ---------- a loan can be recalled ---------- */
function loanRecallCheck() {
  for (let p of [...g.squad]) {
    if (!p.loanIn) continue; let risk = p.loanIn.recallRisk ?? .2, form = p.loanWatch ? p.loanWatch.form : 0;
    let chance = .006 + risk * .012 + (form > 6 ? .01 : 0);
    if (rnd() > chance) continue;
    let impressing = form > 6.2; g.squad = g.squad.filter(x => x.id !== p.id);
    msg('Loan recalled: ' + p.name, impressing ? `${team(p.loanIn.from).name} have seen enough — they are recalling ${p.name} rather than risk losing him for a loan fee. He returns to his parent club with immediate effect.` : `${team(p.loanIn.from).name} need ${p.name} back; injuries at the parent club have forced an early recall.`, 'football');
    g.world.transferred = g.world.transferred || [];
  }
}
const baseLn2Weekly = weeklyWorld; weeklyWorld = function () { baseLn2Weekly(); if (g.ended || !g.world) return; loanRecallCheck() };
const baseLn2FinishMatch = finishMatch;
finishMatch = function () { baseLn2FinishMatch(); let m = g.world.lastMatch; if (!m || !m.ratings) return; for (let r of m.ratings) { let p = g.squad.find(x => x.id === r.id); if (p && p.loanIn) { p.loanWatch = p.loanWatch || { form: 0, apps: 0 }; p.loanWatch.apps++; p.loanWatch.form = p.loanWatch.form * .7 + r.r * .3 } } };

/* ---------- making it permanent is a negotiation, not a fixed number ---------- */
function permanentAsk(p) {
  let base = p.loanIn.ask, formMult = p.loanWatch && p.loanWatch.apps >= 3 ? clamp(1 + (p.loanWatch.form - 6.2) * .12, .75, 1.6) : 1;
  return Math.max(20000, Math.round(base * formMult / 10000) * 10000);
}
makePermanent = function (pid) {
  let p = g.squad.find(x => x.id === pid); if (!p || !p.loanIn) return { error: 'He is not on loan.' };
  let cost = permanentAsk(p); if (g.cash < cost) return { error: 'You need ' + money(cost) + ' — his parent club have revised their price given his form.' };
  if (typeof boardVote === 'function') { let v = boardVote('spend', cost); if (!v.ok) return { error: v.reason } }
  g.cash -= cost; record('Transfer fee: ' + p.name, -cost); delete p.loanIn; delete p.loanWatch; p.contract = 3; g.world.marketOwners[p.id] = g.clubId; g.world.transferred.push(p.id);
  msg('Made permanent: ' + p.name, `${p.name} signs permanently for ${money(cost)} on a contract to ${contractEnd(p)}.`, 'football'); save(); return { ok: true };
};
