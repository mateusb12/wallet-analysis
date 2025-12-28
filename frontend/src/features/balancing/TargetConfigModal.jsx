import React, { useState, useEffect, useRef } from 'react';
import {
  Settings,
  X,
  Save,
  RotateCcw,
  PieChart,
  Layers,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from 'lucide-react';

const COLOR_MAP = {
  fii: { bg: 'bg-blue-500', text: 'text-blue-600', hex: '#3b82f6', bgLight: 'bg-blue-500/20' },
  acoes: {
    bg: 'bg-violet-500',
    text: 'text-violet-600',
    hex: '#8b5cf6',
    bgLight: 'bg-violet-500/20',
  },
  etf: {
    bg: 'bg-emerald-500',
    text: 'text-emerald-600',
    hex: '#10b981',
    bgLight: 'bg-emerald-500/20',
  },
  outros: { bg: 'bg-gray-400', text: 'text-gray-500', hex: '#9ca3af', bgLight: 'bg-gray-400/20' },
};

const MICRO_PALETTE = [
  { bg: 'bg-sky-500', text: 'text-sky-600', hex: '#0ea5e9', bgLight: 'bg-sky-500/20' },
  { bg: 'bg-indigo-500', text: 'text-indigo-600', hex: '#6366f1', bgLight: 'bg-indigo-500/20' },
  { bg: 'bg-teal-500', text: 'text-teal-600', hex: '#14b8a6', bgLight: 'bg-teal-500/20' },
  { bg: 'bg-rose-500', text: 'text-rose-600', hex: '#f43f5e', bgLight: 'bg-rose-500/20' },
  { bg: 'bg-amber-500', text: 'text-amber-600', hex: '#f59e0b', bgLight: 'bg-amber-500/20' },
];

const StackedBar = ({ data, colorMap, total }) => {
  return (
    <div className="relative w-full mb-6">
      <div className="h-4 w-full bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden flex shadow-inner">
        {Object.entries(data).map(([key, value], index) => {
          if (value <= 0) return null;

          const styles = colorMap[key.toLowerCase()] || MICRO_PALETTE[index % MICRO_PALETTE.length];
          const width = Math.min((value / Math.max(total, 100)) * 100, 100);

          return (
            <div
              key={key}
              style={{ width: `${width}%` }}
              className={`${styles.bg} h-full transition-all duration-300 relative group first:rounded-l-full last:rounded-r-full`}
            >
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-gray-900 text-white text-[10px] font-bold px-2 py-1 rounded shadow-lg whitespace-nowrap z-10 pointer-events-none">
                {key.toUpperCase()}: {value}%
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex justify-between px-1 mt-1 text-[10px] text-gray-300 font-mono select-none">
        <span>0%</span>
        <span>50%</span>
        <span>100%</span>
      </div>
    </div>
  );
};

const RangeSlider = ({ label, value, initialValue, maxPotential, onChange, colorStyles }) => {
  const isOverLimit = value > maxPotential;
  const safeValue = isOverLimit ? maxPotential : value;
  const safeWidth = `${Math.max(0, safeValue)}%`;

  const showRedPath = value < initialValue;
  const redPathLeft = `${value}%`;
  const redPathWidth = `${initialValue - value}%`;
  const excessLeft = `${maxPotential}%`;
  const excessWidth = `${value - maxPotential}%`;
  const potentialStart = showRedPath ? initialValue : value;
  const potentialLeft = `${potentialStart}%`;
  const potentialWidth = `${Math.max(0, maxPotential - potentialStart)}%`;

  return (
    <div className="flex items-center gap-4 py-3 group">
      <div className="w-28 shrink-0">
        <label
          className="text-sm font-medium text-gray-700 dark:text-gray-300 capitalize truncate block"
          title={label}
        >
          {label}
        </label>
      </div>

      <div className="flex-1 relative h-6 flex items-center">
        {}
        <div className="absolute inset-x-0 h-1.5 rounded-lg bg-gray-200 dark:bg-gray-700 overflow-hidden pointer-events-none">
          {!isOverLimit && (
            <div
              className={`absolute h-full transition-all duration-300 animate-super-pulse ${colorStyles.bg}`}
              style={{ left: potentialLeft, width: potentialWidth }}
            />
          )}
          {isOverLimit && (
            <div
              className="absolute h-full bg-red-600 transition-all duration-300 animate-super-pulse"
              style={{ left: excessLeft, width: excessWidth }}
            />
          )}
          {showRedPath && (
            <div
              className="absolute h-full bg-red-500/40 transition-all duration-300"
              style={{ left: redPathLeft, width: redPathWidth }}
            />
          )}
          <div
            className={`absolute h-full ${colorStyles.bg} transition-all duration-75`}
            style={{ width: safeWidth }}
          />
        </div>

        {}
        <input
          type="range"
          min="0"
          max="100"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full absolute z-10 opacity-0 cursor-pointer h-6 m-0 p-0"
        />

        {}
        <div
          className={`
            absolute h-4 w-4 bg-white rounded-full shadow-md border pointer-events-none transition-transform duration-75 ease-out z-20
            ${isOverLimit ? 'border-red-500 ring-2 ring-red-200' : 'border-gray-100'}
          `}
          style={{
            left: `calc(${value}% - 8px)`,
          }}
        />
      </div>

      {}
      <div className="w-16 shrink-0 relative">
        <div
          className={`
          flex items-center justify-center rounded-md px-2 py-1 transition-all border
          ${
            isOverLimit
              ? 'bg-red-50 border-red-300 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400'
              : 'bg-gray-50 border-gray-200 dark:bg-gray-900 dark:border-gray-700 group-focus-within:border-blue-400'
          }
        `}
        >
          <input
            type="number"
            value={value}
            onChange={(e) => onChange(Math.max(0, Math.min(100, Number(e.target.value))))}
            className={`
              w-full bg-transparent text-center text-sm font-bold focus:outline-none p-0
              ${isOverLimit ? 'text-red-700 dark:text-red-400' : 'text-gray-700 dark:text-gray-200'}
            `}
          />
          <span className="text-xs text-gray-400 absolute right-1 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
            %
          </span>
        </div>
      </div>
    </div>
  );
};

const TargetConfigModal = ({ isOpen, onClose, currentTargets, schema, onSave, onReset }) => {
  const [localTargets, setLocalTargets] = useState(null);
  const [initialSnapshot, setInitialSnapshot] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const hasInitialized = useRef(false);

  useEffect(() => {
    if (isOpen) {
      if (!hasInitialized.current && currentTargets) {
        setLocalTargets(JSON.parse(JSON.stringify(currentTargets)));
        setInitialSnapshot(JSON.parse(JSON.stringify(currentTargets)));
        hasInitialized.current = true;
      }
    } else {
      hasInitialized.current = false;
      setLocalTargets(null);
    }
  }, [isOpen, currentTargets]);

  if (!isOpen || !localTargets || !initialSnapshot) return null;

  const handleMacroChange = (key, value) => {
    setLocalTargets((prev) => ({
      ...prev,
      macro: { ...prev.macro, [key]: Number(value) },
    }));
  };

  const handleMicroChange = (macroKey, microKey, value) => {
    setLocalTargets((prev) => ({
      ...prev,
      micro: {
        ...prev.micro,
        [macroKey]: {
          ...prev.micro[macroKey],
          [microKey]: Number(value),
        },
      },
    }));
  };

  const totalMacro = Object.values(localTargets.macro).reduce((a, b) => a + b, 0);
  const remainingMacroSpace = 100 - totalMacro;
  const isMacroValid = totalMacro === 100;

  const handleSaveClick = async () => {
    if (!isMacroValid) return;

    setIsSaving(true);
    try {
      await onSave(localTargets);
    } catch (error) {
      console.error('❌ Erro no Modal ao tentar salvar:', error);
      alert('Erro ao salvar. Verifique o console.');
    } finally {
      setIsSaving(false);
    }
  };

  const renderTotalStatus = (total) => {
    const baseClasses =
      'flex items-center gap-1.5 text-sm font-bold px-3 py-1 rounded-full border transition-colors';

    if (total === 100) {
      return (
        <span
          className={`${baseClasses} text-emerald-600 bg-emerald-50 border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20`}
        >
          <CheckCircle2 className="w-4 h-4" /> 100%
        </span>
      );
    }
    if (total > 100) {
      return (
        <span
          className={`${baseClasses} text-red-600 bg-red-50 border-red-100 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20 animate-pulse`}
        >
          <AlertCircle className="w-4 h-4" /> {total}% (Excedido)
        </span>
      );
    }
    return (
      <span
        className={`${baseClasses} text-amber-600 bg-amber-50 border-amber-100 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20`}
      >
        <AlertCircle className="w-4 h-4" /> {total}% (Falta {100 - total}%)
      </span>
    );
  };

  const sourceData = schema ? Object.entries(schema) : Object.entries(localTargets.micro);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <style>{`
        input[type=number]::-webkit-inner-spin-button, 
        input[type=number]::-webkit-outer-spin-button { 
          -webkit-appearance: none; 
          margin: 0; 
        }
        input[type=number] {
          -moz-appearance: textfield;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: #4b5563;
          border-radius: 20px;
        }
        @keyframes super-pulse {
          0%, 100% { opacity: 0.3; filter: brightness(1); }
          50% { opacity: 1; filter: brightness(1.3); }
        }
        .animate-super-pulse { animation: super-pulse 1s ease-in-out infinite; }
      `}</style>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden border border-gray-100 dark:border-gray-700">
        {}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-white dark:bg-gray-800 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
              <Settings className="w-5 h-5 text-gray-400" />
              Configurar Metas
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={isSaving}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {}
        <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
          {}
          <section className="space-y-4">
            <div className="flex justify-between items-end">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                <PieChart className="w-4 h-4" /> Alocação Macro
              </h3>
              {renderTotalStatus(totalMacro)}
            </div>
            <div className="bg-gray-50/50 dark:bg-gray-900/30 p-5 rounded-xl border border-gray-100 dark:border-gray-700">
              <StackedBar data={localTargets.macro} colorMap={COLOR_MAP} total={totalMacro} />
              <div className="space-y-1 divide-y divide-gray-100 dark:divide-gray-700/50">
                {Object.entries(localTargets.macro).map(([key, val]) => {
                  const maxPotential = val + remainingMacroSpace;
                  const initialVal = initialSnapshot.macro[key] || 0;
                  return (
                    <RangeSlider
                      key={key}
                      label={key}
                      value={val}
                      initialValue={initialVal}
                      maxPotential={maxPotential}
                      onChange={(v) => handleMacroChange(key, v)}
                      colorStyles={COLOR_MAP[key.toLowerCase()] || COLOR_MAP.outros}
                    />
                  );
                })}
              </div>
            </div>
          </section>

          {}
          <section className="space-y-6">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2 border-b border-gray-100 dark:border-gray-700 pb-2">
              <Layers className="w-4 h-4" /> Metas Específicas
            </h3>

            {sourceData.map((entry) => {
              const macroKey = entry[0];

              let categoriesList = [];
              if (schema) {
                categoriesList = entry[1].categories;
              } else {
                categoriesList = Object.keys(entry[1]);
              }

              const currentValues = localTargets.micro[macroKey] || {};
              const subTotal = Object.values(currentValues).reduce(
                (a, b) => a + (typeof b === 'number' ? b : 0),
                0
              );
              const remainingSubSpace = 100 - subTotal;
              const parentColors = COLOR_MAP[macroKey.toLowerCase()] || COLOR_MAP.outros;
              const isValid = subTotal === 100;

              if (!localTargets.micro[macroKey] && schema) return null;

              return (
                <div key={macroKey} className="group relative">
                  <div
                    className={`absolute left-0 top-0 bottom-0 w-1 rounded-full ${parentColors.bg} opacity-20 group-hover:opacity-100 transition-opacity`}
                  />
                  <div className="pl-6 py-2">
                    <div className="flex justify-between items-center mb-3">
                      <h4
                        className={`font-semibold text-lg capitalize flex items-center gap-2 ${parentColors.text}`}
                      >
                        {macroKey}
                      </h4>
                      <span
                        className={`text-xs font-mono px-2 py-0.5 rounded transition-colors ${isValid ? 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300' : 'bg-red-50 text-red-600 font-bold animate-pulse'}`}
                      >
                        Total: {subTotal}%
                      </span>
                    </div>
                    <div className="pl-2">
                      {categoriesList.map((subKey, idx) => {
                        const microColors = MICRO_PALETTE[idx % MICRO_PALETTE.length];
                        const val = currentValues[subKey] || 0;

                        const maxPotential = val + remainingSubSpace;
                        const initialVal = initialSnapshot.micro[macroKey]?.[subKey] || 0;

                        return (
                          <RangeSlider
                            key={subKey}
                            label={subKey}
                            value={val}
                            initialValue={initialVal}
                            maxPotential={maxPotential}
                            onChange={(v) => handleMicroChange(macroKey, subKey, v)}
                            colorStyles={microColors}
                          />
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </section>
        </div>

        {}
        <div className="p-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 flex justify-between shrink-0">
          <button
            onClick={onReset}
            disabled={isSaving}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-800 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
          >
            <RotateCcw className="w-4 h-4" /> Restaurar
          </button>
          <button
            onClick={handleSaveClick}
            disabled={!isMacroValid || isSaving}
            className={`flex items-center gap-2 px-6 py-2 rounded-lg font-bold shadow-sm transition-all active:scale-95 ${isMacroValid ? 'bg-gray-900 hover:bg-black text-white dark:bg-white dark:text-black' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Salvando...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" /> Salvar
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TargetConfigModal;
