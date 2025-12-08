import React from 'react';
import { AlertTriangle } from 'lucide-react';

export default function DataConsistencyAlert({ warnings = [], className = '' }) {
  if (!warnings || warnings.length === 0) return null;

  return (
    <div
      className={`p-4 bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 rounded-r-lg flex items-start gap-3 shadow-sm ${className}`}
    >
      <div className="text-yellow-500 mt-0.5">
        <AlertTriangle className="w-5 h-5" />
      </div>
      <div className="flex-1">
        <h3 className="text-sm font-bold text-yellow-800 dark:text-yellow-200">
          Inconsistência de Dados Detectada
        </h3>
        <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
          Os seguintes ativos ou índices estão desatualizados (sem dados de Dezembro), o que pode
          distorcer os cálculos de rentabilidade:
        </p>
        <div className="flex flex-wrap gap-2 mt-2">
          {warnings.map((ticker) => (
            <span
              key={ticker}
              className="px-2 py-1 bg-yellow-100 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-100 text-xs rounded font-mono font-bold border border-yellow-200 dark:border-yellow-700"
            >
              {ticker}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
