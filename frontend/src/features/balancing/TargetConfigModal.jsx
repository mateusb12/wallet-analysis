import React, { useState, useEffect } from 'react';
import {
  Settings,
  X,
  Save,
  RotateCcw,
  PieChart,
  Layers,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

const COLOR_MAP = {
  fii: { bg: 'bg-blue-500', text: 'text-blue-600', hex: '#3b82f6' },
  acoes: { bg: 'bg-violet-500', text: 'text-violet-600', hex: '#8b5cf6' },
  etf: { bg: 'bg-emerald-500', text: 'text-emerald-600', hex: '#10b981' },
  outros: { bg: 'bg-gray-400', text: 'text-gray-500', hex: '#9ca3af' },
};

const MICRO_PALETTE = [
  { bg: 'bg-sky-500', text: 'text-sky-600', hex: '#0ea5e9' },
  { bg: 'bg-indigo-500', text: 'text-indigo-600', hex: '#6366f1' },
  { bg: 'bg-teal-500', text: 'text-teal-600', hex: '#14b8a6' },
  { bg: 'bg-rose-500', text: 'text-rose-600', hex: '#f43f5e' },
  { bg: 'bg-amber-500', text: 'text-amber-600', hex: '#f59e0b' },
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
              {}
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

const RangeSlider = ({ label, value, onChange, colorStyles }) => {
  const activeColor = colorStyles?.hex || '#9ca3af';

  const emptyColor = '#374151';

  return (
    <div className="flex items-center gap-4 py-3 group">
      {}
      <div className="w-28 shrink-0">
        <label
          className="text-sm font-medium text-gray-700 dark:text-gray-300 capitalize truncate block"
          title={label}
        >
          {label}
        </label>
      </div>

      {}
      <div className="flex-1 relative h-6 flex items-center">
        <input
          type="range"
          min="0"
          max="100"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{
            background: `linear-gradient(to right, ${activeColor} 0%, ${activeColor} ${value}%, ${emptyColor} ${value}%, ${emptyColor} 100%)`,
          }}
          className={`
            w-full h-1.5 rounded-lg appearance-none cursor-pointer transition-all focus:outline-none focus:ring-0
            
            /* Estilização da Bolinha (Thumb) Webkit (Chrome/Edge/Safari) */
            [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:h-4
            [&::-webkit-slider-thumb]:w-4
            [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:bg-white
            [&::-webkit-slider-thumb]:shadow-md
            [&::-webkit-slider-thumb]:transition-transform
            [&::-webkit-slider-thumb]:hover:scale-110

            /* Estilização da Bolinha Firefox */
            [&::-moz-range-thumb]:h-4
            [&::-moz-range-thumb]:w-4
            [&::-moz-range-thumb]:rounded-full
            [&::-moz-range-thumb]:bg-white
            [&::-moz-range-thumb]:border-none
            [&::-moz-range-thumb]:shadow-md
          `}
        />
      </div>

      {}
      <div className="w-16 shrink-0 relative">
        <div className="flex items-center justify-center bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md px-2 py-1 group-focus-within:border-blue-400 group-focus-within:ring-2 group-focus-within:ring-blue-100 transition-all">
          <input
            type="number"
            value={value}
            onChange={(e) => onChange(Math.max(0, Math.min(100, Number(e.target.value))))}
            className="w-full bg-transparent text-center text-sm font-bold text-gray-700 dark:text-gray-200 focus:outline-none p-0"
          />
          <span className="text-xs text-gray-400 absolute right-1 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
            %
          </span>
        </div>
      </div>
    </div>
  );
};

const TargetConfigModal = ({ isOpen, onClose, currentTargets, onSave, onReset }) => {
  const [localTargets, setLocalTargets] = useState(currentTargets);

  const styleInjection = (
    <style>{`
      input[type=number]::-webkit-inner-spin-button, 
      input[type=number]::-webkit-outer-spin-button { 
        -webkit-appearance: none; 
        margin: 0; 
      }
      input[type=number] {
        -moz-appearance: textfield;
      }
      /* Custom Scrollbar para o Modal */
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
    `}</style>
  );

  useEffect(() => {
    if (currentTargets) {
      setLocalTargets(currentTargets);
    }
  }, [currentTargets, isOpen]);

  if (!isOpen || !localTargets) return null;

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
  const isMacroValid = totalMacro === 100;

  const renderTotalStatus = (total) => {
    if (total === 100) {
      return (
        <span className="flex items-center gap-1.5 text-sm font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
          <CheckCircle2 className="w-4 h-4" /> 100%
        </span>
      );
    }
    if (total > 100) {
      return (
        <span className="flex items-center gap-1.5 text-sm font-bold text-red-600 bg-red-50 px-3 py-1 rounded-full border border-red-100 animate-pulse">
          <AlertCircle className="w-4 h-4" /> {total}% (Excedido)
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1.5 text-sm font-bold text-amber-600 bg-amber-50 px-3 py-1 rounded-full border border-amber-100">
        <AlertCircle className="w-4 h-4" /> {total}% (Falta {100 - total}%)
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      {styleInjection}

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
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
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
                {Object.entries(localTargets.macro).map(([key, val]) => (
                  <RangeSlider
                    key={key}
                    label={key}
                    value={val}
                    onChange={(v) => handleMacroChange(key, v)}
                    colorStyles={COLOR_MAP[key.toLowerCase()] || COLOR_MAP.outros}
                  />
                ))}
              </div>
            </div>
          </section>

          {}
          <section className="space-y-6">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2 border-b border-gray-100 dark:border-gray-700 pb-2">
              <Layers className="w-4 h-4" /> Metas Específicas
            </h3>

            {Object.entries(localTargets.micro).map(([macroKey, subTypes]) => {
              const subTotal = Object.values(subTypes).reduce((a, b) => a + b, 0);
              const parentColors = COLOR_MAP[macroKey.toLowerCase()] || COLOR_MAP.outros;
              const isValid = subTotal === 100;

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
                        className={`text-xs font-mono px-2 py-0.5 rounded ${isValid ? 'text-gray-400 bg-gray-100' : 'text-red-500 bg-red-50 font-bold'}`}
                      >
                        Total: {subTotal}%
                      </span>
                    </div>

                    <div className="pl-2">
                      {Object.entries(subTypes).map(([subKey, val], idx) => {
                        const microColors = MICRO_PALETTE[idx % MICRO_PALETTE.length];
                        return (
                          <RangeSlider
                            key={subKey}
                            label={subKey}
                            value={val}
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
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-800 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Restaurar
          </button>

          <button
            onClick={() => onSave(localTargets)}
            disabled={!isMacroValid}
            className={`
              flex items-center gap-2 px-6 py-2 rounded-lg font-bold shadow-sm transition-all active:scale-95
              ${
                isMacroValid
                  ? 'bg-gray-900 hover:bg-black text-white dark:bg-white dark:text-black dark:hover:bg-gray-200'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }
            `}
          >
            <Save className="w-4 h-4" />
            {isMacroValid ? 'Salvar Configuração' : 'Corrija o Total'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TargetConfigModal;
