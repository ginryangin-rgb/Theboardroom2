/* A short, recognisable sting plays on the team sheet before kick-off, tagged to whichever competition the fixture
   belongs to. Real audio only exists on the hosted build, same as every other piece of matchday sound. */

function compThemeId(f) {
  if (!f) return null;
  if (f.comp === 'League' && tier() === 0) return 'comp-pl';
  if (f.comp === 'FA') return 'comp-fa';
  if (f.comp === 'LC') return 'comp-lc';
  if (f.comp === 'EU' && g.world.cups.EU && g.world.cups.EU.name === 'Champions League') return 'comp-ucl';
  return null;
}
let compAudioEl = null, compFade = null;
function playCompTheme(f) {
  stopCompTheme(true);
  if (!HOSTED_AUDIO || !soundOn()) return; let id = compThemeId(f); if (!id) return;
  try { let a = new Audio('assets/audio/' + id + '.mp3'); a.volume = .85 * (soundPrefs().vol ?? 1); a.play().catch(() => { }); compAudioEl = a } catch (e) { }
}
function stopCompTheme(instant) {
  if (compFade) { clearInterval(compFade); compFade = null } if (!compAudioEl) return;
  let a = compAudioEl; compAudioEl = null;
  if (instant) { try { a.pause() } catch (e) { } return }
  let steps = 10, i = 0, start = a.volume || .01;
  compFade = setInterval(() => { i++; try { a.volume = Math.max(0, start * (1 - i / steps)) } catch (e) { } if (i >= steps) { clearInterval(compFade); compFade = null; try { a.pause() } catch (e) { } } }, 35);
}
const baseCmSheet = preMatchSheet;
preMatchSheet = function (id) { baseCmSheet(id); let f = g.world.fixtures.find(x => x.id === id); if (f) playCompTheme(f) };
const baseCmCancel = cancelPreMatch;
cancelPreMatch = function () { stopCompTheme(); baseCmCancel() };
const baseCmTalkPick = matchTalkPick;
matchTalkPick = function (id, tone) { stopCompTheme(); baseCmTalkPick(id, tone) };
