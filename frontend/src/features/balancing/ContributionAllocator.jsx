import React, { useState, useEffect } from 'react';
import {
  ArrowRight,
  Coins,
  Calculator,
  Target,
  Lightbulb,
  Sparkles,
  AlertCircle,
} from 'lucide-react';

const FormatCurrency = (value) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const FormatPercent = (value) => {
  const num = parseFloat(value);
  if (isNaN(num)) return '0.0%';
  return `${num.toFixed(1)}%`;
};

const ContributionAllocator = ({ tree, targets }) => {
  const [amount, setAmount] = useState(1000);
  const [allocationPlan, setAllocationPlan] = useState([]);

  const calculatePlan = () => {
    if (!tree || !targets || amount <= 0) return;

    let macroDeficits = [];
    let totalMacroDeficit = 0;

    const currentTotalValue = Object.values(tree).reduce((acc, curr) => acc + curr.totalValue, 0);
    const projectedTotal = currentTotalValue + parseFloat(amount);

    Object.entries(tree).forEach(([macroKey, data]) => {
      const targetPct =
        targets.macro && targets.macro[macroKey] ? parseFloat(targets.macro[macroKey]) : 0;
      if (targetPct === 0) return;

      const currentPct = currentTotalValue > 0 ? (data.totalValue / currentTotalValue) * 100 : 0;

      const idealValue = projectedTotal * (targetPct / 100);
      const currentValue = data.totalValue;
      const deficit = idealValue - currentValue;

      if (deficit > 0) {
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
      const allocationShare = macroItem.deficit / totalMacroDeficit;
      const moneyForMacro = parseFloat(amount) * allocationShare;

      const existingSubTypes = macroItem.data.subTypes || {};
      const targetSubTypes =
        targets.micro && targets.micro[macroItem.key] ? targets.micro[macroItem.key] : {};

      const allSubKeys = Array.from(
        new Set([...Object.keys(existingSubTypes), ...Object.keys(targetSubTypes)])
      );

      let microDeficits = [];
      let totalMicroDeficit = 0;

      allSubKeys.forEach((subKey) => {
        const microTargetPct = targetSubTypes[subKey] ? parseFloat(targetSubTypes[subKey]) : 0;

        const subData = existingSubTypes[subKey] || { value: 0, assets: [] };

        const parentTotal = macroItem.data.totalValue;
        const currentMicroPct = parentTotal > 0 ? (subData.value / parentTotal) * 100 : 0;

        if (microTargetPct === 0) return;

        const projectedMacroTotal = parentTotal + moneyForMacro;
        const idealMicroVal = projectedMacroTotal * (microTargetPct / 100);

        const microDeficit = idealMicroVal - subData.value;

        if (microDeficit > 0) {
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

      if (microAllocations.length === 0 && moneyForMacro > 0) {
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
  }, [amount, tree, targets]);

  const handleAmountChange = (e) => {
    const val = parseFloat(e.target.value);
    setAmount(isNaN(val) ? 0 : val);
  };

  if (!tree) return null;

  return (
    <div className="mt-8 bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm animate-in fade-in slide-in-from-bottom-8 duration-500">
      {}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 border-b border-gray-100 dark:border-gray-700 pb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl text-emerald-600 dark:text-emerald-400">
            <Calculator className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">
              Simulador de Aporte
            </h3>
            <p className="text-sm text-gray-500">
              Distribuição matemática baseada nas lacunas (Gaps) da carteira.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold uppercase text-gray-400 tracking-wider">
            Valor do Aporte
          </label>
          <div className="relative group">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-semibold group-focus-within:text-emerald-500 transition-colors">
              R$
            </span>
            <input
              type="number"
              value={amount}
              onChange={handleAmountChange}
              className="pl-10 pr-4 py-2 w-48 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-800 dark:text-gray-100 font-bold focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
            />
          </div>
        </div>
      </div>

      <div className="space-y-8">
        {allocationPlan.length === 0 ? (
          <div className="text-center py-8 text-gray-400 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
            <Target className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p className="font-medium">Nenhum desequilíbrio crítico encontrado.</p>
            <p className="text-sm opacity-70">
              Sua carteira está alinhada com as metas. Aporte livre!
            </p>
          </div>
        ) : (
          allocationPlan.map((plan) => (
            <div key={plan.macro} className="flex flex-col gap-3">
              {}
              <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-gray-100 dark:border-gray-700/50">
                <div className="flex items-center gap-3">
                  <span className="capitalize font-bold text-lg text-gray-800 dark:text-gray-100">
                    {plan.macro === 'acoes' ? 'Ações' : plan.macro}
                  </span>

                  {}
                  <div className="hidden sm:flex items-center gap-2 text-xs font-mono bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-gray-600 dark:text-gray-300">
                    <span>Atual: {FormatPercent(plan.currentPct)}</span>
                    <ArrowRight className="w-3 h-3 text-gray-400" />
                    <span>Meta: {FormatPercent(plan.targetPct)}</span>
                    <span className="text-red-400 ml-1 font-bold">
                      (Gap: {FormatPercent(plan.targetPct - plan.currentPct)})
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 uppercase font-bold tracking-wider">
                    Aporte nesta classe:
                  </span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold text-lg bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1 rounded-lg border border-emerald-100 dark:border-emerald-800">
                    {FormatCurrency(plan.totalAllocated)}
                  </span>
                </div>
              </div>

              {}
              <div className="sm:hidden text-xs flex justify-between text-gray-500 font-mono px-1">
                <span>
                  {FormatPercent(plan.currentPct)} → {FormatPercent(plan.targetPct)}
                </span>
                <span className="text-red-500">
                  Gap: {FormatPercent(plan.targetPct - plan.currentPct)}
                </span>
              </div>

              {}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {plan.breakdown.map((item, idx) => {
                  const isNewCategory = !item.assets || item.assets.length === 0;

                  return (
                    <div
                      key={idx}
                      className={`
                        flex flex-col h-full rounded-xl border transition-all shadow-sm hover:shadow-md group relative overflow-hidden
                        ${
                          isNewCategory
                            ? 'bg-amber-50/50 dark:bg-amber-900/10 border-amber-300 dark:border-amber-700'
                            : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-emerald-400 dark:hover:border-emerald-500/50'
                        }
                      `}
                    >
                      {}
                      <div
                        className={`absolute left-0 top-0 bottom-0 w-1 ${
                          isNewCategory ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                      />

                      <div className="p-4 flex flex-col h-full">
                        {}
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h5 className="font-bold text-gray-700 dark:text-gray-200 text-sm flex items-center gap-2">
                              {item.subType}
                              {isNewCategory && (
                                <span className="bg-amber-100 text-amber-700 text-[9px] px-1.5 py-0.5 rounded border border-amber-200 uppercase tracking-wide">
                                  Novo
                                </span>
                              )}
                            </h5>

                            {}
                            {item.targetPct > 0 && (
                              <div className="mt-1 flex items-center gap-1.5 text-[10px] font-mono text-gray-500 dark:text-gray-400">
                                <span className="bg-gray-100 dark:bg-gray-700 px-1 rounded">
                                  {FormatPercent(item.currentPct)}
                                </span>
                                <ArrowRight className="w-3 h-3 text-gray-300" />
                                <span className="bg-gray-100 dark:bg-gray-700 px-1 rounded text-gray-700 dark:text-gray-200 font-bold">
                                  {FormatPercent(item.targetPct)}
                                </span>
                              </div>
                            )}
                          </div>

                          <div className="text-right">
                            <span
                              className={`block text-lg font-bold ${
                                isNewCategory
                                  ? 'text-amber-600 dark:text-amber-400'
                                  : 'text-emerald-600 dark:text-emerald-400'
                              }`}
                            >
                              {FormatCurrency(item.amount)}
                            </span>
                            <span
                              className={`text-[10px] font-semibold uppercase tracking-wider ${
                                isNewCategory ? 'text-amber-600/60' : 'text-emerald-600/60'
                              }`}
                            >
                              Sugerido
                            </span>
                          </div>
                        </div>

                        {}
                        <div className="h-px bg-gray-100 dark:bg-gray-700 mb-3 w-full" />

                        {}
                        <div className="mt-auto">
                          {isNewCategory ? (
                            <div className="bg-amber-100 dark:bg-amber-900/30 p-3 rounded-lg border border-amber-200 dark:border-amber-700/50">
                              <div className="flex items-start gap-2">
                                <Lightbulb className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                                <div>
                                  <p className="text-xs font-bold text-amber-700 dark:text-amber-300 mb-1">
                                    Iniciar Posição
                                  </p>
                                  <p className="text-xs text-amber-800/80 dark:text-amber-200/80 leading-relaxed">
                                    Coloque <strong>{FormatCurrency(item.amount)}</strong> aqui em{' '}
                                    <strong>{item.subType}</strong>. Pode escolher qualquer ativo
                                    desta categoria para começar.
                                  </p>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <>
                              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                                <Coins className="w-3 h-3" />
                                Onde Alocar (Sua Carteira):
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {item.assets.map((asset) => (
                                  <div
                                    key={asset.ticker}
                                    className="px-2 py-1.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded text-xs font-bold text-gray-600 dark:text-gray-300 cursor-help hover:text-white hover:bg-emerald-500 hover:border-emerald-500 transition-all text-center min-w-[60px]"
                                    title={`Preço Médio: ${FormatCurrency(
                                      asset.price
                                    )} | Qtd: ${asset.qty}`}
                                  >
                                    {asset.ticker}
                                  </div>
                                ))}
                              </div>
                            </>
                          )}
                        </div>
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
