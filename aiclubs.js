/* Every other club used to be frozen in time: the same players, the same ages, forever. Now they age and retire like
   anyone else, academies produce real replacements, and a struggling club can go into administration with a genuine
   points deduction — not just a line of flavour text. */

function aiSeasonRegen() {
  if (g.aiRegenSeason === g.season) return; g.aiRegenSeason = g.season;
  for (let c of CLUBS) {
    if (c.id === g.clubId || !c.players || c.players.length < 14) continue;
    for (let p of c.players) if (p.age != null) p.age++;
    let retiring = c.players.filter(p => p.age >= 34 && rnd() < (p.age >= 37 ? .8 : p.age >= 36 ? .55 : p.age >= 35 ? .35 : .18));
    if (retiring.length) { c.players = c.players.filter(p => !retiring.includes(p)) }
    if (rnd() < .55) {
      let addN = 1 + (rnd() < .3 ? 1 : 0), used = new Set(c.players.map(p => p.name));
      for (let i = 0; i < addN; i++) {
        let h = Math.abs(hash('reg' + c.id + g.season + i)), nm; let n = 0;
        do { nm = FN[(h + n * 13) % FN.length] + ' ' + SN[(Math.floor(h / 7) + n * 17) % SN.length]; n++ } while (used.has(nm) && n < 30); used.add(nm);
        let pos = ['GK', 'DEF', 'DEF', 'MID', 'MID', 'FWD'][Math.floor((h / 101) % 6)], num = 40 + Math.floor((h / 13) % 20);
        c.players.push({ id: 'reg' + c.id + g.season + i, name: nm, age: 16 + Math.floor((h / 211) % 3), position: pos, number: String(num) });
      }
      if (c.id !== g.clubId && rnd() < .3) addNews(c.name + "'s academy produces a promising graduate", `A new face has broken into the first-team picture at ${c.name} after catching the eye at academy level.`, 'football');
    }
  }
}
/* ---------- administration: rare, and a real points penalty, not just a headline ---------- */
function aiAdminCheck() {
  if (g.aiAdminSeason === g.season) return;
  if (g.week < Math.round(rounds() * .55)) return;   // wait until results actually mean something before picking out a strugglers
  g.aiAdminSeason = g.season;
  if (rnd() > .1) return;   // most seasons, nobody goes under
  let t = tier(), candidates = g.tables[t].filter(r => r.id !== g.clubId && r.p >= 10).sort((a, b) => a.pts / Math.max(1, a.p) - b.pts / Math.max(1, b.p));
  let row = candidates[0]; if (!row) return;
  let deduction = 10 + Math.floor(rnd() * 3);
  row.pts = Math.max(0, row.pts - deduction);
  addNews(team(row.id).name + ' enter administration', `${team(row.id).name} have entered administration after failing to meet their financial obligations. The league has applied an automatic ${deduction}-point deduction with immediate effect.`, 'league');
  msg('A club has gone into administration', `${team(row.id).name}, struggling badly near the foot of the table, have gone into administration. The league's automatic penalty of ${deduction} points has been applied to their total.`, 'football');
}
const baseAiRollover = performSeasonRollover;
performSeasonRollover = function () { baseAiRollover(); if (g.ended || !g.world) return; aiSeasonRegen() };
const baseAiEvents = eventsToday;
eventsToday = function () { let r = baseAiEvents(); if (!g.ended && g.world && !g.world.seasonComplete) aiAdminCheck(); return r };
