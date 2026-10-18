/* The fictional portrait pool. 64 AI-generated player faces and 8 staff faces (assets/portraits/), used only on the hosted site for
   players who have no real photo. A face is assigned once and stays with that player; it is freed again once he is no longer in the
   squad (sold, released, retired), by sweeping the assignment list against who is actually still on the books. If every face is in
   use, the drawn portrait is used instead rather than two players ever sharing a photo. */

const REGEN_IDS = Array.from({ length: 64 }, (_, i) => 'regen' + String(i + 1).padStart(2, '0'));
const STAFF_PORTRAITS = { chairman: 'chairman', 'chief executive': 'chief-executive', 'finance director': 'finance-director', 'commercial director': 'commercial-director', 'director of football': 'director-of-football', 'academy director': 'academy-director', 'head scout': 'head-scout', investor: 'investor', 'vice-chairman': 'vice-chairman', supporters: 'supporters-trust-representative' };
function portraitPool() { return g.portraits || (g.portraits = { assigned: {} }) }
function sweepPortraits() { let pool = portraitPool(), ids = new Set(g.squad.map(p => p.id)); for (let pid in pool.assigned) if (!ids.has(pid)) delete pool.assigned[pid] }
function assignPortrait(p) {
  let pool = portraitPool(); if (pool.assigned[p.id]) return pool.assigned[p.id];
  sweepPortraits(); let used = new Set(Object.values(pool.assigned)), free = REGEN_IDS.filter(r => !used.has(r)); if (!free.length) return null;
  let pick = free[Math.abs(hash(p.id)) % free.length]; pool.assigned[p.id] = pick; return pick;
}
function staffPortraitFile(role) { let k = Object.keys(STAFF_PORTRAITS).find(k => role && role.toLowerCase().includes(k)); return k ? STAFF_PORTRAITS[k] : null }
