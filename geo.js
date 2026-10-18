/* Where the clubs are, who hates whom, and how big each brand is. Used by away travel, derbies, affiliations and the fan base. */

// club id -> [latitude, longitude, town]
const GEO = {
  '349': [50.735, -1.838, 'Bournemouth'], '359': [51.555, -0.108, 'London N5'], '362': [52.509, -1.885, 'Birmingham'], '337': [51.491, -0.289, 'Brentford'], '331': [50.862, -0.083, 'Brighton'],
  '363': [51.482, -0.191, 'London SW6'], '388': [52.448, -1.496, 'Coventry'], '384': [51.398, -0.086, 'London SE25'], '368': [53.426, -3.004, 'Liverpool'], '370': [51.475, -0.222, 'London SW6'],
  '306': [53.746, -0.368, 'Hull'], '373': [52.055, 1.145, 'Ipswich'], '357': [53.778, -1.572, 'Leeds'], '364': [53.431, -2.961, 'Liverpool'], '382': [53.483, -2.200, 'Manchester'],
  '360': [53.463, -2.291, 'Manchester'], '361': [54.976, -1.622, 'Newcastle'], '393': [52.940, -1.133, 'Nottingham'], '366': [54.914, -1.388, 'Sunderland'], '367': [51.604, -0.066, 'London N17'],
  '392': [52.475, -1.868, 'Birmingham'], '365': [53.729, -2.489, 'Blackburn'], '358': [53.581, -2.536, 'Bolton'], '333': [51.440, -2.620, 'Bristol'], '379': [53.789, -2.230, 'Burnley'],
  '347': [51.473, -3.203, 'Cardiff'], '372': [51.486, 0.037, 'London SE7'], '374': [52.915, -1.447, 'Derby'], '314': [53.218, -0.541, 'Lincoln'], '369': [54.578, -1.217, 'Middlesbrough'],
  '391': [51.486, -0.051, 'London SE16'], '381': [52.622, 1.309, 'Norwich'], '385': [50.796, -1.064, 'Portsmouth'], '394': [53.772, -2.688, 'Preston'], '334': [51.509, -0.232, 'London W12'],
  '398': [53.370, -1.471, 'Sheffield'], '376': [50.906, -1.391, 'Southampton'], '336': [52.989, -2.176, 'Stoke-on-Trent'], '318': [51.643, -3.935, 'Swansea'], '395': [51.650, -0.402, 'Watford'],
  '383': [52.509, -1.964, 'West Bromwich'], '371': [51.539, -0.017, 'London E20'], '380': [52.590, -2.130, 'Wolverhampton'], '352': [53.052, -3.004, 'Wrexham'],
  '3802': [51.435, -0.187, 'London SW17'], '397': [53.552, -1.468, 'Barnsley'], '346': [53.805, -3.048, 'Blackpool'], '387': [53.804, -1.759, 'Bradford'], '3129': [51.390, 0.020, 'Bromley'],
  '2567': [52.822, -1.627, 'Burton upon Trent'], '351': [52.212, 0.155, 'Cambridge'], '279': [53.510, -1.114, 'Doncaster'], '335': [53.654, -1.768, 'Huddersfield'], '375': [52.620, -1.142, 'Leicester'],
  '309': [51.560, -0.012, 'London E10'], '301': [51.884, -0.431, 'Luton'], '304': [53.138, -1.200, 'Mansfield'], '390': [52.009, -0.734, 'Milton Keynes'], '340': [52.943, -1.137, 'Nottingham'],
  '311': [51.716, -1.208, 'Oxford'], '342': [52.565, -0.240, 'Peterborough'], '307': [50.388, -4.151, 'Plymouth'], '338': [51.422, -0.983, 'Reading'], '399': [53.411, -1.501, 'Sheffield'],
  '285': [51.889, -0.193, 'Stevenage'], '400': [53.411, -2.178, 'Stockport'], '350': [53.548, -2.654, 'Wigan'], '344': [51.631, -0.800, 'High Wycombe'],
  '2731': [53.765, -2.371, 'Accrington'], '280': [51.650, -0.218, 'Barnet'], '308': [51.486, -2.583, 'Bristol'], '320': [51.906, -2.060, 'Cheltenham'], '343': [53.254, -1.425, 'Chesterfield'],
  '339': [51.923, 0.893, 'Colchester'], '2594': [51.099, -0.205, 'Crawley'], '396': [53.087, -2.435, 'Crewe'], '324': [50.730, -3.521, 'Exeter'], '3891': [53.920, -3.025, 'Fleetwood'],
  '389': [51.384, 0.561, 'Gillingham'], '386': [53.570, -0.046, 'Cleethorpes'], '635': [51.588, -2.988, 'Newport'], '353': [52.235, -0.934, 'Northampton'], '332': [53.555, -2.130, 'Oldham'],
  '348': [53.050, -2.192, 'Burslem'], '303': [53.621, -2.158, 'Rochdale'], '402': [53.428, -1.363, 'Rotherham'], '4703': [53.487, -2.275, 'Salford'], '302': [52.688, -2.749, 'Shrewsbury'],
  '341': [51.564, -1.771, 'Swindon'], '345': [53.374, -3.011, 'Birkenhead'], '401': [52.576, -1.991, 'Walsall'], '315': [53.985, -1.081, 'York']
};
// European opponents: city, coordinates, stadium
const EURO_GEO = { 'eu-real': [40.45, -3.69, 'Madrid', 'Santiago Bernabéu'], 'eu-barca': [41.38, 2.12, 'Barcelona', 'Camp Nou'], 'eu-bayern': [48.22, 11.62, 'Munich', 'Allianz Arena'], 'eu-psg': [48.84, 2.25, 'Paris', 'Parc des Princes'], 'eu-inter': [45.48, 9.12, 'Milan', 'San Siro'], 'eu-juve': [45.11, 7.64, 'Turin', 'Allianz Stadium'], 'eu-atleti': [40.44, -3.6, 'Madrid', 'Metropolitano'], 'eu-dortmund': [51.49, 7.45, 'Dortmund', 'Signal Iduna Park'], 'eu-benfica': [38.75, -9.18, 'Lisbon', 'Estádio da Luz'], 'eu-porto': [41.16, -8.58, 'Porto', 'Estádio do Dragão'], 'eu-ajax': [52.31, 4.94, 'Amsterdam', 'Johan Cruyff Arena'], 'eu-celtic': [55.85, -4.21, 'Glasgow', 'Celtic Park'], 'eu-roma': [41.93, 12.45, 'Rome', 'Stadio Olimpico'], 'eu-lille': [50.61, 3.13, 'Lille', 'Stade Pierre-Mauroy'], 'eu-psv': [51.44, 5.47, 'Eindhoven', 'Philips Stadion'], 'eu-sporting': [38.76, -9.16, 'Lisbon', 'Estádio José Alvalade'], 'eu-fiorentina': [43.78, 11.28, 'Florence', 'Stadio Artemio Franchi'], 'eu-betis': [37.36, -5.98, 'Seville', 'Benito Villamarín'], 'eu-braga': [41.56, -8.43, 'Braga', 'Estádio Municipal'], 'eu-basel': [47.54, 7.62, 'Basel', 'St. Jakob-Park'], 'eu-fener': [40.99, 29.04, 'Istanbul', 'Şükrü Saracoğlu'], 'eu-ander': [50.83, 4.3, 'Brussels', 'Lotto Park'], 'eu-salzburg': [47.82, 13.0, 'Salzburg', 'Red Bull Arena'], 'eu-athens': [38.04, 23.79, 'Athens', 'OPAP Arena'] };
for (let k in EURO_GEO) GEO[k] = EURO_GEO[k].slice(0, 3);
const isAbroad = id => !!EURO_GEO[id];
const stadiumOf = id => { let c = club(id); if (c && c.stadium) return c.stadium; if (EURO_GEO[id]) return EURO_GEO[id][3]; return (team(id).name || 'the stadium') + ' ground' };
const milesBetween = (a, b) => {
  let A = GEO[a], B = GEO[b]; if (!A || !B) return 100; const R = 3958.8, rad = x => x * Math.PI / 180;
  let dLat = rad(B[0] - A[0]), dLon = rad(B[1] - A[1]), h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(A[0])) * Math.cos(rad(B[0])) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)) * 1.22);   // straight line, then a road factor
};
const townOf = id => GEO[id] ? GEO[id][2] : '';

// [club, club, intensity]: 3 = the fiercest derbies, 2 = a proper rivalry
const RIV = [
  ['360', '382', 3], ['364', '368', 3], ['361', '366', 3], ['359', '367', 3], ['392', '362', 3], ['398', '399', 3], ['374', '393', 3], ['347', '318', 3], ['385', '376', 3], ['381', '373', 3],
  ['371', '391', 3], ['333', '308', 3], ['379', '365', 3], ['380', '383', 3], ['369', '366', 3], ['357', '360', 3],
  ['363', '370', 2], ['363', '367', 2], ['359', '363', 2], ['337', '334', 2], ['337', '370', 2], ['384', '331', 2], ['384', '391', 2], ['372', '391', 2], ['374', '375', 2], ['393', '375', 2],
  ['393', '340', 2], ['362', '380', 2], ['392', '383', 2], ['362', '383', 2], ['336', '348', 2], ['396', '348', 2], ['394', '365', 2], ['394', '346', 2], ['358', '350', 2], ['358', '365', 2],
  ['397', '399', 2], ['397', '402', 2], ['402', '398', 2], ['279', '402', 2], ['349', '376', 2], ['311', '338', 2], ['311', '341', 2], ['307', '324', 2], ['301', '395', 2], ['285', '301', 2],
  ['3802', '390', 2], ['342', '351', 2], ['342', '353', 2], ['347', '635', 2], ['318', '635', 2], ['352', '345', 2], ['332', '303', 2], ['3891', '346', 2], ['2594', '331', 2], ['308', '320', 2],
  ['388', '375', 2], ['388', '392', 2], ['335', '357', 2], ['387', '335', 2], ['387', '357', 2], ['373', '339', 2], ['306', '386', 2], ['304', '343', 2], ['304', '340', 2], ['343', '399', 2],
  ['401', '302', 2], ['401', '380', 2], ['2567', '374', 2], ['2731', '379', 2], ['2731', '365', 2], ['309', '371', 2], ['280', '285', 2], ['3129', '372', 2], ['314', '386', 2], ['345', '368', 2],
  ['360', '361', 2], ['364', '360', 3], ['382', '364', 2], ['368', '360', 1]
];
const RIVAL_MAP = (() => { let m = {}; for (let [a, b, n] of RIV) { (m[a] = m[a] || {})[b] = Math.max(n, (m[a] || {})[b] || 0); (m[b] = m[b] || {})[a] = Math.max(n, (m[b] || {})[a] || 0) } return m })();
const rivalryLevel = (a, b) => (RIVAL_MAP[a] && RIVAL_MAP[a][b]) || 0;
const rivalsOf = id => Object.entries(RIVAL_MAP[id] || {}).map(([o, n]) => ({ id: o, level: n, miles: milesBetween(id, o) })).sort((x, y) => y.level - x.level || x.miles - y.miles);
const DERBY_NAME = (a, b) => { let n = rivalryLevel(a, b); return n >= 3 ? 'THE DERBY' : n === 2 ? 'LOCAL DERBY' : n === 1 ? 'RIVALRY' : '' };

// how big each club's brand is beyond its stadium: a multiplier on the global follower count
const BRAND = { '360': 2.4, '364': 2.1, '359': 1.7, '363': 1.6, '382': 1.6, '367': 1.25, '361': 1.25, '357': 1.45, '368': 1.15, '371': 1.15, '362': 1.1, '380': .95, '393': 1.05, '376': .95, '398': .9, '399': .9, '374': 1.0, '365': .85, '381': .9 };
