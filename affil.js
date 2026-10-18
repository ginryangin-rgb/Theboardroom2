/* Club affiliations. A feeder club in the lower divisions that sends you young trialists and gives you roots in the region, an overseas partner club
   that grows your following abroad, your supporter groups (the Trust, the singing section, the family stand), and your rivals with the record against them. */

const baseAffSetup = setupWorld, baseAffWeekly = weeklyWorld;
const PARTNERS = [
  { name: 'Club Atlético Rio Verde', country: 'Brazil', flag: '🇧🇷' }, { name: 'Sakura Wanderers', country: 'Japan', flag: '🇯🇵' }, { name: 'Frontier City FC', country: 'United States', flag: '🇺🇸' },
  { name: 'Lagos Meridian', country: 'Nigeria', flag: '🇳🇬' }, { name: 'Nordlys IF', country: 'Norway', flag: '🇳🇴' }, { name: 'Al Noor SC', country: 'Qatar', flag: '🇶🇦' },
  { name: 'Southern Cross United', country: 'Australia', flag: '🇦🇺' }, { name: 'Atlas Casablanca', country: 'Morocco', flag: '🇲🇦' }
];
const GROUPS = {
  trust: { name: 'Supporters’ Trust', icon: '🏛️', desc: 'Owns a voice, not the club. Wants to be consulted and listened to.', meet: 'Meet the Trust', gain: 'The Trust trusts you more' },
  ultras: { name: 'The singing section', icon: '🥁', desc: 'The loudest end of the ground. Passion, flares and the occasional fine.', meet: 'Support the singing section', gain: 'The atmosphere lifts' },
  family: { name: 'Family stand & access group', icon: '👨‍👩‍👧', desc: 'Families, disabled supporters and the volunteers who make the day work.', meet: 'Visit the family stand', gain: 'Families feel looked after' }
};
function aff() { if (!g.aff) g.aff = { feeder: null, partner: null, groups: { trust: 55, ultras: 55, family: 55 }, met: {} }; if (!g.aff.groups) g.aff.groups = { trust: 55, ultras: 55, family: 55 }; if (!g.aff.met) g.aff.met = {}; return g.aff }
const feederCost = () => Math.round(cfg[tier()].wage * .12 / 1000) * 1000;
const partnerCost = () => Math.round(cfg[tier()].sponsor * .06 / 1000) * 1000;
const groupCost = () => Math.round(cfg[tier()].income * .2 / 1000) * 1000;

/* ---------- who could be your partners ---------- */
function feederCandidates() {
  let t = tier(), lower = CLUBS.filter(c => g.divisions.findIndex(d => d.includes(c.id)) > t && g.divisions.findIndex(d => d.includes(c.id)) <= Math.min(3, t + 2) && c.id !== g.clubId).map(c => ({ id: c.id, name: c.name, miles: milesBetween(g.clubId, c.id), league: DB[g.divisions.findIndex(d => d.includes(c.id))].name, real: true })).filter(c => c.miles <= 130).sort((a, b) => a.miles - b.miles).slice(0, 4);
  if (lower.length >= 2) return lower;
  let town = townOf(g.clubId).replace(/ [A-Z]\d+$/, '') || club().short, suf = ['Town', 'Athletic', 'Rangers', 'Vale'];
  return [...lower, ...suf.slice(0, 4 - lower.length).map((s, i) => ({ id: 'nl' + i, name: `${town} ${s}`, miles: 6 + i * 9, league: 'Non-league', real: false }))];
}
function partnerCandidates() { let rng = seeded(Math.abs(hash('pc' + g.clubId)) + 9), pool = PARTNERS.slice(), out = []; while (out.length < 3 && pool.length) out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]); return out }

/* ---------- decisions ---------- */
function affSignFeeder(idx) {
  let a = aff(), c = feederCandidates()[idx], cost = feederCost(); if (!c || a.feeder) return; if (!spend(cost)) return;
  a.feeder = { id: c.id, name: c.name, league: c.league, since: g.season, rel: 60, miles: c.miles }; g.fans = Math.round(clamp(g.fans * 1.015, 500, g.capacity * 1.5));
  msg('Feeder club agreed', `${c.name} are now your feeder club. Expect two young trialists every summer and a warmer welcome across the region.`, 'club'); save(); render();
}
function affSignPartner(idx) {
  let a = aff(), p = partnerCandidates()[idx], cost = partnerCost(); if (!p || a.partner) return; if (!spend(cost)) return;
  a.partner = { ...p, since: g.season, rel: 60 }; fb().online = Math.round(fb().online * 1.04);
  msg('Overseas partner signed', `${p.name} (${p.country}) are now your partner club. Your following in ${p.country} will grow, and they will send you a young talent each summer.`, 'club'); save(); render();
}
function affEnd(kind) {
  let a = aff(); if (!a[kind]) return; let n = a[kind].name; a[kind] = null; msg('Partnership ended', `The agreement with ${n} has ended.`, 'club'); save(); render();
}
function affMeet(kind) {
  let a = aff(), cost = kind === 'feeder' || kind === 'partner' ? Math.round(groupCost() * .6) : groupCost();
  if (a.met[kind] === g.world.date.slice(0, 7)) return toast('You have already done that this month.'); if (!spend(cost)) return; a.met[kind] = g.world.date.slice(0, 7);
  if (kind === 'feeder' || kind === 'partner') a[kind].rel = clamp(a[kind].rel + 14, 0, 100); else { a.groups[kind] = clamp(a.groups[kind] + 10, 0, 100); if (kind === 'trust') g.trust = clamp(g.trust + .8, 5, 100) }
  toast(kind === 'feeder' || kind === 'partner' ? 'Relationship strengthened.' : GROUPS[kind].gain + '.'); save(); render();
}

/* ---------- the seasons and weeks ---------- */
setupWorld = function (...args) {
  let r = baseAffSetup(...args), a = aff(), n = 0;
  if (a.feeder) { if (g.cash >= feederCost() && a.feeder.rel >= 15) { g.cash -= feederCost(); record('Feeder club partnership', -feederCost()); for (let i = 0; i < 2; i++) { let p = prospect(); p.potential = Math.min(98, (p.potential || 60) + 6); p.from = a.feeder.name; g.prospects.push(p); n++ } msg('Feeder club trialists', `${a.feeder.name} have sent two young trialists to your academy.`, 'academy') } else { msg('Feeder deal lapsed', `The partnership with ${a.feeder.name} has lapsed.`, 'club'); a.feeder = null } }
  if (a.partner) { if (g.cash >= partnerCost() && a.partner.rel >= 15) { g.cash -= partnerCost(); record('Overseas partner fee', -partnerCost()); let tour = Math.round(partnerCost() * .6); g.cash += tour; record('Overseas pre-season tour income', tour); let p = prospect(); p.potential = Math.min(98, (p.potential || 60) + 9); p.from = a.partner.name; g.prospects.push(p); msg('Overseas partner', `${a.partner.name} sent a young talent to your academy, and the pre-season tour brought in ${money(tour)}.`, 'club') } else { msg('Partner deal lapsed', `The partnership with ${a.partner.name} has lapsed.`, 'club'); a.partner = null } }
  g.prospects = g.prospects.slice(-24); return r;
};
weeklyWorld = function () {
  baseAffWeekly(); if (g.ended || !g.world) return; let a = aff();
  for (let k of ['feeder', 'partner']) if (a[k]) { a[k].rel = clamp(a[k].rel - .35, 0, 100); if (a[k].rel < 12) { msg('Partnership strained', `${a[k].name} are unhappy with the lack of contact. The agreement has ended.`, 'club'); a[k] = null } }
  for (let k in a.groups) a.groups[k] = clamp(a.groups[k] + (50 - a.groups[k]) * .01 - (k === 'trust' && g.trust < 45 ? .3 : 0), 0, 100);
  if (a.groups.ultras > 72 && seeded(Math.abs(hash(g.season + ':' + g.world.days + 'ul')))() < .02) { let fine = Math.round(cfg[tier()].income * .35 / 1000) * 1000; g.cash -= fine; record('Football Association fine', -fine); msg('Fine for crowd behaviour', `Flares in the singing section earned the club a ${money(fine)} fine. The atmosphere, at least, was incredible.`, 'club'); a.groups.ultras = clamp(a.groups.ultras - 6, 0, 100) }
};

/* ---------- the page ---------- */
const relMeter = n => `<div class="moodbar"><i class="${n >= 60 ? 'good' : n >= 35 ? 'mid' : 'bad'}" style="width:${n}%"></i></div>`;
function flames(n) { return '🔥'.repeat(n) }
function rivalRows() {
  let t = tier(); return rivalsOf(g.clubId).slice(0, 7).map(r => {
    let d = fb().derby[r.id] || [0, 0, 0], ti = g.divisions.findIndex(x => x.includes(r.id)), row = ti >= 0 ? g.tables[ti].find(x => x.id === r.id) : null, pos = ti >= 0 ? g.tables[ti].slice().sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga)).findIndex(x => x.id === r.id) + 1 : 0;
    let nx = g.world.fixtures.filter(f => !f.played && f.comp === 'League' && ((f.home === g.clubId && f.away === r.id) || (f.away === g.clubId && f.home === r.id))).sort((a, b) => a.date.localeCompare(b.date))[0];
    return `<div class="rivalrow"><span class="fl l${r.level}">${flames(r.level)}</span>${badge(club(r.id), 'xs')}<div class="rvname"><b>${esc(team(r.id).name)}</b><small>${r.miles} miles · ${ti >= 0 ? DB[ti].name + (pos ? ', ' + pos + ordinal(pos) : '') : ''}</small></div><div class="rvrec"><b>${d[0]}-${d[1]}-${d[2]}</b><small>W-D-L</small></div><div class="rvnext">${nx ? `<b>${dateText(nx.date, false)}</b><small>${nx.home === g.clubId ? 'Home' : 'Away'}</small>` : '<small>not in the league this season</small>'}</div></div>`;
  }).join('') || '<p class="emptynote">Your club has no famous rivals. The fans will have to find some.</p>';
}
const ordinal = n => (n % 100 >= 11 && n % 100 <= 13) ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10 < 4 ? n % 10 : 0];
function affPage() {
  let a = aff(), t = tier(), fc = feederCandidates(), pc = partnerCandidates();
  let feeder = a.feeder ? `<div class="affcard on"><div class="afftop"><span class="afficon">🌱</span><div><h3>${esc(a.feeder.name)}</h3><p>${esc(a.feeder.league)} · ${a.feeder.miles} miles away · partners since season ${a.feeder.since}</p></div></div><div class="relrow"><span>Relationship</span>${relMeter(a.feeder.rel)}<b>${Math.round(a.feeder.rel)}</b></div><p class="fineprint">Two young trialists join your academy each summer. Costs ${money(feederCost())} a season. Keep in touch or the deal fades.</p><div class="btnrow"><button onclick="affMeet('feeder')">Visit the club · ${money(Math.round(groupCost() * .6))}</button><button class="ghost" onclick="affEnd('feeder')">End the partnership</button></div></div>` : `<p class="fineprint">A partner club in the region sends you two young trialists every summer and gives you roots in the community. Costs ${money(feederCost())} a season.</p><div class="affgrid">${fc.map((c, i) => `<div class="affcard"><div class="afftop">${c.real ? badge(club(c.id), 'sm') : '<span class="afficon">⚽</span>'}<div><h3>${esc(c.name)}</h3><p>${esc(c.league)} · ${c.miles} miles</p></div></div><button class="primary" onclick="affSignFeeder(${i})" ${g.cash < feederCost() ? 'disabled' : ''}>Partner up · ${money(feederCost())}</button></div>`).join('')}</div>`;
  let partner = a.partner ? `<div class="affcard on"><div class="afftop"><span class="afficon big">${a.partner.flag}</span><div><h3>${esc(a.partner.name)}</h3><p>${esc(a.partner.country)} · partners since season ${a.partner.since}</p></div></div><div class="relrow"><span>Relationship</span>${relMeter(a.partner.rel)}<b>${Math.round(a.partner.rel)}</b></div><p class="fineprint">Grows your following in ${esc(a.partner.country)}, lifts your overseas fans, sends a talent each summer and brings a pre-season tour. Costs ${money(partnerCost())} a season.</p><div class="btnrow"><button onclick="affMeet('partner')">Send a delegation · ${money(Math.round(groupCost() * .6))}</button><button class="ghost" onclick="affEnd('partner')">End the partnership</button></div></div>` : `<p class="fineprint">A partner club abroad opens a new audience: more followers, happier overseas fans, a talent a year and a pre-season tour. Costs ${money(partnerCost())} a season.</p><div class="affgrid">${pc.map((p, i) => `<div class="affcard"><div class="afftop"><span class="afficon big">${p.flag}</span><div><h3>${esc(p.name)}</h3><p>${esc(p.country)}</p></div></div><button class="primary" onclick="affSignPartner(${i})" ${g.cash < partnerCost() ? 'disabled' : ''}>Partner up · ${money(partnerCost())}</button></div>`).join('')}</div>`;
  let groups = Object.entries(GROUPS).map(([k, G]) => `<div class="affcard"><div class="afftop"><span class="afficon">${G.icon}</span><div><h3>${G.name}</h3><p>${G.desc}</p></div></div><div class="relrow"><span>Relationship</span>${relMeter(a.groups[k])}<b>${Math.round(a.groups[k])}</b></div><button onclick="affMeet('${k}')">${G.meet} · ${money(groupCost())}</button></div>`).join('');
  return `  <div class="card"><div class="cardhead"><h2>Feeder club</h2><span class="eyebrow">DOMESTIC PARTNER</span></div><div class="pad">${feeder}</div></div>
  <div class="card"><div class="cardhead"><h2>Overseas partner</h2><span class="eyebrow">INTERNATIONAL</span></div><div class="pad">${partner}</div></div>
  <div class="card"><div class="cardhead"><h2>Supporter groups</h2><span class="eyebrow">KEEP THEM ON SIDE</span></div><div class="pad affgrid three">${groups}</div></div>
  <div class="card"><div class="cardhead"><h2>Rivals</h2><span class="eyebrow">DERBIES COUNT DOUBLE</span></div><div class="pad rivals">${rivalRows()}</div></div>`;
}
icons.Affiliations = '<circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8.2 10.8l7.6-3.6M8.2 13.2l7.6 3.6"/>';
NAV_ORDER.splice(NAV_ORDER.indexOf('Fans') + 1, 0, 'Affiliations'); PAGE_BUILDERS.Affiliations = affPage; MY_PAGES.push('Affiliations'); MY_LABELS.Affiliations = ['THE WIDER CLUB', 'Affiliations', 'Partners, supporter groups and rivals. Who you stand with shapes who follows you.'];
