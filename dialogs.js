/* In-page confirmations. Browser pop-up dialogs (confirm) are blocked inside embedded or sandboxed pages, where they silently
   answer "no", so buttons such as "New career" appeared dead. These flows now ask with an in-page screen instead. */

let confirmBypass = 0, askFn = null;
const nativeConfirm = typeof confirm === 'function' ? confirm : () => false;
globalThis.confirm = function (m) { return confirmBypass > 0 ? true : nativeConfirm(m) };
function withConfirm(fn) { confirmBypass++; try { return fn() } finally { confirmBypass-- } }
function askThen(message, yesLabel, fn) {
  askFn = fn;
  $('modal').innerHTML = `<div class="overlay"><div class="modal"><div class="eyebrow">PLEASE CONFIRM</div><h1 style="font-size:26px">${esc(message)}</h1><div class="actions"><button class="primary" onclick="askGo()">${esc(yesLabel)}</button><button onclick="closeModal()">Cancel</button></div></div></div>`;
}
function askGo() { let f = askFn; askFn = null; closeModal(); if (f) withConfirm(f) }

const baseDlgNewGame = newGame, baseDlgSell = sellPlayer, baseDlgYouth = youthAction, baseDlgImport = importSave;
newGame = function () {
  if (!DB.length) return;
  if (g) askThen('Start a new takeover? Export your current career first if you want to keep it.', 'Start a new career', () => baseDlgNewGame());
  else baseDlgNewGame();
};
sellPlayer = function (id) {
  if (g.ended || g.world.live) return baseDlgSell(id);
  if (!windowOpen()) return toast('Player sales can complete during an open transfer window.');
  if (g.squad.length <= 16) return toast('Keep at least 16 first-team players.');
  let p = g.squad.find(x => x.id === id); if (!p) return;
  askThen(`Accept an offer of ${money(playerValue(p))} for ${p.name}?`, 'Sell', () => baseDlgSell(id));
};
youthAction = function (id, action) {
  if (action === 'release') { let p = g.prospects.find(x => x.id === id); if (!p) return; return askThen('Release ' + p.name + ' from the academy?', 'Release', () => baseDlgYouth(id, action)) }
  return baseDlgYouth(id, action);
};
importSave = function (e) {
  let f = e.target.files[0]; if (!f) return;
  let ev = { target: { files: [f], value: '' } }; e.target.value = '';
  let go = () => { confirmBypass++; baseDlgImport(ev); setTimeout(() => { confirmBypass-- }, 3000) };
  if (g) askThen('Replace the current career with this save?', 'Replace it', go); else go();
};
