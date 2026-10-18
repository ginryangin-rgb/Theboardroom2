/* The smooth pitch. The match model still decides where everyone should be once a game minute; this layer renders it continuously.
   Players run towards their positions with acceleration and a top speed instead of gliding, the ball flies along passes with pace
   and a little height (its shadow separates from it), and whoever has the ball dribbles it a stride ahead of him. */

const basePaintPitch = paintPitch;
const SM = { on: false, pos: null, vel: null, tgt: null, ball: null, ballV: { x: 0, y: 0 }, flight: null, owner: 9, side: 'h', tick: 450, last: 0, phase: [], minute: 0 };
const SPRING = 5.2, VMAX_TICK = 14, BALL_K = 11;

paintPitch = function (l) {
  if (!pitch.el || !l.viz || typeof requestAnimationFrame !== 'function' || typeof performance === 'undefined') return basePaintPitch(l);
  let v = l.viz, tick = Math.max(60, Math.min(900, 900 / (l.speed || 2)) * .92), now = performance.now();
  pitch.el.classList.add('smooth'); pitch.el.style.setProperty('--tick', Math.round(tick) + 'ms');
  if (pitch.sbh) { pitch.sbh.textContent = l.home; pitch.sba.textContent = l.away }
  if (pitch.label) { let who = playerAt(l, v.owner); pitch.label.textContent = who ? who.sur : '' }
  let tgt = v.d.map(d => [d[0] * VW, d[1] * VH]);
  if (!SM.pos || SM.pos.length !== 22) { SM.pos = tgt.map(p => [p[0], p[1]]); SM.vel = tgt.map(() => [0, 0]); SM.phase = tgt.map((_, i) => i * 1.37); SM.ball = { x: v.ball.x * VW, y: v.ball.y * VH } }
  let far = !v.pass && v.ball.x === .5 && v.ball.y === .5 && (!v.path || v.path.length <= 1) && Math.hypot(SM.ball.x - VW / 2, SM.ball.y - VH / 2) > 4;   // a kick-off: the ball is placed dead centre
  if (far) { SM.pos = tgt.map(p => [p[0], p[1]]); SM.vel = tgt.map(() => [0, 0]); SM.ball = { x: v.ball.x * VW, y: v.ball.y * VH }; SM.flight = null }   // a kick-off or half-time: everyone is already in place
  SM.tgt = tgt; SM.owner = v.owner; SM.side = v.side; SM.tick = tick; SM.minute = l.minute;
  let path = v.path && v.path.length ? v.path : [v.ball];
  if (path.length > 1 && !far) {
    let pts = path.map(p => ({ x: p.x * VW, y: p.y * VH })); pts[0] = { x: SM.ball.x, y: SM.ball.y };   // the pass starts from where the ball really is
    let segs = [], total = 0; for (let k = 1; k < pts.length; k++) { let len = Math.hypot(pts[k].x - pts[k - 1].x, pts[k].y - pts[k - 1].y), kind = path[k].kind || (k === pts.length - 1 && (v.evt === 'GOAL!' || v.evt === 'SHOT') ? 'shot' : 'pass'); segs.push({ a: pts[k - 1], b: pts[k], len, kind, who: path[k].who }); total += len * (kind === 'dribble' ? 2.2 : kind === 'tackle' || kind === 'intercept' ? .6 : 1) }
    let speed = Math.max(total / (tick * 1.5), 11 / 1000);   // units per ms: never slower than a brisk pass, faster when there is a lot to fit in
    let t = now; for (let s of segs) { s.t0 = t; let mult = s.kind === 'dribble' ? 2.2 : s.kind === 'tackle' || s.kind === 'intercept' ? .6 : 1; s.dur = Math.max(s.kind === 'dribble' ? 260 : 150, s.len * mult / speed); t = s.t0 + s.dur + (s.kind === 'dribble' ? 0 : 60); s.h = s.kind === 'header' ? 3.2 : s.kind === 'long' ? Math.min(3.4, s.len * .08) : s.kind === 'dribble' || s.kind === 'tackle' ? 0 : Math.min(2.6, s.len * .055) * (s.kind === 'shot' ? .6 : 1) }
    SM.flight = { segs, end: t };
  } else if (far) SM.flight = null;
  else if (!v.pass && !v.cele && tick >= 200 && SM.pos[v.owner] && !(v.path && v.path.length > 1)) {
    // nothing happened this minute in the model: show a couple of short interchanges with nearby teammates, ending back with the owner
    let side = v.owner < 11 ? 0 : 11, o = SM.tgt[v.owner], mates = []; for (let k = side + 1; k < side + 11; k++) if (k !== v.owner) { let d = Math.hypot(SM.tgt[k][0] - o[0], SM.tgt[k][1] - o[1]); if (d > 6 && d < 22) mates.push([k, d]) }
    mates.sort((a, b) => a[1] - b[1]); let picks = mates.slice(0, 3), rnd2 = Math.abs(hash(l.fixture + '|' + l.minute + '|mi')) % 3, mate = picks[rnd2 % Math.max(1, picks.length)];
    if (mate) { let m = SM.tgt[mate[0]], pts = [{ x: SM.ball.x, y: SM.ball.y }, { x: m[0] + (o[0] > m[0] ? .8 : -.8), y: m[1] }, { x: o[0] + 1.2, y: o[1] + .4 }], segs = [], t = now + tick * .12;
      for (let k = 1; k < pts.length; k++) { let len = Math.hypot(pts[k].x - pts[k - 1].x, pts[k].y - pts[k - 1].y), dur = Math.max(160, len / (15 / 1000)); segs.push({ a: pts[k - 1], b: pts[k], len, t0: t, dur, h: Math.min(1.2, len * .04) }); t += dur + tick * .16 }
      SM.flight = { segs, end: t, soft: true } }
  }
  pitch.dots.forEach((c, i) => c.classList.toggle('carrier', i === v.owner));
  if (v.pass && pitch.line) {
    pitch.line.setAttribute('x1', (v.pass.from.x * VW).toFixed(2)); pitch.line.setAttribute('y1', (v.pass.from.y * VH).toFixed(2)); pitch.line.setAttribute('x2', (v.pass.to.x * VW).toFixed(2)); pitch.line.setAttribute('y2', (v.pass.to.y * VH).toFixed(2));
    pitch.line.style.transition = 'none'; pitch.line.style.opacity = '.75'; void pitch.line.getBoundingClientRect(); pitch.line.style.transition = `opacity ${Math.round(tick * 1.1)}ms ease-out`; pitch.line.style.opacity = '0';
  }
  if (!SM.on) { SM.on = true; SM.last = now; requestAnimationFrame(smoothFrame) }
};

function smoothFrame(now) {
  let l = g && g.world && g.world.live; if (!l || !pitch.el || !pitch.el.isConnected || !SM.tgt) { SM.on = false; return }
  let dt = Math.min(.05, Math.max(.001, (now - SM.last) / 1000)); SM.last = now; let tickS = SM.tick / 1000, k = SPRING / tickS, vmax = VMAX_TICK / tickS, paused = l.paused;
  for (let i = 0; i < 22; i++) {
    let p = SM.pos[i], t0 = SM.tgt[i], vel = SM.vel[i], ph = SM.phase[i], b0 = SM.ball;
    let toward = i === SM.owner ? 0 : (Math.hypot(b0.x - t0[0], b0.y - t0[1]) < 18 ? .9 : .35), drift = [Math.sin(now / 1900 + ph) * 1.4 * toward + (b0.x - t0[0]) * .03 * toward, Math.cos(now / 2300 + ph * 1.7) * 1.1 * toward + (b0.y - t0[1]) * .03 * toward], t = [t0[0] + drift[0], t0[1] + drift[1]];
    if (!paused) {
      let ax = (t[0] - p[0]) * k - vel[0] * 2.6 * Math.sqrt(k), ay = (t[1] - p[1]) * k - vel[1] * 2.6 * Math.sqrt(k);   // damped spring: accelerate, then settle
      vel[0] += ax * dt; vel[1] += ay * dt; let sp = Math.hypot(vel[0], vel[1]); if (sp > vmax) { vel[0] *= vmax / sp; vel[1] *= vmax / sp }
      p[0] += vel[0] * dt; p[1] += vel[1] * dt;
    }
    let sp = Math.hypot(vel[0], vel[1]), bob = sp > .6 ? Math.sin(now / 90 + SM.phase[i]) * .22 : 0, lean = sp > .6 ? Math.atan2(vel[1], vel[0]) : null;
    let c = pitch.dots[i]; if (c) c.style.transform = `translate(${(p[0] + (lean != null ? -Math.sin(lean) * bob : 0)).toFixed(2)}px,${(p[1] + (lean != null ? Math.cos(lean) * bob : 0)).toFixed(2)}px)`;
  }
  let b = SM.ball, h = 0;
  if (SM.flight) {
    let f = SM.flight, seg = f.segs.find(s => now < s.t0 + s.dur) || null, si = seg ? f.segs.indexOf(seg) : -1;
    if (seg && SM.segIdx !== si) { SM.segIdx = si; let prev = f.segs[si - 1]; if (prev && prev.who != null) { SM.owner = prev.who; pitch.dots.forEach((c, i) => c.classList.toggle('carrier', i === SM.owner)); if (prev.kind === 'tackle' || prev.kind === 'intercept') { let d = pitch.dots[prev.who]; if (d) { d.classList.remove('hit'); void d.getBoundingClientRect(); d.classList.add('hit') } } } }
    if (!seg) { let last = f.segs[f.segs.length - 1]; b.x = last.b.x; b.y = last.b.y; SM.flight = null; SM.segIdx = -1; if (last.who != null) { SM.owner = last.who; pitch.dots.forEach((c, i) => c.classList.toggle('carrier', i === SM.owner)) } SM.ballV = { x: 0, y: 0 } }
    else { let u = clamp((now - seg.t0) / seg.dur, 0, 1), e = u < .5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2; if (paused) e = clamp((SM.last - seg.t0) / seg.dur, 0, 1); b.x = seg.a.x + (seg.b.x - seg.a.x) * e; b.y = seg.a.y + (seg.b.y - seg.a.y) * e; h = Math.sin(Math.PI * u) * seg.h }
  } else {
    let o = SM.pos[SM.owner] || [b.x, b.y], dir = (SM.side === 'h' ? 1 : -1) * (SM.minute > 45 ? -1 : 1), ov = SM.vel[SM.owner] || [0, 0], moving = Math.hypot(ov[0], ov[1]) > .6;
    let tx = o[0] + dir * 1.5 + (moving ? ov[0] / Math.max(1, Math.hypot(ov[0], ov[1])) * .8 : 0), ty = o[1] + (moving ? Math.sin(now / 140) * .55 : .35);
    if (!paused) { b.x += (tx - b.x) * Math.min(1, BALL_K * dt); b.y += (ty - b.y) * Math.min(1, BALL_K * dt) }
  }
  if (pitch.ball) pitch.ball.style.transform = `translate(${b.x.toFixed(2)}px,${b.y.toFixed(2)}px)`;
  if (pitch.core) pitch.core.style.transform = `translate(${(h * .35).toFixed(2)}px,${(-h).toFixed(2)}px) scale(${(1 + h * .22).toFixed(3)})`;
  let sh = pitch.el.querySelector && pitch.el.querySelector('.ballshadow'); if (sh) { sh.setAttribute('rx', (1.1 + h * .3).toFixed(2)); sh.setAttribute('opacity', (.45 - h * .1).toFixed(2)) }
  if (pitch.label) { let o = SM.pos[SM.owner]; if (o) { pitch.label.style.transform = `translate(${o[0].toFixed(2)}px,${(o[1] - 3.3).toFixed(2)}px)`; if (SM.labelFor !== SM.owner) { SM.labelFor = SM.owner; let who = playerAt(l, SM.owner); pitch.label.textContent = who ? who.sur : '' } } }
  requestAnimationFrame(smoothFrame);
}
