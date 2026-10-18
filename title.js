/* The title screen. The game no longer drops you straight into a save (or straight into the club picker): every visit opens here
   first, the badge spins in, and you choose what to do — carry on, start again, load a save file from disk, or change the sound
   before you've even picked a club. Settings made here are remembered as this browser's defaults and, if a career is already
   loaded in memory, applied to it immediately too, so coming back to the title screen and adjusting the volume isn't wasted. */

const GLOBAL_PREFS_KEY = 'boardroom-globalprefs-v1';
function globalPrefs() { try { return JSON.parse(localStorage.getItem(GLOBAL_PREFS_KEY)) || {} } catch { return {} } }
function saveGlobalPrefs(p) { try { localStorage.setItem(GLOBAL_PREFS_KEY, JSON.stringify(p)) } catch { } }
function setGlobalPref(k, v) { let p = globalPrefs(); p[k] = v; saveGlobalPrefs(p); if (g) { if (k === 'sound' || k === 'vol' || k === 'crowd') { let s = soundPrefs(); if (k === 'sound') s.on = v; if (k === 'vol') s.vol = v; if (k === 'crowd') s.crowd = v; save() } if (k === 'commentary' && typeof raPrefs === 'function') { raPrefs().commentary = v; save() } } }

function showTitle() {
  let savedClub = g ? club(g.clubId) : null, hostedAudio = typeof HOSTED_AUDIO !== 'undefined' && HOSTED_AUDIO;
  $('modal').innerHTML = `<div class="overlay titlescreen"><div class="titlewrap">
    <div class="titlelogo"><span class="brandicon big">B<span>•</span></span></div>
    <h1 class="titlename">THE BOARDROOM</h1><p class="titletag">FOOTBALL CLUB OWNER</p>
    <div class="titlemenu">
      ${g ? `<button class="primary titlebtn" onclick="closeModal();render()"><span class="tbtop">Continue</span><span class="tbsub">${badge(savedClub, 'xs')}${esc(savedClub.name)} &middot; ${esc(DB[savedClub.league].name)}</span></button>` : ''}
      <button class="titlebtn ${g ? '' : 'primary'}" onclick="newGame()"><span class="tbtop">${g ? 'Start a new career' : 'Start your career'}</span><span class="tbsub">Pick a club from 92 professional sides</span></button>
      <button class="titlebtn" onclick="document.getElementById('import').click()"><span class="tbtop">Load a save file</span><span class="tbsub">Import a career exported from this or another device</span></button>
      ${g ? `<button class="titlebtn" onclick="closeModal();render();ownerForm()"><span class="tbtop">Your profile</span><span class="tbsub">Your name and photo as chairman</span></button>` : ''}
      <button class="titlebtn" onclick="titleSettings()"><span class="tbtop">Settings</span><span class="tbsub">Sound${hostedAudio ? ', commentary' : ''} and how the game plays</span></button>
    </div>
    <button class="textbutton titleabout" onclick="about()">Game information &amp; credits</button>
  </div></div>`;
}
function titleSettings() {
  let gp = globalPrefs(), on = g ? soundOn() : gp.sound !== false, vol = Math.round((g ? soundPrefs().vol : gp.vol ?? .7) * 100), crowd = g ? soundPrefs().crowd : gp.crowd !== false, hostedAudio = typeof HOSTED_AUDIO !== 'undefined' && HOSTED_AUDIO, commentary = hostedAudio ? (g ? raPrefs().commentary : gp.commentary !== false) : false;
  $('modal').innerHTML = `<div class="overlay titlescreen"><div class="titlewrap"><div class="titlelogo small"><span class="brandicon">B<span>•</span></span></div>
  <h1 class="titlename small">Settings</h1><p class="titletag">These are remembered on this device${g ? ' and applied to your career right away' : ', and used as the default for your next career'}.</p>
  <div class="titlesettings">
    <label class="pauseopt"><span><b>Sound</b><small>Crowd noise, whistles, goals and interface cues.</small></span><input type="checkbox" ${on ? 'checked' : ''} onchange="setGlobalPref('sound',this.checked)"></label>
    <label class="pauseopt volrow2"><span><b>Volume</b></span><input type="range" min="0" max="100" value="${vol}" oninput="setGlobalPref('vol',this.value/100)"></label>
    <label class="pauseopt"><span><b>Stadium crowd</b><small>The ambient crowd bed while you watch a match.</small></span><input type="checkbox" ${crowd ? 'checked' : ''} onchange="setGlobalPref('crowd',this.checked)"></label>
    ${hostedAudio ? `<label class="pauseopt"><span><b>Commentary voice</b><small>A synthetic voice (Piper, open-source) calls goals and big moments.</small></span><input type="checkbox" ${commentary ? 'checked' : ''} onchange="setGlobalPref('commentary',this.checked)"></label>` : ''}
  </div>
  <button class="textbutton titleabout" onclick="showTitle()">&larr; Back</button></div></div>`;
}
