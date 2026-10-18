/* Real sound, v2 — hosted site only (assets/audio/*.mp3 do not exist in the single-file preview, so every call here checks
   window.__CLUBS__ and falls back to the procedural Web Audio synthesis in audio.js when a file is missing or this is the
   preview build). Crowd beds, whistles, goal reactions and away-day transport are now real field recordings (Freesound and
   Wikimedia Commons, each individually CC0/CC BY/CC BY-SA licensed — see the Credits page). The commentary voice is Piper's
   open-source "northern_english_male" model (CC BY-SA 4.0): a real neural voice, still synthetic and not a broadcaster, and
   its model card says so explicitly. Flagging this document as hosted lets the CSS show the real boardroom photo too. */

if (typeof document !== 'undefined' && document.documentElement) document.documentElement.classList.add('hosted');
const HOSTED_AUDIO = typeof window !== 'undefined' && !window.__CLUBS__;
const baseRA_kickoff = SFX.kickoff, baseRA_halfTime = SFX.halfTime, baseRA_fullTime = SFX.fullTime, baseRA_card = SFX.card, baseRA_shot = SFX.shot, baseRA_goal = SFX.goal, baseRA_travel = SFX.travel, baseRA_arrive = SFX.arrive;
const RA = { pool: {}, crowd: null };
/* the pack's own recommended mix levels (assets/credits/AUDIO-ASSETS-V2.json), inlined so no extra fetch is needed */
const AUDIO_VOL = { crowd_calm_loop: .22, crowd_match_loop: .22, crowd_tense_loop: .22, goal_cheer_1: .6, goal_cheer_2: .6, goal_cheer_3: .6, crowd_applause: .6, crowd_disappointed: .6, crowd_near_miss: .55, whistle_single: .45, whistle_kickoff: .45, whistle_halftime: .45, whistle_final: .45, bus_arrival: .5, bus_departure: .5, bus_door_airbrake: .55, aeroplane_takeoff: .5, aeroplane_flyover: .4, ball_kick: .5, ui_message: .4, ui_warning: .45, ui_contract_signed: .45, ui_transfer_complete: .45 };
const COMMENTARY_VOL = .78;
function raPrefs() { let s = soundPrefs(); if (s.commentary == null) { let gp = typeof globalPrefs === 'function' ? globalPrefs() : {}; s.commentary = gp.commentary !== false } return s }
function raVol(id) { return AUDIO_VOL[id] != null ? AUDIO_VOL[id] : /^commentary_/.test(id) ? COMMENTARY_VOL : .6 }
function raClip(id, volMult = 1, opts = {}) {
  if (!HOSTED_AUDIO || !g || !soundOn()) return null; let a = RA.pool[id]; if (!a) { a = RA.pool[id] = new Audio('assets/audio/' + id + '.mp3'); a.preload = 'none' }
  let n = a.cloneNode(); n.volume = clamp(raVol(id) * volMult * soundPrefs().vol, 0, 1); if (opts.rate) n.playbackRate = opts.rate; n.play().catch(() => { }); if (opts.cut) setTimeout(() => { try { n.pause() } catch (e) { } }, opts.cut); return n;
}
const WHISTLE = { rate: 1.45, cut: 700 };
function raPick(ids) { return ids[Math.floor(Math.random() * ids.length)] }

/* ---------- crowd bed: crossfades between three real stadium recordings by how tense the game is ---------- */
function raCrowdLevel() { let l = g.world && g.world.live; return l ? (typeof crowdLevel === 'function' ? crowdLevel(l) : .3) : 0 }
function raCrowdTick() {
  if (!HOSTED_AUDIO || !g || !g.world || !soundOn() || !soundPrefs().crowd) return; let l = g.world && g.world.live; if (!l || l.paused || page !== 'Matchday') { raCrowdStop(); return }
  let lvl = raCrowdLevel(), want = lvl > .62 ? 'crowd_tense_loop' : lvl > .3 ? 'crowd_match_loop' : 'crowd_calm_loop';
  if (!RA.crowd || RA.crowd.id !== want) { if (RA.crowd) RA.crowd.a.pause(); let a = new Audio('assets/audio/' + want + '.mp3'); a.loop = true; a.volume = 0; a.play().catch(() => { }); RA.crowd = { id: want, a } }
  RA.crowd.a.volume = clamp(raVol(want) * (1 + lvl * .8) * soundPrefs().vol, 0, 1);
}
function raCrowdStop() { if (RA.crowd) { RA.crowd.a.pause(); RA.crowd = null } }
if (HOSTED_AUDIO && typeof setInterval === 'function') setInterval(raCrowdTick, 1500);

/* ---------- whistles, cards, shots, goals ---------- */
SFX.kickoff = function () { if (!raClip('whistle_kickoff', 1, { rate: 1.4, cut: 1500 })) baseRA_kickoff() };
SFX.halfTime = function () { if (!raClip('whistle_halftime', 1, { rate: 1.4, cut: 1800 })) baseRA_halfTime(); raCrowdStop() };
SFX.fullTime = function () { if (!raClip('whistle_final', 1, { rate: 1.35, cut: 2600 })) baseRA_fullTime(); raCrowdStop() };
SFX.card = function () { if (!raClip('whistle_single', 1, WHISTLE)) baseRA_card() };
SFX.shot = function (onTarget, own) { let played = raClip('ball_kick', .6 + Math.random() * .5, { rate: .92 + Math.random() * .2 }); if (onTarget) { let r = Math.random(); if (r < .45) raClip('crowd_near_miss', .6 + Math.random() * .4, { rate: .95 + Math.random() * .1 }); else if (r < .7) raClip('crowd_applause', .5 + Math.random() * .3) } if (!played) baseRA_shot(onTarget, own) };
SFX.goal = function (own, who) {
  let played = false;
  if (HOSTED_AUDIO && soundOn()) {
    raClip('ball_kick', .7);
    if (own) { raClip(raPick(['goal_cheer_1', 'goal_cheer_2', 'goal_cheer_3'])); played = true } else { raClip('crowd_disappointed'); played = true }
    if (raPrefs().commentary) { let l = g.world.live, level = l ? Math.abs(l.home - l.away) : 1, late = l && l.minute >= 85, clip = !own ? 'commentary_away_goal' : late && level <= 1 ? 'commentary_late_winner' : level === 0 ? 'commentary_equaliser' : l && ((l.home > l.away && l.home - (own ? 1 : 0) <= l.away) || (l.away > l.home && l.away - (own ? 1 : 0) <= l.home)) ? 'commentary_take_the_lead' : raPick(['commentary_goal_its_in', 'commentary_goal_what_a_finish']); setTimeout(() => raClip(clip), 500) }
  }
  if (!played) baseRA_goal(own, who);
};
/* ---------- away days: real transport recordings instead of the synthesised engine ---------- */
SFX.travel = function (mode) { if (!raClip(mode === 'flight' ? 'aeroplane_takeoff' : 'bus_departure')) baseRA_travel(mode); if (mode === 'flight' && HOSTED_AUDIO) setTimeout(() => raClip('aeroplane_flyover'), 2600) };
SFX.arrive = function () { let l = g.world.travel ? Object.values(g.world.travel).at(-1) : null, flying = l && l.mode === 'flight'; if (flying) { if (!raClip('aeroplane_flyover', .9, { rate: .85 })) baseRA_arrive() } else { if (!raClip('bus_arrival')) baseRA_arrive(); setTimeout(() => raClip('bus_door_airbrake', .8), 1400) } };

/* ---------- small interface cues, played directly where the game already calls toast() ---------- */
function raUi(id) { raClip(id) }
const baseRA_toast = typeof toast === 'function' ? toast : null;
if (baseRA_toast) toast = function (t) { raUi(/declined|cannot|not able|error/i.test(t) ? 'ui_warning' : 'ui_message'); return baseRA_toast(t) };
const baseRA_finishDeal = typeof finishDeal === 'function' ? finishDeal : null;
if (baseRA_finishDeal) finishDeal = function (d, p) { let before = d.status, r = baseRA_finishDeal(d, p); if (before !== 'signed' && d.status === 'signed') { raUi('ui_transfer_complete'); if (raPrefs().commentary && (d.fee || 0) >= cfg[tier()].fee * 1.2) setTimeout(() => raClip('commentary_new_signing'), 400) } return r };
const baseRA_offerRenewal = typeof offerRenewal === 'function' ? offerRenewal : null;
if (baseRA_offerRenewal) offerRenewal = function (pid, wage, years) { let r = baseRA_offerRenewal(pid, wage, years); if (r && r.ok) raUi('ui_contract_signed'); return r };

/* ---------- settings ---------- */
const baseRA_pause = pauseSettings;
pauseSettings = function () {
  baseRA_pause(); if (!HOSTED_AUDIO) return; let h = $('modal').innerHTML; if (typeof h !== 'string') return; let i = h.indexOf('<div class="actions"><button class="primary" onclick="closeModal()">Done');
  if (i > 0) $('modal').innerHTML = h.slice(0, i) + `<div class="pauseopt" style="cursor:default"><span><b>Commentary voice</b><small>A real neural voice (Piper, open-source) calls goals and big moments &mdash; synthetic speech, not a real commentator.<br><label><input type="checkbox" ${raPrefs().commentary ? 'checked' : ''} onchange="raPrefs().commentary=this.checked;save()"> Enable the commentary voice</label></small></span></div>` + h.slice(i);
};
