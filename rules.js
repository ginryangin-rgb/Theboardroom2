/* Financial rules as DATA, not code. Edit here (or add a season block) without touching the engine.
   Reference: the rules agreed for English football for 2026/27 (Premier League and Championship Squad Cost Rules,
   League One/Two Salary Cost Management Protocol). They are simplified for the game and the full rulebooks are longer.
   Money fields are in REAL pounds and are multiplied by `scale` because the game economy is smaller than the real one.
   To change a rule from a given season, add e.g.  seasons['2027'] = { 1: { limit: .80 } }  (only changed fields needed). */
const RULES = {
  reference: '2026/27',
  // Game economy is smaller than the real one, so absolute £ thresholds are scaled per division (0 = Premier League).
  scale: { 0: .3, 1: .4, 2: .5, 3: .5 },
  seasons: {
    default: {
      0: {
        kind: 'scr', title: 'Squad Cost Ratio', league: 'Premier League',
        limit: .85,            // squad costs (wages + amortised fees) as a share of football revenue + player-sale profit
        allowance: .30,        // multi-year allowance: spend above the limit up to this share of revenue, at a levy
        pointsPerUnit: 6, unit: 6.5e6,   // beyond the allowance: 6 points per £6.5m overspend (real £, scaled)
        sanction: 'Levy above the limit; points deduction once the multi-year allowance is used up.'
      },
      1: {
        kind: 'scr', title: 'Squad Cost Rules', league: 'Championship',
        limit: .85,
        equitySeasonCap: 15e6, equity3yCap: 33e6,   // owner equity can top up spending, capped per season and over 3 seasons
        levyOnEquity: .10,     // levy on spending covered by the equity allowance
        pointsPerUnit: 6, unit: 3e6,
        sanction: 'Levy if the overspend is covered by owner equity within the allowance; points deduction beyond it.'
      },
      2: {
        kind: 'scmp', title: 'Salary Cost Management Protocol', league: 'League One',
        limit: .50, relegatedLimit: .65,   // wages + manager as a share of turnover; 65% in the first season after relegation
        equityCredit: .5,      // each £1 of owner equity buys £0.50 of extra wage room
        sanction: 'Transfer embargo (this summer and next winter window).'
      },
      3: {
        kind: 'scmp', title: 'Salary Cost Management Protocol', league: 'League Two',
        limit: .50, relegatedLimit: .50,
        equityTurnover: true,  // owner money counts in full as turnover
        sanction: 'Transfer embargo (this summer and next winter window).'
      }
    }
    // '2027': { 1: { limit: .80 } },
  },
  resolve(y, t) {
    let d = this.seasons.default[t], o = this.seasons[String(y)]?.[t] || {};
    let r = { ...d, ...o }, s = this.scale[t];
    for (let k of ['unit', 'equitySeasonCap', 'equity3yCap']) if (r[k]) r[k] = Math.round(r[k] * s);
    return r;
  }
};
// Parachute payments after relegation, as a share of the division's annual central income, paid weekly. [year1, year2, year3]
const PARACHUTE = { 0: [.45, .35, .15], 1: [.18, .08] };

/* Economy rebalance. The original economy let a do-nothing club multiply its cash about five-fold in a year because wages
   were only ~30% of revenue. These knobs raise wages and add club operating costs so money is genuinely tight.
   Applied only to NEW careers (a career already under way keeps its old economy). Set enabled:false to switch off. */
const ECONOMY = {
  enabled: true,
  wageScale: { 0: 1.8, 1: 2.4, 2: 1.35, 3: 1.5 },    // multiplies first-team and market wages by division
  opsShare: { 0: .1, 1: .12, 2: .14, 3: .15 }        // weekly club operations as a share of annual revenue / 48 — now that real gate and concessions income lands on actual matchdays rather than being smoothed across the year, this needs to be lighter than it would if revenue arrived evenly
};
