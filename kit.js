/* The kit launch. Before every season the board gathers to design the home and away kits and, if there is no shirt sponsor under contract, to choose one.
   Then the supporters react. Five groups of fans judge it differently: traditionalists want the club's colours and patterns, young fans want something bold,
   families care about the sponsor, and nobody likes a muddy design. The verdict moves merchandise sales, supporter confidence and the club's following. */

const baseKitSetup = setupWorld, baseKitOpen = openBoardroom, baseKitEnsure = ensureWorld;
const PATTERNS = { solid: 'Plain', stripes: 'Stripes', hoops: 'Hoops', halves: 'Halves', sash: 'Sash', pinstripe: 'Pinstripe', chevron: 'Chevron', fade: 'Fade' };
const COLLARS = { crew: 'Crew neck', vneck: 'V-neck', polo: 'Polo collar' };
const SWATCHES = ['#c8102e', '#7a263a', '#1b4fa8', '#0f2a52', '#6cb4ee', '#1d8348', '#14532d', '#f2c230', '#f08a24', '#111111', '#f6f6f2', '#8a949c', '#5b2a86', '#e35d9b', '#1aa59b', '#c9a227'];
const TRAD = { '361': 'stripes', '366': 'stripes', '398': 'stripes', '337': 'stripes', '376': 'stripes', '336': 'stripes', '365': 'halves', '349': 'stripes', '331': 'stripes', '384': 'stripes', '306': 'stripes', '314': 'stripes', '334': 'hoops', '383': 'stripes', '387': 'halves', '279': 'hoops', '335': 'stripes', '304': 'stripes', '340': 'stripes', '338': 'hoops', '399': 'stripes', '344': 'halves', '308': 'halves', '320': 'stripes', '339': 'stripes', '324': 'stripes', '386': 'stripes' };
const SHIRT_BRANDS = [
  { name: 'Hartley & Sons Builders', sector: 'Local business', ethics: 1, mult: .8 }, { name: 'Fenwick Motors', sector: 'Local business', ethics: 1, mult: .85 }, { name: 'Northline Group', sector: 'Retail', ethics: 0, mult: 1 },
  { name: 'Skyline Air', sector: 'Airline', ethics: 0, mult: 1.15 }, { name: 'Meridian Energy', sector: 'Energy', ethics: 0, mult: 1.05 }, { name: 'Greenfield Bank', sector: 'Bank', ethics: 0, mult: 1.1 },
  { name: 'Wavelength Telecom', sector: 'Telecoms', ethics: 0, mult: 1.1 }, { name: 'Orchard Dairy', sector: 'Food & drink', ethics: 0, mult: .9 }, { name: 'PulsePlay', sector: 'Gaming', ethics: 0, mult: 1.05 },
  { name: 'BetPrime', sector: 'Betting', ethics: -1, mult: 1.35 }, { name: 'CoinArc', sector: 'Crypto exchange', ethics: -1, mult: 1.3 }, { name: 'Kind Hearts Hospice', sector: 'Charity', ethics: 1, mult: .3 }
];
let kitDraft = null;

/* ---------- colour maths ---------- */
function hexRgb(h) { h = String(h || '#888888').replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); let n = parseInt(h, 16); return [n >> 16 & 255, n >> 8 & 255, n & 255] }
function hslOf(h) { let [r, gg, b] = hexRgb(h).map(v => v / 255), mx = Math.max(r, gg, b), mn = Math.min(r, gg, b), l = (mx + mn) / 2, s = 0, hh = 0; if (mx !== mn) { let d = mx - mn; s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn); hh = mx === r ? (gg - b) / d + (gg < b ? 6 : 0) : mx === gg ? (b - r) / d + 2 : (r - gg) / d + 4; hh *= 60 } return { h: hh, s, l } }
function lumOf(h) { let [r, gg, b] = hexRgb(h).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4 }); return .2126 * r + .7152 * gg + .0722 * b }
function contrastOf(a, b) { let x = lumOf(a), y = lumOf(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05) }
function hueDist(a, b) { let A = hslOf(a), B = hslOf(b); if (A.s < .12 || B.s < .12) return Math.abs(A.l - B.l) * 120; let d = Math.abs(A.h - B.h); return Math.min(d, 360 - d) }
const inkOn = c => contrastOf(c, '#ffffff') >= contrastOf(c, '#111111') ? '#ffffff' : '#111111';
function colourName(hex) {
  let { h, s, l } = hslOf(hex); if (l < .13) return 'black'; if (l > .9 && s < .3) return 'white'; if (s < .14) return l > .6 ? 'light grey' : 'grey';
  let n = h < 15 || h >= 345 ? 'red' : h < 40 ? 'orange' : h < 68 ? 'yellow' : h < 160 ? 'green' : h < 195 ? 'teal' : h < 255 ? 'blue' : h < 290 ? 'purple' : 'pink'; return (l < .28 && n === 'red' ? 'claret' : l < .3 ? 'dark ' + n : l > .72 ? 'light ' + n : n);
}
const prefPattern = id => TRAD[id] || 'solid';

/* ---------- the shirt ---------- */
const TORSO = 'M52 46 L72 22 Q110 46 148 22 L168 46 L168 212 Q110 226 52 212 Z', SLV_L = 'M72 22 L30 40 L6 104 L40 120 L52 86 L52 46 Z', SLV_R = 'M148 22 L190 40 L214 104 L180 120 L168 86 L168 46 Z';
function patternSvg(d, uid) {
  let c2 = d.c2, out = '';
  if (d.pattern === 'stripes') for (let x = 6; x < 220; x += 26) out += `<rect x="${x}" y="0" width="13" height="240" fill="${c2}"/>`;
  else if (d.pattern === 'hoops') for (let y = 20; y < 230; y += 30) out += `<rect x="0" y="${y}" width="220" height="15" fill="${c2}"/>`;
  else if (d.pattern === 'halves') out = `<rect x="110" y="0" width="110" height="240" fill="${c2}"/>`;
  else if (d.pattern === 'sash') out = `<polygon points="30,14 86,14 198,236 142,236" fill="${c2}"/>`;
  else if (d.pattern === 'pinstripe') for (let x = 8; x < 220; x += 11) out += `<rect x="${x}" y="0" width="1.7" height="240" fill="${c2}" opacity=".92"/>`;
  else if (d.pattern === 'chevron') for (let k = 0; k < 5; k++) out += `<polyline points="52,${64 + k * 38} 110,${100 + k * 38} 168,${64 + k * 38}" fill="none" stroke="${c2}" stroke-width="16"/>`;
  else if (d.pattern === 'fade') out = `<defs><linearGradient id="fd${uid}" x1="0" y1="0" x2="0" y2="1"><stop offset=".15" stop-color="${d.c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs><rect x="0" y="0" width="220" height="240" fill="url(#fd${uid})"/>`;
  return out;
}
function shirtSvg(d, uid = 'k', sponsor = '', crest = true, size = 200) {
  let cl = `cl${uid}`, ink = inkOn(d.c1), trim = d.c3, collar = d.collar === 'vneck' ? `<path d="M86 24 L110 56 L134 24" fill="none" stroke="${trim}" stroke-width="9" stroke-linejoin="round"/>` : d.collar === 'polo' ? `<path d="M84 24 L100 40 L92 52 L74 32 Z M136 24 L120 40 L128 52 L146 32 Z" fill="${trim}" stroke="#0003" stroke-width="1"/><path d="M96 26 Q110 48 124 26" fill="none" stroke="${trim}" stroke-width="5"/>` : `<path d="M86 24 Q110 56 134 24" fill="none" stroke="${trim}" stroke-width="9" stroke-linecap="round"/>`;
  let slv = d.sleeves === 'contrast' ? `<path d="${SLV_L}" fill="${d.c2}"/><path d="${SLV_R}" fill="${d.c2}"/>` : '';
  let text = sponsor ? `<text x="110" y="106" text-anchor="middle" font-family="Barlow Condensed, Arial Narrow, sans-serif" font-weight="800" font-size="${sponsor.length > 14 ? 13 : 16}" letter-spacing=".5" fill="${ink}" stroke="${ink === '#ffffff' ? '#000000' : '#ffffff'}" stroke-width="2.4" paint-order="stroke" textLength="${Math.min(92, sponsor.length * 9)}" lengthAdjust="spacingAndGlyphs">${esc(sponsor.toUpperCase())}</text>` : '';
  let badgeImg = crest && club().badge ? `<image href="${esc(club().badge)}" x="122" y="52" width="26" height="26" preserveAspectRatio="xMidYMid meet"/>` : '';
  return `<svg class="kitshirt" viewBox="0 0 220 240" width="${size}" role="img" aria-label="Shirt design"><defs><clipPath id="${cl}"><path d="${TORSO}"/><path d="${SLV_L}"/><path d="${SLV_R}"/></clipPath><linearGradient id="sh${uid}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000" stop-opacity=".22"/><stop offset=".25" stop-color="#000" stop-opacity="0"/><stop offset=".75" stop-color="#fff" stop-opacity=".05"/><stop offset="1" stop-color="#000" stop-opacity=".25"/></linearGradient></defs>
  <ellipse cx="110" cy="232" rx="78" ry="6" fill="#0005"/><g clip-path="url(#${cl})"><rect width="220" height="240" fill="${d.c1}"/>${patternSvg(d, uid)}${slv}</g>
  <g fill="none" stroke="${trim}" stroke-width="6" stroke-linecap="round"><path d="M6 104 L40 120"/><path d="M214 104 L180 120"/></g>${collar}${badgeImg}${text}
  <g clip-path="url(#${cl})"><rect width="220" height="240" fill="url(#sh${uid})"/><path d="M52 204 Q110 216 168 204 L168 214 Q110 228 52 214 Z" fill="#000" opacity=".16"/><path d="M62 70 Q70 140 60 200" stroke="#fff" stroke-opacity=".07" stroke-width="3" fill="none"/></g>
  <path d="${TORSO}" fill="none" stroke="#0000002e" stroke-width="1.5"/><path d="${SLV_L}" fill="none" stroke="#0000002e" stroke-width="1.5"/><path d="${SLV_R}" fill="none" stroke="#0000002e" stroke-width="1.5"/></svg>`;
}
function bottomsSvg(d, uid = 'k') {
  let shorts = d.pattern === 'solid' ? d.c2 : d.c1, stripe = d.c3;
  return `<svg class="bottoms" viewBox="0 0 220 150" width="200" aria-hidden="true"><path d="M62 4 L158 4 L170 70 L116 70 L110 40 L104 70 L50 70 Z" fill="${shorts}" stroke="#0003" stroke-width="1.5"/><path d="M62 4 L158 4" stroke="${stripe}" stroke-width="5"/><path d="M52 66 L106 66 M114 66 L168 66" stroke="${stripe}" stroke-width="4"/><g><rect x="62" y="78" width="38" height="66" rx="8" fill="${d.c1}" stroke="#0003"/><rect x="62" y="96" width="38" height="8" fill="${stripe}"/><rect x="120" y="78" width="38" height="66" rx="8" fill="${d.c1}" stroke="#0003"/><rect x="120" y="96" width="38" height="8" fill="${stripe}"/></g></svg>`;
}
function kitSvg(d, uid, sponsor) { return `<div class="kitstack">${shirtSvg(d, uid, sponsor, true, 210)}${bottomsSvg(d, uid)}</div>` }

/* ---------- defaults ---------- */
function homeDefault() { let c = club().colour || '#1b4fa8', pat = prefPattern(g.clubId), l = hslOf(c).l; return { pattern: pat, c1: c, c2: l > .6 ? '#111111' : '#f6f6f2', c3: l > .6 ? '#111111' : '#f6f6f2', collar: 'crew', sleeves: 'match' } }
function awayDefault(home) {
  let dark = lumOf(home.c1) < .3, c1 = dark ? '#f6f6f2' : '#111111', h = Math.abs(hash('aw' + g.clubId + g.season)) % 3;
  return { pattern: ['solid', 'halves', 'pinstripe'][h], c1, c2: home.c1, c3: home.c1, collar: 'polo', sleeves: 'match' };
}
const seasonLabel = () => `${seasonYear()}/${String(seasonYear() + 1).slice(2)}`;
function hasShirtSponsor() { return g.sponsors.find(s => s.id === 'shirt') || null }
function shirtOffers() {
  let rng = seeded(Math.abs(hash('so' + g.clubId + g.season)) * 31 + 3), base = (offers().find(o => o.id === 'shirt') || { base: cfg[tier()].sponsor }).base, pool = SHIRT_BRANDS.slice(), pick = [];
  let take = f => { let c = pool.filter(f); if (!c.length) return; let b = c[Math.floor(rng() * c.length)]; pool.splice(pool.indexOf(b), 1); pick.push(b) };
  take(b => b.ethics === -1); take(b => b.ethics === 1 && b.mult > .5); take(b => b.ethics === 0); take(b => b.ethics === 0);
  return pick.map(b => ({ ...b, annual: Math.round(base * b.mult * (.9 + rng() * .22) / 1000) * 1000 })).sort((a, b) => b.annual - a.annual);
}
const yearsAdj = y => 1 + (y - 1) * .05;

/* ---------- how the fans take it ---------- */
function heritage(d, cid, clubColour) {
  let hd = hueDist(d.c1, clubColour), lightGap = Math.abs(hslOf(d.c1).l - hslOf(clubColour).l), pref = prefPattern(cid), t = 100 - Math.min(70, hd * .55) - (lightGap > .35 ? 14 : 0);
  if (d.pattern !== pref && d.pattern !== 'solid') t -= 12; if (pref !== 'solid' && d.pattern === 'solid') t -= 8; if (d.pattern === 'fade') t -= 10; return clamp(Math.round(t), 5, 100);
}
function aesthetic(d) {
  let a = 72, cr = contrastOf(d.c1, d.c2), s1 = hslOf(d.c1).s, s2 = hslOf(d.c2).s, hd = hueDist(d.c1, d.c2);
  if (d.pattern !== 'solid' && cr < 1.25) a -= 24; else if (d.pattern !== 'solid' && cr < 1.6) a -= 8; if (cr > 6) a += 4; if (s1 > .7 && s2 > .7 && hd > 90 && hd < 160) a -= 14; if (d.c3 === d.c1) a -= 4; if (contrastOf(d.c3, d.c1) < 1.3) a -= 5;
  if (hslOf(d.c3).s > .6 && hslOf(d.c2).s > .6 && hslOf(d.c1).s > .6) a -= 8; return clamp(Math.round(a), 5, 100);
}
const BOLD = { solid: 30, stripes: 42, hoops: 46, halves: 50, pinstripe: 52, sash: 70, chevron: 74, fade: 82 };
function modernity(d, clubColour) { let m = BOLD[d.pattern] || 40; if (hueDist(d.c1, clubColour) > 70) m += 8; if (d.collar === 'vneck') m += 4; if (d.sleeves === 'contrast') m += 4; return clamp(Math.round(m), 5, 100) }
const SEG_SHARE = { loyal: .30, casual: .22, families: .14, young: .18, overseas: .16 };
const Q = {
  loyal: [['That is our colours, our pattern. Proper club shirt.', 'Not bad. It feels like us.'], ['It is fine, I suppose.'], ['That is not our club. Where are our colours?', 'My grandad would not recognise this.']],
  casual: [['Clean looking kit. Already ordered mine.', 'Best looking shirt in the division.'], ['Does the job.'], ['Meh. Looks like a training top.', 'Not paying that for this.']],
  families: [['Bought the kids’ version. They love it!', 'Great design and a sponsor I am happy with.'], ['The kids want it, so I suppose I am buying it.'], ['£55 for that? And look who is on the front.', 'Not buying it for the kids.']],
  young: [['this kit goes hard 🔥', 'honestly top 3 kit in the league 😍'], ['it is alright'], ['who designed this, my nan?', 'so boring 😴']],
  overseas: [['Ordered from Singapore, cannot wait 🙌', 'Looks great on the TV.'], ['Might get one when it is on sale.'], ['Not buying this one.', 'Last year’s was better.']]
};
function kitReaction(designs, ctx) {
  let rng = seeded(Math.abs(hash('kr' + ctx.clubId + ctx.season + JSON.stringify(designs))) * 17 + 5), hm = designs.home, aw = designs.away, sp = ctx.sponsor, eth = sp ? sp.ethics : 0, none = !sp;
  let T = Math.round(.75 * heritage(hm, ctx.clubId, ctx.colour) + .25 * (62 + (hueDist(aw.c2, ctx.colour) < 30 ? 14 : 0))), A = Math.round(.65 * aesthetic(hm) + .35 * aesthetic(aw)), M = Math.round(.7 * modernity(hm, ctx.colour) + .3 * modernity(aw, ctx.colour));
  let sLoyal = eth === -1 ? -14 : eth === 1 ? 6 : none ? 8 : 0, sFam = eth === -1 ? -16 : eth === 1 ? 7 : none ? 5 : 0, sYoung = eth === -1 ? -3 : eth === 1 ? 2 : 0, sOther = eth === -1 ? -6 : eth === 1 ? 3 : 0;
  let wild = (BOLD[hm.pattern] > 60 ? 10 : 4), noise = () => (rng() - .5) * 2 * wild;
  let seg = {
    loyal: .62 * T + .3 * A + 4 + sLoyal + noise(), casual: .25 * T + .45 * A + .15 * M + 7.5 + sOther + noise(), families: .3 * T + .35 * A + .15 * M + 10 + sFam + noise(),
    young: .15 * T + .35 * A + .4 * M + 5 + sYoung + noise(), overseas: .2 * T + .4 * A + .3 * M + 5 + sOther / 2 + (ctx.partner ? 3 : 0) + noise()
  };
  for (let k in seg) seg[k] = Math.round(clamp(seg[k], 3, 99)); let like = Math.round(Object.keys(seg).reduce((s, k) => s + seg[k] * SEG_SHARE[k], 0));
  let verdict = like >= 85 ? 'An instant classic.' : like >= 72 ? 'A big hit with supporters.' : like >= 58 ? 'Well received.' : like >= 45 ? 'A divisive kit: some love it, some hate it.' : like >= 32 ? 'Supporters are underwhelmed.' : 'Backlash. The fans are furious.';
  let quotes = [], used = new Set(), band = v => v >= 66 ? 0 : v >= 45 ? 1 : 2, order = Object.keys(seg).sort((a, b) => Math.abs(seg[b] - 55) - Math.abs(seg[a] - 55));
  if (sp && eth === -1) quotes.push({ who: 'Supporters’ Trust', icon: '🏠', text: /Bet/.test(sp.sector) ? 'A betting logo on a shirt kids will wear. Disgraceful.' : 'A crypto firm on our shirt? I hope that is not our money.', mood: 'bad' });
  else if (sp && eth === 1) quotes.push({ who: 'Local supporter', icon: '🏠', text: sp.sector === 'Charity' ? 'A hospice on the front of the shirt. That is what a community club does.' : 'A local firm on the shirt. Love to see it.', mood: 'good' });
  for (let k of order) { if (quotes.length >= 4) break; let set = Q[k][band(seg[k])]; quotes.push({ who: SEGMENT_NAMES[k], icon: SEGMENT_ICONS[k], text: set[Math.floor(rng() * set.length)], mood: seg[k] >= 66 ? 'good' : seg[k] >= 45 ? 'mid' : 'bad' }) }
  return { like, seg, verdict, quotes, parts: { tradition: T, aesthetic: A, modern: M }, effects: { sales: Math.round(clamp(.65 + like / 100 * .85, .65, 1.5) * 100) / 100, trust: Math.round(clamp((like - 55) / 22, -2.5, 2) * 10) / 10, buzz: Math.round(clamp((like - 50) / 50, -1, 1) * 100) / 100 } };
}
const SEGMENT_NAMES = { loyal: 'Loyal supporter', casual: 'Casual fan', families: 'Parent', young: 'Young fan', overseas: 'Overseas fan' }, SEGMENT_ICONS = { loyal: '🏠', casual: '🎟️', families: '🧒', young: '📱', overseas: '🌍' };

/* ---------- the board matter ---------- */
function queueKit() {
  if (!g.world || g.ended) return; if (g.kit && g.kit.season === g.season) return; let b = bd(); if (b.items.some(i => i.kind === 'kit' && i.status === 'open')) return;
  if (g.world.date > iso(seasonYear(), 8, 20) || g.world.seasonComplete) { let home = homeDefault(); g.kit = { season: g.season, design: { home, away: awayDefault(home) }, sponsor: hasShirtSponsor() ? { name: hasShirtSponsor().name, sector: hasShirtSponsor().sector || 'Partner', ethics: hasShirtSponsor().ethics || 0 } : null, reaction: null, sales: null }; return }
  let it = newItem('kit', { title: 'Kit launch ' + seasonLabel(), urgent: true, speaker: 'com', line: '', side: null, opts: [] });
  msg('Kit launch ' + seasonLabel(), 'The board meets to design the new home and away kits' + (hasShirtSponsor() ? '.' : ' and agree the shirt sponsor.') + ' The supporters are waiting to see them.', 'club'); g.inbox[0].boardId = it.id; g.world.autoPause = { title: 'Kit launch', cat: 'boardroom', date: g.world.date };
}
setupWorld = function (...a) { let r = baseKitSetup(...a); queueKit(); return r };
ensureWorld = function (...a) { let r = baseKitEnsure(...a); queueKit(); return r };
const baseKitValid = itemValid;
itemValid = function (it) { if (it.kind === 'kit') return it.status === 'open'; return baseKitValid(it) };
openBoardroom = function (id) { let it = id ? findItem(id) : boardPending()[0]; if (it && it.kind === 'kit' && it.status === 'open') { stopClock(); return kitRoom(it.id) } return baseKitOpen(id) };

/* ---------- the room ---------- */
function kitRoom(itemId) {
  let last = (g.kitHistory || []).at(-1), home = last ? { ...last.design.home } : homeDefault(), away = last ? { ...last.design.away } : awayDefault(home), sp = hasShirtSponsor();
  kitDraft = { item: itemId, tab: 'home', d: { home, away }, offers: sp ? [] : shirtOffers(), pick: null, years: 2, none: false, sponsor: sp };
  kitView();
}
function swatchRow(slot, cur) {
  let tab = kitDraft.tab; return `<div class="swrow">${SWATCHES.map(c => `<button class="sw ${c.toLowerCase() === String(cur).toLowerCase() ? 'on' : ''}" style="background:${c}" title="${colourName(c)}" onclick="kitColour('${slot}','${c}')"></button>`).join('')}<label class="swcustom" title="Pick any colour"><input type="color" value="${cur}" onchange="kitColour('${slot}',this.value)">+</label></div>`;
}
function kitHint() {
  let d = kitDraft.d.home, t = heritage(d, g.clubId, club().colour), a = aesthetic(d), pref = prefPattern(g.clubId);
  let her = t >= 80 ? ['Strong heritage', 'good'] : t >= 60 ? ['Respects tradition', 'mid'] : ['A radical departure', 'bad'], look = a >= 70 ? ['Clean design', 'good'] : a >= 52 ? ['Busy in places', 'mid'] : ['Muddy or clashing', 'bad'];
  return `<div class="kithint"><span class="hint ${her[1]}">${her[0]}</span><span class="hint ${look[1]}">${look[0]}</span><small>The fans know the club as <b>${colourName(club().colour)}</b>${pref !== 'solid' ? ' in <b>' + PATTERNS[pref].toLowerCase() + '</b>' : ''}.</small></div>`;
}
function kitView() {
  let k = kitDraft, d = k.d[k.tab], sp = k.sponsor || (k.pick != null ? k.offers[k.pick] : null), sponsorName = k.none ? '' : sp ? sp.name : '', needSponsor = !k.sponsor && k.pick == null && !k.none, last = (g.kitHistory || []).at(-1);
  let offerHtml = k.sponsor ? `<div class="kitsec"><h3>Shirt sponsor</h3><p class="fineprint"><b>${esc(k.sponsor.name)}</b> are under contract for this season and will be on the shirt.</p></div>` : `<div class="kitsec"><h3>Choose the shirt sponsor</h3><div class="offers">${k.offers.map((o, i) => { let ann = Math.round(o.annual * yearsAdj(k.years) / 1000) * 1000; return `<button class="offer ${k.pick === i ? 'on' : ''}" onclick="kitPick(${i})"><b>${esc(o.name)}</b><span class="sector">${esc(o.sector)}</span><span class="fee">${money(ann)}<small>/season</small></span><span class="eth ${o.ethics < 0 ? 'bad' : o.ethics > 0 ? 'good' : ''}">${o.ethics < 0 ? 'Controversial with fans' : o.ethics > 0 ? 'Fans will like this' : 'Uncontroversial'}</span></button>` }).join('')}<button class="offer none ${k.none ? 'on' : ''}" onclick="kitNone()"><b>No shirt sponsor</b><span class="sector">A clean shirt</span><span class="fee">£0</span><span class="eth good">Traditionalists approve</span></button></div><div class="yearsrow"><span>Length</span>${[1, 2, 3].map(y => `<button class="${k.years === y ? 'on' : ''}" onclick="kitYears(${y})">${y} season${y > 1 ? 's' : ''}</button>`).join('')}<small>Longer deals pay a little more per season.</small></div></div>`;
  $('modal').innerHTML = `<div class="overlay boardoverlay"><div class="meeting kitmeeting"><div class="meetinghead"><div><div class="eyebrow">KIT LAUNCH · ${seasonLabel()}</div><h1>Design the new kit</h1><p class="negsub">Home and away. The supporters will judge it the moment it goes on sale.</p></div><div class="kitlaunchtop"><button class="primary" onclick="kitLaunch()" ${needSponsor ? 'disabled' : ''}>Launch the kit →</button>${needSponsor ? '<small>Choose a sponsor first</small>' : ''}</div></div>
  <div class="kitlayout"><div class="kitstage"><div class="kittabs"><button class="${k.tab === 'home' ? 'on' : ''}" onclick="kitTab('home')">Home</button><button class="${k.tab === 'away' ? 'on' : ''}" onclick="kitTab('away')">Away</button></div>${kitSvg(d, 'live', sponsorName)}${k.tab === 'home' ? kitHint() : '<div class="kithint"><small>The away kit matters less to traditionalists but still counts.</small></div>'}</div>
  <div class="kitcontrols"><div class="kitsec"><h3>Pattern</h3><div class="patgrid">${Object.entries(PATTERNS).map(([p, n]) => `<button class="pat ${d.pattern === p ? 'on' : ''}" onclick="kitPattern('${p}')"><i class="pi ${p}" style="--a:${d.c1};--b:${d.c2}"></i><span>${n}</span></button>`).join('')}</div></div>
  <div class="kitsec"><h3>Primary colour</h3>${swatchRow('c1', d.c1)}<h3>Secondary colour</h3>${swatchRow('c2', d.c2)}<h3>Trim colour</h3>${swatchRow('c3', d.c3)}</div>
  <div class="kitsec two"><div><h3>Collar</h3><div class="chips">${Object.entries(COLLARS).map(([c, n]) => `<button class="${d.collar === c ? 'on' : ''}" onclick="kitCollar('${c}')">${n}</button>`).join('')}</div></div><div><h3>Sleeves</h3><div class="chips"><button class="${d.sleeves === 'match' ? 'on' : ''}" onclick="kitSleeves('match')">Match body</button><button class="${d.sleeves === 'contrast' ? 'on' : ''}" onclick="kitSleeves('contrast')">Contrast</button></div></div></div>
  <div class="chips tools"><button onclick="kitRandom()">🎲 Surprise me</button><button onclick="kitReset()">Club colours</button>${last ? '<button onclick="kitReuse()">Reuse last season’s</button>' : ''}</div></div></div>
  ${offerHtml}<div class="negpanel launchbar"><div class="negbtns"><button class="primary" onclick="kitLaunch()" ${needSponsor ? 'disabled' : ''}>Launch the kit →</button>${needSponsor ? '<span class="fineprint">Choose a shirt sponsor, or go without one, to launch.</span>' : ''}</div></div></div></div>`;
}
const kitSet = (fn) => { let d = kitDraft.d[kitDraft.tab]; fn(d); kitView() };
const kitPattern = p => kitSet(d => d.pattern = p), kitCollar = c => kitSet(d => d.collar = c), kitSleeves = s => kitSet(d => d.sleeves = s), kitColour = (slot, hex) => kitSet(d => d[slot] = hex);
function kitTab(t) { kitDraft.tab = t; kitView() }
function kitPick(i) { kitDraft.pick = i; kitDraft.none = false; kitView() }
function kitNone() { kitDraft.none = true; kitDraft.pick = null; kitView() }
function kitYears(y) { kitDraft.years = y; kitView() }
function kitReset() { let h = homeDefault(); kitDraft.d = { home: h, away: awayDefault(h) }; kitView() }
function kitReuse() { let l = (g.kitHistory || []).at(-1); if (l) { kitDraft.d = { home: { ...l.design.home }, away: { ...l.design.away } }; kitView() } }
function kitRandom() {
  let rng = seeded(Math.abs(hash('rand' + Date.now())) + 1), pick = a => a[Math.floor(rng() * a.length)], h = { pattern: pick(Object.keys(PATTERNS)), c1: pick(SWATCHES), c2: pick(SWATCHES), c3: pick(SWATCHES), collar: pick(Object.keys(COLLARS)), sleeves: pick(['match', 'contrast']) };
  kitDraft.d[kitDraft.tab] = h; kitView();
}
function kitLaunch() {
  let k = kitDraft; if (!k) return; let sponsor = k.sponsor ? { name: k.sponsor.name, sector: k.sponsor.sector || 'Partner', ethics: k.sponsor.ethics || 0 } : null;
  if (!k.sponsor && k.pick != null) {
    let o = k.offers[k.pick], annual = Math.round(o.annual * yearsAdj(k.years) / 1000) * 1000, upfront = Math.round(annual * .25), remaining = Math.round((annual - upfront) * (rounds() - g.week + 1) / rounds());
    g.cash += upfront; g.sponsors.push({ id: 'shirt', name: o.name, annual, years: k.years, upfront: 25, remaining, bonus: Math.round(annual * .2), ethics: o.ethics, sector: o.sector }); record('Sponsor signing advance', upfront);
    sponsor = { name: o.name, sector: o.sector, ethics: o.ethics }; if (o.ethics < 0) g.trust = clamp(g.trust - 1.5, 5, 100); if (o.ethics > 0) g.trust = clamp(g.trust + 1, 5, 100);
  }
  let rx = kitReaction(k.d, { clubId: g.clubId, colour: club().colour, season: g.season, sponsor, partner: !!(g.aff && g.aff.partner) }), f = fb(), price = [65, 55, 48, 42][tier()], total = Math.round(f.online * .012 * price * rx.effects.sales / 1000) * 1000;
  g.trust = clamp(g.trust + rx.effects.trust, 5, 100); f.buzz = clamp(f.buzz + rx.effects.buzz, -1, 1);
  g.kit = { season: g.season, design: { home: k.d.home, away: k.d.away }, sponsor, reaction: { like: rx.like, verdict: rx.verdict, seg: rx.seg, quotes: rx.quotes, parts: rx.parts, effects: rx.effects }, sales: { total, left: total } };
  (g.kitHistory = g.kitHistory || []).push({ season: g.season, design: g.kit.design, like: rx.like, sponsor: sponsor ? sponsor.name : null }); g.kitHistory = g.kitHistory.slice(-10);
  let it = findItem(k.item); if (it) it.status = 'done'; g.world.autoPause = null; g.world.pauseNote = null; for (let m of g.inbox) if (m.boardId === k.item) m.handled = true;
  addNews(`${club().short} unveil their ${seasonLabel()} kit`, `${rx.verdict} ${rx.like}% of supporters like it${sponsor ? ', sponsored by ' + sponsor.name : ''}.`, 'club'); save(); kitReactionView(); if (typeof SFX !== 'undefined') SFX.gavel();
}
function kitWeek() {
  let s = g.kit && g.kit.sales; if (!s || s.left <= 0) return; let x = Math.min(s.left, Math.round(s.total / 10)); s.left -= x; if (typeof addLedger === 'function') addLedger('Kit & merchandise sales', x);
}
function kitReactionView() {
  let k = g.kit, rx = k.reaction, face = rx.like >= 72 ? '🤩' : rx.like >= 58 ? '🙂' : rx.like >= 45 ? '😕' : '😠', cls = rx.like >= 58 ? 'good' : rx.like >= 45 ? 'mid' : 'bad';
  $('modal').innerHTML = `<div class="overlay boardoverlay"><div class="meeting kitmeeting"><div class="meetinghead"><div><div class="eyebrow">THE FANS REACT · ${seasonLabel()}</div><h1>${face} ${esc(rx.verdict)}</h1></div></div>
  <div class="kitreact"><div class="kitshow">${shirtSvg(k.design.home, 'rx-h', k.sponsor ? k.sponsor.name : '', true, 190)}${shirtSvg(k.design.away, 'rx-a', k.sponsor ? k.sponsor.name : '', true, 150)}</div>
  <div><div class="bigpct ${cls}">${rx.like}<small>% of supporters like it</small></div><div class="likebar"><i class="${cls}" style="width:${rx.like}%"></i></div>${Object.entries(SEGMENTS).map(([s, v]) => `<div class="rxseg"><span>${v.icon} ${v.name}</span><div class="moodbar"><i class="${rx.seg[s] >= 66 ? 'good' : rx.seg[s] >= 45 ? 'mid' : 'bad'}" style="width:${rx.seg[s]}%"></i></div><b>${rx.seg[s]}%</b></div>`).join('')}</div></div>
  <div class="quotes">${rx.quotes.map((q, i) => `<div class="quote ${q.mood}" style="animation-delay:${.35 + i * .25}s"><b>${q.icon} ${esc(q.who)}</b><p>“${esc(q.text)}”</p></div>`).join('')}</div>
  <div class="effects"><span>🛍️ Kit sales <b>about ${money(k.sales.total)}</b> over the first ten weeks</span><span>${rx.effects.trust >= 0 ? '📈' : '📉'} Supporter confidence <b>${rx.effects.trust >= 0 ? '+' : ''}${rx.effects.trust}</b></span><span>${rx.effects.buzz >= 0 ? '🌍' : '🔇'} Followers growth <b>${rx.effects.buzz >= 0 ? 'boosted' : 'slowed'}</b></span>${k.sponsor ? `<span>🤝 Shirt sponsor <b>${esc(k.sponsor.name)}</b></span>` : ''}</div>
  <div class="actions"><button class="primary" onclick="closeBoardroom()">Close the meeting →</button></div></div></div>`;
}
