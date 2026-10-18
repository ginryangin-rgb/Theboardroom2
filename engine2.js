/* Match engine, second generation. The results engine still decides the outcome of each minute (goals, shots, corners, cards, possession);
   this engine decides what that minute looked like: six to ten real touches chosen from the players' attributes. A pass can be intercepted
   by the nearest defender, a dribble can be tackled, a long ball can be headed clear, a cross can find a head. Both teams hold a shape
   that follows the formation from the squad screen and shifts with the ball. The renderer then plays the sequence continuously. */

const baseE2Viz = vizStep, baseE2Build = buildPitch, baseE2Slot = slot;
/* ---------- shapes from formations ---------- */
function shapeSlots(form) {
  let sh = (typeof FORMS !== 'undefined' && FORMS[form]) || [1, 4, 4, 2], out = [[.04, .5, 'g']], spread = (n, u, role, pad = .12) => { for (let k = 0; k < n; k++) out.push([u, n === 1 ? .5 : pad + k * (1 - 2 * pad) / (n - 1), role]) };
  spread(sh[1], .2, 'd', sh[1] === 3 ? .25 : sh[1] === 5 ? .08 : .12);
  if (sh[2] === 5) { spread(2, .34, 'm', .35); spread(3, .47, 'm', .2) } else spread(sh[2], .4, 'm', sh[2] === 3 ? .25 : .12);
  spread(sh[3], .57, 'f', sh[3] === 1 ? .5 : sh[3] === 3 ? .15 : .38);
  return out;
}
slot = function (i) { let l = g.world && g.world.live, v = l && l.viz; if (!v || !v.form) return baseE2Slot(i); let side = i < 11 ? 'h' : 'a', k = i < 11 ? i : i - 11, f = v.form[side][k] || baseE2Slot(i); return { side, k, u: f[0], y: f[1], role: f[2] } };
function ensureForm(l) { let v = l.viz, sh = l.lineup && l.lineup.shapes; if (!v.form || v.formKey !== JSON.stringify(sh)) { v.form = { h: shapeSlots(sh ? sh.h : '4-4-2'), a: shapeSlots(sh ? sh.a : '4-3-3') }; v.formKey = JSON.stringify(sh) } }
/* ---------- attributes for anyone on the pitch ---------- */
function e2Attr(l, i) {
  let v = l.viz; v.at = v.at || {}; if (v.at[i]) return v.at[i]; let pl = playerAt(l, i), f = g.world.fixtures.find(x => x.id === l.fixture), id = i < 11 ? f.home : f.away;
  let p = (id === g.clubId ? g.squad.find(x => x.id === pl.id) : (typeof squadOf === 'function' ? squadOf(id) : []).find(x => x.id === pl.id)) || { id: pl.id, rating: (g.strengths[id] ?? team(id).strength ?? 55), position: slot(i).role === 'g' ? 'GK' : slot(i).role === 'd' ? 'DEF' : slot(i).role === 'm' ? 'MID' : 'FWD', age: 26 };
  let a = typeof attrs === 'function' ? attrs({ ...p, rating: p.rating || 55, age: p.age || 26, position: p.position || 'MID' }) : {};
  return v.at[i] = { pas: a.passing || 60, dri: a.dribbling || 60, tac: a.tackling || 60, pac: a.pace || 60, sho: a.shooting || 60, hea: a.heading || 60, cmp: a.composure || 60, gk: a.reflexes || 60 };
}
/* ---------- the sequence generator ---------- */
function e2Nearest(v, idxs, pt, except) { let best = null, bd = 9; for (let i of idxs) { if (i === except) continue; let d = Math.hypot(v.d[i][0] - pt.x, v.d[i][1] - pt.y); if (d < bd) { bd = d; best = i } } return { i: best, d: bd } }
function e2Options(v, l, side, owner, rng) {
  let min = l.minute, dir = dirOf(side, min), o = v.d[owner], mates = teamIdx(side).filter(i => i !== owner && slot(i).role !== 'g'), out = [];
  for (let m of mates) { let p = v.d[m], dx = (p[0] - o[0]) * dir, dist = Math.hypot(p[0] - o[0], p[1] - o[1]); if (dist < .03 || dist > .5) continue; out.push({ i: m, dist, fwd: dx, score: (dx > 0 ? 1.2 : .6) + rng() * .8 - dist * 1.5 + (slot(m).role === 'f' ? .3 : 0) }) }
  return out.sort((a, b) => b.score - a.score);
}
function e2Sequence(v, l, rng, want, n) {
  let min = l.minute, seq = [], side = v.side, owner = v.owner, ball = { x: v.ball.x, y: v.ball.y }, turnovers = 0;
  for (let step = 0; step < n; step++) {
    let A = e2Attr(l, owner), opp = side === 'h' ? 'a' : 'h', dir = dirOf(side, min), near = e2Nearest(v, teamIdx(opp).filter(i => slot(i).role !== 'g'), ball), pressure = clamp(1 - near.d / .12, 0, 1), opts = e2Options(v, l, side, owner, rng);
    let lastStep = step === n - 1, mustEnd = lastStep && side !== want;
    let action = mustEnd ? 'lose' : rng() < .36 + pressure * .25 && A.dri > 48 ? 'dribble' : rng() < .14 ? 'long' : rng() < .22 ? 'through' : 'pass';
    if (action === 'lose' || (action !== 'dribble' && !opts.length)) { let t = near.i != null ? near.i : teamIdx(opp)[5]; seq.push({ kind: 'tackle', from: ball, to: { x: v.d[t][0], y: v.d[t][1] }, who: t, by: t }); ball = { x: v.d[t][0], y: v.d[t][1] }; side = opp; owner = t; turnovers++; continue }
    if (action === 'dribble') {
      let D = near.i != null ? e2Attr(l, near.i) : { tac: 50 }, ok = rng() < clamp(.5 + (A.dri - D.tac) / 140 - pressure * .2, .15, .9), to = { x: clamp(ball.x + dir * (.05 + rng() * .06), .02, .98), y: clamp(ball.y + (rng() - .5) * .08, .04, .96) };
      if (ok) { seq.push({ kind: 'dribble', from: ball, to, who: owner }); ball = to; v.d[owner] = [to.x, to.y] } else { let t = near.i; seq.push({ kind: 'tackle', from: ball, to: { x: v.d[t][0], y: v.d[t][1] }, who: t, by: t, victim: owner }); ball = { x: v.d[t][0], y: v.d[t][1] }; side = opp; owner = t; turnovers++ } continue;
    }
    let target = action === 'long' ? (opts.filter(o => o.dist > .25)[0] || opts[0]) : action === 'through' ? (opts.filter(o => o.fwd > .05)[0] || opts[0]) : opts[Math.min(opts.length - 1, Math.floor(rng() * Math.min(3, opts.length)))], to = { x: v.d[target.i][0], y: v.d[target.i][1] }; if (action === 'through') { to = { x: clamp(to.x + dir * .07, .03, .97), y: clamp(to.y + (rng() - .5) * .05, .04, .96) }; v.d[target.i] = [to.x, to.y] } let mid = { x: (ball.x + to.x) / 2, y: (ball.y + to.y) / 2 };
    let cut = e2Nearest(v, teamIdx(opp).filter(i => slot(i).role !== 'g'), mid), risk = clamp(.1 + (action === 'long' ? .18 : 0) + pressure * .18 + (target.dist * .5) - (A.pas - 60) / 250 - (cut.d / .15) * .2, .03, .6);
    if (rng() < risk && cut.i != null) { let t = cut.i, at = { x: (mid.x + v.d[t][0]) / 2, y: (mid.y + v.d[t][1]) / 2 }; seq.push({ kind: action === 'long' ? 'header' : 'intercept', from: ball, to: at, who: t, by: t }); ball = at; v.d[t] = [at.x, at.y]; side = opp; owner = t; turnovers++ }
    else { seq.push({ kind: action === 'long' ? 'long' : 'pass', from: ball, to, who: target.i }); ball = to; owner = target.i }
  }
  return { seq, side, owner, ball, turnovers };
}
function e2Shape(v, l, rng) {
  let min = l.minute; for (let i = 0; i < 22; i++) {
    let s = slot(i), bu = ballU(v, s.side, min), has = v.side === s.side, du = has ? (bu - .5) * .55 : (bu - .5) * .4, u = clamp(s.u + du * (s.role === 'g' ? .1 : s.role === 'd' ? .7 : s.role === 'm' ? .95 : 1), .03, .95), y = clamp(s.y + (v.ball.y - .5) * (s.role === 'g' ? .3 : .35) + (rng() - .5) * .03, .04, .96);
    let t = [xOf(s.side, u, min), y], d = v.d[i], touched = v.seqTouched && v.seqTouched.has(i); if (!touched) { d[0] += (t[0] - d[0]) * .45; d[1] += (t[1] - d[1]) * .45 }
  }
}
vizStep = function (l, ev) {
  let v = l.viz; ensureForm(l);
  if (ev.scored || ev.shot.h || ev.shot.a || ev.corner.h || ev.corner.a || (v.flash > 0) || (l.minute >= 46 && v.half === 1) || v.cele) { let r = baseE2Viz(l, ev); if (v.path && v.path.length > 1) { let b = e2Buildup(v, l); v.path = [...b, ...v.path]; } return r }
  let min = l.minute, rng = seeded(Math.abs(hash(l.fixture)) * 131 + min * 17 + 9); v.evt = null; v.pass = null; v.mode = 'play';
  if (rng() < .2) v.want = rng() * 100 < v.possH ? 'h' : 'a'; if (!v.want) v.want = 'h';
  let n = 5 + Math.floor(rng() * 5), r = e2Sequence(v, l, rng, v.want, n); v.seqTouched = new Set(r.seq.map(s => s.who));
  v.side = r.side; v.owner = r.owner; v.ball = r.ball; v.path = [{ x: v.path && v.path.length ? v.path.at(-1).x : v.ball.x, y: v.path && v.path.length ? v.path.at(-1).y : v.ball.y }, ...r.seq.map(s => ({ x: s.to.x, y: s.to.y, who: s.who, kind: s.kind, by: s.by }))];
  v.path[0] = { x: r.seq[0] ? r.seq[0].from.x : v.ball.x, y: r.seq[0] ? r.seq[0].from.y : v.ball.y }; v.d[v.owner] = [v.ball.x, v.ball.y]; v.turnovers = r.turnovers;
  e2Shape(v, l, rng); v.seqTouched = null;
  let last = r.seq.at(-1); if (last && (last.kind === 'tackle' || last.kind === 'intercept') && rng() < .35) { let who = playerAt(l, last.by); if (who) l.commentary.unshift({ minute: min, text: `${who.sur} ${last.kind === 'tackle' ? 'wins it back with a crunching tackle' : 'reads it and intercepts'}.` }) }
};
/* a couple of quick passes before the shot or corner the old engine produced, so attacks have a build-up */
function e2Buildup(v, l) { let rng = seeded(Math.abs(hash(l.fixture)) * 7 + l.minute * 3), side = v.side === 'h' && v.evt !== 'SHOT' ? 'h' : (v.cele ? v.cele.side : v.side), mates = teamIdx(side).filter(i => slot(i).role === 'm' || slot(i).role === 'd').slice(1, 6), pts = [], start = v.path[0]; for (let k = 0; k < 2; k++) { let i = mates[Math.floor(rng() * mates.length)]; if (!i) break; pts.push({ x: clamp(start.x + (rng() - .5) * .12, .05, .95), y: clamp(start.y + (rng() - .5) * .3, .06, .94), who: i, kind: 'pass' }) } return pts }

/* ---------- the pitch, drawn properly ---------- */
function e2Sprite(c, ink, gk, n) { return `<g class="spr"><ellipse class="sshadow" cx=".6" cy="1.2" rx="2" ry=".9" fill="#0008"/><ellipse cx="-1.5" cy="0" rx="1" ry="1.5" fill="${c}" stroke="#0005" stroke-width=".25"/><ellipse cx="1.5" cy="0" rx="1" ry="1.5" fill="${c}" stroke="#0005" stroke-width=".25"/><ellipse cx="0" cy="0" rx="2.1" ry="1.75" fill="${c}" stroke="${gk ? '#ffd54a' : '#ffffffaa'}" stroke-width=".35"/><circle cx="0" cy="-.35" r=".9" fill="#d9a07a" stroke="#4a3020" stroke-width=".25"/><text y="1.35" text-anchor="middle" font-size="1.5" font-weight="800" fill="${ink}" stroke="#0007" stroke-width=".25" paint-order="stroke">${n}</text></g>` }
buildPitch = function (l, f) {
  let p = baseE2Build(l, f); if (!p || !p.el) return p; let svg = p.el.querySelector('svg'); if (!svg) return p;
  let [hc, ac] = pitchColours(f), hosted = !window.__CLUBS__;
  let defs = `<defs><pattern id="mow" width="${VW / 14}" height="${VH}" patternUnits="userSpaceOnUse"><rect width="${VW / 28}" height="${VH}" fill="#2a7a45"/><rect x="${VW / 28}" width="${VW / 28}" height="${VH}" fill="#256d3d"/></pattern><pattern id="grain" width="3" height="3" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".35" fill="#ffffff08"/><circle cx="2.4" cy="2.2" r=".3" fill="#00000010"/></pattern><radialGradient id="wear" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#8a7a3a" stop-opacity=".22"/><stop offset="1" stop-color="#8a7a3a" stop-opacity="0"/></radialGradient><pattern id="net" width="1.2" height="1.2" patternUnits="userSpaceOnUse"><path d="M0 0 L1.2 1.2 M1.2 0 L0 1.2" stroke="#ffffff99" stroke-width=".12"/></pattern><radialGradient id="light" cx="50%" cy="40%" r="70%"><stop offset="0" stop-color="#fff" stop-opacity=".12"/><stop offset="1" stop-color="#000" stop-opacity=".22"/></radialGradient></defs>`;
  let stands = `<g class="stands">${['top', 'bottom'].map(k => `<rect x="-3" y="${k === 'top' ? -3 : VH + .2}" width="${VW + 6}" height="2.8" fill="#2a3338"/>` + Array.from({ length: 70 }, (_, i) => `<circle cx="${-2 + i * (VW + 4) / 70}" cy="${k === 'top' ? -1.6 : VH + 1.6}" r=".55" fill="${['#c8102e', '#f6f6f2', hc, ac, '#1b4fa8', '#111'][i % 6]}" opacity=".55"/>`).join('')).join('')}</g>`;
  let turf = `<rect x="0" y="0" width="${VW}" height="${VH}" fill="url(#mow)"/><rect x="0" y="0" width="${VW}" height="${VH}" fill="url(#grain)"/><ellipse cx="${VW / 2}" cy="${VH / 2}" rx="14" ry="10" fill="url(#wear)"/><ellipse cx="9" cy="${VH / 2}" rx="7" ry="11" fill="url(#wear)"/><ellipse cx="${VW - 9}" cy="${VH / 2}" rx="7" ry="11" fill="url(#wear)"/><rect x="0" y="0" width="${VW}" height="${VH}" fill="url(#light)"/>`;
  let nets = `<g class="nets"><rect x="-2.4" y="29.2" width="2.6" height="9.6" fill="url(#net)" stroke="#fff" stroke-width=".35"/><rect x="${VW - .2}" y="29.2" width="2.6" height="9.6" fill="url(#net)" stroke="#fff" stroke-width=".35"/></g>`;
  let bg = svg.querySelector('rect'), stripesG = bg && bg.nextElementSibling && bg.nextElementSibling.tagName === 'g' && !bg.nextElementSibling.getAttribute('fill') ? bg.nextElementSibling : null; if (stripesG) stripesG.remove();
  if (bg) { bg.setAttribute('fill', '#163f26'); bg.insertAdjacentHTML('afterend', defs + stands + turf) }
  let goals = svg.querySelector('g[fill="#ffffff22"]'); if (goals) goals.outerHTML = nets;
  let html = svg.innerHTML;
  svg.innerHTML = html;
  svg.querySelectorAll('g.pl').forEach(gp => { let c = gp.querySelector('circle'), t = gp.querySelector('text'); if (!c || !t) return; gp.innerHTML = e2Sprite(c.getAttribute('fill'), t.getAttribute('fill'), gp.classList.contains('gk'), t.textContent) });
  let core = svg.querySelector('.ballcore'); if (core) { let gball = document.createElementNS('http://www.w3.org/2000/svg', 'g'); gball.setAttribute('class', 'ballcore'); gball.innerHTML = `<circle r="1" fill="#fff" stroke="#222" stroke-width=".25"/><path d="M-.5 -.3 L.1 -.8 L.6 -.2 L.2 .5 L-.5 .35 Z" fill="#222" opacity=".85"/><path d="M-.95 .3 Q-.4 .2 -.1 .9" stroke="#222" stroke-width=".18" fill="none"/>`; core.replaceWith(gball) }
  p.el.classList.add('v2');
  return { ...p, dots: [...p.el.querySelectorAll('g.pl')], ball: p.el.querySelector('g.ball'), core: p.el.querySelector('.ballcore'), label: p.el.querySelector('.carrierlabel'), sbh: p.el.querySelector('.sbh'), sba: p.el.querySelector('.sba'), line: p.el.querySelector('.passline'), evt: p.el.querySelector('.evt'), phase: p.el.querySelector('.phase') };
};
