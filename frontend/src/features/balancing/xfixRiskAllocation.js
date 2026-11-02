import { FII_COMPOSITIONS } from './fiiCompositions.js';
import { categoryForSegment } from './fiiRiskAllocation.js';

function parsePairs(raw) {
  return Object.freeze(
    Object.fromEntries(
      raw
        .trim()
        .split(/\s+/)
        .map((entry) => {
          const [ticker, value] = entry.split('=');
          const weight = Number(value);

          if (!ticker || !Number.isFinite(weight) || weight < 0) {
            throw new Error('Composição inválida: ' + entry);
          }

          return [ticker, weight];
        })
    )
  );
}

export const XFIX11_HOLDINGS = Object.freeze({
  Tijolo: parsePairs(
    'BTLG11=4.69 HGLG11=4.51 XPML11=4.46 ' +
      'XPLG11=3.11 GGRC11=2.08 VISC11=2.00 ' +
      'HGBS11=1.80 BRCO11=1.34 PVBI11=1.26 ' +
      'HSML11=1.16 LVBI11=1.06 PMLL11=0.95 ' +
      'VILG11=0.95 TVRI11=0.93 HGRE11=0.92 ' +
      'CPSH11=0.79 HSLG11=0.66 GTWR11=0.62 ' +
      'BPML11=0.42 KORE11=0.41 FATN11=0.34 ' +
      'BBIG11=0.33 RBRL11=0.33 RCRB11=0.32 ' +
      'TEPP11=0.27 HTMX11=0.26 TRBL11=0.25 ' +
      'VINO11=0.24 TOPP11=0.20'
  ),

  Papel: parsePairs(
    'KNCR11=7.63 KNIP11=4.78 KNHY11=1.98 ' +
      'CPTS11=1.82 KNUQ11=1.72 KNSC11=1.49 ' +
      'RECR11=1.40 MCCI11=1.08 HGCR11=0.99 ' +
      'VGIR11=0.94 RBRR11=0.79 VRTA11=0.75 ' +
      'RBRY11=0.72 RBRX11=0.71 VCJR11=0.67 ' +
      'BTCI11=0.62 MCRE11=0.60 VGIP11=0.59 ' +
      'XPCI11=0.46 RZAK11=0.46 JSAF11=0.36 ' +
      'HABT11=0.36 AFHI11=0.33 ITRI11=0.33 ' +
      'CLIN11=0.25 ICRI11=0.23 SNCI11=0.23 ' +
      'BCRI11=0.23 MANA11=0.23 PORD11=0.21 ' +
      'HCTR11=0.20 KCRE11=0.20 DEVA11=0.16 ' +
      'HSAF11=0.13'
  ),

  Hibridos: parsePairs(
    'MXRF11=3.48 TRXF11=3.12 KNRI11=2.98 ' +
      'HGRU11=1.91 GARE11=1.61 IRIM11=1.45 ' +
      'BTHF11=1.24 KNHF11=1.22 ALZR11=1.10 ' +
      'RZTR11=1.05 RBVA11=0.96 PCIP11=0.86 ' +
      'JSRE11=0.84 BRCR11=0.76 TGAR11=0.73 ' +
      'VGHF11=0.57 GZIT11=0.52 RZAT11=0.25 ' +
      'MFII11=0.18 WHGR11=0.18 RPRI11=0.17 ' +
      'OUJP11=0.15 VGRI11=0.12 SPXS11=0.10 ' +
      'CACR11=0.05'
  ),

  FundosDeFundos: parsePairs(
    'HFOF11=0.96 PSEC11=0.65 KFOF11=0.36 ' + 'KISU11=0.24 SNFF11=0.19 XPSF11=0.19'
  ),

  SemRateio: parsePairs('SNEL11=0.60 RBRP11=0.37 CYCR11=0.20 ' + 'LIFE11=0.18 URPR11=0.16'),
});

const entries = Object.entries(XFIX11_HOLDINGS).flatMap(([group, holdings]) =>
  Object.entries(holdings).map(([ticker, weight]) => ({
    group,
    ticker,
    weight,
  }))
);

export const XFIX11_HOLDINGS_COUNT = entries.length;

export const XFIX11_TOTAL_WEIGHT = entries.reduce((sum, entry) => sum + entry.weight, 0);

const normalizationFactor = 100 / XFIX11_TOTAL_WEIGHT;

const CATEGORIES = ['Tijolo', 'Papel', 'Desenvolvimento'];

export function calculateXfixRiskExposure(totalValue) {
  const value = Number(totalValue);

  if (!Number.isFinite(value) || value < 0) {
    throw new Error('Valor inválido do XFIX11');
  }

  const weights = {
    Tijolo: 0,
    Papel: 0,
    Desenvolvimento: 0,
  };

  for (const { group, ticker, weight } of entries) {
    const normalizedWeight = weight * normalizationFactor;

    if (group === 'Tijolo' || group === 'Papel') {
      weights[group] += normalizedWeight;
      continue;
    }

    if (ticker === 'TGAR11' || ticker === 'MFII11') {
      weights.Desenvolvimento += normalizedWeight;
      continue;
    }

    const composition = FII_COMPOSITIONS[ticker];

    if (!composition) {
      continue;
    }

    let recognizedPercent = 0;

    for (const segment of composition.segments) {
      const category = categoryForSegment(segment);

      if (!category || !CATEGORIES.includes(category)) {
        continue;
      }

      const percent = Number(segment.percent);

      if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
        throw new Error('Percentual inválido: ' + ticker);
      }

      recognizedPercent += percent;
      weights[category] += normalizedWeight * (percent / 100);
    }

    if (recognizedPercent > 100.000001) {
      throw new Error('Rateio acima de 100%: ' + ticker);
    }
  }

  const exposures = Object.fromEntries(
    CATEGORIES.map((category) => [category, value * (weights[category] / 100)])
  );

  const allocatedValue = Object.values(exposures).reduce((sum, amount) => sum + amount, 0);

  const unallocatedValue = Math.max(0, value - allocatedValue);

  return {
    ticker: 'XFIX11',
    totalValue: value,
    exposures,
    percentages: weights,
    allocatedValue,
    unallocatedValue,
    unallocatedPercent: value > 0 ? (unallocatedValue / value) * 100 : 0,
    referenceDate: 'Consulta: 02/11/2026',
    source: 'https://investidor10.com.br/etfs/xfix11/',
  };
}
