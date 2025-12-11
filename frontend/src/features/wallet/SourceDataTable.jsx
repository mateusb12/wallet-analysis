import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, Database, FileSpreadsheet } from 'lucide-react';
import { formatChartDate } from '../../utils/dateUtils';

const formatCurrency = (val) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

const formatDecimal = (val, digits = 2) =>
  new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(val);

export default function SourceDataTable({
  data,
  benchmarkName,
  isSpecificAsset,
  assetTicker,
  highlightDate,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  if (!data || data.length === 0) return null;

  const sortedData = [...data].sort((a, b) => new Date(b.trade_date) - new Date(a.trade_date));

  useEffect(() => {
    if (highlightDate && sortedData.length > 0) {
      const index = sortedData.findIndex((row) => row.trade_date === highlightDate);

      if (index !== -1) {
        setIsOpen(true);

        const targetPage = Math.floor(index / rowsPerPage) + 1;
        setCurrentPage(targetPage);

        setTimeout(() => {
          const element = document.getElementById(`row-${highlightDate}`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 100);
      }
    }
  }, [highlightDate, sortedData]);

  const totalPages = Math.ceil(sortedData.length / rowsPerPage);
  const currentRows = sortedData.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  const isRateBenchmark = benchmarkName === 'CDI';

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden mt-8 transition-colors">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          <div className="text-left">
            <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200">
              Auditoria de Dados Históricos
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Visualize os dados brutos (Cotação Original vs Índice Oficial)
            </p>
          </div>
        </div>
        {isOpen ? (
          <ChevronUp className="w-5 h-5 text-gray-500" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-500" />
        )}
      </button>

      {isOpen && (
        <div className="p-0 border-t border-gray-200 dark:border-gray-700 animate-in slide-in-from-top-2">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-100 dark:bg-gray-900 text-gray-600 dark:text-gray-400 font-medium border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-6 py-3">Data</th>
                  <th className="px-6 py-3 text-right">
                    {isSpecificAsset ? `Preço ${assetTicker}` : 'Patrimônio Total'} <br />
                    <span className="text-[10px] font-normal opacity-70">
                      {isSpecificAsset ? '(Cotação Real)' : '(Soma Carteira)'}
                    </span>
                  </th>
                  <th className="px-6 py-3 text-right bg-yellow-50/50 dark:bg-yellow-900/10">
                    {benchmarkName} <br />
                    <span className="text-[10px] font-normal opacity-70">
                      {isRateBenchmark ? '(Taxa Diária %)' : '(Pontos Oficiais)'}
                    </span>
                  </th>
                  <th className="px-6 py-3 text-right">
                    Capital Benchmark <br />
                    <span className="text-[10px] font-normal opacity-70">(Normalizado)</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {currentRows.map((row, idx) => {
                  const isHighlighted = row.trade_date === highlightDate;
                  return (
                    <tr
                      key={idx}
                      id={`row-${row.trade_date}`}
                      className={`
                        transition-colors duration-500 
                        ${
                          isHighlighted
                            ? 'bg-blue-100 dark:bg-blue-900/40 ring-2 ring-inset ring-blue-500 z-10'
                            : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                        }
                      `}
                    >
                      <td className="px-6 py-3 font-mono text-gray-700 dark:text-gray-300">
                        {formatChartDate(row.trade_date)}
                      </td>

                      <td className="px-6 py-3 text-right font-medium text-gray-900 dark:text-gray-100">
                        {isSpecificAsset && row.asset_price_raw
                          ? formatCurrency(row.asset_price_raw)
                          : formatCurrency(row.portfolio_value)}
                      </td>

                      <td className="px-6 py-3 text-right font-mono text-yellow-700 dark:text-yellow-500 bg-yellow-50/30 dark:bg-yellow-900/5">
                        {row.benchmark_raw !== undefined ? (
                          isRateBenchmark ? (
                            `${formatDecimal(row.benchmark_raw, 6)}%`
                          ) : (
                            formatDecimal(row.benchmark_raw, 0)
                          )
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>

                      <td className="px-6 py-3 text-right text-gray-500 dark:text-gray-400">
                        {formatCurrency(row.benchmark_value)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Página {currentPage} de {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 text-xs font-medium rounded bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 disabled:opacity-50 text-gray-700 dark:text-gray-200"
              >
                Anterior
              </button>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 text-xs font-medium rounded bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 disabled:opacity-50 text-gray-700 dark:text-gray-200"
              >
                Próximo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
