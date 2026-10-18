/* Phase 2b — injuries and fitness.
   Players carry fitness (p.fit), an injury-proneness trait and an optional injury (p.inj). Injuries and tired legs change who plays,
   and so change results, but only inside match simulation (transfer valuations are not disturbed by a knock). */

const baseMedSquadRating = squadRating, baseMedSimulate = simulate, baseMedRaw = rawScore, baseMedTick = tickMatch,
  baseMedSettle = settleLeague, baseMedResolve = resolveCupGame, baseMedWeekly = weeklyWorld, baseMedAdvance = advanceDay,
  baseMedMarket = marketPlayer, baseMedShowTransfer = showTransfer;

const MED = {
  staff: { name: 'Medical staff', desc: 'Doctors and physios. Fewer injuries and better return estimates.', cost: [0, 1.5, 3, 5.5], run: [0, .004, .008, .014] },
  science: { name: 'Sports science', desc: 'Load monitoring. Fewer injuries and faster recovery of match fitness.', cost: [0, 1.5, 3, 5.5], run: [0, .004, .008, .014] },
  rehab: { name: 'Rehab facilities', desc: 'Injured players return sooner.', cost: [0, 2, 4, 7], run: [0, .003, .006, .01] }
};
const INJ = {
  knock: { label: 'Knock', days: [3, 10] }, muscle: { label: 'Muscle injury', days: [14, 35] },
  ligament: { label: 'Ligament injury', days: [56, 140] }, long: { label: 'Long-term injury', days: [168, 280] }
};
let matchCtx = 0;

function med() { return g.med || (g.med = { staff: 0, science: 0, rehab: 0, lastDay: null, recent: [], warned: null }) }
function proneOf(p) { return .6 + (Math.abs(hash(p.id)) % 100) / 100 }
function isProne(p) { return proneOf(p) > 1.35 }
function fitOf(p) { return p.fit == null ? 100 : p.fit }
function isAvail(p) { return !p.inj }
function medWeekly() { let m = med(); return Math.round(Object.keys(MED).reduce((s, k) => s + cfg[tier()].income * MED[k].run[m[k]], 0)) }
function medReduction() { let m = med(); return 1 - .07 * (m.staff + m.science) }
function effective(p) { return p.rating * (.88 + .12 * fitOf(p) / 100) }
function restThreshold() { return 60 + ((g.world?.managerTrust ?? 70) - 50) * .2 }
function selectXI() {
  let pool = g.squad.filter(p => isAvail(p) && !p.rest), th = restThreshold();
  let fresh = pool.filter(p => fitOf(p) >= th).sort((a, b) => effective(b) - effective(a));
  let tired = pool.filter(p => fitOf(p) < th).sort((a, b) => effective(b) - effective(a));
  let order = [...fresh, ...tired];
  let forced = g.squad.filter(p => isAvail(p) && p.rest).sort((a, b) => effective(b) - effective(a));
  return { xi: order.slice(0, 11), subs: [...order.slice(11), ...forced].slice(0, 3) };
}
function availableRating() {
  let { xi } = selectXI(), sum = xi.reduce((s, p) => s + effective(p), 0) + (11 - xi.length) * 35;
  return sum / 11;
}
squadRating = function () { return matchCtx ? availableRating() : baseMedSquadRating() };
function inMatch(fn) { return function (...a) { matchCtx++; try { return fn.apply(this, a) } finally { matchCtx-- } } }
simulate = inMatch(simulate); rawScore = inMatch(rawScore); tickMatch = inMatch(tickMatch);

function keyPlayers() { return [...g.squad].sort((a, b) => b.rating - a.rating).slice(0, 13).map(p => p.id) }
function injure(p, date) {
  let m = med(), r = rnd(), sev = r < .55 ? 'knock' : r < .85 ? 'muscle' : r < .96 ? 'ligament' : 'long', [lo, hi] = INJ[sev].days;
  let days = Math.max(2, Math.round((lo + rnd() * (hi - lo)) * (1 - .07 * m.rehab)));
  let spread = Math.max(.15, .5 - .1 * m.staff), est = Math.max(2, Math.round(days * (1 + (rnd() - .5) * 2 * spread)));
  p.inj = { sev, type: INJ[sev].label, start: date, back: dayAdd(date, days), est: dayAdd(date, est), setbacks: 0 };
  p.fit = Math.min(fitOf(p), 60);
  let key = keyPlayers().includes(p.id);
  msg((key ? 'Injury: ' : 'Minor injury: ') + p.name, `${INJ[sev].label}. The medical team expect him back around ${dateText(p.inj.est, false)}${spreadNote(m)}.`, 'football');
  m.recent.push(p.name + ' (' + INJ[sev].label.toLowerCase() + ')');
}
function spreadNote(m) { return m.staff >= 2 ? '' : ' (estimates can be wrong)' }
function matchLoad(f) {
  if (!g.world || !(f.home === g.clubId || f.away === g.clubId)) return;
  let m = med(), date = f.date || g.world.date; m.recent = [];
  let { xi, subs } = selectXI(), recent = g.world.fixtures.filter(x => x.played && x.id !== f.id && daysBetween(x.date, date) >= 0 && daysBetween(x.date, date) <= 14).length;
  for (let [list, load] of [[xi, 1], [subs, .35]]) for (let p of list) {
    let fit = fitOf(p), mult = proneOf(p) * (fit < 70 ? 1 + (70 - fit) / 80 : 1) * (1 + .07 * Math.max(0, recent - 2)) * (p.age > 31 ? 1.25 : 1) * medReduction() * (p.rushUntil && p.rushUntil >= date ? 3 : 1) * (p.riskNext ? 2 : 1) * load;
    p.fit = Math.max(20, fit - (11 + rnd() * 6) * (1 - .06 * m.science) * load);
    p.riskNext = false;
    if (rnd() < .018 * mult) injure(p, date);
  }
  for (let p of g.squad) p.rest = false;
  let n = g.squad.filter(isAvail).length;
  if (n < 15 && (!m.warned || daysBetween(m.warned, date) >= 14)) { m.warned = date; msg('Squad crisis: ' + n + ' fit players', 'Injuries have left you with ' + n + ' fit first-team players. Rest tired players, rush someone back or buy cover while the window is open.', 'football') }
}
settleLeague = function (f, score) { let r = baseMedSettle(f, score); matchLoad(f); return r };
resolveCupGame = function (cup, f, score, quiet) { let r = baseMedResolve(cup, f, score, quiet); matchLoad(f); return r };

function medDaily() {
  let w = g.world, m = med(); if (m.lastDay === w.date) return; m.lastDay = w.date;
  for (let p of g.squad) {
    if (p.inj) {
      if (w.date >= p.inj.back) {
        let rushed = p.inj.rushed, sev = p.inj.sev; p.fit = rushed ? 55 : sev === 'knock' ? 85 : sev === 'muscle' ? 75 : 60;
        if (rushed) p.rushUntil = dayAdd(w.date, 21); p.inj = null;
        msg('Returns: ' + p.name, p.name + ' is back in training' + (rushed ? ', but he was rushed and the medical team are worried.' : '.'), 'football');
      }
    } else p.fit = Math.min(100, fitOf(p) + 3 + .5 * m.science);
  }
}
advanceDay = function () { baseMedAdvance(); if (g && g.world && !g.ended) medDaily() };
weeklyWorld = function () {
  let prev = g.ledger[0]; baseMedWeekly(); if (g.ledger[0] === prev || g.ended) return;
  let cost = medWeekly(); if (cost) addLedger('Medical & sports science', -cost);
  let m = med();
  for (let p of g.squad) if (p.inj && p.inj.sev !== 'knock' && rnd() < .05 * (1 - .1 * m.rehab)) {
    let extra = 7 + Math.floor(rnd() * 15); p.inj.back = dayAdd(p.inj.back, extra); p.inj.est = dayAdd(p.inj.est, extra); p.inj.setbacks++;
    msg('Setback: ' + p.name, 'A setback in rehab. The medical team now expect him back around ' + dateText(p.inj.est, false) + '.', 'football');
  }
};
marketPlayer = function (p, owner) {
  let m = baseMedMarket(p, owner); if (isProne(p)) { m.prone = true; m.ask = Math.round(m.ask * .9 / 1000) * 1000 } return m;
};
showTransfer = function (id) {
  baseMedShowTransfer(id); let d = g.world.deals[id], h = $('modal').innerHTML;
  if (d && d.player.prone && typeof h === 'string' && h.includes('<span class="pill')) $('modal').innerHTML = h.replace('<span class="pill', '<span class="pill negative">Injury-prone · cheaper but misses games</span> <span class="pill');
};

/* actions */
function restPlayer(id) { let p = g.squad.find(x => x.id === id); if (!p || p.inj) return { error: 'He cannot be rested.' }; p.rest = true; p.fit = Math.min(100, fitOf(p) + 12); save(); return { ok: true } }
function rushBack(id) {
  let p = g.squad.find(x => x.id === id); if (!p || !p.inj) return { error: 'He is not injured.' };
  let left = daysBetween(g.world.date, p.inj.back); if (left <= 3) return { error: 'He is nearly back anyway.' };
  p.inj.back = dayAdd(g.world.date, Math.max(2, Math.round(left * .4))); p.inj.est = p.inj.back; p.inj.rushed = true;
  g.world.managerTrust = clamp(g.world.managerTrust - 4, 5, 100);
  msg('Manager unhappy: ' + p.name, 'Your manager and the medical team objected to rushing ' + p.name + ' back. The relationship has cooled, and the injury risk is higher when he returns.', 'football');
  save(); return { ok: true };
}
function medCost(k) { let m = med(), lv = m[k]; return lv >= 3 ? 0 : Math.round(cfg[tier()].income * MED[k].cost[lv + 1]) }
function investMedical(k) {
  let cost = medCost(k); if (!cost) return { error: 'Already at the top level.' }; if (g.cash < cost) return { error: 'You need ' + money(cost) + '.' };
  if (typeof boardVote === 'function') { let v = boardVote('spend', cost); if (!v.ok) return { error: v.reason } }
  g.cash -= cost; med()[k]++; record(MED[k].name + ' investment', -cost); save(); return { ok: true, cost };
}

/* page */
function medicalPage() {
  let m = med(), inj = g.squad.filter(p => p.inj), avail = g.squad.filter(isAvail), { xi } = selectXI();
  let avgFit = xi.length ? xi.reduce((s, p) => s + fitOf(p), 0) / xi.length : 0, key = keyPlayers();
  let alert = avail.length < 15 ? `<div class="notice danger"><b>Thin squad.</b> Only ${avail.length} fit first-team players. Buy cover or promote from the academy.</div>` : avgFit < 70 ? `<div class="notice warning"><b>Tired legs.</b> The likely XI averages ${Math.round(avgFit)}% fitness. Rotate or protect them.</div>` : '';
  let invest = Object.entries(MED).map(([k, c]) => {
    let lv = m[k], cost = medCost(k);
    return `<div class="card pad"><div class="eyebrow">LEVEL ${lv} / 3</div><h2 style="font-size:22px;margin:10px 0">${c.name}</h2><p>${c.desc}</p><div class="row"><span>Running cost</span><b>${money(Math.round(cfg[tier()].income * c.run[lv]))}/week</b></div><button class="primary investbtn" ${cost ? '' : 'disabled'} onclick="result(investMedical('${k}'),'Investment made.')">${cost ? 'Invest ' + money(cost) + ' →' : 'Fully developed'}</button></div>`;
  }).join('');
  let injRows = inj.sort((a, b) => a.inj.est.localeCompare(b.inj.est)).map(p => `<tr><td><b>${esc(p.name)}</b><small>${p.position}${key.includes(p.id) ? ' · key' : ''}</small></td><td>${esc(p.inj.type)}${p.inj.rushed ? ' · rushed' : ''}${p.inj.setbacks ? ' · ' + p.inj.setbacks + ' setback(s)' : ''}</td><td>${dateText(p.inj.est, false)}</td><td>about ${Math.max(0, daysBetween(g.world.date, p.inj.est))} days</td><td><button class="iconbutton" onclick="result(rushBack('${p.id}'),'Rushed back. The manager is not happy.')">Rush back</button></td></tr>`).join('');
  let squadRows = [...g.squad].sort((a, b) => b.rating - a.rating).map(p => {
    let f = fitOf(p), st = p.inj ? 'Injured' : p.rest ? 'Resting' : f < restThreshold() ? 'Tired' : 'Fit';
    return `<tr><td><b>${esc(p.name)}</b><small>${p.position} · ${Math.round(p.rating)}${isProne(p) ? ' · <span class="negative">injury-prone</span>' : ''}</small></td><td class="barcell">${bar(f / 100, f < 60 ? 'bad' : '')}</td><td>${Math.round(f)}%</td><td class="${st === 'Injured' ? 'negative' : st === 'Tired' ? 'warnc' : ''}">${st}</td><td>${p.inj || p.rest ? '' : `<button class="iconbutton" onclick="result(restPlayer('${p.id}'),'He will miss the next match.')">Rest next match</button>`}</td></tr>`;
  }).join('');
  return `${alert}<div class="stats">${[['Fit players', avail.length + ' / ' + g.squad.length, 'available to select'], ['Injured', String(inj.length), inj.length ? 'longest back ' + dateText([...inj].sort((a, b) => b.inj.est.localeCompare(a.inj.est))[0].inj.est, false) : 'nobody out'], ['XI fitness', Math.round(avgFit) + '%', 'likely starters'], ['Medical budget', money(medWeekly()) + '/wk', 'staff, science, rehab']].map(([a, b, c]) => `<div class="stat"><div class="label">${a}</div><b>${b}</b><small>${c}</small></div>`).join('')}</div>
  <div class="sectiontitle"><h2>Medical department</h2></div><div class="cards">${invest}</div>
  ${card('Injury list', `<div class="tablewrap"><table><thead><tr><th>PLAYER</th><th>INJURY</th><th>EXPECTED BACK</th><th>TIME LEFT</th><th></th></tr></thead><tbody>${injRows || '<tr><td colspan="5">Nobody is injured.</td></tr>'}</tbody></table></div><div class="pad"><p class="fineprint">Return dates are the medical team’s estimate and can be wrong: better staff estimate more closely. Rushing a player back shortens the layoff but raises re-injury risk and annoys your manager.</p></div>`)}
  ${card('Squad fitness', `<div class="tablewrap"><table><thead><tr><th>PLAYER</th><th>FITNESS</th><th></th><th>STATUS</th><th></th></tr></thead><tbody>${squadRows}</tbody></table></div><div class="pad"><p class="fineprint">Fixture congestion drains fitness. Tired and injury-prone players get injured more often, and your manager rests players when they drop below ${Math.round(restThreshold())}%, more freely if he trusts you.</p></div>`)}`;
}
PAGE_BUILDERS.Medical = medicalPage;
MY_PAGES.push('Medical'); MY_LABELS.Medical = ['KEEP THEM FIT', 'Injuries & fitness', 'Who is available, who is tired and what it costs.'];
NAV_ORDER.splice(NAV_ORDER.indexOf('Football') + 1, 0, 'Medical'); NAV_ICON.Medical = 'Academy';
NAV_BADGES.Medical = () => { let n = g.squad.filter(p => p.inj).length; return n ? `<span class="count ${n >= 4 ? 'hot' : ''}">${n}</span>` : '' };
