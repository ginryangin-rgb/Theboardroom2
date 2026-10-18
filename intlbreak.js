/* The calendar already leaves blank weekends through the season for this; nothing used to happen on them. Now your best
   players are away on international duty those weeks — most come back fine, some return having impressed, and
   occasionally one comes back with a knock, same as the real thing. */

function intlBreakDates() { let y = seasonYear(); return [iso(y, 11, 7), iso(y, 12, 5), iso(y + 1, 1, 9), iso(y + 1, 2, 13), iso(y + 1, 3, 6), iso(y + 1, 4, 3), iso(y + 1, 4, 24), iso(y + 1, 5, 22)] }
function intlBreakCheck() {
  let w = g.world; if (!w || g.ended || w.live) return;
  if (!intlBreakDates().includes(w.date) || w.lastIntlBreak === w.date) return; w.lastIntlBreak = w.date;
  let bar = 66 + tier() * 4, eligible = g.squad.filter(p => p.rating >= bar && !p.inj);
  if (!eligible.length) return;
  let n = clamp(Math.round(eligible.length * .4), 1, 4), called = [...eligible].sort((a, b) => b.rating - a.rating).slice(0, n), lines = [], hurt = null;
  for (let p of called) {
    let r = rnd();
    if (r < .07 && !hurt) { injure(p, w.date); hurt = p; lines.push(`${p.name} picks up a ${p.inj.type.toLowerCase()} away with his country and is expected back around ${dateText(p.inj.est, false)}.`) }
    else if (r < .32) lines.push(`${p.name} scores for his country in a routine win.`);
    else if (r < .55) lines.push(`${p.name} starts and catches the eye in a narrow result.`);
    else if (r < .8) lines.push(`${p.name} plays 90 minutes without incident.`);
    else lines.push(`${p.name} is an unused substitute across the break.`);
  }
  addNews('International call-ups', lines.join(' '), 'football');
  msg('International break', `${called.length} of your players ${called.length === 1 ? 'is' : 'are'} away on international duty this week.<br><br>${lines.join('<br>')}`, 'football');
}
const baseIbAdvance = advanceDay;
advanceDay = function () { baseIbAdvance(); if (!g || !g.world || g.ended) return; intlBreakCheck() };
