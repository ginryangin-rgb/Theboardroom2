/* People at the table. Instead of coloured dots, every seat shows a drawn person: a high-backed chair, shoulders in a suit or blazer,
   shirt and tie or a blouse, a face and a hairstyle. Looks are generated from the person's name, so Margaret Hale always looks like
   Margaret Hale, whichever meeting she is in. Seats facing you (far side) show the face; seats at the near side show the back of the head. */

const SKIN = ['#f3d4b8', '#e8bb97', '#d9a07a', '#c2825a', '#9c6442', '#6e4630', '#f7dfca'];
const HAIR = ['#2a1b12', '#4a3020', '#8a5a2b', '#c99a5b', '#e5d3a8', '#6b6b6b', '#d8d8d8', '#1a1a1a', '#a3442a'];
const SUIT = ['#1f2a3d', '#2b2b33', '#3a2f2a', '#1d3a2f', '#44293a', '#243b55', '#2f3a24', '#4b3b2a', '#333b47'];
const BLOUSE = ['#f6f2ea', '#dbe7f3', '#f3d7dc', '#e7e2f6', '#d9efe3', '#fbe3c8'];
const TIE = ['#a33131', '#2d5fa6', '#b88a1f', '#3f8a5a', '#7a3f8a', '#1f1f1f', '#d06a2a'];
const FEMALE = /^(margaret|priya|helen|susan|janet|anita|joan|sarah|emma|lucy|claire|karen|rachel|laura|sophie|anna|jane|kate|mary|amy|zoe|hannah|nina|rose|grace|julia|fiona|linda|ruth|carol|diane|jo|elaine|gill|debbie|lisa|nicola)\b/i;
const hashN = (s, n, salt = '') => Math.abs(hash(String(s) + '|' + salt)) % n;

function personLook(name, accent) {
  let h = Math.abs(hash('look|' + name)), fem = FEMALE.test(name) || (h % 100 > 68 && !/^(sir|mr|ian|tom|colin|gary|alan|richard|david|mark|peter|graham|colin|alex)\b/i.test(name));
  let age = (h >> 3) % 100, grey = age > 62;
  return {
    name, fem, skin: SKIN[hashN(name, SKIN.length, 's')], hair: grey ? HAIR[5 + (hashN(name, 2, 'g'))] : HAIR[hashN(name, 5, 'h')],
    style: fem ? ['bob', 'long', 'bun', 'short'][hashN(name, 4, 'st')] : ['short', 'side', 'bald', 'curly', 'short'][hashN(name, 5, 'st')],
    suit: SUIT[hashN(name, SUIT.length, 'su')], shirt: fem ? BLOUSE[hashN(name, BLOUSE.length, 'b')] : '#f4f1ea', tie: accent || TIE[hashN(name, TIE.length, 't')],
    glasses: hashN(name, 10, 'gl') < 2, beard: !fem && hashN(name, 10, 'bd') < 3, lapel: hashN(name, 2, 'lp') === 1
  };
}
/* a seated person seen from the front (far side of the table) */
function personFront(L, uid) {
  let hairBack = L.style === 'long' ? `<path d="M22 58 Q18 86 24 100 L76 100 Q82 86 78 58 Z" fill="${L.hair}"/>` : L.style === 'bob' ? `<path d="M24 58 Q20 80 26 90 L74 90 Q80 80 76 58 Z" fill="${L.hair}"/>` : '';
  let hairTop = L.style === 'bald' ? `<path d="M31 56 Q31 44 50 42 Q69 44 69 56 Q62 50 50 50 Q38 50 31 56 Z" fill="${L.hair}" opacity=".55"/>` :
    L.style === 'curly' ? `<path d="M28 60 Q24 36 50 36 Q76 36 72 60 Q66 44 50 46 Q34 44 28 60 Z" fill="${L.hair}"/><circle cx="29" cy="52" r="5" fill="${L.hair}"/><circle cx="71" cy="52" r="5" fill="${L.hair}"/><circle cx="40" cy="41" r="5" fill="${L.hair}"/><circle cx="60" cy="41" r="5" fill="${L.hair}"/>` :
    L.style === 'side' ? `<path d="M29 60 Q28 40 50 40 Q72 40 71 58 Q60 46 42 50 Q33 52 29 60 Z" fill="${L.hair}"/>` :
    L.style === 'bun' ? `<path d="M30 60 Q29 42 50 42 Q71 42 70 60 Q60 50 50 50 Q40 50 30 60 Z" fill="${L.hair}"/><circle cx="50" cy="38" r="8" fill="${L.hair}"/>` :
    `<path d="M29 60 Q28 40 50 40 Q72 40 71 60 Q60 48 50 48 Q40 48 29 60 Z" fill="${L.hair}"/>`;
  let beard = L.beard ? `<path d="M36 70 Q50 92 64 70 Q58 82 50 83 Q42 82 36 70 Z" fill="${L.hair}" opacity=".85"/>` : '';
  let glasses = L.glasses ? `<g fill="none" stroke="#222" stroke-width="1.6"><circle cx="42" cy="62" r="6"/><circle cx="58" cy="62" r="6"/><path d="M48 62h4"/></g>` : '';
  let collar = L.fem ? `<path d="M40 100 L50 118 L60 100 Z" fill="${L.shirt}"/>` : `<path d="M41 100 L50 114 L59 100 Z" fill="${L.shirt}"/><path d="M47 104 L50 128 L53 104 L50 101 Z" fill="${L.tie}"/>`;
  let lapel = `<path d="M36 100 L50 130 L41 100 Z" fill="#00000022"/><path d="M64 100 L50 130 L59 100 Z" fill="#00000022"/>`;
  return `<svg class="person front" viewBox="0 0 100 140" aria-hidden="true">
    <defs><clipPath id="pc${uid}"><rect x="0" y="0" width="100" height="134"/></clipPath></defs>
    <path d="M14 70 Q14 54 30 54 L70 54 Q86 54 86 70 L86 134 L14 134 Z" fill="#2a1a12" stroke="#120a06" stroke-width="2"/><path d="M20 62 Q20 60 23 60 L77 60 Q80 60 80 62 L80 128 L20 128 Z" fill="#3b2619"/>
    <g clip-path="url(#pc${uid})">${hairBack}<path d="M22 134 L22 112 Q22 96 40 96 L60 96 Q78 96 78 112 L78 134 Z" fill="${L.suit}"/>${lapel}<rect x="44" y="82" width="12" height="20" rx="5" fill="${L.skin}"/>${collar}
    <ellipse cx="50" cy="63" rx="17" ry="20" fill="${L.skin}"/>${beard}${hairTop}<ellipse cx="43" cy="63" rx="1.7" ry="2" fill="#2a1b12"/><ellipse cx="57" cy="63" rx="1.7" ry="2" fill="#2a1b12"/><path d="M45 72 Q50 76 55 72" fill="none" stroke="#7a4a3a" stroke-width="1.4" stroke-linecap="round"/>${glasses}</g></svg>`;
}
/* the back of a seated person (near side of the table) */
function personBack(L, uid) {
  let hair = L.style === 'bald' ? `<ellipse cx="50" cy="60" rx="16" ry="18" fill="${L.hair}" opacity=".5"/>` : L.style === 'long' ? `<path d="M30 56 Q28 38 50 38 Q72 38 70 56 L74 98 L26 98 Z" fill="${L.hair}"/>` : L.style === 'bob' ? `<path d="M30 56 Q28 38 50 38 Q72 38 70 56 L72 84 L28 84 Z" fill="${L.hair}"/>` : L.style === 'bun' ? `<ellipse cx="50" cy="58" rx="18" ry="20" fill="${L.hair}"/><circle cx="50" cy="44" r="8" fill="${L.hair}"/>` : L.style === 'curly' ? `<ellipse cx="50" cy="58" rx="20" ry="22" fill="${L.hair}"/>` : `<ellipse cx="50" cy="57" rx="17" ry="19" fill="${L.hair}"/>`;
  return `<svg class="person back" viewBox="0 0 100 140" aria-hidden="true">
    <path d="M12 134 L12 118 Q12 104 28 104 L72 104 Q88 104 88 118 L88 134 Z" fill="#1d1109"/>
    <path d="M18 136 L18 104 Q18 90 36 90 L64 90 Q82 90 82 104 L82 136 Z" fill="${L.suit}"/><path d="M50 92 L50 136" stroke="#00000033" stroke-width="2"/>
    <rect x="44" y="76" width="12" height="18" rx="5" fill="${L.skin}"/><ellipse cx="50" cy="60" rx="17" ry="20" fill="${L.skin}"/>${hair}
    <path d="M8 118 Q8 100 26 100 L74 100 Q92 100 92 118 L92 140 L8 140 Z" fill="#2a1a12" stroke="#120a06" stroke-width="2"/><path d="M15 112 Q15 108 20 108 L80 108 Q85 108 85 112 L85 136 L15 136 Z" fill="#3b2619"/></svg>`;
}
/* the whole seat: figure + name plate. side: 'front' faces you, 'back' is seen from behind. */
function personSeat(who, side, cls = '', uid = '') {
  let hosted = !window.__CLUBS__, isYou = who.name === 'You' || who.role === 'Chairman' && who.colour === '#f5a623', staff = hosted && typeof staffPortraitFile === 'function' ? (who.role === 'Chairman' && !isYou ? null : staffPortraitFile(who.role)) : null; if (isYou && hosted && g && g.owner && g.owner.photo) staff = null;
  let fallbackFace = hosted && !staff && typeof REGEN_IDS !== 'undefined' ? REGEN_IDS[Math.abs(hash((who.name || who.role) + 'board')) % REGEN_IDS.length] : null;
  // a named character's own portrait is shown however they're seated; an anonymous fallback face only when facing the camera
  let ownPhoto = isYou && g && g.owner && g.owner.photo ? g.owner.photo : null;
  let fig = ownPhoto ? `<span class="person front photo"><img src="${ownPhoto}" alt=""></span>` : staff ? `<span class="person front photo"><img src="assets/portraits/${staff}.jpg" alt=""></span>`
    : fallbackFace && side !== 'back' ? `<span class="person front photo"><img src="assets/portraits/${fallbackFace}.jpg" alt=""></span>`
    : (() => { let L = personLook(who.name || who.role, who.colour); return side === 'back' ? personBack(L, uid) : personFront(L, uid) })();
  return `<div class="seat ${cls} ${side}">${fig}<div class="plate" style="--c:${who.colour || '#777'}"><b>${esc((who.name || '').split(' ').slice(-1)[0] || who.role)}</b><small>${esc(who.role)}</small></div></div>`;
}
seatHtml = function (k, speaking) { let m = MEMBERS[k]; return personSeat(m, ['fan', 'vc'].includes(k) ? 'back' : 'front', `s-${k} ${speaking === k ? 'speaking' : ''}`, 'b' + k) };
seat = function (k, who, extra = '') { return personSeat(who, /s-u/.test(k) ? 'back' : 'front', `${k} ${extra}`, 'n' + k) };
