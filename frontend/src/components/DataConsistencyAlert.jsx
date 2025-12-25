import React from 'react';
import { AlertTriangle, CalendarClock } from 'lucide-react';

export default function DataConsistencyAlert({ warnings = [], className = '' }) {
  if (!warnings || warnings.length === 0) return null;

  return (
    <div
      className={`p-4 bg-yellow-50 dark:bg-yellow-900/10 border-l-4 border-yellow-400 rounded-r-lg flex items-start gap-3 shadow-sm ${className}`}
    >
      <div className="text-yellow-600 dark:text-yellow-500 mt-0.5">
        {}
        <CalendarClock className="w-5 h-5" />
      </div>
      <div className="flex-1">
        <h3 className="text-sm font-bold text-yellow-800 dark:text-yellow-200">
          Sincronização de Mercado
        </h3>
        <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1 leading-relaxed">
          Os itens abaixo mostram datas anteriores a hoje.
          <span className="block mt-1 opacity-90 italic">
            Nota: A bolsa (B3/NYSE) fecha em <strong>fins de semana e feriados</strong>. É normal
            que a data permaneça no último dia útil (ex: Sexta-feira).
          </span>
        </p>

        {}
        <div className="flex flex-wrap gap-2 mt-3">
          {warnings.map((tickerStr) => {
            const [ticker, ...reason] = tickerStr.split('(');

            return (
              <div
                key={tickerStr}
                className="flex items-center gap-2 px-2 py-1 bg-yellow-100 dark:bg-yellow-800/40 text-yellow-900 dark:text-yellow-100 text-xs rounded border border-yellow-200 dark:border-yellow-700/50"
              >
                <span className="font-bold font-mono">{ticker.trim()}</span>
                {reason.length > 0 && (
                  <span className="opacity-70 text-[10px] border-l border-yellow-300 dark:border-yellow-600 pl-2">
                    {reason.join('(').replace(')', '')}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
