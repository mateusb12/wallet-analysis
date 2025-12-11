import React, { useState, useEffect, useRef } from 'react';
import {
  fetchFiiDividends,
  fetchUniqueTickers,
  fetchFiiChartData,
} from '../../services/b3service.js';
import { getIpcaRange } from '../../services/ipcaService.js';
import Pagination from '../../components/Pagination.jsx';
import HistoryChart from './HistoryChart.jsx';
import { getIfixRange } from '../../services/ifixService.js';

function FiiHistoricalChecker() {
  const [ticker, setTicker] = useState('');

  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [tableData, setTableData] = useState([]);
  const [total, setTotal] = useState(0);

  const [chartData, setChartData] = useState([]);
  const [timeRange, setTimeRange] = useState(12);

  const [showTotalReturn, setShowTotalReturn] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchedTicker, setSearchedTicker] = useState('');
  const [tickerList, setTickerList] = useState([]);
  const [tickersLoading, setTickersLoading] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const inputRef = useRef(null);
  const comboboxRef = useRef(null);

  const loadTableData = async (pageToLoad, tickerToSearch = null) => {
    setLoading(true);
    setError(null);
    const tickerToFetch = tickerToSearch || searchedTicker;

    if (!tickerToFetch) {
      setLoading(false);
      return;
    }

    try {
      const { data, count } = await fetchFiiDividends(tickerToFetch, pageToLoad, pageSize);
      setTableData(data);
      setTotal(count);

      if (tickerToSearch) {
        setSearchedTicker(tickerToSearch);
      }
    } catch (err) {
      console.error(err);
      setError('Erro ao buscar dividendos.');
      setTableData([]);
    } finally {
      setLoading(false);
    }
  };

  const loadChartData = async (tickerToFetch) => {
    if (!tickerToFetch) return;

    try {
      console.log(`🔍 Iniciando carga do gráfico para: ${tickerToFetch}`);

      const fiiData = await fetchFiiChartData(tickerToFetch, timeRange);

      if (!fiiData || fiiData.length === 0) {
        console.warn('🔍 Sem dados de FII encontrados.');
        setChartData([]);
        return;
      }

      const sortedData = [...fiiData].sort(
        (a, b) => new Date(a.trade_date) - new Date(b.trade_date)
      );

      const startDate = sortedData[0].trade_date;
      const endDate = sortedData[sortedData.length - 1].trade_date;

      console.log('🔍 Range de Datas:', { startDate, endDate, totalRecords: sortedData.length });

      const [startYear, startMonth] = startDate.split('-').map(Number);
      const [endYear, endMonth] = endDate.split('-').map(Number);

      const [ipcaData, ifixData] = await Promise.all([
        getIpcaRange(startYear, startMonth, endYear, endMonth),
        getIfixRange(startDate, endDate),
      ]);

      const ifixMap = {};
      ifixData.forEach((item) => {
        ifixMap[item.trade_date] = parseFloat(item.close_value);
      });

      const ipcaMap = {};
      ipcaData.forEach((item) => {
        const key = item.ref_date.substring(0, 7);
        ipcaMap[key] = item.ipca;
      });

      const basePrice = parseFloat(sortedData[0].purchase_price);

      const baseIfix = ifixData.length > 0 ? parseFloat(ifixData[0].close_value) : null;

      console.log('🔍 Âncoras (t=0):', {
        basePrice,
        baseIfix,
        startDateOfAsset: startDate,
        firstDateOfIfix: ifixData.length > 0 ? ifixData[0].trade_date : 'N/A',
      });

      let ipcaAccumulatedFactor = 1.0;
      let ipcaProcessedMonth = '';
      let accumulatedShares = 1.0;
      let dividendProcessedMonth = '';

      const mergedData = sortedData.map((dayData, index) => {
        const fullDateKey = dayData.trade_date;
        const dateKey = fullDateKey.substring(0, 7);

        const currentPrice = parseFloat(dayData.purchase_price);
        const currentDividend = parseFloat(dayData.dividend_value || 0);

        if (dateKey !== ipcaProcessedMonth && ipcaMap[dateKey] !== undefined && index > 0) {
          const monthlyRate = ipcaMap[dateKey] / 100;
          ipcaAccumulatedFactor *= 1 + monthlyRate;
          ipcaProcessedMonth = dateKey;
        }

        if (currentDividend > 0 && dateKey !== dividendProcessedMonth) {
          const totalCashReceived = currentDividend * accumulatedShares;
          if (currentPrice > 0) {
            const newSharesPurchased = totalCashReceived / currentPrice;
            accumulatedShares += newSharesPurchased;
          }
          dividendProcessedMonth = dateKey;
        }

        let ifixProjection = null;

        const currentIfix = ifixMap[fullDateKey];

        if (baseIfix && currentIfix) {
          const ifixFactor = currentIfix / baseIfix;
          ifixProjection = basePrice * ifixFactor;

          if (index < 3) {
            console.log(`🔍 Row ${index} [${fullDateKey}]:`, {
              basePrice,
              baseIfix,
              currentIfix,
              factor: ifixFactor.toFixed(4),
              result: ifixProjection.toFixed(2),
            });
          }
        } else if (index < 3) {
          console.warn(
            `⚠️ Row ${index} [${fullDateKey}]: IFIX missing for this date. Map has it? ${!!currentIfix}`
          );
        }

        return {
          ...dayData,
          ipca_projection: basePrice * ipcaAccumulatedFactor,
          ifix_projection: ifixProjection,
          total_return: currentPrice * accumulatedShares,
        };
      });

      setChartData([...mergedData].reverse());
    } catch (err) {
      console.error('❌ Erro ao carregar gráfico', err);
    }
  };

  useEffect(() => {
    async function loadTickers() {
      setTickersLoading(true);
      try {
        const tickers = await fetchUniqueTickers();
        setTickerList(tickers);
        const defaultTicker = tickers.includes('BPFF11') ? 'BPFF11' : tickers[0] || '';
        if (defaultTicker) {
          setTicker(defaultTicker);
          loadTableData(1, defaultTicker);
          setSearchedTicker(defaultTicker);
        }
      } catch (err) {
        setError('Erro ao carregar tickers.');
      } finally {
        setTickersLoading(false);
      }
    }
    loadTickers();
  }, []);

  useEffect(() => {
    if (searchedTicker && page > 1) {
      loadTableData(page);
    }
  }, [page]);

  useEffect(() => {
    if (searchedTicker) {
      loadChartData(searchedTicker);
    }
  }, [timeRange, searchedTicker]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (ticker) {
      setPage(1);
      setSearchedTicker(ticker);
      loadTableData(1, ticker);
      setIsDropdownOpen(false);
    }
  };

  const handlePageChange = (newPage) => setPage(newPage);
  const filteredTickers = tickerList.filter((t) => t.toLowerCase().includes(ticker.toLowerCase()));
  const handleBlur = (e) => {
    if (comboboxRef.current && !comboboxRef.current.contains(e.relatedTarget)) {
      setIsDropdownOpen(false);
    }
  };

  const getRangeLabel = (val) => {
    if (val >= 60) return '5 Anos';
    if (val >= 24) return `${val / 12} Anos`;
    if (val === 12) return '1 Ano';
    return `${val} Meses`;
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="p-8 dark:bg-gray-900 min-h-screen">
      <h2 className="text-3xl font-bold mb-6 text-gray-800 dark:text-gray-100">
        Histórico de Dividendos de FIIs
      </h2>

      {}
      <div className="border border-gray-500 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 max-w-2xl mb-8">
        <form onSubmit={handleSearch} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Ticker do FII
            </label>
            <div className="relative" ref={comboboxRef} onBlur={handleBlur}>
              <input
                ref={inputRef}
                type="text"
                value={ticker}
                onChange={(e) => {
                  setTicker(e.target.value);
                  setIsDropdownOpen(true);
                }}
                onFocus={() => setIsDropdownOpen(true)}
                placeholder="Digite ou selecione um ticker"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 pr-10"
              />
              <button
                type="button"
                onClick={() => {
                  setIsDropdownOpen(!isDropdownOpen);
                  inputRef.current.focus();
                }}
                className="absolute inset-y-0 right-0 flex items-center justify-center w-10 h-full text-gray-500 dark:text-gray-400"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
              {isDropdownOpen && (
                <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {filteredTickers.map((t) => (
                    <div
                      key={t}
                      className="px-4 py-2 hover:bg-blue-100 dark:hover:bg-gray-600 cursor-pointer text-gray-800 dark:text-gray-200"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setTicker(t);
                        setIsDropdownOpen(false);
                      }}
                    >
                      {t}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
          >
            {loading ? 'Buscando...' : 'Buscar Dividendos'}
          </button>
        </form>
      </div>

      <div className="mt-8 max-w-6xl space-y-6">
        {error && <p className="mt-6 text-red-500">{error}</p>}

        {!error && searchedTicker && (
          <div className="border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <div className="mb-8">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div className="flex flex-col gap-2">
                  <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200">
                    Evolução ({getRangeLabel(timeRange)})
                  </h3>

                  <div className="flex items-center space-x-2">
                    <input
                      id="totalReturnCheck"
                      type="checkbox"
                      checked={showTotalReturn}
                      onChange={(e) => setShowTotalReturn(e.target.checked)}
                      className="w-4 h-4 text-blue-600 bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500 cursor-pointer"
                    />
                    <label
                      htmlFor="totalReturnCheck"
                      className="text-sm font-medium text-purple-700 dark:text-purple-400 cursor-pointer select-none"
                    >
                      Mostrar Retorno Total (Cota + Div)
                    </label>
                  </div>
                </div>

                <div className="w-full md:w-1/3">
                  <label
                    htmlFor="timeRange"
                    className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1"
                  >
                    Janela de Tempo:{' '}
                    <span className="text-blue-600 dark:text-blue-400 font-bold">
                      {getRangeLabel(timeRange)}
                    </span>
                  </label>
                  <input
                    id="timeRange"
                    type="range"
                    min="6"
                    max="60"
                    step="6"
                    value={timeRange}
                    onChange={(e) => setTimeRange(Number(e.target.value))}
                    className="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>6m</span>
                    <span>1a</span>
                    <span>3a</span>
                    <span>5a</span>
                  </div>
                </div>
              </div>

              {}
              <div className="border border-gray-200 dark:border-gray-700 rounded p-4 bg-gray-50 dark:bg-gray-900">
                {chartData.length > 0 ? (
                  <HistoryChart data={chartData} showTotalReturn={showTotalReturn} />
                ) : (
                  <p className="text-center text-gray-500 py-10">Carregando gráfico...</p>
                )}
              </div>
            </div>

            {tableData.length > 0 ? (
              <>
                <p className="text-gray-700 dark:text-gray-300 text-sm mb-4">
                  Exibindo página {page} de {totalPages} ({total} registros totais)
                </p>

                <div
                  className={`overflow-x-auto transition-opacity duration-300 ${loading ? 'opacity-50' : 'opacity-100'}`}
                >
                  <table className="w-full border-collapse border border-gray-300 dark:border-gray-700 text-sm">
                    <thead className="bg-gray-100 dark:bg-gray-900">
                      <tr>
                        <th className="border border-gray-300 dark:border-gray-700 px-2 py-1 text-left dark:text-gray-200">
                          Data
                        </th>
                        <th className="border border-gray-300 dark:border-gray-700 px-2 py-1 text-left dark:text-gray-200">
                          Abertura
                        </th>
                        <th className="border border-gray-300 dark:border-gray-700 px-2 py-1 text-left dark:text-gray-200">
                          Fechamento
                        </th>
                        <th className="border border-gray-300 dark:border-gray-700 px-2 py-1 text-left dark:text-gray-200">
                          Yield
                        </th>
                        <th className="border border-gray-300 dark:border-gray-700 px-2 py-1 text-left dark:text-gray-200">
                          Dividendo
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {tableData.map((row) => (
                        <tr
                          key={`${row.ticker}-${row.trade_date}`}
                          className="hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-300"
                        >
                          <td className="border border-gray-300 dark:border-gray-700 px-2 py-1">
                            {row.trade_date}
                          </td>
                          <td className="border border-gray-300 dark:border-gray-700 px-2 py-1">
                            R$ {parseFloat(row.open).toFixed(2)}
                          </td>
                          <td className="border border-gray-300 dark:border-gray-700 px-2 py-1">
                            R$ {parseFloat(row.purchase_price).toFixed(2)}
                          </td>
                          <td className="border border-gray-300 dark:border-gray-700 px-2 py-1 text-blue-600 dark:text-blue-400">
                            {(parseFloat(row.dividend_yield_month) * 100).toFixed(2)}%
                          </td>
                          <td className="border border-gray-300 dark:border-gray-700 px-2 py-1 text-green-700 dark:text-green-400 font-medium">
                            R$ {parseFloat(row.dividend_value).toFixed(4)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-6">
                  <Pagination
                    currentPage={page}
                    totalPages={totalPages}
                    onPageChange={handlePageChange}
                  />
                </div>
              </>
            ) : (
              <p className="text-gray-600 dark:text-gray-400">Nenhum dado encontrado na tabela.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default FiiHistoricalChecker;
