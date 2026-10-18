/* Away days. When the fixture is away, the club has to get there: a team coach (cheap, but a long journey leaves the squad tired) or a charter flight
   (expensive, fast and fresh, only worth it on a long trip). An overnight hotel takes the sting out of a long coach ride. The journey is shown on a map
   made of the real club locations, with the coach or plane moving across it. Fatigue then costs a little squad strength in the match itself. */

const baseTravelDecision = matchDecision, baseTravelRating = squadRating;
const COACH_PM = [14, 11, 8, 6], COACH_MIN = [1200, 900, 700, 500], FLY_BASE = [38000, 24000, 15000, 10000], FLY_PM = [40, 30, 22, 16], HOTEL_HEAD = [140, 110, 85, 70], PARTY = 38;
let travelDraft = null, travelRun = null;

/* ---------- the options (pure, so they can be tested) ---------- */
function travelOptions(miles, t = tier(), abroad = false) {
  let coachHours = miles / 44 + .3, coachFat = clamp((coachHours - 1.5) * 3.2, 0, 14), hotel = miles >= 120;
  let o = {
    miles, coach: { cost: Math.round(Math.max(COACH_MIN[t], miles * COACH_PM[t]) / 100) * 100, hours: coachHours, fatigue: Math.round(coachFat * 10) / 10 },
    hotel: hotel ? { cost: HOTEL_HEAD[t] * PARTY, fatigueCut: .6 } : null, flight: null
  };
  if (miles >= 120) { let h = 1.1 + miles / 380 + 1.6; o.flight = { cost: Math.round((FLY_BASE[t] + miles * FLY_PM[t]) / 100) * 100, hours: h, fatigue: miles > 600 ? 3 : 1.5 } }
  if (abroad) { o.coach = null; o.hotel = null }
  return o;
}
function travelChoice(opts, mode, hotel) {
  if (!opts.coach) mode = 'flight';
  if (mode === 'flight' && opts.flight) return { mode, cost: opts.flight.cost, hours: opts.flight.hours, fatigue: opts.flight.fatigue, hotel: false };
  let h = hotel && opts.hotel; return { mode: 'coach', cost: opts.coach.cost + (h ? opts.hotel.cost : 0), hours: opts.coach.hours, fatigue: Math.round(opts.coach.fatigue * (h ? 1 - opts.hotel.fatigueCut : 1) * 10) / 10, hotel: !!h };
}
const freshness = f => f <= 2 ? ['Fresh', 'good'] : f <= 6 ? ['Slightly tired', 'mid'] : f <= 10 ? ['Tired', 'warn'] : ['Exhausted', 'bad'];
const hoursText = h => { let m = Math.round(h * 60); return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m` };
const isAway = f => f.away === g.clubId;
squadRating = function () {
  let r = baseTravelRating(); if (typeof matchCtx !== 'undefined' && matchCtx && g.world && g.world.live) { let tv = g.world.travel && g.world.travel[g.world.live.fixture]; if (tv) r -= tv.fatigue * .15 } return r;
};

/* ---------- the decision ---------- */
matchDecision = function (f) {
  baseTravelDecision(f); if (f.played || !isAway(f)) return; let h = $('modal').innerHTML; if (typeof h !== 'string') return;
  let miles = milesBetween(g.clubId, f.home), note = `<p class="awaynote">✈️ Away day · <b>${miles} miles</b> to ${esc(team(f.home).short)}${townOf(f.home) ? ', ' + esc(townOf(f.home)) : ''}. You will choose how the team travels.</p>`;
  h = h.split(`beginMatch('${f.id}',true)`).join(`travelPlan('${f.id}',true)`).split(`beginMatch('${f.id}',false)`).join(`travelPlan('${f.id}',false)`).replace('<div class="teams">', note + '<div class="teams">'); $('modal').innerHTML = h;
};
function travelPlan(id, attend) {
  let f = g.world.fixtures.find(x => x.id === id); if (!f || f.played || g.world.live) return; let abroad = isAbroad(f.home), miles = milesBetween(g.clubId, f.home), opts = travelOptions(miles, tier(), abroad); travelDraft = { id, attend, mode: abroad ? 'flight' : 'coach', hotel: false, opts, abroad }; travelView();
}
function travelView() {
  let d = travelDraft, f = g.world.fixtures.find(x => x.id === d.id), o = d.opts, ch = travelChoice(o, d.mode, d.hotel), fr = freshness(ch.fatigue), canFly = !!o.flight && g.cash >= o.flight.cost, canHotel = o.hotel && g.cash >= o.coach.cost + o.hotel.cost;
  let card = (mode, icon, title, cost, hours, fat, extra, disabled, why) => `<button class="topt ${d.mode === mode ? 'on' : ''}" ${disabled ? 'disabled' : ''} onclick="travelMode('${mode}')"><span class="ticon">${icon}</span><b>${title}</b><span class="tcost">${money(cost)}</span><span class="tmeta">${hoursText(hours)} door to door</span><span class="tfresh ${freshness(fat)[1]}">${freshness(fat)[0]}</span><small>${disabled ? why : extra}</small></button>`;
  $('modal').innerHTML = `<div class="overlay"><div class="modal travelmodal"><div class="eyebrow">AWAY DAY · ${dateText(f.date, false).toUpperCase()}</div><h1>${esc(team(f.home).name)}</h1><p>${esc(stadiumOf(f.home))} · ${esc(townOf(f.home))} · <b>${o.miles} miles</b> from ${esc(townOf(g.clubId))}${d.abroad ? ' · <b>European away night</b>' : ''}</p>
  <div class="travelopts">${o.coach ? card('coach', '🚌', 'Team coach', o.coach.cost, o.coach.hours, o.coach.fatigue, o.miles < 60 ? 'A short trip. Everyone is off the bus fresh.' : 'Cheap and cheerful. The longer the road, the heavier the legs.', false) : `<div class="topt on" style="pointer-events:none"><span class="ticon">🛫</span><b>Charter flight (required)</b><span class="tcost">${money(o.flight.cost)}</span><span class="tmeta">${hoursText(o.flight.hours)} door to door</span><span class="tfresh ${freshness(o.flight.fatigue)[1]}">${freshness(o.flight.fatigue)[0]}</span><small>A European away trip. UEFA, the players and common sense all say fly.</small></div>`}${o.coach ? card('flight', '✈️', 'Charter flight', o.flight ? o.flight.cost : 0, o.flight ? o.flight.hours : 0, 1.5, 'The squad lands rested. Players love the treatment.', !canFly, o.flight ? 'You cannot afford the charter.' : 'Too short for a flight. Take the coach.') : ''}</div>
  ${o.hotel && d.mode === 'coach' ? `<label class="hotelrow ${canHotel ? '' : 'off'}"><input type="checkbox" ${d.hotel ? 'checked' : ''} ${canHotel ? '' : 'disabled'} onchange="travelHotel(this.checked)"> Stay overnight in a hotel the night before <b>+${money(o.hotel.cost)}</b> <small>cuts the tiredness by 60%</small></label>` : ''}
  <div class="regchip ${fr[1] === 'bad' ? 'bad' : fr[1] === 'warn' ? 'warn' : ''}">The squad will be <b>${fr[0].toLowerCase()}</b> on arrival${ch.fatigue > 2 ? ` · about −${(ch.fatigue * .15).toFixed(1)} on the squad rating` : ''} · cost <b>${money(ch.cost)}</b> · cash after <b>${money(g.cash - ch.cost)}</b></div>
  <div class="actions"><button class="primary" onclick="travelGo()">Depart →</button><button onclick="matchDecision(g.world.fixtures.find(x => x.id === '${f.id}'))">Back</button></div></div></div>`;
}
function travelMode(m) { travelDraft.mode = m; if (m === 'flight') travelDraft.hotel = false; travelView() }
function travelHotel(v) { travelDraft.hotel = !!v; travelView() }
function travelGo() {
  let d = travelDraft, f = g.world.fixtures.find(x => x.id === d.id), ch = travelChoice(d.opts, d.mode, d.hotel); if (!f || f.played) return;
  g.cash -= ch.cost; record('Away travel: ' + team(f.home).short, -ch.cost); (g.world.travel = g.world.travel || {})[f.id] = { ...ch, miles: d.opts.miles };
  if (ch.mode === 'flight') g.morale = clamp(g.morale + 1, 10, 100); save(); travelScene(f, d.attend);
}

/* ---------- the journey ---------- */
const MAPW = 380, MAPH = 500;
const proj = id => { let p = GEO[id] || [52.5, -1.5]; return [(p[1] + 5.6) / 7.6 * MAPW, (55.9 - p[0]) / 6 * MAPH] };
function routePath(A, B, plane) {
  let dx = B[0] - A[0], dy = B[1] - A[1], d = Math.hypot(dx, dy) || 1, nx = -dy / d, ny = dx / d, off = d * (plane ? .2 : .1);
  if (plane) return `M${A[0].toFixed(1)} ${A[1].toFixed(1)} Q${((A[0] + B[0]) / 2 + nx * off).toFixed(1)} ${((A[1] + B[1]) / 2 + ny * off).toFixed(1)} ${B[0].toFixed(1)} ${B[1].toFixed(1)}`;
  return `M${A[0].toFixed(1)} ${A[1].toFixed(1)} C${(A[0] + dx * .33 + nx * off * .8).toFixed(1)} ${(A[1] + dy * .33 + ny * off * .8).toFixed(1)} ${(A[0] + dx * .66 - nx * off * .6).toFixed(1)} ${(A[1] + dy * .66 - ny * off * .6).toFixed(1)} ${B[0].toFixed(1)} ${B[1].toFixed(1)}`;
}
const BUS_LINES = ['The coach pulls out of the training ground.', 'The manager runs through set pieces on the tablet.', 'A quick stop at the services. Pies are bought.', 'Headphones on. Everyone is in the zone.', 'Nearly there. The nerves are building.'];
const FLY_LINES = ['Wheels up from the local airport.', 'Cruising above the clouds. Cards are out in the back rows.', 'The manager walks the aisle with a last team talk.', 'Descent begins. The stadium is not far now.'];
const VEH_BUS = '<g class="veh"><rect x="-10" y="-4.5" width="20" height="9" rx="2.5" fill="#ffd54a" stroke="#0007" stroke-width=".8"/><rect x="-7.5" y="-3" width="3" height="2.4" fill="#16222a"/><rect x="-3.5" y="-3" width="3" height="2.4" fill="#16222a"/><rect x="0.5" y="-3" width="3" height="2.4" fill="#16222a"/><rect x="5" y="-3" width="3.5" height="2.4" fill="#16222a"/><circle cx="-5.5" cy="4.5" r="1.7" fill="#111"/><circle cx="5.5" cy="4.5" r="1.7" fill="#111"/></g>';
const VEH_PLANE = '<g class="veh"><path d="M-11 0 L8 -2.2 L13 0 L8 2.2 Z" fill="#fff"/><path d="M-2 -1 L-7 -10 L-4.5 -10 L4 -1 Z" fill="#dfe7ec"/><path d="M-2 1 L-7 10 L-4.5 10 L4 1 Z" fill="#dfe7ec"/><path d="M-10 0 L-13.5 -4.5 L-11 -4.5 L-7 0 Z" fill="#c9d4da"/></g>';
function sceneryBand(mode) {
  if (mode === 'flight') { let cl = (x, y, s) => `<g transform="translate(${x} ${y}) scale(${s})" fill="#fff" opacity=".9"><ellipse cx="0" cy="0" rx="46" ry="14"/><ellipse cx="30" cy="-8" rx="30" ry="12"/><ellipse cx="-28" cy="-6" rx="26" ry="10"/></g>`; let layer = cl(60, 40, 1) + cl(300, 82, .7) + cl(560, 30, 1.2) + cl(820, 74, .8) + cl(1060, 44, 1); return `<div class="tscenery sky"><div class="lay l1"><svg viewBox="0 0 1200 140" preserveAspectRatio="none">${layer}</svg><svg viewBox="0 0 1200 140" preserveAspectRatio="none">${layer}</svg></div><svg class="wing" viewBox="0 0 400 120"><path d="M0 120 L260 70 L400 56 L400 84 L220 120 Z" fill="#cfd8dd"/><path d="M0 120 L260 70 L400 56" stroke="#fff" stroke-width="3" fill="none"/></svg></div>` }
  let hills = `<path d="M0 100 Q100 40 220 90 T440 80 T660 92 T880 70 T1100 90 T1200 84 L1200 140 L0 140 Z" fill="#1f4d36"/>`, hills2 = `<path d="M0 118 Q120 78 260 112 T520 106 T780 114 T1040 100 T1200 110 L1200 140 L0 140 Z" fill="#2b6b47"/>`, trees = [...Array(14)].map((_, i) => `<g transform="translate(${60 + i * 85} ${104 + (i % 3) * 5})"><rect x="-1.5" y="0" width="3" height="10" fill="#4a3322"/><circle cx="0" cy="-3" r="${7 + i % 3}" fill="#1d5a3a"/></g>`).join(''), road = `<rect x="0" y="120" width="1200" height="20" fill="#2a2f33"/><path d="M0 130 H1200" stroke="#fff" stroke-width="2" stroke-dasharray="26 22" opacity=".7"/>`;
  return `<div class="tscenery land"><div class="lay l1"><svg viewBox="0 0 1200 140" preserveAspectRatio="none">${hills}</svg><svg viewBox="0 0 1200 140" preserveAspectRatio="none">${hills}</svg></div><div class="lay l2"><svg viewBox="0 0 1200 140" preserveAspectRatio="none">${hills2}${trees}</svg><svg viewBox="0 0 1200 140" preserveAspectRatio="none">${hills2}${trees}</svg></div><div class="lay l3"><svg viewBox="0 0 1200 140" preserveAspectRatio="none">${road}</svg><svg viewBox="0 0 1200 140" preserveAspectRatio="none">${road}</svg></div></div>`;
}
function travelScene(f, attend) {
  let tv = g.world.travel[f.id], plane = tv.mode === 'flight';
  if (typeof requestAnimationFrame !== 'function' || typeof document.createElement !== 'function') return travelFinish(f.id, attend);
  let A = proj(g.clubId), B = proj(f.home), dots = CLUBS.map(c => { let p = proj(c.id); return `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="1.8" class="mdot"/>` }).join(''), path = routePath(A, B, plane), lines = plane ? FLY_LINES : BUS_LINES;
  $('modal').innerHTML = `<div class="overlay travelscene ${plane ? 'plane' : 'coach'}"><div class="tshell"><div class="thead"><div class="troute">${badge(club(), 'sm')}<b>${esc(club().short)}</b><span class="tarrow">➜</span><b>${esc(team(f.home).short)}</b>${teamBadge(f.home)}</div><button class="tskip" onclick="travelSkip()">Skip ▸▸</button></div>
  <div class="tmapwrap"><svg class="tmap" viewBox="0 0 ${MAPW} ${MAPH}"><g>${dots}</g><path id="troute" d="${path}" class="rbase"/><path id="tdone" d="${path}" class="rdone"/><g class="endpoint a"><circle cx="${A[0]}" cy="${A[1]}" r="9" class="ring"/><circle cx="${A[0]}" cy="${A[1]}" r="4.5" class="pt"/></g><g class="endpoint b"><circle cx="${B[0]}" cy="${B[1]}" r="9" class="ring"/><circle cx="${B[0]}" cy="${B[1]}" r="4.5" class="pt"/></g><text x="${A[0] + 11}" y="${A[1] + 4}" class="mlabel">${esc(townOf(g.clubId))}</text><text x="${B[0] + 11}" y="${B[1] + 4}" class="mlabel">${esc(townOf(f.home))}</text><g id="tveh">${plane ? '<ellipse class="pshadow" cx="5" cy="9" rx="10" ry="3"/>' : ''}${plane ? VEH_PLANE : VEH_BUS}</g></svg>
  <div class="thud"><div><small>DISTANCE</small><b id="tmiles">0</b><em>of ${tv.miles} miles</em></div><div><small>${plane ? 'ALTITUDE / SPEED' : 'SPEED'}</small><b id="tspeed">0 mph</b></div><div><small>ARRIVAL</small><b id="teta">--:--</b></div></div></div>
  ${sceneryBand(tv.mode)}<div class="tcaption" id="tcap">${lines[0]}</div><div class="tprogress"><i id="tbar"></i></div>
  <div class="tarrive" id="tarr"><div class="arrcard"><span class="eyebrow">ARRIVED</span><h2>${esc(stadiumOf(f.home))}</h2><p>${esc(townOf(f.home))} · ${Math.round(clamp(g.fans * .05, 40, 4000)).toLocaleString()} away fans have made the trip</p></div></div></div></div>`;
  let pathEl = $('modal').querySelector('#troute'), doneEl = $('modal').querySelector('#tdone'), veh = $('modal').querySelector('#tveh'), len = pathEl.getTotalLength(), dur = clamp(4200 + tv.miles * 7, 4800, 7600), t0 = performance.now(), last = 0, ease = x => x < .5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2, start = 9 * 60 + 10, over = false;
  doneEl.style.strokeDasharray = len; doneEl.style.strokeDashoffset = len; travelRun = { skip: false, id: f.id, attend, over: false }; if (typeof SFX !== 'undefined' && SFX.travel) SFX.travel(tv.mode);
  let el = id => $('modal').querySelector(id);
  let frame = (now) => {
    if (!travelRun || travelRun.id !== f.id) return; let e = travelRun.skip ? 1 : Math.min(1, (now - t0) / dur), p = ease(e), pt = pathEl.getPointAtLength(len * p), pt2 = pathEl.getPointAtLength(Math.min(len, len * p + 2)), ang = Math.atan2(pt2.y - pt.y, pt2.x - pt.x) * 180 / Math.PI;
    veh.setAttribute('transform', `translate(${pt.x.toFixed(2)} ${pt.y.toFixed(2)}) rotate(${ang.toFixed(1)}) scale(${plane ? 1.15 : 1.05})`); doneEl.style.strokeDashoffset = len * (1 - p);
    el('#tmiles').textContent = Math.round(tv.miles * p); let sp = plane ? Math.round(120 + Math.sin(p * Math.PI) * 330) : Math.round(52 + Math.sin(p * 9) * 6 + Math.sin(p * Math.PI) * 10); el('#tspeed').textContent = (plane ? Math.round(sp * 38).toLocaleString() + ' ft · ' : '') + sp + ' mph';
    let mins = start + Math.round(tv.hours * 60 * p), eta = start + Math.round(tv.hours * 60); el('#teta').textContent = `${String(Math.floor(eta / 60) % 24).padStart(2, '0')}:${String(eta % 60).padStart(2, '0')}`; el('#tbar').style.width = (p * 100) + '%';
    let ci = Math.min(lines.length - 1, Math.floor(p * lines.length)); if (el('#tcap').textContent !== lines[ci]) el('#tcap').textContent = lines[ci];
    if (e >= 1 && !over) { over = true; travelRun.over = true; el('#tarr').classList.add('show'); if (typeof SFX !== 'undefined' && SFX.arrive) SFX.arrive(); setTimeout(() => { if (travelRun && travelRun.id === f.id) travelFinish(f.id, attend) }, travelRun.skip ? 700 : 1700) }
    if (!over) requestAnimationFrame(frame);
  }; requestAnimationFrame(frame);
}
function travelSkip() { if (travelRun) { travelRun.skip = true } }
function travelFinish(id, attend) { travelRun = null; beginMatch(id, attend) }
