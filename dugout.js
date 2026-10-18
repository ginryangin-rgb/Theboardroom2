/* Three things that make the club feel like people.
   The dugout: your manager's face and his instructions sit right under the live pitch, with the substitution button, instead of in a card far away.
   The unveiling: when a player signs, he is welcomed to the club on the pitch, holding his shirt beside you, cameras flashing.
   Faces: every player gets a drawn face generated from his name, used in the report, the unveiling and the substitution dialog. */

const baseDugRender = render, baseDugNegResult = negResult, baseDugFinishDeal = finishDeal;
let unveilNext = null;

/* ---------- faces ---------- */
function playerFace(p, uid, size = 36) { let k = g.kit && g.kit.design ? g.kit.design.home : { pattern: 'solid', c1: club().colour || '#1b4fa8', c2: '#f6f6f2', c3: '#f6f6f2' }; return `<span class="face" style="width:${size}px;height:${Math.round(size * 1.25)}px">${personFront({ name: p.name || 'Player', male: true, nochair: true, kit: k, age: p.age }, uid)}</span>` }

/* ---------- the dugout bar ---------- */
function dugoutHtml(l) {
  let mg = g.manager, L = { name: mg.name, male: true }, react = l.commentary.find(c => /^Manager:/.test(c.text) && c.minute >= l.minute - 4);
  let btn = (k, label, on) => `<button class="${on ? 'on' : ''}" onclick="managerRequest('${k}')">${label}</button>`;
  return `<div class="dugout"><div class="dugface">${personFront(L, 'dug')}<div><b>${esc(mg.name)}</b><small>${mg.caretaker ? 'Caretaker' : 'Manager'} · trust ${Math.round(g.world.managerTrust)}</small></div></div>
  <div class="dugsay">${react ? `<p>${esc(react.text.replace(/^Manager:\s*/, ''))}</p>` : `<p class="muted">${l.paused ? 'Waiting for your word.' : l.mentality === 'attacking' ? '“Keep pushing, keep the width.”' : l.mentality === 'defensive' ? '“Stay compact. Make them play in front of us.”' : '“Keep the shape, keep the ball moving.”'}</p>`}</div>
  <div class="dugbtns"><div class="duggroup"><small>Shape</small>${btn('attacking', 'Push forward', l.mentality === 'attacking')}${btn('balanced', 'Balanced', l.mentality === 'balanced')}${btn('defensive', 'Protect', l.mentality === 'defensive')}</div><div class="duggroup"><small>Tempo</small>${btn('high', 'Raise', l.tempo === 'high')}${btn('normal', 'Manage', l.tempo === 'normal')}</div><div class="duggroup"><small>Bench</small>${btn('encourage', 'Encourage', false)}<button class="subbtn" onclick="openSub()" ${(typeof subsLeft === 'function' ? subsLeft(l) : 3) <= 0 || l.minute < 1 ? 'disabled' : ''}>⇄ Sub <small>${typeof subsLeft === 'function' ? subsLeft(l) : 3}</small></button></div></div></div>`;
}
render = function () {
  baseDugRender(); let l = g && g.world && g.world.live; if (!l || page !== 'Matchday') return; let root = $('content'); if (!root || !root.querySelector) return;
  let mv = root.querySelector('.matchview'); if (mv && !mv.querySelector('.dugout')) { let d = document.createElement('div'); d.innerHTML = dugoutHtml(l); mv.insertBefore(d.firstChild, mv.children[1] || null) }
  root.querySelectorAll('.matchcontrols .subbtn').forEach(b => b.remove());   // the sub button now lives in the dugout
  let far = root.querySelector('.dugfarbtns'); if (!far) root.querySelectorAll('.card').forEach(c => { if (/Manager communication/.test(c.innerHTML)) { let a = c.querySelector('.actions'); if (a) { a.className = 'actions dugfarbtns'; a.innerHTML = '<p class="fineprint">Your instructions are in the dugout under the pitch.</p>' } } });
};

/* ---------- the unveiling ---------- */
function unveilHtml(p, o) {
  let kit = g.kit && g.kit.design ? g.kit.design.home : { pattern: 'solid', c1: club().colour || '#1b4fa8', c2: '#f6f6f2', c3: '#f6f6f2', collar: 'crew', sleeves: 'match' }, num = o.num || (Number(p.number) || 0) || (7 + (Math.abs(hash(p.id)) % 20));
  let shirt = typeof shirtSvg === 'function' ? shirtSvg(kit, 'unv', '', false, 170).replace('</svg>', `<text x="110" y="78" text-anchor="middle" font-family="Barlow Condensed, Arial Narrow, sans-serif" font-weight="800" font-size="20" letter-spacing="2" fill="${inkOn(kit.c1)}">${esc(surname(p.name).toUpperCase())}</text><text x="110" y="150" text-anchor="middle" font-family="Barlow Condensed, Arial Narrow, sans-serif" font-weight="900" font-size="78" fill="${inkOn(kit.c1)}">${num}</text></svg>`) : '';
  let LP = { name: p.name, male: true, nochair: true, kit: kit, age: p.age }, LC = personLook('The Chairman');
  let board = Array.from({ length: 12 }, (_, i) => `<span style="animation-delay:${(i % 4) * .3}s">${badge(club(), 'xs')}${esc(club().short.toUpperCase())}</span>`).join('');
  return `<div class="overlay unveil"><div class="unvstage"><div class="unvboard">${board}</div><div class="flashes">${Array.from({ length: 9 }, (_, i) => `<i style="left:${8 + i * 10.5}%;top:${10 + ((i * 37) % 60)}%;animation-delay:${i * .33}s"></i>`).join('')}</div>
  <div class="unvpeople"><div class="unvperson chairman">${personFront(LC, 'unvc')}<small>You, Chairman</small></div><div class="unvshirt">${shirt}</div><div class="unvperson player">${personFront(LP, 'unvp')}<small>${esc(p.name)}</small></div></div>
  <div class="unvcard"><span class="eyebrow">${esc(o.eyebrow || 'NEW SIGNING')}</span><h1>Welcome to ${esc(club().name)}</h1><h2>${esc(p.name)}</h2><p>${esc(o.line)}</p><div class="unvfacts">${(o.facts || []).map(f => `<span>${esc(f)}</span>`).join('')}</div><blockquote>“${esc(o.quote)}”</blockquote><div class="actions"><button class="primary" onclick="closeBoardroom()">Finish the photocall →</button></div></div></div></div>`;
}
function unveil(p, o) { $('modal').innerHTML = unveilHtml(p, o); if (typeof SFX !== 'undefined') { SFX.ping(); if (SFX.ready && SFX.ready()) swell(.3, 3) } }
negResult = function (o) {
  if (o.stamp === 'DEAL DONE' && unveilNext) { let u = unveilNext; unveilNext = null; return unveil(u.p, u.o) }
  return baseDugNegResult(o);
};
finishDeal = function (d, p) {
  let before = d.status, r = baseDugFinishDeal(d, p);
  if (before !== 'signed' && d.status === 'signed') {
    let sp = g.squad.find(x => x.id === p.id) || p, pos = normPos(p.position), posWord = pos === 'GK' ? 'goalkeeper' : pos === 'DEF' ? 'defender' : pos === 'MID' ? 'midfielder' : 'forward';
    let quotes = ['I spoke to the manager and he sold me the project straight away. I cannot wait to get started.', 'The size of this club, the fans, the stadium. It was an easy decision.', 'I want to repay the faith the chairman has shown in me.', 'I have heard about the atmosphere here. I want to be part of it.'];
    unveilNext = { p, o: { eyebrow: d.fee ? 'NEW SIGNING' : 'FREE TRANSFER', line: `${p.name} joins from ${team(p.owner).name}${d.fee ? ' for ' + money(d.fee) : ' on a free transfer'}, on ${money(d.wage)} a week until ${contractEnd(sp)}.`, facts: [`${p.age} years old`, posWord, `rating ${Math.round(p.rating)}`, (d.role === 'key' ? 'promised a key role' : d.role === 'rotation' ? 'rotation player' : 'first-team regular')], quote: quotes[Math.abs(hash(p.id)) % quotes.length], num: Number(p.number) || 0 } };
  }
  return r;
};

/* ---------- faces in the report and the substitution dialog ---------- */
const baseDugReport = reportHtml;
reportHtml = function (m) { let h = baseDugReport(m); if (typeof h !== 'string') return h; return h.replace(/<span class="rnum">(\d*)<\/span><div class="rname"><b>([^<]*)<\/b>/g, (s, n, name) => `<span class="rnum">${n}</span>${playerFace({ name: name.replace(/&#39;|&amp;/g, "'") }, 'rf' + Math.abs(hash(name)), 30)}<div class="rname"><b>${name}</b>`) };
