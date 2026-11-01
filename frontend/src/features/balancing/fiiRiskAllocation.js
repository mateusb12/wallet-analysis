import { FII_COMPOSITIONS } from './fiiCompositions.js';

const BALANCING_CATEGORIES = new Set([
  'Tijolo',
  'Papel',
  'Desenvolvimento',
]);

function categoryForSegment(segment) {
  const label = String(segment.label || '').toLowerCase();

  if (label.startsWith('tijolo')) return 'Tijolo';
  if (label.startsWith('papel')) return 'Papel';
  if (label.startsWith('desenvolvimento')) return 'Desenvolvimento';

  // Caixa, ações, cotas de FIIs não identificadas e estratégias
  // mistas não entram nas metas dessas três categorias.
  return null;
}

export function distributeFiiExposure(fii) {
  if (!fii) return fii;

  const originalSubTypes = fii.subTypes || {};
  const subTypes = {};

  // Preserva as categorias existentes, inclusive eventuais
  // categorias sem ativos, sem modificar suas metas.
  for (const [category, data] of Object.entries(originalSubTypes)) {
    subTypes[category] = {
      ...data,
      value: 0,
      assets: [],
    };
  }

  function addExposure(category, asset, value, percent) {
    if (!subTypes[category]) {
      subTypes[category] = { value: 0, assets: [] };
    }

    subTypes[category].value += value;

    subTypes[category].assets.push({
      ...asset,
      sector: category,
      exposureValue: value,
      ...(percent == null ? {} : { exposurePercent: percent }),
    });
  }

  for (const [originalCategory, data] of Object.entries(originalSubTypes)) {
    for (const asset of data.assets || []) {
      const ticker = String(asset.ticker || '').toUpperCase();
      const marketValue = Number(asset.qty) * Number(asset.price);
      const composition = FII_COMPOSITIONS[ticker];

      if (!Number.isFinite(marketValue) || marketValue < 0) {
        throw new Error(`Valor inválido para ${ticker}`);
      }

      // FIIs sem composição detalhada continuam classificados
      // integralmente na categoria original.
      if (!composition) {
        addExposure(originalCategory, asset, marketValue, null);
        continue;
      }

      // FIIs com composição conhecida passam a contribuir
      // proporcionalmente para cada risco identificado.
      for (const segment of composition.segments) {
        const category = categoryForSegment(segment);

        if (!category || !BALANCING_CATEGORIES.has(category)) {
          continue;
        }

        const percent = Number(segment.percent);

        if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
          throw new Error(`Percentual inválido para ${ticker}`);
        }

        const allocatedValue = marketValue * (percent / 100);

        addExposure(category, asset, allocatedValue, percent);
      }
    }
  }

  // Apenas as três categorias reconhecidas participam
  // do denominador das metas de FIIs.
  const allocatedValue = [...BALANCING_CATEGORIES].reduce(
    (sum, category) => sum + (subTypes[category]?.value || 0),
    0
  );

  const unallocatedValue = fii.totalValue - allocatedValue;

  return {
    ...fii,
    subTypes,
    allocatedValue,
    unallocatedValue,
  };
}
