/* Managers. A world of managers with reputations, styles, records and jobs. Some will not come to a club at your level, some are happy where they
   are, some want a guaranteed budget or the final say on signings. You approach one, sit across the table, agree a wage, a contract and your
   promises, and pay compensation if you poach him. Sacking costs a payoff and leaves a caretaker. Break a promise and the new man remembers. */

const baseMgrSetup = setupWorld, baseMgrComplete = completeWorldSeason, baseMgrFootball = football;
const MFN = ['Gareth', 'Neil', 'Steve', 'Paul', 'Chris', 'Nathan', 'Darren', 'Lee', 'Michael', 'Mark', 'Kevin', 'Stuart', 'Carlos', 'Roberto', 'Marco', 'Thomas', 'Jürgen', 'Pep', 'Luis', 'Ange', 'Ruben', 'Eddie', 'Russell', 'Kieran', 'Liam', 'Danny', 'Alex', 'Ryan', 'Wayne', 'Scott', 'Dean', 'Martin', 'Nigel', 'Tony', 'Graham', 'Sean', 'Ian', 'Oliver', 'Xavi', 'Vincent'];
const MSN = ['Ainsworth', 'Warnock', 'Cooper', 'Rowett', 'Parkinson', 'Hughton', 'Carvalho', 'Moreno', 'Silva', 'Frank', 'Keller', 'Baumann', 'Jansen', 'de Boer', 'Marsh', 'Lowery', 'Beale', 'Rosenior', 'Maresca', 'Farke', 'Mowbray', 'Appleton', 'Eustace', 'Barton', 'Holloway', 'Pearson', 'Wagner', 'Robins', 'Sheridan', 'Evans', 'Duff', 'Flynn', 'Wilder', 'Ferguson', 'Lambert', 'Clotet', 'Castro', 'Lindqvist', 'Novák', 'Hasenhüttl'];
const NAT = ['England', 'England', 'England', 'England', 'Scotland', 'Wales', 'Ireland', 'Spain', 'Portugal', 'Italy', 'Germany', 'Netherlands', 'Argentina', 'Denmark'];
const STYLES = { attacking: ['Attacking', 'Front-foot football, goals at both ends.'], possession: ['Possession', 'Patient build-up and control of the ball.'], pragmatic: ['Pragmatic', 'Organised, compact and hard to beat.'], counter: ['Counter-attacking', 'Sit deep, break fast.'], motivator: ['Motivator', 'Gets more out of ordinary players.'] };
const STYLE_MENT = { attacking: 'attacking', possession: 'balanced', pragmatic: 'defensive', counter: 'defensive', motivator: 'balanced' };
const WANTS = { budget: 'A guaranteed transfer budget', control: 'The final say on signings', security: 'A promise not to sack him this season', contract: 'A long contract' };
let mgrNeg = null, mgrPickId = null;

/* ---------- the world of managers ---------- */
function mgrPool() {
  if (g.mgrpool) return g.mgrpool; let rng = seeded(Math.abs(hash('mgr' + g.seed)) + 1), pool = [], used = new Set();
  for (let i = 0; i < 40; i++) {
    let nm; do { nm = MFN[Math.floor(rng() * MFN.length)] + ' ' + MSN[Math.floor(rng() * MSN.length)] } while (used.has(nm)); used.add(nm);
    let rep = Math.round(20 + rng() * 75), skill = clamp(Math.round(rep * .55 + 20 + (rng() - .5) * 22), 30, 94), styles = Object.keys(STYLES);
    pool.push({ id: 'm' + i, name: nm, age: 36 + Math.floor(rng() * 28), nat: NAT[Math.floor(rng() * NAT.length)], rep, skill, style: styles[Math.floor(rng() * styles.length)], ambition: Math.round(rng() * 100), loyalty: Math.round(rng() * 100), wants: Object.keys(WANTS).filter(() => rng() < .35), won: Math.round(rng() * 40), games: 100 + Math.round(rng() * 500), club: null, since: 0 });
  }
  g.mgrpool = pool; mgrJobs(rng); return pool;
}
/* most managers have jobs; the best managers tend to be at the biggest clubs */
function mgrJobs(rng) {
  let pool = g.mgrpool.slice().sort((a, b) => b.rep - a.rep), clubs = CLUBS.filter(c => c.id !== g.clubId).sort((a, b) => a.league - b.league || (b.capacity - a.capacity)), taken = new Set();
  pool.forEach((m, i) => { if (rng() < .25) { m.club = null; return } let span = clubs.filter(c => !taken.has(c.id)), idx = clamp(Math.floor((1 - m.rep / 95) * span.length + (rng() - .5) * 8), 0, span.length - 1), c = span[idx]; if (c) { m.club = c.id; taken.add(c.id); m.since = g.season - Math.floor(rng() * 3) } });
}
const clubTier = id => g.divisions.findIndex(d => d.includes(id));
function mgrLevel(m) { return m.rep >= 78 ? 0 : m.rep >= 58 ? 1 : m.rep >= 38 ? 2 : 3 }   // the lowest division he would consider
function clubAppeal() {
  let t = tier(), base = [78, 58, 40, 26][t], pos = position(), n = g.tables[t].length, form = myrow().p ? (1 - (pos - 1) / (n - 1)) * 10 - 5 : 0, cash = clamp(g.cash / cfg[t].cash, -1, 2) * 4, fol = typeof fb === 'function' ? clamp(Math.log10(Math.max(1000, fb().online)) - 4.5, 0, 2) * 4 : 0;
  return Math.round(base + form + cash + fol + (g.trust - 60) * .1);
}
/* why he would or would not come (pure) */
function mgrInterest(m) {
  let t = tier(), appeal = clubAppeal(), reasons = [], score = appeal - m.rep * .75 + m.ambition * .12;
  if (mgrLevel(m) < t) { score -= (t - mgrLevel(m)) * 14; reasons.push(`Wants ${DB[mgrLevel(m)].name} football at least`) }
  if (m.club) { let ct = clubTier(m.club); if (ct >= 0 && ct < t) { score -= 18; reasons.push(`Happy at ${team(m.club).short}, a division above you`) } else if (ct === t) { score -= 6 + m.loyalty * .08; reasons.push(`Settled at ${team(m.club).short}`) } else { score += 6; reasons.push(`Sees you as a step up from ${team(m.club).short}`) } if (m.loyalty > 70) { score -= 6; reasons.push('Loyal by nature') } }
  else { score += 10; reasons.push('Out of work and wants a job') }
  if (m.ambition > 70) reasons.push('Ambitious: wants a project'); if (g.trust < 45) { score -= 6; reasons.push('Worried by the mood around the club') } if (g.cash < 0) { score -= 8; reasons.push('Nervous about the finances') }
  let code = score < -14 ? 'no' : score < 2 ? 'reluctant' : score < 22 ? 'open' : 'keen';
  return { code, score: Math.round(score), reasons, label: { no: 'Not interested', reluctant: 'Would need convincing', open: 'Open to talks', keen: 'Keen' }[code] };
}
function mgrWage(m, code = 'open') { let t = tier(); return Math.round(cfg[t].wage * (.012 + m.rep / 100 * .05) * ({ keen: .95, open: 1.05, reluctant: 1.35, no: 2 })[code] / 100) * 100 }
function mgrComp(m) { if (!m.club) return 0; let ct = clubTier(m.club); return ct < 0 ? 0 : Math.round(mgrWage(m) * 30 * (ct < tier() ? 1.6 : 1) / 1000) * 1000 }
function payoff() { let mg = g.manager; if (mg.caretaker) return 0; let left = mg.until ? Math.max(0, (mg.until - g.season) * 47 + Math.max(0, 47 - g.week)) : 47; return Math.round(mg.wage * Math.min(left, 52) / 1000) * 1000 }
function skillRange(m) { let j = (Math.abs(hash('sr' + m.id)) % 7) - 3; return [clamp(m.skill + j - 5, 1, 99), clamp(m.skill + j + 5, 1, 99)] }
function mgrStars(rep) { let n = Math.round(rep / 20); return '★'.repeat(clamp(n, 1, 5)) + '☆'.repeat(5 - clamp(n, 1, 5)) }
/* the response at the table (pure) */
function mgrResponse(m, offer, st) {
  let it = mgrInterest(m), need = mgrWage(m, it.code), wants = m.wants.filter(w => !offer.promises.includes(w)), yrs = m.wants.includes('contract') ? 3 : 2, miss = [];
  if (offer.wage < need) miss.push('wage'); if (wants.length && it.code === 'reluctant') miss.push('promises'); if (offer.years < yrs && m.wants.includes('contract')) miss.push('years');
  if (!miss.length) return { type: 'accept', line: it.code === 'keen' ? 'Where do I sign? Let us get to work.' : 'That is a fair offer. I accept.' };
  let gap = offer.wage < need ? (need - offer.wage) / need : .05; st.patience -= gap > .3 ? 2 : gap > .12 ? 1.5 : 1; st.round++;
  if (st.patience <= 0) return { type: 'walk', line: it.code === 'reluctant' ? 'I did not want to leave anyway. Good luck this season.' : 'We are too far apart. I will look elsewhere.' };
  let move = gap > .12 ? .35 : .55, d = Math.max(Math.ceil(need / 100) * 100, Math.round((st.demand - (st.demand - need) * move) / 100) * 100); st.demand = d;
  let line = miss.includes('wage') ? `I would want ${money(d)} a week${miss.includes('promises') ? ', and ' + WANTS[wants[0]].toLowerCase() : ''}.` : miss.includes('promises') ? `The money is fine. I need ${WANTS[wants[0]].toLowerCase()} before I move.` : `I would want a ${yrs}-year deal at least. Give me time to build.`;
  return { type: 'counter', demand: d, line, want: wants[0] || null, years: yrs };
}

/* ---------- the market screen ---------- */
function mgrMarket() {
  stopClock(); let pool = mgrPool(), t = tier(), rows = pool.filter(m => m.club !== g.clubId).map(m => ({ m, it: mgrInterest(m) })).sort((a, b) => ({ keen: 0, open: 1, reluctant: 2, no: 3 })[a.it.code] - ({ keen: 0, open: 1, reluctant: 2, no: 3 })[b.it.code] || b.m.rep - a.m.rep);
  let row = ({ m, it }) => { let [lo, hi] = skillRange(m), comp = mgrComp(m); return `<div class="mrow ${it.code}"><div class="mface">${typeof personFront === 'function' ? personFront({ name: m.name, male: true, age: m.age }, 'mk' + m.id) : ''}</div><div class="minfo"><b>${esc(m.name)}</b><small>${m.age} · ${esc(m.nat)} · ${m.club ? esc(team(m.club).name) + (clubTier(m.club) >= 0 ? ', ' + DB[clubTier(m.club)].name : '') : 'Out of work'}</small><div class="mtags"><span title="Reputation">${mgrStars(m.rep)}</span><span>${STYLES[m.style][0]}</span><span title="Our estimate of his ability">Ability ${lo}–${hi}</span><span>Win rate ${Math.round(28 + m.skill * .35)}%</span>${m.wants.length ? `<span class="wants" title="${esc(m.wants.map(w => WANTS[w]).join(', '))}">Wants: ${m.wants.map(w => ({ budget: 'budget', control: 'control', security: 'security', contract: 'long deal' })[w]).join(', ')}</span>` : ''}</div></div><div class="mint"><b class="il ${it.code}">${it.label}</b><small>${esc(it.reasons.slice(0, 2).join(' · '))}</small><small>About ${money(mgrWage(m, it.code))}/wk${comp ? ' · comp ' + money(comp) : ''}</small></div><div>${it.code === 'no' ? '<button disabled>Will not talk</button>' : `<button class="primary" onclick="mgrApproach('${m.id}')">Approach →</button>`}</div></div>` };
  $('modal').innerHTML = `<div class="overlay"><div class="modal wide mgrmodal"><div class="topline"><span class="eyebrow">THE MANAGER MARKET · ${esc(DB[t].name.toUpperCase())}</span><button class="textbutton" onclick="closeModal()">Close ×</button></div><h1>Find a manager</h1><p>Current: <b>${esc(g.manager.name)}</b>${g.manager.caretaker ? ' (caretaker)' : ` · payoff to dismiss ${money(payoff())}`}. Your club's appeal to managers right now: <b>${clubAppeal()}</b>/100. Interest depends on your level, your table position, your money and the mood around the club.</p><div class="mlist">${rows.map(row).join('')}</div></div></div>`;
}
function mgrApproach(id) {
  let m = mgrPool().find(x => x.id === id); if (!m) return; let it = mgrInterest(m); if (it.code === 'no') return toast(m.name + ' will not take the call.');
  mgrNeg = { id, st: { round: 1, patience: it.code === 'keen' ? 4 : 3, demand: Math.round(mgrWage(m, it.code) * 1.25 / 100) * 100, hist: [], said: null }, promises: [], budget: Math.round(cfg[tier()].fee / 1000) * 1000 }; mgrView();
}
function mgrView(msgText) {
  let m = mgrPool().find(x => x.id === mgrNeg.id), it = mgrInterest(m), st = mgrNeg.st, comp = mgrComp(m), po = payoff(), def = st.last || Math.round(mgrWage(m, 'open') * .95 / 100) * 100;
  let opening = `“${it.code === 'keen' ? 'I have admired this club for a while. Make me an offer.' : it.code === 'open' ? 'I am listening. Tell me about the project and the money.' : `I am ${m.club ? 'settled at ' + team(m.club).short : 'in no rush'}. You would have to make it worth my while.`}”`;
  let seats = [{ name: m.name, role: 'Manager', colour: '#4f9d7a' }, { name: 'Agent ' + m.name.split(' ').pop(), role: 'His agent', colour: '#7a6a8a' }];
  let prom = Object.entries(WANTS).map(([k, label]) => `<label class="promise ${m.wants.includes(k) ? 'wanted' : ''}"><input type="checkbox" ${mgrNeg.promises.includes(k) ? 'checked' : ''} onchange="mgrPromise('${k}',this.checked)"> ${label}${k === 'budget' ? ` <input type="number" id="mgrBudget" value="${mgrNeg.budget}" step="100000" oninput="mgrNeg.budget=Number(this.value)||0" style="width:120px;margin-left:6px">` : ''}${m.wants.includes(k) ? ' <em>he wants this</em>' : ''}</label>`).join('');
  let o = { eyebrow: 'MANAGER TALKS', title: m.name, sub: `${mgrStars(m.rep)} · ${STYLES[m.style][0]} · ${m.age} · ${m.club ? 'currently at ' + esc(team(m.club).name) : 'out of work'} · <b class="il ${it.code}">${it.label}</b>`, plaque: `${esc(club().name)} <span class="vs">·</span> Manager appointment`, opp: seats, speaker: 'opp', st,
    bubbles: [{ cls: '', who: m.name, txt: esc(msgText || st.said || opening) }, ...advice([['Gary Pell, Director of Football', `Our scouts rate his ability at ${skillRange(m).join('–')}. ${STYLES[m.style][1]}`], ['Margaret Hale, Finance Director', `${comp ? team(m.club).short + ' would want ' + money(comp) + ' in compensation. ' : ''}${po ? 'Dismissing ' + g.manager.name + ' costs ' + money(po) + '. ' : ''}The wage is for the whole contract.`]])],
    panel: `<div class="negpanel"><div class="negrow"><div><label>Weekly wage (£)</label><input id="negAmt" type="number" min="1" value="${def}"></div><div><label>Length</label><select id="negYears">${[1, 2, 3, 4].map(y => `<option value="${y}" ${y === (mgrNeg.years || 2) ? 'selected' : ''}>${y} year${y > 1 ? 's' : ''}</option>`).join('')}</select></div></div><div class="promises">${prom}</div>${st.hist.length ? `<div class="presets"><button class="primary" onclick="mgrAcceptDemand()">Accept his terms · ${money(st.demand)}${st.years ? ' · ' + st.years + ' years' : ''}${(st.wants || []).length ? ' · ' + WANTS[st.wants[0]].toLowerCase() : ''}</button></div>` : ''}<div class="negbtns"><button class="primary" onclick="mgrOffer()">Make the offer →</button><button onclick="closeModal();mgrMarket()">Back to the market</button></div><div id="negErr" class="negative boarderr"></div></div>` };
  $('modal').innerHTML = negHtml(o);
}
function mgrPromise(k, on) { mgrNeg.promises = mgrNeg.promises.filter(x => x !== k); if (on) mgrNeg.promises.push(k); }
function mgrAcceptDemand() { let el = $('negAmt'); if (el) el.value = mgrNeg.st.demand; if (mgrNeg.st.years) { let y = $('negYears'); if (y) y.value = String(mgrNeg.st.years) } for (let w of mgrNeg.st.wants || []) if (!mgrNeg.promises.includes(w)) mgrNeg.promises.push(w); mgrOffer() }
function mgrOffer() {
  let m = mgrPool().find(x => x.id === mgrNeg.id), st = mgrNeg.st, wage = Math.round(Number($('negAmt').value)), years = Number($('negYears').value); mgrNeg.years = years;
  if (!Number.isFinite(wage) || wage < 1) return negErr('Enter a weekly wage.'); if (mgrNeg.promises.includes('budget') && (!mgrNeg.budget || mgrNeg.budget < 0)) return negErr('Enter the budget you are promising.');
  let comp = mgrComp(m), po = payoff(); if (g.cash < comp + po) return negErr(`You cannot afford the compensation and payoff (${money(comp + po)}).`);
  st.last = wage; let r = mgrResponse(m, { wage, years, promises: mgrNeg.promises }, st);
  if (r.type === 'accept') { st.hist.push({ you: money(wage), them: 'Accepted' }); return mgrAppoint(m, wage, years, comp, po) }
  if (r.type === 'walk') { st.hist.push({ you: money(wage), them: 'Walked away' }); m.cool = g.season; save(); return negResultMgr(m, 'TALKS COLLAPSED', 'bad', `${m.name} has ended the conversation. Try again next season.`) }
  st.hist.push({ you: money(wage), them: money(r.demand) + (r.years && years < r.years ? ' · ' + r.years + ' yrs' : '') + (r.want ? ' · ' + ({ budget: 'budget', control: 'control', security: 'security', contract: 'long deal' })[r.want] : '') }); st.said = `“${r.line}”`; st.years = r.years && years < r.years ? r.years : null; st.wants = r.want ? [r.want] : []; if (r.want && !mgrNeg.promises.includes(r.want)) { /* he has told you what he wants */ } save(); mgrView(st.said);
}
function negResultMgr(m, stamp, tone, text) {
  $('modal').innerHTML = negHtml({ eyebrow: tone === 'good' ? 'APPOINTMENT' : 'TALKS COLLAPSED', title: m.name, sub: '', plaque: `${esc(club().name)} <span class="vs">·</span> Manager appointment`, opp: [{ name: m.name, role: 'Manager', colour: '#4f9d7a' }], speaker: 'us', st: null, result: { stamp, tone }, bubbles: [{ cls: 'you', who: 'Motion carried', txt: esc(text) }], panel: `<div class="actions"><button class="primary" onclick="closeBoardroom()">Close the meeting →</button></div>` });
  if (typeof SFX !== 'undefined') { if (tone === 'good') SFX.gavel(); else SFX.card() }
}
function mgrAppoint(m, wage, years, comp, po) {
  let old = g.manager, oldName = old.name, from = m.club ? team(m.club).name : null, code = mgrInterest(m).code; if (po) { g.cash -= po; record('Manager payoff: ' + oldName, -po) } if (comp) { g.cash -= comp; record('Compensation to ' + team(m.club).short, -comp) }
  if (!old.caretaker && old.id) { let om = mgrPool().find(x => x.id === old.id); if (om) { om.club = null } }
  if (m.club) { let vac = m.club; m.club = null; addNews(`${team(vac).short} seek a new manager`, `${m.name} has left ${team(vac).name} to join ${club().name}.`, 'league') }
  m.club = g.clubId; m.since = g.season; g.manager = { id: m.id, name: m.name, skill: m.skill, wage, until: g.season + years - 1, style: m.style, rep: m.rep, caretaker: false };
  g.world.mentality = STYLE_MENT[m.style]; g.world.managerTrust = ({ keen: 72, open: 62, reluctant: 52 })[code] || 60; g.morale = clamp(g.morale - 5, 10, 100);
  g.world.promises = { season: g.season, budget: mgrNeg.promises.includes('budget') ? mgrNeg.budget : 0, control: mgrNeg.promises.includes('control'), security: mgrNeg.promises.includes('security'), kept: null };
  msg('New manager appointed', `${m.name} is the new manager of ${club().name} on ${money(wage)} a week until summer ${seasonYear() + years}.${comp ? ' Compensation of ' + money(comp) + ' was paid.' : ''}${po ? ' ' + oldName + ' received a ' + money(po) + ' payoff.' : ''}`, 'football');
  if (m.rep >= 65 && typeof pressQueue === 'function') pressQueue({ head: m.rep >= 80 ? 'MARQUEE APPOINTMENT' : 'NEW MAN IN THE DUGOUT', sub: `${club().short} appoint ${m.name}${from ? ', prising him from ' + from : ''}.`, body: `The ${m.age}-year-old brings ${STYLES[m.style][0].toLowerCase()} football and ${m.won} trophies and promotions on his CV. "This is a club with real ambition," he said at his unveiling. The squad trains under him for the first time tomorrow.`, tone: 'good', kind: 'club', scene: 'signing' });
  save(); negResultMgr(m, 'APPOINTED', 'good', `${m.name} is your new manager. ${STYLES[m.style][1]}${g.world.promises.budget ? ' You have promised him ' + money(g.world.promises.budget) + ' to spend this season.' : ''}`);
}
function mgrDismiss() {
  if (g.manager.caretaker) return toast('A caretaker is already in charge.'); let po = payoff(); if (g.cash < po) return toast('You cannot afford the ' + money(po) + ' payoff.');
  askThen(`Dismiss ${g.manager.name}? The payoff is ${money(po)}, and your assistant takes over as caretaker until you appoint someone.`, 'Dismiss the manager', () => doDismiss(po));
}
function doDismiss(po) {
  let old = g.manager; g.cash -= po; record('Manager payoff: ' + old.name, -po); if (old.id) { let om = mgrPool().find(x => x.id === old.id); if (om) om.club = null }
  let care = MFN[Math.abs(hash('care' + g.season)) % MFN.length] + ' ' + MSN[Math.abs(hash('cs' + g.season)) % MSN.length];
  g.manager = { name: care, skill: clamp(cfg[tier()].quality - 6, 30, 90), wage: Math.round(cfg[tier()].wage * .012), caretaker: true, style: 'pragmatic' }; g.morale = clamp(g.morale - 4, 10, 100); g.world.managerTrust = 55;
  if (g.world.promises && g.world.promises.security && g.world.promises.season === g.season) { g.trust = clamp(g.trust - 4, 5, 100); msg('Promise broken', 'You promised not to sack the manager this season. Supporters and the dressing room have noticed.', 'football') }
  g.world.promises = null; msg('Manager dismissed', `${old.name} has left the club${po ? ' with a ' + money(po) + ' payoff' : ''}. ${care} takes charge as caretaker.`, 'football'); addNews(`${club().short} part company with ${old.name}`, `${care} is caretaker while the board searches for a successor.`, 'club'); save(); closeModal(); render();
}

/* ---------- the seasons: promises checked, jobs change ---------- */
completeWorldSeason = function () {
  baseMgrComplete(); let P = g.world.promises; if (P && P.season === g.season && P.budget) { let spent = fin().season.purchases || 0; if (spent >= P.budget) { g.world.managerTrust = clamp(g.world.managerTrust + 6, 5, 100); P.kept = true } else { g.world.managerTrust = clamp(g.world.managerTrust - 15, 5, 100); P.kept = false; msg('Promise broken', `You promised ${g.manager.name} a transfer budget of ${money(P.budget)} but spent ${money(spent)}. He is unhappy.`, 'football') } }
};
setupWorld = function (...a) {
  let r = baseMgrSetup(...a); let first = !g.mgrpool; mgrPool(); if (first) return r; let rng = seeded(Math.abs(hash('mj' + g.seed + g.season)) + 7), pool = g.mgrpool;
  for (let m of pool) { if (m.club === g.clubId) continue; m.age++; if (m.age > 66 && rng() < .5) { m.club = null; m.rep = Math.max(20, m.rep - 20) } else if (m.club && rng() < .22) { m.club = null } m.rep = clamp(m.rep + Math.round((rng() - .5) * 8), 15, 95); m.cool = null }
  let vacant = CLUBS.filter(c => c.id !== g.clubId && !pool.some(m => m.club === c.id)); for (let c of vacant) { let free = pool.filter(m => !m.club && m.id !== g.manager.id).sort((a, b) => b.rep - a.rep); let pick = free.find(m => mgrLevel(m) >= c.league) || free[0]; if (pick && rng() < .85) { pick.club = c.id; pick.since = g.season } }
  if (g.manager.until && g.season > g.manager.until && !g.manager.caretaker) { g.manager.until = g.season; msg('Manager’s contract', `${g.manager.name}’s contract has run into its final year. Agree a new deal or plan a succession.`, 'football') }
  return r;
};
football = function () {
  let h = baseMgrFootball(); if (typeof h !== 'string') return h; let mg = g.manager, until = mg.until ? 'Contract to summer ' + (2025 + mg.until + 1) : mg.caretaker ? 'Caretaker' : 'Rolling contract';
  let card_ = `<div class="pad mgrcard"><div class="mgrtop">${typeof personFront === 'function' ? personFront({ name: mg.name, male: true }, 'mgcur') : ''}<div><h2>${esc(mg.name)}${mg.caretaker ? ' <small>caretaker</small>' : ''}</h2><p>${mg.rep ? mgrStars(mg.rep) + ' · ' : ''}${mg.style ? STYLES[mg.style][0] + ' · ' : ''}${money(mg.wage)}/week · ${until}<br>Relationship ${g.world.managerTrust}/100${g.world.promises && g.world.promises.budget ? ' · promised budget ' + money(g.world.promises.budget) + ' (spent ' + money(fin().season.purchases || 0) + ')' : ''}</p></div></div><label>Default match approach</label><select onchange="g.world.mentality=this.value;save()">${['balanced', 'attacking', 'defensive'].map(v => `<option ${g.world.mentality === v ? 'selected' : ''} value="${v}">${v[0].toUpperCase() + v.slice(1)}</option>`).join('')}</select><div class="actions"><button class="primary" onclick="mgrMarket()">Find a new manager →</button>${mg.caretaker ? '' : `<button onclick="mgrDismiss()">Dismiss · ${money(payoff())}</button>`}</div></div>`;
  let i = h.indexOf('<div class="pad"><h2>' + esc(mg.name)), j = h.indexOf('</div>', h.indexOf('Recruit a stronger manager')); if (i < 0 || j < 0) return h; return h.slice(0, i) + card_ + h.slice(j + 6);
};
hireManager = function () { mgrMarket() };
