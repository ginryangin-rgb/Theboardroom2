/* Every player's season is already tallied for the league's own records; it just vanished the moment a new one began.
   Now a snapshot of anyone who actually played is kept permanently, so a player's profile can show the seasons he's
   had in this save — which club, how many games, how many goals — however long the career has run. */

function careerHistoryFor(id) { return (g.careerHistory || {})[id] || [] }
const baseCareerRollover = performSeasonRollover;
performSeasonRollover = function () {
  let take = !rollingOver && g.world && g.world.seasonComplete;
  let snap = take && g.world.ps ? g.world.ps.p : null, season = g.season;
  baseCareerRollover();
  if (!snap) return; g.careerHistory = g.careerHistory || {};
  for (let id in snap) { let e = snap[id]; if (!e.ap) continue; let hist = g.careerHistory[id] || (g.careerHistory[id] = []); if (hist.length && hist.at(-1).season === season) continue; hist.push({ season, club: e.c, apps: e.ap, goals: e.g, assists: e.a, cs: e.cs }); if (hist.length > 20) hist.shift() }
};
function careerTableHtml(id) {
  let hist = careerHistoryFor(id); if (!hist.length) return '';
  let rows = hist.map(h => `<tr><td>${h.season}\u2013${h.season + 1}</td><td>${esc(team(h.club).short)}</td><td>${h.apps}</td><td>${h.goals}</td><td>${h.assists}</td></tr>`).join('');
  return `<div class="careerbox"><h2>Career in this save</h2><table class="careertable"><thead><tr><th>SEASON</th><th>CLUB</th><th>APPS</th><th>GOALS</th><th>ASSISTS</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}
const baseCareerProfile = playerProfile;
playerProfile = function (id, clubId) {
  baseCareerProfile(id, clubId); let h = $('modal').innerHTML; if (typeof h !== 'string') return;
  let box = careerTableHtml(id); if (!box || h.includes('careerbox')) return;
  if (h.includes('<div class="actions">')) h = h.replace('<div class="actions">', box + '<div class="actions">');
  else h += box;
  $('modal').innerHTML = h;
};
