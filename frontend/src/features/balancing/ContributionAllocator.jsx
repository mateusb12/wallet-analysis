import React, { useState, useEffect } from 'react';
import {
  ArrowRight,
  Calculator,
  Target,
  Sparkles,
  PlusCircle,
  TrendingUp,
  AlertCircle,
  Banknote,
  Maximize,
  Sliders,
} from 'lucide-react';

const FormatCurrency = (value) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const FormatPercent = (value) => {
  const num = parseFloat(value);
  if (isNaN(num)) return '0.0%';
  return `${num.toFixed(1)}%`;
};

const ContributionAllocator = ({ tree, targets }) => {
  const [mode, setMode] = useState('smart');
  const [amount, setAmount] = useState(1000);
  const [calculatedTopUpAmount, setCalculatedTopUpAmount] = useState(0);
  const [allocationPlan, setAllocationPlan] = useState([]);

  const calculatePlan = () => {
    if (!tree || !targets) return;

    const currentTotalValue = Object.values(tree).reduce((acc, curr) => acc + curr.totalValue, 0);

    let projectedTotal = 0;
    let effectiveAmount = 0;

    if (mode === 'smart') {
      effectiveAmount = amount <= 0 ? 0 : parseFloat(amount);
      projectedTotal = currentTotalValue + effectiveAmount;
    } else {
      let maxImpliedTotal = currentTotalValue;

      Object.entries(tree).forEach(([macroKey, data]) => {
        const targetPct =
          targets.macro && targets.macro[macroKey] ? parseFloat(targets.macro[macroKey]) / 100 : 0;
        if (targetPct > 0 && data.totalValue > 0) {
          const impliedForThisMacro = data.totalValue / targetPct;
          if (impliedForThisMacro > maxImpliedTotal) {
            maxImpliedTotal = impliedForThisMacro;
          }
        }
      });

      projectedTotal = maxImpliedTotal;
      effectiveAmount = projectedTotal - currentTotalValue;

      setCalculatedTopUpAmount(effectiveAmount);
    }

    let macroDeficits = [];
    let totalMacroDeficit = 0;

    Object.entries(tree).forEach(([macroKey, data]) => {
      const targetPct =
        targets.macro && targets.macro[macroKey] ? parseFloat(targets.macro[macroKey]) : 0;
      if (targetPct === 0) return;

      const currentPct = currentTotalValue > 0 ? (data.totalValue / currentTotalValue) * 100 : 0;

      const idealValue = projectedTotal * (targetPct / 100);
      const currentValue = data.totalValue;

      const deficit = idealValue - currentValue;

      if (deficit > 0.01) {
        macroDeficits.push({
          key: macroKey,
          deficit,
          currentPct: currentPct || 0,
          targetPct: targetPct || 0,
          data,
        });
        totalMacroDeficit += deficit;
      }
    });

    if (totalMacroDeficit === 0) {
      setAllocationPlan([]);
      return;
    }

    const plan = macroDeficits.map((macroItem) => {
      let moneyForMacro = 0;

      if (mode === 'topup') {
        moneyForMacro = macroItem.deficit;
      } else {
        const allocationShare = macroItem.deficit / totalMacroDeficit;
        moneyForMacro = effectiveAmount * allocationShare;
      }

      const existingSubTypes = macroItem.data.subTypes || {};
      const targetSubTypes =
        targets.micro && targets.micro[macroItem.key] ? targets.micro[macroItem.key] : {};

      const allSubKeys = Array.from(
        new Set([...Object.keys(existingSubTypes), ...Object.keys(targetSubTypes)])
      );

      let microDeficits = [];
      let totalMicroDeficit = 0;

      const projectedMacroTotal = macroItem.data.totalValue + moneyForMacro;

      allSubKeys.forEach((subKey) => {
        const microTargetPct = targetSubTypes[subKey] ? parseFloat(targetSubTypes[subKey]) : 0;
        const subData = existingSubTypes[subKey] || { value: 0, assets: [] };

        const parentTotal = macroItem.data.totalValue;
        const currentMicroPct = parentTotal > 0 ? (subData.value / parentTotal) * 100 : 0;

        if (microTargetPct === 0) return;

        const idealMicroVal = projectedMacroTotal * (microTargetPct / 100);
        const microDeficit = idealMicroVal - subData.value;

        if (microDeficit > 0.01) {
          microDeficits.push({
            key: subKey,
            deficit: microDeficit,
            currentPct: currentMicroPct || 0,
            targetPct: microTargetPct || 0,
            assets: subData.assets || [],
          });
          totalMicroDeficit += microDeficit;
        }
      });

      const microAllocations = microDeficits
        .map((microItem) => {
          const microShare = totalMicroDeficit > 0 ? microItem.deficit / totalMicroDeficit : 0;
          return {
            subType: microItem.key,
            amount: moneyForMacro * microShare,
            currentPct: microItem.currentPct || 0,
            targetPct: microItem.targetPct || 0,
            assets: microItem.assets,
          };
        })
        .filter((m) => m.amount > 1);

      if (microAllocations.length === 0 && moneyForMacro > 1) {
        microAllocations.push({
          subType: 'Rebalanceamento Geral',
          amount: moneyForMacro,
          currentPct: 0,
          targetPct: 0,
          assets: [],
        });
      }

      return {
        macro: macroItem.key,
        totalAllocated: moneyForMacro,
        currentPct: macroItem.currentPct || 0,
        targetPct: macroItem.targetPct || 0,
        breakdown: microAllocations,
      };
    });

    setAllocationPlan(plan.sort((a, b) => b.totalAllocated - a.totalAllocated));
  };

  useEffect(() => {
    calculatePlan();
  }, [amount, tree, targets, mode]);

  const handleAmountChange = (e) => {
    const val = parseFloat(e.target.value);
    setAmount(isNaN(val) ? 0 : val);
  };

  if (!tree) return null;

  return (
    <div className="mt-8 bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm animate-in fade-in slide-in-from-bottom-8 duration-500">
      {}
      <div className="flex flex-col gap-6 mb-8 border-b border-gray-100 dark:border-gray-700 pb-6">
        {}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div
              className={`p-3 rounded-2xl ring-4 transition-colors ${
                mode === 'smart'
                  ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 ring-emerald-50 dark:ring-emerald-900/10'
                  : 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 ring-indigo-50 dark:ring-indigo-900/10'
              }`}
            >
              {mode === 'smart' ? (
                <Calculator className="w-6 h-6" />
              ) : (
                <Maximize className="w-6 h-6" />
              )}
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">
                {mode === 'smart' ? 'Simulador Inteligente' : 'Completar Carteira (Top-up)'}
              </h3>
              <p className="text-sm text-gray-500">
                {mode === 'smart'
                  ? 'Distribui seu aporte para equilibrar as porcentagens.'
                  : 'Calcula quanto aportar para atingir os alvos sem vender.'}
              </p>
            </div>
          </div>

          {}
          <div className="flex p-1 bg-gray-100 dark:bg-gray-900 rounded-xl">
            <button
              onClick={() => setMode('smart')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                mode === 'smart'
                  ? 'bg-white dark:bg-gray-800 text-emerald-600 dark:text-emerald-400 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <Sliders className="w-4 h-4" />
              Simular
            </button>
            <button
              onClick={() => setMode('topup')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                mode === 'topup'
                  ? 'bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              Top-up
            </button>
          </div>
        </div>

        {}
        <div className="flex justify-end">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold uppercase text-gray-400 tracking-wider text-right">
              {mode === 'smart' ? 'Valor do Aporte' : 'Necessário para Equilíbrio'}
            </label>
            <div className="relative group">
              <span
                className={`absolute left-3 top-1/2 -translate-y-1/2 font-medium transition-colors ${
                  mode === 'smart'
                    ? 'text-gray-400 group-focus-within:text-emerald-500'
                    : 'text-indigo-400'
                }`}
              >
                R$
              </span>
              <input
                type="number"
                value={mode === 'smart' ? amount : calculatedTopUpAmount.toFixed(2)}
                onChange={handleAmountChange}
                disabled={mode === 'topup'}
                className={`pl-9 pr-4 py-2.5 w-48 border rounded-xl font-bold text-lg outline-none transition-all shadow-sm ${
                  mode === 'smart'
                    ? 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-600 text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500'
                    : 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-100 dark:border-indigo-800 text-indigo-600 dark:text-indigo-300 cursor-not-allowed'
                }`}
              />
            </div>
            {mode === 'topup' && (
              <span className="text-[10px] text-indigo-500/70 text-right font-medium">
                Cálculo automático baseado nos desvios
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-10">
        {allocationPlan.length === 0 ? (
          <div className="text-center py-12 bg-gray-50/50 dark:bg-gray-900/30 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700">
            <div className="bg-gray-100 dark:bg-gray-800 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <Target className="w-8 h-8 text-gray-400" />
            </div>
            <p className="font-semibold text-gray-600 dark:text-gray-300 text-lg">
              Carteira Equilibrada
            </p>
            <p className="text-sm text-gray-400 mt-1">
              {mode === 'smart'
                ? 'Nenhum desequilíbrio crítico para o valor informado.'
                : 'Suas porcentagens atuais já respeitam os alvos mínimos.'}
            </p>
          </div>
        ) : (
          allocationPlan.map((plan) => (
            <div key={plan.macro} className="flex flex-col gap-5">
              {}
              <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-3">
                  <span
                    className={`w-2 h-8 rounded-r-full ${
                      mode === 'smart' ? 'bg-emerald-500' : 'bg-indigo-500'
                    }`}
                  ></span>
                  <div>
                    <span className="capitalize font-bold text-xl text-gray-800 dark:text-gray-100 block leading-none">
                      {plan.macro === 'acoes' ? 'Ações' : plan.macro}
                    </span>
                    <span className="text-xs text-gray-400 font-medium mt-1 block">
                      Meta da Classe: {FormatPercent(plan.targetPct)}
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-0.5">
                    Alocar nesta classe
                  </span>
                  <span
                    className={`font-bold text-xl ${
                      mode === 'smart'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-indigo-600 dark:text-indigo-400'
                    }`}
                  >
                    {FormatCurrency(plan.totalAllocated)}
                  </span>
                </div>
              </div>

              {}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {plan.breakdown.map((item, idx) => {
                  const isNewCategory = !item.assets || item.assets.length === 0;

                  const cheapestAssetPrice =
                    item.assets && item.assets.length > 0
                      ? Math.min(...item.assets.map((a) => a.price))
                      : 0;

                  const isUnaffordable =
                    !isNewCategory && cheapestAssetPrice > 0 && item.amount < cheapestAssetPrice;

                  let cardStyle =
                    mode === 'smart'
                      ? 'border-gray-200 dark:border-gray-700 hover:border-emerald-300 dark:hover:border-emerald-600 hover:shadow-lg hover:shadow-emerald-500/5 dark:hover:shadow-none bg-white dark:bg-gray-800'
                      : 'border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-600 hover:shadow-lg hover:shadow-indigo-500/5 dark:hover:shadow-none bg-white dark:bg-gray-800';

                  let valueColor =
                    mode === 'smart'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-indigo-600 dark:text-indigo-400';

                  if (isNewCategory) {
                    cardStyle =
                      'border-amber-200 dark:border-amber-800/50 hover:border-amber-300 shadow-amber-100/50 dark:shadow-none bg-white dark:bg-gray-800';
                    valueColor = 'text-amber-600 dark:text-amber-500';
                  } else if (isUnaffordable) {
                    cardStyle =
                      'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 opacity-90';
                    valueColor = 'text-slate-500 dark:text-slate-400';
                  }

                  return (
                    <div
                      key={idx}
                      className={`
                        relative flex flex-col justify-between p-5 rounded-2xl border transition-all duration-200
                        ${cardStyle}
                      `}
                    >
                      {isNewCategory && (
                        <div className="absolute -top-3 -right-2 bg-amber-100 dark:bg-amber-900 border border-amber-200 dark:border-amber-700 text-amber-700 dark:text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                          <Sparkles className="w-3 h-3" />
                          NOVA POSIÇÃO
                        </div>
                      )}

                      <div>
                        <div className="flex justify-between items-start mb-1">
                          <h5
                            className={`font-bold text-base truncate pr-2 ${
                              isNewCategory
                                ? 'text-amber-900 dark:text-amber-100'
                                : isUnaffordable
                                  ? 'text-slate-600 dark:text-slate-300'
                                  : 'text-gray-700 dark:text-gray-200'
                            }`}
                          >
                            {item.subType}
                          </h5>
                        </div>

                        <div className="flex items-center gap-2 mb-4">
                          <div
                            className={`flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-md ${isUnaffordable ? 'bg-slate-200/50 dark:bg-slate-700/50 text-slate-500' : 'bg-gray-50 dark:bg-gray-700/50 text-gray-400'}`}
                          >
                            <span>{FormatPercent(item.currentPct)}</span>
                            <ArrowRight className="w-3 h-3 text-gray-300" />
                            <span
                              className={`${
                                isNewCategory
                                  ? 'text-amber-600'
                                  : isUnaffordable
                                    ? 'text-slate-500'
                                    : 'text-gray-600 dark:text-gray-300'
                              }`}
                            >
                              {FormatPercent(item.targetPct)}
                            </span>
                          </div>
                        </div>

                        <div className="mb-4">
                          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">
                            Sugerido
                          </span>
                          <span className={`text-2xl font-bold tracking-tight ${valueColor}`}>
                            {FormatCurrency(item.amount)}
                          </span>
                        </div>

                        {}
                        {isUnaffordable && (
                          <div className="mb-4 bg-slate-100 dark:bg-slate-700/50 rounded-lg p-2.5 flex items-start gap-2 border border-slate-200 dark:border-slate-600">
                            <AlertCircle className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                            <div>
                              <p className="text-[11px] font-bold text-slate-600 dark:text-slate-300 leading-tight">
                                Aporte Insuficiente
                              </p>
                              <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight mt-0.5">
                                O preço mínimo é{' '}
                                <span className="font-mono font-bold">
                                  {FormatCurrency(cheapestAssetPrice)}
                                </span>
                                . Acumule para o próximo mês.
                              </p>
                            </div>
                          </div>
                        )}
                      </div>

                      <div
                        className={`h-px w-full mb-4 ${
                          isNewCategory
                            ? 'bg-amber-100 dark:bg-amber-900/30'
                            : isUnaffordable
                              ? 'bg-slate-200 dark:bg-slate-700'
                              : 'bg-gray-100 dark:bg-gray-700'
                        }`}
                      ></div>

                      <div>
                        {isNewCategory ? (
                          <div className="group cursor-pointer rounded-lg border border-dashed border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 py-2.5 flex items-center justify-center gap-2 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors">
                            <PlusCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                            <span className="text-xs font-bold text-amber-700 dark:text-amber-300">
                              Escolher Ativo
                            </span>
                          </div>
                        ) : (
                          <div>
                            <div
                              className={`flex items-center gap-1.5 mb-2 text-[10px] font-bold uppercase ${isUnaffordable ? 'text-slate-400' : 'text-gray-400'}`}
                            >
                              <TrendingUp className="w-3 h-3" />
                              <span>Onde Alocar:</span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {item.assets.map((asset) => {
                                const assetIsTooExpensive = asset.price > item.amount;

                                const activeClass =
                                  mode === 'smart'
                                    ? 'hover:text-white hover:bg-emerald-500 hover:border-emerald-500'
                                    : 'hover:text-white hover:bg-indigo-500 hover:border-indigo-500';

                                return (
                                  <div
                                    key={asset.ticker}
                                    className={`
                                    px-2.5 py-1.5 border rounded-md text-xs font-bold cursor-help transition-all min-w-[60px] text-center shadow-sm flex items-center gap-1.5
                                    ${
                                      assetIsTooExpensive && isUnaffordable
                                        ? 'bg-slate-100 dark:bg-slate-700/50 border-slate-200 dark:border-slate-600 text-slate-400 dark:text-slate-500'
                                        : `bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 ${activeClass}`
                                    }
                                  `}
                                    title={`Preço Atual: ${FormatCurrency(asset.price)} | Qtd na Carteira: ${asset.qty}`}
                                  >
                                    {asset.ticker}
                                    {assetIsTooExpensive && isUnaffordable && (
                                      <span className="text-[9px] font-normal opacity-70 border-l border-slate-300 pl-1.5 ml-0.5">
                                        {FormatCurrency(asset.price)}
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ContributionAllocator;
