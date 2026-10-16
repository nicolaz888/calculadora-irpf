// Estimador simplificado 2026 para rendimientos del trabajo.
// Fuentes y límites se explican en README.md. No sustituye el algoritmo completo de la AEAT.
const STATE_SCALE = [
  [12_450, 0.095], [20_200, 0.12], [35_200, 0.15],
  [60_000, 0.185], [300_000, 0.225], [Infinity, 0.245],
];

// Escalas autonómicas publicadas por la AEAT para 2025; la de Extremadura
// se actualiza con efectos 1-1-2026 según Ley 1/2026.
const REGIONAL_SCALES = {
  andalucia: [[13_000,.095],[21_100,.12],[35_200,.15],[60_000,.185],[Infinity,.225]],
  aragon: [[13_072.5,.095],[21_210,.12],[36_960,.15],[52_500,.185],[60_000,.205],[80_000,.23],[90_000,.24],[130_000,.25],[Infinity,.255]],
  asturias: [[12_450,.09],[17_707.2,.12],[33_007.2,.14],[53_407.2,.192],[70_000,.215],[90_000,.225],[175_000,.25],[Infinity,.26]],
  baleares: [[10_000,.09],[18_000,.1125],[30_000,.1425],[48_000,.175],[70_000,.19],[90_000,.2175],[120_000,.2275],[175_000,.2375],[Infinity,.2475]],
  canarias: [[13_748,.09],[19_422,.115],[35_924,.14],[57_566,.185],[93_268,.235],[123_745,.25],[Infinity,.26]],
  cantabria: [[13_000,.085],[21_000,.11],[35_200,.145],[60_000,.18],[90_000,.225],[Infinity,.245]],
  castilla_la_mancha: [[12_450,.095],[20_200,.12],[35_200,.15],[60_000,.185],[Infinity,.225]],
  castilla_y_leon: [[12_450,.09],[20_200,.12],[35_200,.14],[53_407.2,.185],[Infinity,.215]],
  cataluna: [[12_500,.095],[22_000,.125],[33_000,.16],[53_000,.19],[90_000,.215],[120_000,.235],[175_000,.245],[Infinity,.255]],
  extremadura: [[12_450,.0775],[20_200,.0975],[24_200,.16],[35_200,.175],[60_000,.21],[80_200,.235],[99_200,.24],[120_200,.245],[Infinity,.25]],
  galicia: [[12_985.35,.09],[21_068.6,.1165],[35_200,.149],[60_000,.184],[Infinity,.225]],
  madrid: [[13_362.22,.085],[19_004.63,.107],[35_425.68,.128],[57_320.4,.174],[Infinity,.205]],
  murcia: [[12_450,.095],[20_200,.112],[34_000,.133],[60_000,.179],[Infinity,.225]],
  la_rioja: [[12_450,.08],[20_200,.106],[35_200,.136],[40_000,.178],[50_000,.183],[60_000,.19],[120_000,.245],[Infinity,.27]],
  comunidad_valenciana: [[12_000,.09],[22_000,.12],[32_000,.15],[42_000,.175],[52_000,.20],[62_000,.225],[72_000,.25],[100_000,.265],[150_000,.275],[200_000,.285],[Infinity,.295]],
  ceuta_melilla: [[12_450,.095],[20_200,.12],[35_200,.15],[60_000,.185],[Infinity,.225]],
};

// Mínimos autonómicos del manual AEAT 2025 para las comunidades que los modifican.
// En las restantes se aplica el mínimo estatal como aproximación.
const REGIONAL_MINIMUMS = {
  andalucia: { taxpayer: 5790, child: [2510,2820,4170,4700], under3: 2920, age65: 1200, age75: 1460 },
  asturias: { taxpayer: 6105, child: [2640,2970,4400,4950], under3: 3080, age65: 1265, age75: 1540 },
  baleares: { taxpayer: 5550, child: [2400,2970,4400,4950], under3: 2800, age65: 1265, age75: 1540 },
  canarias: { taxpayer: 5606, child: [2424,2727,4040,4545], under3: 2828, age65: 1162, age75: 1414 },
  galicia: { taxpayer: 5789, child: [2503,2816,4172,4694], under3: 2920, age65: 1199, age75: 1460 },
  madrid: { taxpayer: 5956.65, child: [2575.85,2897.83,4400,4950], under3: 3005.16, age65: 1234.26, age75: 1502.58 },
  comunidad_valenciana: { taxpayer: 6105, child: [2640,2970,4400,4950], under3: 3080, age65: 1265, age75: 1540 },
};

const REGION_KEYS = {
  Andalucía: 'andalucia', Aragón: 'aragon', Asturias: 'asturias', 'Illes Balears': 'baleares',
  Canarias: 'canarias', Cantabria: 'cantabria', 'Castilla-La Mancha': 'castilla_la_mancha',
  'Castilla y León': 'castilla_y_leon', Cataluña: 'cataluna', Extremadura: 'extremadura',
  Galicia: 'galicia', 'Comunidad de Madrid': 'madrid', 'Región de Murcia': 'murcia',
  'La Rioja': 'la_rioja', 'Comunitat Valenciana': 'comunidad_valenciana',
  Ceuta: 'ceuta_melilla', Melilla: 'ceuta_melilla',
};

const RETENTION_SCALE = [
  [12_450,.19],[20_200,.24],[35_200,.30],[60_000,.37],[300_000,.45],[Infinity,.47],
];
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

function applyScale(amount, bands) {
  let lower = 0;
  let tax = 0;
  for (const [upper, rate] of bands) {
    const taxable = Math.max(0, Math.min(amount, upper) - lower);
    tax += taxable * rate;
    if (amount <= upper) break;
    lower = upper;
  }
  return round2(tax);
}

function workIncomeReduction(netWork) {
  if (netWork <= 14_852) return 7_302;
  if (netWork <= 17_673.52) return 7_302 - 1.75 * (netWork - 14_852);
  if (netWork < 19_747.5) return Math.max(0, 2_364.34 - 1.14 * (netWork - 17_673.52));
  return 0;
}

// Aproximación anual para Régimen General, contrato indefinido y salario bruto
// uniforme durante los 12 meses. Incluye la cuota obrera ordinaria y solidaridad 2026.
function estimateEmployeeContributions(salary) {
  const monthlyPay = Math.max(0, salary) / 12;
  const base = Math.min(monthlyPay, 5_101.2);
  const ordinary = base * 0.065;
  const solidarity = Math.min(Math.max(monthlyPay - 5_101.2, 0), 510.12) * 0.0019
    + Math.min(Math.max(monthlyPay - 5_611.32, 0), 2_040.48) * 0.0021
    + Math.max(monthlyPay - 7_651.8, 0) * 0.0024;
  return round2((ordinary + solidarity) * 12);
}

function minimums(data, regional = false) {
  const base = regional ? (REGIONAL_MINIMUMS[data.regionKey] || {}) : {};
  const taxpayer = base.taxpayer ?? 5_550;
  const age65 = base.age65 ?? 1_150;
  const age75 = base.age75 ?? 1_400;
  const childAmounts = base.child ?? [2_400,2_700,4_000,4_500];
  const under3 = base.under3 ?? 2_800;
  let descendants = 0;
  const childCount = data.children;
  for (let i = 0; i < childCount; i++) descendants += childAmounts[Math.min(i, childAmounts.length - 1)];
  return round2(taxpayer + (data.age >= 65 ? age65 : 0) + (data.age >= 75 ? age75 : 0)
    + (descendants + data.childrenUnder3 * under3) * data.childShare);
}

function calculateAnnual(data) {
  const regionKey = REGION_KEYS[data.region];
  if (!regionKey) return { unsupported: true, message: 'Navarra y los territorios históricos del País Vasco tienen régimen foral propio. Esta versión aún no incorpora sus tarifas.' };
  const netWork = Math.max(0, data.salary - data.contributions);
  const reduction = workIncomeReduction(netWork);
  const taxableBase = Math.max(0, netWork - 2_000 - reduction);
  const stateMinimum = minimums(data, false);
  const regionalMinimum = minimums({ ...data, regionKey }, true);
  const stateTax = Math.max(0, applyScale(taxableBase, STATE_SCALE) - applyScale(Math.min(stateMinimum, taxableBase), STATE_SCALE));
  const regionalTax = Math.max(0, applyScale(taxableBase, REGIONAL_SCALES[regionKey]) - applyScale(Math.min(regionalMinimum, taxableBase), REGIONAL_SCALES[regionKey]));
  const quota = round2(stateTax + regionalTax);
  const balance = round2(quota - data.withheld);
  return { taxableBase: round2(taxableBase), reduction: round2(reduction), stateTax, regionalTax, quota, withheld: data.withheld, balance };
}

function calculateRetention(data) {
  const netWork = Math.max(0, data.salary - data.contributions);
  const reduction = workIncomeReduction(netWork);
  const extraChildrenReduction = data.children > 2 ? 600 : 0;
  const spouseReduction = data.familyStatus === '2' ? 3_400 : 0;
  const base = Math.max(0, netWork - Math.min(2_000, netWork) - reduction - extraChildrenReduction - spouseReduction);
  const familyMinimum = minimums(data, false);
  let quota = Math.max(0, applyScale(base, RETENTION_SCALE) - applyScale(Math.min(familyMinimum, base), RETENTION_SCALE));
  const exemptLimits = { '1': [0, 17_644,18_694], '2': [17_197,18_130,19_262], '3': [15_876,16_342,16_867] };
  const childIndex = data.children === 0 ? 0 : data.children === 1 ? 1 : 2;
  if (data.salary <= exemptLimits[data.familyStatus][childIndex]) quota = 0;
  if (data.salary <= 35_200) {
    const maxBase = exemptLimits[data.familyStatus][childIndex];
    quota = Math.min(quota, Math.max(0, (data.salary - maxBase) * .43));
  }
  const rate = Math.floor((quota / data.salary) * 10_000) / 100;
  const annualRetention = round2(data.salary * rate / 100);
  return { taxableBase: round2(base), reduction: round2(reduction), quota: round2(quota), rate, annualRetention, monthlyRetention: round2(annualRetention / data.payments) };
}

window.TaxEngine2026 = { calculateAnnual, calculateRetention, estimateEmployeeContributions, REGION_KEYS };
