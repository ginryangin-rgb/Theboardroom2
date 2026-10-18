/* This is the manager's own department. He brings in his own assistant, fitness coach and chief scout without asking
   permission — the chairman funds it and can see who's been appointed, but doesn't pick them. Each role does
   something real: the assistant sharpens the team on matchday, the fitness coach cuts down on injuries, the scout
   improves what the academy produces. */

const COACH_ROLES = { assistant: 'Assistant manager', fitness: 'Head of sports science', scout: 'Chief scout' };
const COACH_TRAITS = { assistant: ['Sharp tactical eye', 'Great with the senior pros', 'Calm head on matchday', 'Demanding but fair'], fitness: ['Modern sports-science methods', 'Old-school conditioning', 'Specialist in injury prevention', 'Believes in minimal rest'], scout: ['Strong local network', 'Well travelled abroad', 'Trusts the data', 'Trusts his eye over the numbers'] };
function coachStaff() { g.manager.coachStaff = g.manager.coachStaff || {}; return g.manager.coachStaff }
function coachWeekly() { let cs = coachStaff(); return Object.values(cs).reduce((s, c) => s + (c.wage || 0), 0) }
function managerPicksCoach(role) {
  g.allStaffNames = g.allStaffNames || []; let used = new Set(g.allStaffNames);
  let h = Math.abs(hash('coach' + role + g.clubId + g.season + Math.floor(rnd() * 99999))), nm, n = 0;
  do { nm = (typeof SH_FN !== 'undefined' ? SH_FN : FN)[(h + n * 13) % (typeof SH_FN !== 'undefined' ? SH_FN.length : FN.length)] + ' ' + (typeof SH_SN !== 'undefined' ? SH_SN : SN)[(Math.floor(h / 7) + n * 17) % (typeof SH_SN !== 'undefined' ? SH_SN.length : SN.length)]; n++ } while (used.has(nm) && n < 40);
  g.allStaffNames.push(nm);
  let rep = Math.round(20 + rnd() * 70), trait = COACH_TRAITS[role][Math.floor(rnd() * COACH_TRAITS[role].length)], wage = Math.round(cfg[tier()].wage * (.006 + rep / 100 * .018) / 100) * 100;
  coachStaff()[role] = { name: nm, trait, rep, wage, since: g.season };
  msg('New appointment: ' + nm, `${g.manager.name} has brought in ${nm} as the new ${COACH_ROLES[role]}. ${trait}.`, 'football');
}
function coachFillVacancies() { for (let role in COACH_ROLES) if (!coachStaff()[role]) managerPicksCoach(role) }
const baseCsStart = startCareer;
startCareer = function (id) { let r = baseCsStart(id); coachFillVacancies(); return r };
const baseCsAppoint = mgrAppoint;
mgrAppoint = function (m, wage, years, comp, po) { let r = baseCsAppoint(m, wage, years, comp, po); g.manager.coachStaff = {}; coachFillVacancies(); return r };
const baseCsRollover = performSeasonRollover;
performSeasonRollover = function () { baseCsRollover(); if (g.ended || !g.world) return; coachFillVacancies(); if (rnd() < .12) { let role = Object.keys(COACH_ROLES)[Math.floor(rnd() * 3)]; managerPicksCoach(role) } };
const baseCsWeekly = weeklyWorld;
weeklyWorld = function () { baseCsWeekly(); if (g.ended || !g.world) return; let c = coachWeekly(); if (c) { g.cash -= c; g.ledger[0] && g.ledger[0].items.push(['Manager\u2019s coaching staff', -c]) } };

/* ---------- what each role actually does ---------- */
function assistantBoost() { let c = coachStaff().assistant; return c ? c.rep / 100 * .55 : 0 }
const baseCsRates = liveRates;
liveRates = function (l) { let r = baseCsRates(l), boost = assistantBoost(); if (boost) { if (r.ownSide === 'h') { r.hr *= (1 + boost * .04); r.ar *= (1 - boost * .015) } else { r.ar *= (1 + boost * .04); r.hr *= (1 - boost * .015) } } return r };
const baseCsMedRed = medReduction;
medReduction = function () { let c = coachStaff().fitness; return baseCsMedRed() * (1 - (c ? c.rep / 100 * .12 : 0)) };
const baseCsProspect = prospect;
prospect = function () { let c = coachStaff().scout, original = g.youth.scouting; if (c) g.youth.scouting = original + c.rep / 100 * 1.4; let p = baseCsProspect(); g.youth.scouting = original; return p };

/* ---------- a card showing who the manager has brought in ---------- */
function coachStaffCard() {
  let cs = coachStaff(); if (!Object.keys(cs).length) return '';
  let rows = Object.entries(COACH_ROLES).map(([role, name]) => { let c = cs[role]; return c ? `<div class="hirerow"><div><b>${esc(c.name)}</b><small>${name} \u00b7 ${esc(c.trait)} \u00b7 ${money(c.wage)}/week</small></div></div>` : '' }).join('');
  return `<div class="card pad"><div class="eyebrow">THE MANAGER'S OWN STAFF</div><h2 style="font-size:20px;margin:10px 0 4px">Coaching team</h2><p class="fineprint" style="margin-top:0">${esc(g.manager.name)} picked this team himself \u2014 you fund it, he chooses.</p>${rows}</div>`;
}
const baseCsFootball = football;
football = function () { let h = baseCsFootball(); if (typeof h !== 'string') return h; return h + (coachStaffCard() || '') };
