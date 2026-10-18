/* Hiring a Finance Director, Head of Commercial or Director of Football used to be a dropdown picking an abstract quality
   tier. Now it's a shortlist of named people with a reputation, an age, and a trait that says something about how they
   work, each asking a wage that reflects who they are — and dismissing one costs a payoff, same as any real departure. */

const SH_FN = ['James', 'Rebecca', 'Michael', 'Priya', 'David', 'Sarah', 'Andrew', 'Claire', 'Mark', 'Fiona', 'Daniel', 'Helen', 'Robert', 'Laura', 'Paul', 'Nicola', 'Simon', 'Rachel', 'Graham', 'Amanda'];
const SH_SN = ['Whitfield', 'Okafor', 'Bramley', 'Sandhu', 'Carrington', 'Mulcahy', 'Pearce', 'Donaldson', 'Keogh', 'Fairweather', 'Appleby', 'Marsh', 'Tildesley', 'O\u2019Brien', 'Carver', 'Sinclair'];
const STAFF_TRAITS = { finance: ['Cautious with money', 'Ambitious about growth', 'Methodical and careful', 'Bold with risk'], commercial: ['Deeply networked', 'Creative dealmaker', 'Relentless on sponsors', 'Old-school contacts'], football: ['Believes in data', 'Traditional eye for a player', 'Well connected abroad', 'Hands-on with the academy'] };
function staffPool(role) {
  g.staffpool = g.staffpool || {}; if (g.staffpool[role]) return g.staffpool[role];
  // every candidate ever drawn, for any role, past or present, stays off every future shortlist — so nobody you
  // dismissed turns up again days later, and the same name never appears twice across different posts at once
  g.allStaffNames = g.allStaffNames || [];
  let rng = seeded(Math.abs(hash('staffpool' + role + g.season + (g.staffpoolSeq = (g.staffpoolSeq || 0) + 1))) + 1), pool = [], used = new Set(g.allStaffNames);
  for (let i = 0; i < 4; i++) {
    let nm, tries = 0; do { nm = SH_FN[Math.floor(rng() * SH_FN.length)] + ' ' + SH_SN[Math.floor(rng() * SH_SN.length)] } while (used.has(nm) && tries++ < 60); used.add(nm); g.allStaffNames.push(nm);
    let rep = Math.round(15 + rng() * 80), q = rep >= 68 ? 3 : rep >= 42 ? 2 : 1;
    pool.push({ id: 'sp' + i, name: nm, rep, q, age: 30 + Math.floor(rng() * 30), trait: STAFF_TRAITS[role][Math.floor(rng() * STAFF_TRAITS[role].length)] });
  }
  return g.staffpool[role] = pool;
}
function staffWage(role, c) { return Math.round(cfg[tier()].wage * DEL_Q[c.q].wage * (.8 + c.rep / 260) / 100) * 100 }
function hiredWageOf(role) { let st = del().staff[role]; return st.wage || (st.q ? Math.round(cfg[tier()].wage * DEL_Q[st.q].wage / 100) * 100 : 0) }
function hireStaff(role, id) {
  let c = staffPool(role).find(x => x.id === id); if (!c) return; let wage = staffWage(role, c), st = del().staff[role];
  if (!confirm(`Appoint ${c.name} as your new ${DEL_ROLES[role]} on ${money(wage)}/week?`)) return;
  if (st.name) { let payoff = Math.round(hiredWageOf(role) * 8 / 100) * 100; if (payoff) { g.cash -= payoff; record('Payoff: ' + st.name, -payoff) } }
  del().staff[role] = { q: c.q, limit: st.limit || 'low', name: c.name, trait: c.trait, wage, rep: c.rep, since: g.season };
  delete g.staffpool[role];
  msg('New appointment: ' + c.name, `${c.name} joins as your ${DEL_ROLES[role]} on ${money(wage)}/week. ${c.trait}.`, 'football'); save(); render();
}
function dismissStaff(role) {
  let st = del().staff[role]; if (!st.name) return; if (!confirm(`Dismiss ${st.name}?`)) return;
  let payoff = Math.round(hiredWageOf(role) * 8 / 100) * 100; if (payoff) { g.cash -= payoff; record('Payoff: ' + st.name, -payoff) }
  del().staff[role] = { q: 0, limit: st.limit }; delete g.staffpool[role]; save(); render();
}
delWeekly = function () { let d = del(); return Object.values(d.staff).reduce((s, st) => s + (st.name ? (st.wage || 0) : 0), 0) };

/* ---------- the card: either a named appointment, or a shortlist to choose from ---------- */
function staffRoleCard(role, name) {
  let st = del().staff[role], mine = del().log.filter(l => l.role === role).length;
  let hired = st.name ? `<div class="hirerow"><div><b>${esc(st.name)}</b><small>${esc(st.trait || '')} \u00b7 reputation ${st.rep || '\u2013'}/100 \u00b7 ${money(st.wage || 0)}/week</small></div><button class="ghost" onclick="dismissStaff('${role}')">Dismiss</button></div>`
    : `<div class="shortlist">${staffPool(role).map(c => `<div class="candrow"><div><b>${esc(c.name)}</b><small>${esc(c.trait)} \u00b7 reputation ${c.rep}/100 \u00b7 ${c.age} \u00b7 asking ${money(staffWage(role, c))}/week</small></div><button onclick="hireStaff('${role}','${c.id}')">Appoint</button></div>`).join('')}</div>`;
  return `<div class="card pad"><div class="eyebrow">${role.toUpperCase()}</div><h2 style="font-size:22px;margin:10px 0">${name}</h2>${hired}
  <label>May approve alone</label><select onchange="setDelegate('${role}',null,this.value)" ${st.q ? '' : 'disabled'}>${Object.keys(DEL_LIMITS).map(k => `<option value="${k}" ${st.limit === k ? 'selected' : ''}>${DEL_LIMIT_NAMES[k]}${k === 'off' ? '' : ' \u00b7 up to ' + money(Math.round(cfg[tier()].income * DEL_LIMITS[k]))}</option>`).join('')}</select>
  <p class="fineprint">${st.q ? `${mine} recent decisions logged. A better reputation means the right call more often; anything above the limit comes to you.` : 'Without one, every ' + role + ' decision lands in your inbox.'}</p></div>`;
}
staffPage = function () {
  let ds = del(), open = ds.queue.filter(d => d.status === 'open');
  let cards = Object.entries(DEL_ROLES).map(([role, name]) => staffRoleCard(role, name)).join('');
  let openHtml = open.length ? open.map(d => `<div class="inboxitem prio-decision"><div class="inboxbody"><div class="inboxmeta"><span class="prio prio-decision">Decision</span><span>${esc(DEL_ROLES[d.kind])}</span><span class="pill deadline">Decide by ${dateText(d.due, false)}</span></div><h3>${esc(d.title)}</h3><p>${esc(d.body)}</p><div class="decisionopts">${d.opts.map((o, i) => `<button class="${i === 0 ? 'primary' : ''}" onclick="answerDecision('${d.id}',${i})">${esc(o.label)}</button>`).join('')}</div></div></div>`).join('') : '<div class="pad"><p>Nothing waiting. Your desk is clear.</p></div>';
  let log = ds.log.map(l => `<tr><td>${dateText(l.date, false)}</td><td>${esc(DEL_ROLES[l.role])}</td><td>${esc(l.title)}</td><td>${esc(l.choice)}</td><td class="${l.good ? 'positive' : 'negative'}">${l.good ? 'Best option' : 'Not the best'}</td></tr>`).join('');
  return `<div class="stats">${[['Staff wages', money(delWeekly()) + '/wk', 'delegates\u2019 salaries'], ['Waiting for you', String(open.length), 'decisions open'], ['Delegated', String(ds.made), 'decisions made for you'], ['Mistakes', String(ds.mistakes), ds.made ? Math.round(ds.mistakes / ds.made * 100) + '% of delegated' : 'none yet']].map(([a, b, c]) => `<div class="stat"><div class="label">${a}</div><b>${b}</b><small>${c}</small></div>`).join('')}</div>
  <div class="cards">${cards}</div>${card('Decisions waiting for you', openHtml)}
  ${card('What your delegates have done', `<div class="tablewrap"><table><thead><tr><th>DATE</th><th>WHO</th><th>DECISION</th><th>CHOSE</th><th></th></tr></thead><tbody>${log || '<tr><td colspan="5">Nothing delegated yet. Hire someone above.</td></tr>'}</tbody></table></div>`)}
  <p class="fineprint">Minor decisions arrive about once a week: repairs, insurance, small sponsor and community requests, contract requests, scouting trips and renewals. Large moves such as transfers, loans and big projects always stay with you.</p>`;
};
PAGE_BUILDERS.Staff = staffPage;   // Staff is looked up through PAGE_BUILDERS at the point it was first registered, so the override must be re-registered here or the old page keeps rendering
