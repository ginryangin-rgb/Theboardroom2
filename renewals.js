/* Contract renewals at the table. A player's agent sits opposite you. You offer a wage and a length; he counters, loses patience if you lowball,
   and after three insulting offers the player decides to leave. The hidden number is the same renewNeed() the old dialog used. Players
   who have agreed to join someone else cost more; a key man expects a raise; a young player wants a longer deal. */

const baseRnModal = renewModal;
let rnNeg = null;
function rnPatience(p) { return p.renewTries ? Math.max(1, 3 - p.renewTries) : 3 }
function rnOpening(p, need) { let rank = rankOf(p); return p.leaving ? `“He has an offer from ${team(p.leaving).short} on the table. If you want him to stay, it has to beat it.”` : rank <= 3 ? `“He is your best player and he knows it. ${money(Math.round(need * 1.15 / 100) * 100)} a week is where we start.”` : p.age < 23 ? `“He wants to stay, but he wants security. A long deal, and ${money(Math.round(need * 1.1 / 100) * 100)} a week.”` : `“He is happy here. ${money(Math.round(need * 1.1 / 100) * 100)} a week and we can shake on it.”` }
renewModal = function (pid) {
  let p = g.squad.find(x => x.id === pid); if (!p) return; if (p.loanIn) return toast('He is on loan: his contract belongs to his club.'); if (p.refuses) return toast(p.name + ' has made up his mind to leave. Talks are closed.');
  stopClock(); let need = renewNeed(p); rnNeg = { pid, st: { round: 1, patience: rnPatience(p), demand: Math.round(need * 1.1 / 100) * 100, hist: [], said: null }, def: Math.round(p.wage * 1.05 / 100) * 100 }; rnView();
};
function rnView(msgText) {
  let p = g.squad.find(x => x.id === rnNeg.pid), st = rnNeg.st, need = renewNeed(p), years = rnNeg.years || (p.age < 24 ? 4 : p.age > 31 ? 1 : 3), face = typeof playerFace === 'function' ? playerFace(p, 'rnf', 40) : '';
  let o = { eyebrow: 'CONTRACT RENEWAL', title: p.name, sub: `${esc(p.position)} · ${p.age} · ${Math.round(p.rating)} rating · ${money(p.wage)} a week · contract ends ${contractEnd(p)}${p.leaving ? ' · <b class="il no">has agreed to join ' + esc(team(p.leaving).short) + '</b>' : ''}`, plaque: `${esc(club().name)} <span class="vs">·</span> Contract talks`, opp: [{ name: 'Agent ' + surname(p.name), role: 'His agent', colour: '#7a6a8a' }, { name: p.name, role: 'The player', colour: club().colour || '#586b75' }], speaker: 'opp', st,
    bubbles: [{ cls: '', who: 'His agent', txt: esc(msgText || st.said || rnOpening(p, need)) }, ...advice([['Margaret Hale, Finance Director', `Every extra £1,000 a week is £52,000 a year. His current deal costs ${money(p.wage * 52)} a year.`], ['Gary Pell, Director of Football', rankOf(p) <= 5 ? 'He is one of the first names on the sheet. Losing him for nothing would hurt.' : p.age > 30 ? 'He is in the last years of his career. Keep it short.' : 'A squad player. Do not overpay.']])],
    panel: `<div class="negpanel"><div class="negrow"><div><label>Weekly wage (£)</label><input id="negAmt" type="number" min="1" value="${st.last || rnNeg.def}" oninput="rnChip()"></div><div><label>Length</label><select id="negYears" onchange="rnNeg.years=Number(this.value)">${[1, 2, 3, 4].map(y => `<option value="${y}" ${y === years ? 'selected' : ''}>${y} year${y > 1 ? 's' : ''}</option>`).join('')}</select></div></div><div id="negChip">${typeof whyChip === 'function' ? whyChip((Number(st.last || rnNeg.def) - p.wage), 0) : ''}</div>${st.hist.length ? `<div class="presets"><button class="primary" onclick="rnAccept()">Accept his ${money(st.demand)}</button></div>` : ''}<div class="negbtns"><button class="primary" onclick="rnOffer()">Make the offer →</button><button onclick="closeModal();render()">Leave the table</button></div><div id="negErr" class="negative boarderr"></div></div>` };
  $('modal').innerHTML = negHtml(o);
}
function rnChip() { let p = g.squad.find(x => x.id === rnNeg.pid), w = numVal('negAmt') || 0, el = $('negChip'); if (el && typeof whyChip === 'function') el.innerHTML = whyChip(w - p.wage, 0) }
function rnAccept() { let el = $('negAmt'); if (el) el.value = rnNeg.st.demand; rnOffer() }
function rnOffer() {
  let p = g.squad.find(x => x.id === rnNeg.pid), st = rnNeg.st, wage = Math.round(Number($('negAmt').value)), years = Number($('negYears').value); rnNeg.years = years;
  if (!Number.isFinite(wage) || wage < 1) return negErr('Enter a weekly wage.'); let need = renewNeed(p);
  if (wage >= need) {
    let r = offerRenewal(p.id, wage, years); if (r.error) return negErr(r.error); st.hist.push({ you: money(wage), them: 'Accepted' });
    return rnResult(p, 'RENEWED', 'good', `${p.name} signs a new deal at ${money(wage)} a week until ${contractEnd(p)}.`);
  }
  let gap = (need - wage) / need; st.patience -= gap > .25 ? 2 : gap > .12 ? 1.5 : 1; st.round++; st.last = wage;
  if (st.patience <= 0) { p.renewTries = 3; p.refuses = true; msg('Contract talks collapse: ' + p.name, p.name + ' has lost patience and will leave when his contract ends.', 'football'); save(); st.hist.push({ you: money(wage), them: 'Walked away' }); return rnResult(p, 'TALKS COLLAPSED', 'bad', `${p.name} has had enough. He will see out his contract and go.`) }
  p.renewTries = Math.max(p.renewTries || 0, 3 - Math.ceil(st.patience)); let d = Math.max(Math.ceil(need / 100) * 100, Math.round((st.demand - (st.demand - need) * (gap > .12 ? .35 : .55)) / 100) * 100); st.demand = d; st.hist.push({ you: money(wage), them: money(d) });
  st.said = gap > .25 ? `“That is an insult to a player of his standing. ${money(d)} a week, and I would not test him again.”` : d <= Math.ceil(need / 100) * 100 ? `“${money(d)} a week. That is the number. Take it or he walks.”` : `“We can come down a little. ${money(d)} a week.”`; save(); rnView(st.said);
}
function rnResult(p, stamp, tone, text) {
  $('modal').innerHTML = negHtml({ eyebrow: tone === 'good' ? 'DEAL DONE' : 'TALKS COLLAPSED', title: p.name, sub: '', plaque: `${esc(club().name)} <span class="vs">·</span> Contract talks`, opp: [{ name: 'Agent ' + surname(p.name), role: 'His agent', colour: '#7a6a8a' }], speaker: 'us', st: null, result: { stamp, tone }, bubbles: [{ cls: 'you', who: 'Motion carried', txt: esc(text) }], panel: `<div class="actions"><button class="primary" onclick="closeBoardroom()">Close the meeting →</button></div>` });
  if (typeof SFX !== 'undefined') { if (tone === 'good') SFX.gavel(); else SFX.card() }
}
