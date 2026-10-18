/* The boardroom. Urgent matters that need a decision (a takeover approach, a key player's contract about to expire, a cash crisis,
   a projected breach of the financial rules) and money scenarios that arrive every few weeks are held as board meetings.
   Time cannot move until they are answered. Everything is shown as a meeting with the directors around the table. */

const baseBrWeekly = weeklyWorld, baseBrContinue = continueRun, baseBrNext = nextDay, baseBrStep = stepDay, baseBrAdvance = advance,
  baseBrEnd = ffwdEnd, baseBrResultClose = resultClose;

const MEMBERS = {
  fd: { name: 'Margaret Hale', role: 'Finance Director', ini: 'MH', colour: '#3a7bd5' },
  sec: { name: 'Ian Duffield', role: 'Club Secretary', ini: 'ID', colour: '#8e6bbf' },
  com: { name: 'Priya Nair', role: 'Commercial Director', ini: 'PN', colour: '#e08a2e' },
  vc: { name: 'Sir Colin Ashby', role: 'Vice-chairman', ini: 'CA', colour: '#4f9d7a' },
  fan: { name: 'Tom Reeve', role: 'Supporters’ Trust', ini: 'TR', colour: '#c6534e' },
  you: { name: 'You', role: 'Chairman', ini: 'CH', colour: '#f5a623' }
};

function bd() { let f = fin(); return f.board || (f.board = { items: [], log: [], seq: 0, since: 14, cflag: {}, quiet: {}, last: null }) }
function B() { let t = tier(); return Math.round((cfg[t].cash * .04 + cfg[t].income * .6) / 100) * 100 }
const S = k => Math.round(B() * k / 100) * 100;

/* ---------- scenario catalogue ---------- */
const SCENARIOS = [
  () => ({ title: 'The roof is leaking over the main stand', speaker: 'fd', line: 'Engineers have found water damage in the roof over the main stand. We need to decide how to deal with it.', side: { who: 'sec', line: 'If it fails an inspection we could lose a stand for the next home games.' }, opts: [
    { label: 'Full repair', text: 'The work is done properly and the stand is safe.', fx: { cash: -S(1.2) } },
    { label: 'Temporary fix', text: 'A patch holds for now, but it may not last.', fx: { cash: -S(.4), later: { prob: .55, cash: -S(2.4), days: 40, title: 'The temporary roof repair failed' } } },
    { label: 'Close the damaged section', text: 'Part of the stand is shut and supporters are not pleased.', fx: { cash: -S(.6), trust: -3 } }] }),
  () => ({ title: 'The council offers a community grant', speaker: 'sec', line: 'The council will back a community programme with a grant, provided we run it properly.', side: { who: 'fan', line: 'It is good for the town and good for us.' }, opts: [
    { label: 'Accept and run the programme', text: 'The scheme launches to warm local coverage.', fx: { cash: S(1.0), trust: 3 } },
    { label: 'Negotiate for more', text: '', fx: { chance: { prob: .5, yes: { fx: { cash: S(2.0), trust: 2 }, text: 'The council improve their offer.' }, no: { fx: { trust: -1 }, text: 'The council withdraw the offer and the press notice it.' } } } },
    { label: 'Decline politely', text: 'The council are disappointed.', fx: { trust: -1 } }] }),
  () => ({ title: 'A tax rebate may be due', speaker: 'fd', line: 'We may be owed a rebate. I can claim the safe amount now, or we can pay advisers to chase more.', side: { who: 'vc', line: 'Advisers are not cheap, but I have seen them recover far more.' }, opts: [
    { label: 'Claim the safe amount', text: 'A modest rebate arrives.', fx: { cash: S(.9) } },
    { label: 'Hire advisers', text: '', fx: { cash: -S(.25), chance: { prob: .6, yes: { fx: { cash: S(2.3) }, text: 'The advisers recover a much bigger sum.' }, no: { fx: {}, text: 'The advisers find nothing extra.' } } } }] }),
  () => ({ title: 'An overseas tour is on offer', speaker: 'com', line: 'A promoter will pay us to play a friendly tour abroad mid-season. It is a lot of travelling.', side: { who: 'fan', line: 'Supporters will ask why we are abroad while there is a league to play.' }, opts: [
    { label: 'Accept the tour', text: 'The money arrives, but the squad is tired when they return.', fx: { cash: S(1.7), fitAll: -12, trust: -2 } },
    { label: 'Decline', text: 'The squad stays focused on the league.', fx: { mgr: 2 } }] }),
  () => ({ title: 'A testimonial match for a club legend', speaker: 'fan', line: 'Supporters want to honour a club legend with a testimonial. The whole town will turn out.', side: { who: 'com', line: 'It will not make a fortune, but it is excellent goodwill.' }, opts: [
    { label: 'Host the testimonial', text: 'A joyful night. The ground is full.', fx: { cash: S(.8), trust: 4 } },
    { label: 'Politely refuse', text: 'The Trust is unhappy.', fx: { trust: -3 } }] }),
  () => ({ title: 'A legal claim lands on the desk', speaker: 'sec', line: 'A former contractor is claiming money from the club. We can settle quietly or fight it.', side: { who: 'fd', line: 'Settling is expensive but certain. Fighting is a gamble.' }, opts: [
    { label: 'Settle quietly', text: 'The matter is closed.', fx: { cash: -S(1.0) } },
    { label: 'Fight the claim', text: '', fx: { chance: { prob: .55, yes: { fx: { cash: S(.3) }, text: 'We win, and costs are awarded to the club.' }, no: { fx: { cash: -S(2.6), trust: -1 }, text: 'We lose, and the bill is far higher.' } } } }] }),
  () => ({ title: 'The FA fines us over fan behaviour', speaker: 'sec', line: 'The FA has charged us after crowd trouble at a recent match.', side: { who: 'fan', line: 'It was a handful of people. The Trust will help identify them.' }, opts: [
    { label: 'Pay the fine', text: 'The fine is paid and the matter closed.', fx: { cash: -S(.5) } },
    { label: 'Appeal', text: '', fx: { chance: { prob: .4, yes: { fx: {}, text: 'The appeal succeeds and the fine is dropped.' }, no: { fx: { cash: -S(.8) }, text: 'The appeal fails and the fine is increased.' } } } }] }),
  () => ({ title: 'Hackers have locked the ticketing system', speaker: 'com', line: 'Criminals have locked our ticket sales and want payment. Match tickets cannot be sold until it is fixed.', side: { who: 'fd', line: 'Paying only encourages them, but time matters.' }, opts: [
    { label: 'Pay the ransom', text: 'Systems come back within hours.', fx: { cash: -S(.9) } },
    { label: 'Rebuild from scratch', text: 'Rebuilding takes days and supporters struggle to buy tickets.', fx: { cash: -S(.6), trust: -3 } }] }),
  () => ({ title: 'A sponsor asks to defer its payment', speaker: 'com', line: 'One of our sponsors is having a hard quarter and wants to delay a payment.', side: { who: 'fd', line: 'Cash now is worth more than goodwill, but this sponsor has been loyal.' }, opts: [
    { label: 'Agree to defer', text: '', fx: { cash: -S(.5), chance: { prob: .75, yes: { fx: { cash: S(1.3) }, text: 'They repay in full, with a thank-you bonus.' }, no: { fx: { cash: -S(.5) }, text: 'The sponsor collapses and the money is lost.' } } } },
    { label: 'Hold them to the contract', text: 'The sponsor pays, but relations cool.', fx: { sponsorRel: -12 } }] }),
  () => ({ title: 'Energy costs are spiking', speaker: 'fd', line: 'Energy prices are jumping. We can lock in a fixed price now or stay on the current tariff.', side: { who: 'vc', line: 'Fixing is dull and sensible.' }, opts: [
    { label: 'Fix the price', text: 'The price is locked in.', fx: { cash: -S(.5) } },
    { label: 'Stay on the tariff', text: '', fx: { chance: { prob: .7, yes: { fx: { cash: -S(1.3) }, text: 'Prices surge and the bill is much higher.' }, no: { fx: {}, text: 'Prices ease and the gamble pays off.' } } } }] }),
  () => ({ title: 'Staff ask for a pay rise', speaker: 'sec', line: 'Matchday and office staff are asking for a rise. They have been patient.', side: { who: 'fan', line: 'These are local people. They deserve it.' }, opts: [
    { label: 'Grant the rise', text: 'Staff are delighted.', fx: { cash: -S(.35), morale: 2 } },
    { label: 'Refuse', text: '', fx: { morale: -2, chance: { prob: .35, yes: { fx: { cash: -S(.6) }, text: 'Staff stage a walkout and matchday costs spiral.' }, no: { fx: {}, text: 'Staff grumble, but carry on.' } } } }] }),
  () => ({ title: 'A TV crew wants to film a documentary', speaker: 'com', line: 'A production company will pay well for access to the club for a behind-the-scenes series.', side: { who: 'vc', line: 'The manager will not enjoy the cameras.' }, opts: [
    { label: 'Allow the cameras', text: 'The series is a hit, but the dressing room felt watched.', fx: { cash: S(1.2), mgr: -4, morale: -2 } },
    { label: 'Decline', text: 'The club keeps its privacy.', fx: { mgr: 2 } }] }),
  () => ({ title: 'A supporter loyalty scheme', speaker: 'fan', line: 'The Trust wants a loyalty scheme that rewards season-ticket holders.', side: { who: 'fd', line: 'It costs money, but supporters stick around.' }, opts: [
    { label: 'Launch it', text: 'Supporters love it.', fx: { cash: -S(.4), trust: 5 } },
    { label: 'Not this season', text: 'The Trust is disappointed.', fx: { trust: -2 } }] }),
  () => ({ title: 'A corporate event wants the ground', speaker: 'com', line: 'A local company wants to hire the stadium for a big corporate day.', side: { who: 'sec', line: 'It is easy money, and easy to arrange.' }, opts: [
    { label: 'Accept the booking', text: 'A smooth day and a nice earner.', fx: { cash: S(.7) } },
    { label: 'Keep the ground for football', text: 'Nothing changes.', fx: {} }] }),
  () => ({ title: 'A concert promoter wants the pitch', speaker: 'com', line: 'A promoter will pay handsomely to stage a concert on the pitch.', side: { who: 'sec', line: 'The turf will not enjoy it.' }, opts: [
    { label: 'Allow the concert', text: '', fx: { cash: S(1.8), chance: { prob: .5, yes: { fx: { cash: -S(.9) }, text: 'The pitch is badly damaged and needs relaying.' }, no: { fx: {}, text: 'The pitch recovers quickly.' } } } },
    { label: 'Refuse', text: 'The pitch is protected.', fx: {} }] }),
  () => ({ title: 'An agent demands a payment', speaker: 'fd', line: 'An agent is demanding a fee on top of a recent deal, and threatening to cause trouble.', side: { who: 'vc', line: 'Better to pay a little than to have it dragged out.' }, opts: [
    { label: 'Pay the fee', text: 'The agent goes away.', fx: { cash: -S(.6) } },
    { label: 'Refuse to pay', text: 'The agent briefs the press and the dressing room is unsettled.', fx: { morale: -2, trust: -1 } }] }),
  () => ({ title: 'An anonymous donor offers funds', speaker: 'fan', line: 'A lifelong supporter, who wishes to stay anonymous, wants to donate to the club.', side: { who: 'sec', line: 'There are no strings, as far as I can see.' }, opts: [
    { label: 'Accept the donation', text: 'A generous gift arrives.', fx: { cash: S(1.0), trust: 2 } },
    { label: 'Ask for it to go to the academy', text: 'The donor is thrilled and gives even more.', fx: { cash: S(1.4), trust: 3 } }] }),
  () => ({ title: 'The bank offers to refinance', speaker: 'fd', line: 'Our bank is offering better terms if we refinance our loans now.', side: { who: 'vc', line: 'A lower rate is a lower rate.' }, need: () => fin().loans.some(l => l.type === 'bank'), opts: [
    { label: 'Refinance', text: 'The rate comes down on every bank loan.', fx: { cash: -S(.2), refi: 1.5 } },
    { label: 'Keep the current terms', text: 'Nothing changes.', fx: {} }] }),
  () => ({ title: 'A first-team squad member wants out for personal reasons', speaker: 'sec', line: 'One of the players has asked for a transfer to be closer to family. It is not about football.', side: { who: 'fan', line: 'Supporters won\u2019t take kindly to losing him if the real story never comes out.' }, opts: [
    { label: 'Support him publicly', text: 'The club backs him and explains the situation to supporters.', fx: { trust: 3, mgr: -1 } },
    { label: 'Keep it private and block any move', text: 'He stays, but morale among the squad dips.', fx: { morale: -4 } },
    { label: 'Quietly work on a move', text: 'Deals will be easier to arrange this window.', fx: { cash: -S(.2) } }] }),
  () => ({ title: 'The manager wants extra backing for one more signing', speaker: 'sec', line: 'He has identified a player he believes would make a real difference and wants the board to stretch the budget.', side: { who: 'fd', line: 'Every pound spent now is a pound we don\u2019t have in March.' }, opts: [
    { label: 'Back him fully', text: 'The money is found and the manager feels trusted.', fx: { cash: -S(1.6), mgr: 4 } },
    { label: 'Offer half the amount', text: 'A compromise, though he is clearly disappointed.', fx: { cash: -S(.8), mgr: 1 } },
    { label: 'Say no', text: 'He accepts it, reluctantly.', fx: { mgr: -3 } }] }),
  () => ({ title: 'A promising academy prospect is being watched by a bigger club', speaker: 'sec', line: 'Scouts from a much bigger academy have been at training. The family are asking about his pathway here.', need: () => (g.prospects || []).length > 0, side: { who: 'com', line: 'Losing him for nothing would look bad, whatever the fee.' }, opts: [
    { label: 'Offer him a first scholarship deal early', text: 'A show of faith that may keep him at the club.', fx: { cash: -S(.15), trust: 1 } },
    { label: 'Let the family decide', text: 'Nothing is promised either way.', fx: {} },
    { label: 'Agree a sell-on clause now in case he leaves', text: 'Protects the club financially if he does go.', fx: { cash: -S(.05) } }] }),
  () => ({ title: 'The academy\u2019s category status is under review', speaker: 'sec', line: 'The league\u2019s auditors want to see improvements to facilities and coaching staff or the academy drops a category.', side: { who: 'fd', line: 'A category drop cuts the compensation we get for every academy sale for years.' }, opts: [
    { label: 'Invest to keep the current category', text: 'The academy passes its review comfortably.', fx: { cash: -S(1.4) } },
    { label: 'Make the minimum required changes', text: 'It scrapes through, for now.', fx: { cash: -S(.5) } },
    { label: 'Accept the lower category', text: 'A cheaper option, but it will cost the club later.', fx: { cash: 0 } }] }),
  () => ({ title: 'A former player criticises the club publicly', speaker: 'com', line: 'A well-known ex-player has given an interview questioning the direction of the club. It has been picked up widely.', side: { who: 'fan', line: 'Some of what he said, fans agree with.' }, opts: [
    { label: 'Respond publicly', text: 'The club sets out its case. It calms things, mostly.', fx: { trust: 2 } },
    { label: 'Ignore it', text: 'The story fades within a few days.', fx: {} },
    { label: 'Reach out to him privately', text: 'A quiet word does more good than a public row.', fx: { trust: 1, cash: 0 } }] }),
  () => ({ title: 'A player\u2019s conduct off the pitch makes headlines', speaker: 'com', line: 'One of the squad has been involved in an incident reported in the press. Nothing proven, but the story is out there.', side: { who: 'sec', line: 'How we handle this will be remembered either way.' }, opts: [
    { label: 'Stand by him until the facts are known', text: 'Supporters are divided, but he feels backed.', fx: { trust: -2, mgr: 2 } },
    { label: 'Suspend him pending review', text: 'A cautious move that satisfies most observers.', fx: { trust: 1, mgr: -2 } },
    { label: 'Issue a strong statement distancing the club', text: 'Protects the club\u2019s name immediately.', fx: { trust: 2, mgr: -4 } }] }),
  () => ({ title: 'A minority shareholder wants more transparency', speaker: 'vc', line: 'One of the smaller shareholders is asking to see the full accounts and attend board meetings.', need: () => (fin().investors || []).length > 0, side: { who: 'fd', line: 'They are entitled to ask. It is how we answer that matters.' }, opts: [
    { label: 'Open the books fully', text: 'It builds trust, even if some decisions get questioned.', fx: { trust: 2 } },
    { label: 'Share a summary only', text: 'A middle ground that satisfies nobody completely.', fx: {} },
    { label: 'Politely decline', text: 'Within your rights, but it is noted.', fx: { trust: -2 } }] }),
  () => ({ title: 'A data breach exposes supporter details', speaker: 'sec', line: 'A fault in the ticketing database briefly exposed some supporters\u2019 personal details. It has been fixed, but it happened.', side: { who: 'com', line: 'How quickly and honestly we tell people matters more than the breach itself.' }, opts: [
    { label: 'Inform every affected supporter immediately', text: 'Costly and uncomfortable, but the right thing to do.', fx: { cash: -S(.5), trust: 1 } },
    { label: 'Fix it quietly and say nothing', text: 'Cheaper, but a real risk if it comes out later.', fx: { chance: { prob: .3, yes: { fx: { trust: -8, cash: -S(1.2) }, text: 'It comes out anyway, and the cover-up is the real story.' }, no: { fx: {}, text: 'It never surfaces.' } } } }] }),
  () => ({ title: 'Planning permission for a new facility hits a snag', speaker: 'sec', line: 'The council has raised objections to the plans for the new training ground. A public consultation is now required.', need: () => true, side: { who: 'fd', line: 'Delays cost money whichever way this goes.' }, opts: [
    { label: 'Fund a full public consultation', text: 'Slower, but it wins the council and most residents round.', fx: { cash: -S(.6), trust: 1 } },
    { label: 'Scale back the plans to satisfy objections', text: 'A smaller facility than hoped for.', fx: { cash: -S(.1) } },
    { label: 'Push ahead and contest any objection', text: 'Faster, if it works.', fx: { chance: { prob: .5, yes: { fx: {}, text: 'Permission is granted without further delay.' }, no: { fx: { cash: -S(1.0), trust: -2 }, text: 'The objection succeeds and the project stalls for months.' } } } }] }),
  () => ({ title: 'The pitch is unplayable after a hard frost', speaker: 'sec', line: 'The undersoil heating has failed and the pitch may not pass inspection before Saturday.', side: { who: 'fd', line: 'A postponed game costs us the gate receipts either way.' }, opts: [
    { label: 'Pay for emergency pitch covers and heaters', text: 'An expensive scramble, but the game goes ahead.', fx: { cash: -S(.4) } },
    { label: 'Accept the postponement', text: 'A game is lost from the calendar for now.', fx: { cash: -S(.3) } }] }),
  () => ({ title: 'A floodlight failure risks a postponement', speaker: 'sec', line: 'One bank of floodlights has failed ahead of a midweek fixture. Engineers say a full replacement is overdue.', side: { who: 'fd', line: 'A temporary fix might not even pass the pre-match inspection.' }, opts: [
    { label: 'Replace the floodlights now', text: 'A proper fix, at a proper cost.', fx: { cash: -S(1.5) } },
    { label: 'Patch them for this match only', text: 'It holds, this time.', fx: { cash: -S(.3), later: { prob: .35, cash: -S(1.8), days: 60, title: 'The patched floodlights have failed again' } } }] }),
  () => ({ title: 'A rival club\u2019s supporters plan a provocative away trip', speaker: 'sec', line: 'Police have flagged a large away following for the upcoming derby and want extra segregation measures funded.', need: () => tier() <= 2, side: { who: 'fan', line: 'Get this wrong and someone gets hurt.' }, opts: [
    { label: 'Fund full police and stewarding cover', text: 'An expensive match day, but a safe one.', fx: { cash: -S(.5) } },
    { label: 'Meet the minimum requirement', text: 'Cheaper, and probably fine.', fx: { chance: { prob: .15, yes: { fx: { cash: -S(1.0), trust: -4 }, text: 'Trouble flares and the club is fined over its stewarding.' }, no: { fx: {}, text: 'The day passes without serious incident.' } } } }] }),
  () => ({ title: 'A fire safety inspection flags issues in the main stand', speaker: 'sec', line: 'Inspectors have found the stand\u2019s fire exits and signage fall short of current standards.', side: { who: 'fd', line: 'This is not something we can afford to ignore.' }, opts: [
    { label: 'Fix everything immediately', text: 'The stand is brought fully up to standard.', fx: { cash: -S(.9) } },
    { label: 'Fix the most serious issues only', text: 'It passes, barely.', fx: { cash: -S(.35) } }] }),
  () => ({ title: 'A kit supplier wants an extended, cheaper deal', speaker: 'com', line: 'Our kit supplier wants to lock in another three years at a lower annual fee in exchange for the longer term.', side: { who: 'fd', line: 'Certainty is worth something, but so is testing the market.' }, opts: [
    { label: 'Accept the extension', text: 'A safe, slightly cheaper deal is secured for years.', fx: { cash: S(.3) } },
    { label: 'Decline and test the market next window', text: 'Riskier, but a better deal might be out there.', fx: {} }] }),
  () => ({ title: 'Counterfeit replica shirts are being sold outside the ground', speaker: 'com', line: 'Fake shirts are being sold on matchday streets, undercutting the official store.', side: { who: 'fan', line: 'Some supporters just see it as a cheaper option, fair or not.' }, opts: [
    { label: 'Fund trading standards enforcement', text: 'It costs money, but the sellers move on.', fx: { cash: -S(.25), sponsorRel: 3 } },
    { label: 'Do nothing', text: 'It continues, quietly eating into merchandise revenue.', fx: {} }] }),
  () => ({ title: 'A long-serving member of staff is retiring', speaker: 'sec', line: 'A much-loved kit man who has served the club for decades is retiring at the end of the season.', side: { who: 'fan', line: 'Supporters will expect this to be marked properly.' }, opts: [
    { label: 'Give him a proper send-off and a stand naming tribute', text: 'A generous, well-received gesture.', fx: { cash: -S(.15), trust: 3 } },
    { label: 'A simple thank-you and a gift', text: 'Modest, and perfectly fine.', fx: { trust: 1 } }] }),
  () => ({ title: 'A backroom staff dispute reaches the board', speaker: 'sec', line: 'Two members of staff have raised a formal grievance against each other. It needs resolving properly.', side: { who: 'fd', line: 'Handled badly, this becomes a legal problem as well as a people problem.' }, opts: [
    { label: 'Commission an independent investigation', text: 'Costly and slow, but fair and thorough.', fx: { cash: -S(.3) } },
    { label: 'Have HR resolve it internally', text: 'Quicker, and usually enough.', fx: {} }] }),
  () => ({ title: 'A sponsor\u2019s conduct becomes controversial', speaker: 'com', line: 'One of our sponsors is facing bad press over its own business practices, and supporters are asking questions.', need: () => (g.sponsors || []).length > 0, side: { who: 'fan', line: 'Being associated with this is starting to cost us goodwill.' }, opts: [
    { label: 'End the partnership early', text: 'A costly but well-received stand on principle.', fx: { cash: -S(1.1), trust: 4 } },
    { label: 'Wait and see how it develops', text: 'No immediate cost, but the association lingers.', fx: { trust: -2 } }] }),
  () => ({ title: 'A charity partnership request lands on the desk', speaker: 'com', line: 'A local children\u2019s charity has asked the club to become its official partner for the season.', side: { who: 'fan', line: 'It would mean a lot locally.' }, opts: [
    { label: 'Commit club funding and player appearances', text: 'A genuine community boost, at a real cost.', fx: { cash: -S(.3), trust: 3 } },
    { label: 'Offer appearances only, no funding', text: 'Still appreciated, at no direct cost.', fx: { trust: 1 } },
    { label: 'Decline for now', text: 'Nothing lost, nothing gained.', fx: {} }] }),
  () => ({ title: 'A local school asks for a stadium visit and coaching session', speaker: 'fan', line: 'A nearby school has asked whether their pupils could visit the ground and meet some of the squad.', side: { who: 'com', line: 'Good publicity, if the players are willing.' }, opts: [
    { label: 'Arrange it properly, with players involved', text: 'A memorable day that plays well locally.', fx: { cash: -S(.1), trust: 2, mgr: -1 } },
    { label: 'Offer a stadium tour only', text: 'Simpler, and still appreciated.', fx: { trust: 1 } }] })
];

/* ---------- applying options ---------- */
function evOf(fx) {
  let v = (fx.cash || 0) + (fx.trust || 0) * B() * .12; if (fx.later) v += fx.later.prob * fx.later.cash;
  if (fx.chance) { let c = fx.chance; v += c.prob * evOf(c.yes.fx || {}) + (1 - c.prob) * evOf(c.no.fx || {}) } return v;
}
function backersFor(opts) {
  let ev = opts.map(o => evOf(o.fx || {})), cash = opts.map(o => (o.fx && o.fx.cash) || 0), trust = opts.map(o => (o.fx && o.fx.trust) || 0), risk = opts.map(o => (o.fx && (o.fx.chance || o.fx.later)) ? 1 : 0);
  let argmax = a => a.indexOf(Math.max(...a)), out = opts.map(() => []);
  out[argmax(ev)].push('com'); out[argmax(cash)].push('fd'); out[argmax(trust.map((t, i) => t * 10 + ev[i] / 1e9))].push('fan'); out[risk.indexOf(Math.min(...risk))].push('sec'); out[argmax(ev.map((e, i) => e + trust[i] * B() * .05 - risk[i] * B() * .2))].push('vc');
  return out;
}
function applyScenarioFx(title, o) {
  let fx = o.fx || {}, text = o.text || '', say = [];
  let go = (f, label) => { let d = { title }; let s = applyFx(d, { fx: f }); if (s) say.push(s) };
  if (fx.chance) { let win = rnd() < fx.chance.prob, b = win ? fx.chance.yes : fx.chance.no; text = b.text; let rest = { ...fx }; delete rest.chance; go(rest); go(b.fx || {}) } else go(fx);
  if (fx.sponsorRel) { let f = fin(); for (let s of g.sponsors) f.rel[s.id] = clamp((f.rel[s.id] ?? 50) + fx.sponsorRel, 0, 100); for (let d of f.deals) d.rel = clamp((d.rel || 50) + fx.sponsorRel, 0, 100); say.push('sponsor relationships ' + fx.sponsorRel) }
  if (fx.refi) { for (let l of fin().loans) if (l.type === 'bank') l.rate = Math.max(2, +(l.rate - fx.refi).toFixed(1)); say.push('bank rates down ' + fx.refi + ' points') }
  return { text, say: say.join(' · ') };
}
function optHint(o) {
  let fx = o.fx || {}, parts = [];
  if (o.act) return o.hint || '';
  if (fx.chance) { let c = fx.chance, y = (c.yes.fx || {}).cash || 0, n = (c.no.fx || {}).cash || 0; parts.push('Gamble: ' + (y ? (y > 0 ? '+' : '−') + compact(Math.abs(y)) : 'nothing') + ' or ' + (n ? (n > 0 ? '+' : '−') + compact(Math.abs(n)) : 'nothing')) }
  if (fx.cash) parts.push((fx.cash > 0 ? '+' : '−') + compact(Math.abs(fx.cash)) + (fx.chance ? ' up front' : ''));
  if (fx.later) parts.push('may cost ' + compact(Math.abs(fx.later.cash)) + ' later');
  if (fx.trust) parts.push('fan mood ' + (fx.trust > 0 ? '+' : '−') + Math.abs(fx.trust));
  if (fx.morale) parts.push('squad mood ' + (fx.morale > 0 ? '+' : '−') + Math.abs(fx.morale));
  if (fx.mgr) parts.push('manager ' + (fx.mgr > 0 ? '+' : '−') + Math.abs(fx.mgr));
  if (fx.fitAll) parts.push('squad fitness ' + fx.fitAll);
  if (fx.sponsorRel) parts.push('sponsors cool');
  if (fx.refi) parts.push('lower loan rates');
  return parts.join(' · ');
}

/* ---------- items ---------- */
function newItem(kind, o) { let b = bd(); let it = { id: 'M' + (++b.seq), kind, status: 'open', date: g.world.date, urgent: kind !== 'scenario', ...o }; b.items.push(it); b.items = b.items.slice(-40); return it }
function findItem(id) { return bd().items.find(x => x.id === id) }
function itemValid(it) {
  let f = fin(), w = g.world;
  if (it.status !== 'open') return false;
  if (it.kind === 'takeover') return !!f.bid;
  if (it.kind === 'contract') { let p = g.squad.find(x => x.id === it.pid); return !!p && isExpiring(p) && !p.renewed && !p.refuses }
  if (it.kind === 'cash') { let s = shortfallInfo(); return !!s && daysBetween(w.date, s.first) <= 60 }
  if (it.kind === 'reg') return !!(f.live && f.live.status === 'breach')
  return true;
}
function boardPending() { let b = bd(); for (let it of b.items) if (it.status === 'open' && !itemValid(it)) { it.status = 'moot'; let m = g.inbox.find(x => x.boardId === it.id); if (m) m.handled = true } return b.items.filter(x => x.status === 'open') }
function announce(it, title, body) {
  msg('Board matter: ' + title, body, 'finance'); let m = g.inbox[0]; m.boardId = it.id; m.page = 'Overview';
  g.world.autoPause = { title: 'Board matter: ' + title, cat: 'boardroom', date: g.world.date };
}
function makeScenario() {
  let b = bd(), pool = SCENARIOS.map(f => f()).filter(s => !s.need || s.need()), recent = b.items.filter(x => x.kind === 'scenario').slice(-6).map(x => x.title), fresh = pool.filter(s => !recent.includes(s.title));
  let s = (fresh.length ? fresh : pool)[Math.floor(rnd() * (fresh.length ? fresh : pool).length)], back = backersFor(s.opts);
  let it = newItem('scenario', { title: s.title, speaker: s.speaker, line: s.line, side: s.side, opts: s.opts.map((o, i) => ({ ...o, backers: back[i], hint: optHint(o) })), urgent: false });
  announce(it, s.title, 'The board is meeting about this. ' + s.line); return it;
}
function mandatoryChecks() {
  let f = fin(), b = bd(), w = g.world, open = b.items.filter(x => x.status === 'open');
  if (open.length >= 2) return;
  if (f.bid && !open.some(x => x.kind === 'takeover')) {
    let it = newItem('takeover', { title: 'Takeover approach from ' + f.bid.bidder, speaker: 'vc', line: `${f.bid.bidder} have offered ${money(f.bid.offer)} for the whole club. You would receive ${controlShare()}% of that. We must give them an answer.`, side: { who: 'fd', line: 'It is a fair price on paper, but you will no longer own the club.' }, opts: [
      { label: 'Accept and sell the club', act: { t: 'takeover', v: 'accept' }, hint: 'Ends your chairmanship', backers: ['fd'] }, { label: 'Reject the offer', act: { t: 'takeover', v: 'reject' }, hint: 'Keep the club', backers: ['fan', 'vc'] }] });
    announce(it, it.title, it.line); return;
  }
  if (monthNow() === 6 || (monthNow() === 5 && Number(w.date.slice(8)) >= 25)) {
    let top = [...g.squad].sort((a, c) => c.rating - a.rating).slice(0, 11).map(p => p.id);
    let p = g.squad.find(x => top.includes(x.id) && isExpiring(x) && !x.renewed && !x.refuses && !b.cflag[x.id + ':' + g.season]);
    if (p && !open.some(x => x.kind === 'contract')) {
      b.cflag[p.id + ':' + g.season] = 1;
      let it = newItem('contract', { title: p.name + ' is about to walk away', pid: p.id, speaker: 'sec', line: `${p.name}'s contract ends on 30 June. If we do nothing he leaves for nothing, and one of our best players goes.`, side: { who: 'fd', line: `He will want more than ${money(p.wage)} a week.` }, opts: [
        { label: 'Open talks on a new contract', act: { t: 'renew' }, hint: 'The meeting stays open until he signs or you let him go', backers: ['vc', 'fan'] }, { label: 'Let him leave on a free', act: { t: 'letgo' }, hint: 'He leaves on 30 June', backers: ['fd'] }] });
      announce(it, it.title, it.line); return;
    }
  }
  let s = shortfallInfo(), quiet = b.quiet.cash;
  if (s && daysBetween(w.date, s.first) <= 60 && !(quiet && w.date < quiet) && !open.some(x => x.kind === 'cash')) {
    let need = Math.max(10000, Math.round((-s.amount + weeklyCosts() * 4) / 10000) * 10000), cap = bankCapacity(), wealth = fin().owner.wealth, opts = [];
    if (cap >= need) opts.push({ label: 'Borrow ' + money(need) + ' from the bank', act: { t: 'loan', amount: need }, hint: 'Two-year loan at the bank’s rate', backers: ['fd'] });
    if (wealth >= need) opts.push({ label: 'Put in ' + money(need) + ' of your own money', act: { t: 'inject', amount: need }, hint: 'An equity injection, counted by the financial rules', backers: ['vc'] });
    let offer = investorOffers()[0]; if (offer) opts.push({ label: `Sell ${offer.stake}% to ${offer.name} for ${money(offer.price)}`, act: { t: 'stake', stake: offer.stake }, hint: 'Dilutes your control and adds a dividend', backers: ['com'] });
    opts.push({ label: 'Carry on and accept the risk', act: { t: 'risk', key: 'cash' }, hint: 'The board records its concern: fan mood −2', backers: ['fan'] });
    let it = newItem('cash', { title: s.admin ? 'The club is heading for administration' : 'The club will run out of cash', speaker: 'fd', line: `Our forecast shows cash falling to ${money(s.amount)} around ${s.month}.${s.admin ? ' That is beyond our overdraft limit, so we would enter administration.' : ' We would be living in our overdraft.'} We need a plan today.`, side: { who: 'vc', line: 'Doing nothing is a decision too.' }, opts });
    announce(it, it.title, it.line); return;
  }
  if (f.live && f.live.status === 'breach' && !b.quiet['reg' + g.season] && !open.some(x => x.kind === 'reg')) {
    let r = rule(), ev = evaluate(metrics(true)), eq = tier() === 0 ? 0 : Math.min(fin().owner.wealth, Math.round(ev.excess * 1.05 / 10000) * 10000 + 10000), opts = [];
    if (eq > 0) opts.push({ label: 'Put in ' + money(eq) + ' of your own money as equity', act: { t: 'inject', amount: eq }, hint: 'Counted by the rules, so it can head off a sanction', backers: ['fd'] });
    opts.push({ label: 'Accept the sanctions and carry on', act: { t: 'risk', key: 'reg' + g.season }, hint: r.sanction, backers: ['fan'] });
    let it = newItem('reg', { title: 'We are about to breach the financial rules', speaker: 'sec', line: `${r.title}: we are on course for ${Math.round(ev.ratio * 100)}% against a ${Math.round(ev.limit * 100)}% limit. Sanctions follow at the end of the season unless we act.`, side: { who: 'fd', line: 'Cutting the wage bill is the real answer, and that takes time.' }, opts });
    announce(it, it.title, it.line); return;
  }
  if (b.since >= 28 && !open.length && w.days >= 21 && rnd() < clamp((b.since - 14) / 60, 0, .5)) { b.since = 0; makeScenario() }
}
weeklyWorld = function () {
  let prev = g.ledger[0]; baseBrWeekly(); if (g.ledger[0] === prev || g.ended) return;
  let b = bd(); b.since += 7; mandatoryChecks();
};

/* ---------- answering ---------- */
function runAct(it, o) {
  let a = o.act, f = fin(), b = bd();
  if (a.t === 'takeover') { if (a.v === 'accept') acceptTakeover(); else rejectTakeover(); return { text: a.v === 'accept' ? 'The club is sold.' : 'The offer is rejected.', say: '' } }
  if (a.t === 'letgo') { let p = g.squad.find(x => x.id === it.pid); if (p) p.refuses = true; return { text: (p ? p.name : 'He') + ' will leave on a free transfer.', say: '' } }
  if (a.t === 'loan') { let r = takeBankLoan(a.amount, 104); if (r.error) return { error: r.error }; b.quiet.cash = dayAdd(g.world.date, 28); return { text: 'The loan is arranged and the shortfall is covered.', say: '+' + money(a.amount) + ' borrowed' } }
  if (a.t === 'inject') { let r = injectFunds(a.amount, 'gift'); if (r.error) return { error: r.error }; b.quiet.cash = dayAdd(g.world.date, 28); return { text: 'Your own money goes in as equity.', say: money(a.amount) + ' from your own wealth' } }
  if (a.t === 'stake') { let r = sellStake(a.stake); if (r.error) return { error: r.error }; b.quiet.cash = dayAdd(g.world.date, 28); return { text: 'A stake is sold and the money arrives.', say: '+' + money(r.o.price) } }
  if (a.t === 'risk') { b.quiet[a.key] = a.key === 'cash' ? dayAdd(g.world.date, 56) : true; g.trust = clamp(g.trust - 2, 5, 100); return { text: 'The board notes the risk and moves on.', say: 'fan mood −2' } }
  if (a.t === 'secondsell') { let v = secondValue(), name = club(f.second.clubId).name; recallAll(); g.cash += v; baseFinRecord('Sale of ' + name, v); f.second = null; f.secondClash = null; return { text: name + ' is sold to comply with league ownership rules.', say: '+' + money(v) } }
  if (a.t === 'secondappeal') { let ok = rnd() < .4; if (ok) { f.secondClash = null; f.secondGrace = g.season + 1; g.trust = clamp(g.trust - 3, 5, 100); return { text: 'The league grants a season\u2019s grace while you restructure. It will not be offered twice.', say: 'fan mood \u22123' } } let v = secondValue(), name = club(f.second.clubId).name; recallAll(); g.cash += v; baseFinRecord('Sale of ' + name, v); f.second = null; f.secondClash = null; g.trust = clamp(g.trust - 5, 5, 100); return { text: 'The appeal is rejected. ' + name + ' is sold at the league\u2019s insistence.', say: 'fan mood \u22125' } }
  return { error: 'Unknown action.' };
}
function chooseBoard(id, i) {
  let it = findItem(id); if (!it || it.status !== 'open') return;
  let o = it.opts[i]; if (!o) return; let cash0 = g.cash, res;
  if (o.act && o.act.t === 'renew') { renewModal(it.pid); return }
  res = o.act ? runAct(it, o) : applyScenarioFx(it.title, o);
  if (res.error) { let box = $('boardErr'); if (box) box.textContent = res.error; return }
  it.status = 'done'; it.choice = i; it.result = { text: res.text, say: res.say, cash: Math.round(g.cash - cash0) };
  bd().log.unshift({ date: g.world.date, title: it.title, choice: o.label, cash: it.result.cash, say: res.say }); bd().log = bd().log.slice(0, 30);
  let m = g.inbox.find(x => x.boardId === id); if (m) { m.handled = true; m.body += '  → ' + o.label }
  save(); boardroomView(it, true);
}

/* ---------- the room ---------- */
function seatHtml(k, speaking) { let m = MEMBERS[k]; return `<div class="seat s-${k} ${speaking === k ? 'speaking' : ''}"><div class="av" style="background:${m.colour}">${m.ini}</div><small>${esc(m.role)}</small></div>` }
function boardroomView(it, result) {
  let sp = result ? 'you' : it.speaker, M = MEMBERS[it.speaker], side = it.side && MEMBERS[it.side.who];
  let mini = k => `<i class="mini" style="background:${MEMBERS[k].colour}" title="${esc(MEMBERS[k].name)}, ${esc(MEMBERS[k].role)}">${MEMBERS[k].ini}</i>`;
  let scene = `<div class="room"><div class="wall"><div class="plaque">${typeof teamBadge === 'function' ? teamBadge(g.clubId) : ''}<span>${esc(club().name)} · BOARDROOM</span></div><div class="window"></div></div><div class="table"><span class="paper p1"></span><span class="paper p2"></span><span class="paper p3"></span><span class="jug"></span></div>${['sec', 'fd', 'com', 'fan', 'vc', 'you'].map(k => seatHtml(k, sp)).join('')}</div>`;
  let bubble = result
    ? `<div class="bubble you"><b>Motion carried</b><p>${esc(it.opts[it.choice].label)}${it.result.text ? '. ' + esc(it.result.text) : ''}</p>${it.result.say ? `<div class="chips">${it.result.say.split(' · ').map(s => `<span class="chip">${esc(s)}</span>`).join('')}</div>` : ''}${it.result.cash ? `<div class="bigdelta ${it.result.cash > 0 ? 'positive' : 'negative'}">${it.result.cash > 0 ? '+' : '−'}${money(Math.abs(it.result.cash)).replace('-', '')}</div>` : ''}</div>`
    : `<div class="bubble"><b>${esc(M.name)}, ${esc(M.role)}</b><p>“${esc(it.line)}”</p></div>${side ? `<div class="bubble side"><b>${esc(side.name)}</b><p>“${esc(it.side.line)}”</p></div>` : ''}`;
  let motions = result ? `<div class="actions"><button class="primary" onclick="closeBoardroom()">Close the meeting →</button></div>`
    : `<div class="motions">${it.opts.map((o, i) => `<button class="motion" onclick="chooseBoard('${it.id}',${i})"><b>${esc(o.label)}</b>${o.hint ? `<span class="mh">${esc(o.hint)}</span>` : ''}<span class="backers">${(o.backers || []).length ? 'Backed by ' + o.backers.map(mini).join('') : ''}</span></button>`).join('')}</div><div id="boardErr" class="negative boarderr"></div>`;
  $('modal').innerHTML = `<div class="overlay boardoverlay"><div class="meeting ${it.urgent ? 'urgentmeeting' : ''}"><div class="meetinghead"><div><div class="eyebrow">BOARD MEETING · ${dateText(g.world.date, false).toUpperCase()}</div><h1>${esc(it.title)}</h1></div>${it.urgent && !result ? '<span class="urgenttag">URGENT · A decision is needed before time can move on</span>' : ''}</div>${scene}${bubble}${motions}</div></div>`;
  if (result && typeof countUp === 'function') { let d = $('modal').querySelector && $('modal').querySelector('.bigdelta'); if (d) countUp(d, 1100) }
}
function openBoardroom(id) {
  stopClock(); if (typeof SFX !== 'undefined' && !($('modal').querySelector && $('modal').querySelector('.boardoverlay'))) SFX.gavel(); let it = id ? findItem(id) : boardPending()[0]; if (!it || it.status !== 'open') return; if (!itemValid(it)) { it.status = 'moot'; return openBoardroom() }
  boardroomView(it, false);
}
function closeBoardroom() { closeModal(); render(); let n = boardPending()[0]; if (n && !g.world.ready && !g.ended) openBoardroom(n.id) }

/* ---------- time cannot move while a matter is waiting ---------- */
function guardTime() { if (g.ended || g.world.live || g.world.ready || g.world.seasonComplete) return false; let it = boardPending()[0]; if (!it) return false; openBoardroom(it.id); return true }
continueRun = function () { if (guardTime()) return; return baseBrContinue() };
nextDay = function () { if (guardTime()) return; baseBrNext(); afterTime() };
stepDay = function () { if (guardTime()) return; return baseBrStep() };
advance = function () { if (guardTime()) return; return baseBrAdvance() };
function afterTime() { if (!g.ended && !g.world.ready && !g.world.live && boardPending().length) openBoardroom() }
ffwdEnd = function () { baseBrEnd(); afterTime() };
resultClose = function (silent) { baseBrResultClose(silent); if (!silent) afterTime() };

/* ---------- inbox, time bar and minutes ---------- */
function boardButtons(m) { let it = findItem(m.boardId); if (!it || it.status !== 'open') return ''; return `<div class="actions"><button class="primary" onclick="openBoardroom('${it.id}')">Attend the meeting →</button></div>` }
function boardSlot() { let it = boardPending()[0]; return it ? `<div class="pausenote board"><b>⚠ ${it.urgent ? 'Urgent board matter' : 'Board meeting called'}:</b> ${esc(it.title)} <button class="textbutton" onclick="openBoardroom('${it.id}')">Attend →</button></div>` : '' }
function minutesCard() {
  let log = bd().log;
  return card('Board minutes', `<div class="pad">${log.length ? log.slice(0, 10).map(l => `<div class="row"><div><h3>${esc(l.title)}</h3><small>${dateText(l.date, false)} · ${esc(l.choice)}${l.say ? ' · ' + esc(l.say) : ''}</small></div><b class="${l.cash > 0 ? 'positive' : l.cash < 0 ? 'negative' : ''}">${l.cash ? (l.cash > 0 ? '+' : '') + money(l.cash) : '—'}</b></div>`).join('') : '<p>The board has not had to meet yet. Meetings are called every few weeks, and for anything urgent.</p>'}</div>`);
}
const baseBrOwnership = PAGE_BUILDERS.Ownership; PAGE_BUILDERS.Ownership = () => baseBrOwnership() + minutesCard();
